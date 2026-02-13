/**
 * question.js
 * PhysFlow - Question Detail Page Logic
 * Modular Vanilla JS | Supabase | Quill | MathJax
 */

import { supabase } from './supabase-config.js';

// ─────────────────────────────────────────────
//  CONSTANTS & STATE
// ─────────────────────────────────────────────

const ANSWERS_PER_PAGE = 5;
const MIN_ANSWER_LENGTH = 30;

let state = {
    questionId: null,
    question: null,
    answers: [],
    currentPage: 0,        // offset pages loaded (0-based)
    totalAnswers: 0,
    sortBy: 'votes',       // 'votes' | 'newest' | 'oldest'
    currentUserId: null,
    quillEditor: null,
    previewVisible: false,
    bookmarked: false,
};

// ─────────────────────────────────────────────
//  ENTRY POINT
// ─────────────────────────────────────────────

/**
 * initQuestionPage
 * Called from question.html after layout/auth setup.
 */
export async function initQuestionPage() {
    // 1. Extract question id from URL
    const params = new URLSearchParams(window.location.search);
    state.questionId = params.get('id');

    // 2. If no id in URL → clean 404 UI
    if (!state.questionId) {
        showNotFound('প্রশ্নের আইডি পাওয়া যায়নি।');
        return;
    }

    // 3. Get current user (if logged in)
    const { data: { user } } = await supabase.auth.getUser();
    state.currentUserId = user?.id ?? null;

    // 4. Fetch & render question
    await loadQuestion();

    // 5. Bind UI events (non-question-specific)
    bindSortChange();
    bindLoadMore();
    bindShareButton();
    bindBookmarkButton();
    // FAB + editor + submit are initialized inside loadQuestion after question loads
}

// ─────────────────────────────────────────────
//  FETCH & RENDER QUESTION
// ─────────────────────────────────────────────

async function loadQuestion() {
    showSkeleton(true);

    const { data: question, error } = await supabase
        .from('question')
        .select('*')
        .eq('id', state.questionId)
        .single();

    showSkeleton(false);

    if (error || !question) {
        showNotFound('প্রশ্নটি পাওয়া যায়নি বা মুছে ফেলা হয়েছে।');
        return;
    }

    state.question = question;

    // Increment view (once per session)
    incrementViewCount();

    // Render question UI (author loaded inside renderQuestion)
    renderQuestion(question);

    // SEO meta injection
    injectSEOMeta(question);

    // Fetch answers (first page)
    await loadAnswers(true);

    // Fetch related questions
    loadRelatedQuestions();

    // Init FAB + answer modal
    initAnswerModal();

    // Bind answer submit & preview
    bindSubmitAnswer();
    bindPreviewToggle();

    // Show content
    document.getElementById('question-content').classList.remove('hidden');
}

function renderQuestion(q) {
    // Title
    document.getElementById('question-title').textContent = q.title;

    // Views
    document.getElementById('question-views').innerHTML =
        `<i class="far fa-eye"></i> ${formatNumber(q.views ?? 0)} বার দেখা হয়েছে`;

    // Vote count
    document.getElementById('q-vote-count').textContent = q.votes ?? 0;

    // Body (sanitized HTML from Quill)
    const bodyEl = document.getElementById('question-body');
    bodyEl.innerHTML = sanitizeHTML(q.body ?? '');
    typesetMath(bodyEl);

    // Tags
    renderTags(q.tags ?? []);

    // Edit button: show only for question author
    if (state.currentUserId && state.currentUserId === q.author_id) {
        document.getElementById('q-edit-btn').classList.remove('hidden');
    }

    // Vote button events
    bindQuestionVotes(q);

    // Author card (async — fills in once profile loaded)
    fetchAuthorProfile(q.author_id).then(profile => {
        const avatarEl = document.getElementById('question-author-avatar');
        const nameEl   = document.getElementById('question-author-name');
        const timeEl   = document.getElementById('question-timeago');
        const linkEls  = document.querySelectorAll('#question-author-link, #question-author-name');

        if (profile.avatar_url) {
            avatarEl.src = profile.avatar_url;
            avatarEl.onerror = () => {
                avatarEl.style.display = 'none';
                // Insert initials span
                const span = document.createElement('span');
                span.className = 'w-8 h-8 rounded-full author-avatar shrink-0 flex items-center justify-center text-sm font-semibold';
                span.textContent = getInitials(profile.name);
                avatarEl.parentNode.replaceChild(span, avatarEl);
            };
        } else {
            // No avatar → show initials
            avatarEl.style.display = 'none';
            const span = document.createElement('span');
            span.className = 'w-8 h-8 rounded-full author-avatar shrink-0 inline-flex items-center justify-center text-sm font-semibold';
            span.textContent = getInitials(profile.name);
            avatarEl.parentNode.insertBefore(span, avatarEl);
        }

        if (nameEl) {
            nameEl.textContent = profile.name;
            nameEl.href = `user.html?id=${q.author_id}`;
        }
        const authorLink = document.getElementById('question-author-link');
        if (authorLink) authorLink.href = `user.html?id=${q.author_id}`;

        if (timeEl) timeEl.textContent = timeAgo(q.created_at);
    });
}

function renderTags(tags) {
    const container = document.getElementById('question-tags');
    container.innerHTML = '';
    if (!tags || tags.length === 0) return;
    tags.forEach(tag => {
        const span = document.createElement('a');
        span.href = `questions.html?tag=${encodeURIComponent(tag)}`;
        span.className = 'tag-badge';
        span.textContent = tag;
        container.appendChild(span);
    });
}

// ─────────────────────────────────────────────
//  FETCH & RENDER ANSWERS
// ─────────────────────────────────────────────

/**
 * loadAnswers
 * @param {boolean} reset - If true, clear existing list and start from page 0
 */
async function loadAnswers(reset = false) {
    if (reset) {
        state.currentPage = 0;
        state.answers = [];
        document.getElementById('answer-list').innerHTML = '';
    }

    const offset = state.currentPage * ANSWERS_PER_PAGE;

    // Build query with sort
    let query = supabase
        .from('answer')
        .select('*', { count: 'exact' })
        .eq('question_id', state.questionId)
        .range(offset, offset + ANSWERS_PER_PAGE - 1);

    // Sorting logic: accepted first, then by sort preference
    if (state.sortBy === 'newest') {
        query = query.order('is_accepted', { ascending: false })
                     .order('created_at', { ascending: false });
    } else if (state.sortBy === 'oldest') {
        query = query.order('is_accepted', { ascending: false })
                     .order('created_at', { ascending: true });
    } else {
        // Default: votes (best)
        query = query.order('is_accepted', { ascending: false })
                     .order('votes', { ascending: false })
                     .order('created_at', { ascending: true });
    }

    const { data: answers, error, count } = await query;

    if (error) {
        console.error('Error fetching answers:', error);
        return;
    }

    state.totalAnswers = count ?? 0;
    state.answers = reset ? (answers ?? []) : [...state.answers, ...(answers ?? [])];

    // Update heading
    document.getElementById('answer-count-num').textContent = state.totalAnswers;

    // Render answers
    const list = document.getElementById('answer-list');
    (answers ?? []).forEach(answer => {
        list.appendChild(createAnswerCard(answer));
    });

    // Typeset all new math
    typesetMath(list);

    // Show/hide Load More
    const loaded = state.currentPage * ANSWERS_PER_PAGE + ANSWERS_PER_PAGE;
    const loadMoreContainer = document.getElementById('load-more-container');
    if (state.totalAnswers > loaded) {
        loadMoreContainer.classList.remove('hidden');
    } else {
        loadMoreContainer.classList.add('hidden');
    }

    // Inject structured data (JSON-LD) after answers loaded
    injectStructuredData(state.question, state.answers);
}

/**
 * createAnswerCard
 * Builds the DOM element for a single answer.
 * Layout:
 *   [vote panel]  [author chip]
 *                 [answer body]
 *                 [accepted badge / reply button]
 */
function createAnswerCard(answer) {
    const isAccepted      = answer.is_accepted === true;
    const isQuestionAuthor = state.currentUserId && state.currentUserId === state.question?.author_id;

    const card = document.createElement('div');
    card.id = `answer-${answer.id}`;
    card.className = [
        'flex gap-4 pb-6 border-b border-gray-200 dark:border-gray-700',
        'border-l-4 pl-3',
        isAccepted
            ? 'border-l-green-500 dark:border-l-green-400 bg-green-50/30 dark:bg-green-900/5 answer-accepted'
            : 'border-l-transparent'
    ].join(' ');

    // ── Vote panel ──────────────────────────────
    const votePanel = document.createElement('div');
    votePanel.className = 'flex flex-col items-center gap-1.5 pt-8 shrink-0';
    votePanel.innerHTML = `
        <button class="vote-btn answer-vote-up" data-id="${answer.id}" title="উপভোট">
            <i class="fas fa-chevron-up text-sm"></i>
        </button>
        <span class="answer-vote-count text-base font-semibold text-gray-700 dark:text-gray-300 min-w-[24px] text-center">
            ${answer.votes ?? 0}
        </span>
        <button class="vote-btn answer-vote-down" data-id="${answer.id}" title="ডাউনভোট">
            <i class="fas fa-chevron-down text-sm"></i>
        </button>
        ${isAccepted
            ? `<div class="mt-3 text-green-600 dark:text-green-400" title="গৃহীত উত্তর">
                   <i class="fas fa-check-circle text-xl"></i>
               </div>`
            : isQuestionAuthor
                ? `<button class="accept-answer-btn mt-3 vote-btn text-gray-400 hover:text-green-600 hover:border-green-500"
                           data-id="${answer.id}" title="এই উত্তরটি গ্রহণ করুন">
                       <i class="fas fa-check text-sm"></i>
                   </button>`
                : ''
        }
    `;

    // ── Body container ──────────────────────────
    const bodyContainer = document.createElement('div');
    bodyContainer.className = 'flex-1 min-w-0';

    // Author chip placeholder (filled async)
    const authorChip = document.createElement('div');
    authorChip.className = 'answer-author-chip mb-3';
    authorChip.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="w-7 h-7 rounded-full author-avatar shrink-0 inline-flex items-center justify-center text-xs skeleton"></span>
            <div class="flex flex-col leading-tight">
                <span class="text-[13px] font-medium text-gray-400 skeleton w-20 h-3 rounded"></span>
                <span class="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 skeleton w-14 h-2.5 rounded mt-1"></span>
            </div>
        </div>`;

    // Answer body
    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'answer-body prose prose-sm max-w-none text-gray-800 dark:text-gray-200 leading-relaxed mb-4';
    bodyDiv.innerHTML = sanitizeHTML(answer.body ?? '');

    // Footer row
    const footerRow = document.createElement('div');
    footerRow.className = 'flex items-center gap-3 flex-wrap';

    if (isAccepted) {
        // Accepted: show badge only, no reply
        footerRow.innerHTML = `
            <span class="text-green-600 dark:text-green-400 text-[12px] font-medium flex items-center gap-1">
                <i class="fas fa-check-circle"></i> গৃহীত উত্তর
            </span>`;
    } else {
        // Not accepted: reply button
        footerRow.innerHTML = `
            <button class="reply-toggle-btn action-btn flex items-center gap-1 text-[12px]"
                    data-id="${answer.id}">
                <i class="fas fa-reply text-[11px]"></i> রিপ্লাই
            </button>`;
    }

    // Inline reply box (hidden by default)
    const replyBox = document.createElement('div');
    replyBox.className = 'reply-box hidden mt-3';
    replyBox.id = `reply-box-${answer.id}`;
    replyBox.innerHTML = `
        <div class="reply-editor-${answer.id} mb-2 rounded border border-gray-300 dark:border-gray-600 overflow-hidden"></div>
        <div class="flex items-center gap-2 mt-2">
            <button class="reply-submit-btn bg-[#0056b3] hover:bg-[#004494] text-white px-4 py-1.5 rounded text-xs font-medium transition
                           disabled:opacity-50 flex items-center gap-1.5">
                <span class="reply-submit-text">রিপ্লাই করুন</span>
                <span class="reply-spinner hidden"><i class="fas fa-spinner fa-spin text-xs"></i></span>
            </button>
            <button class="reply-cancel-btn text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                বাতিল
            </button>
            <span class="reply-validation text-red-500 text-xs hidden">কমপক্ষে ৩০ অক্ষর লিখুন।</span>
        </div>`;

    bodyContainer.appendChild(authorChip);
    bodyContainer.appendChild(bodyDiv);
    bodyContainer.appendChild(footerRow);
    bodyContainer.appendChild(replyBox);

    card.appendChild(votePanel);
    card.appendChild(bodyContainer);

    // ── Populate author chip (async) ────────────
    fetchAuthorProfile(answer.author_id).then(profile => {
        authorChip.innerHTML = buildAuthorChip(profile, answer.author_id, answer.created_at, false);
    });

    // ── Vote events ─────────────────────────────
    votePanel.querySelector('.answer-vote-up')
        .addEventListener('click', () => handleAnswerVote(answer.id, 'up', card));
    votePanel.querySelector('.answer-vote-down')
        .addEventListener('click', () => handleAnswerVote(answer.id, 'down', card));

    // ── Accept event ────────────────────────────
    votePanel.querySelector('.accept-answer-btn')
        ?.addEventListener('click', () => handleAcceptAnswer(answer.id));

    // ── Reply toggle ────────────────────────────
    if (!isAccepted) {
        const replyToggleBtn = footerRow.querySelector('.reply-toggle-btn');
        let replyQuill = null;

        replyToggleBtn.addEventListener('click', () => {
            const isOpen = !replyBox.classList.contains('hidden');
            if (isOpen) {
                replyBox.classList.add('hidden');
                replyToggleBtn.innerHTML = '<i class="fas fa-reply text-[11px]"></i> রিপ্লাই';
                return;
            }

            replyBox.classList.remove('hidden');
            replyToggleBtn.innerHTML = '<i class="fas fa-times text-[11px]"></i> বন্ধ করুন';

            // Init Quill for reply (only once per answer)
            if (!replyQuill) {
                replyQuill = new Quill(`.reply-editor-${answer.id}`, {
                    theme: 'snow',
                    placeholder: 'এই উত্তরে রিপ্লাই করুন...',
                    modules: {
                        toolbar: [
                            ['bold', 'italic', 'code-block'],
                            ['link', 'formula'],
                        ]
                    }
                });
                // Dark mode
                if (document.documentElement.classList.contains('dark')) {
                    const c = replyBox.querySelector('.ql-container');
                    const t = replyBox.querySelector('.ql-toolbar');
                    if (c) { c.style.background = '#161616'; c.style.color = '#e5e5e5'; c.style.borderColor = '#374151'; }
                    if (t) { t.style.background = '#202020'; t.style.borderColor = '#374151'; }
                }
            }

            // Submit reply
            const submitBtn   = replyBox.querySelector('.reply-submit-btn');
            const submitText  = replyBox.querySelector('.reply-submit-text');
            const spinner     = replyBox.querySelector('.reply-spinner');
            const validation  = replyBox.querySelector('.reply-validation');
            const cancelBtn   = replyBox.querySelector('.reply-cancel-btn');

            // Remove old listener to avoid duplicates
            const newSubmitBtn = submitBtn.cloneNode(true);
            submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);

            newSubmitBtn.addEventListener('click', async () => {
                if (!state.currentUserId) { showLoginAlert(); return; }

                const html = replyQuill.root.innerHTML;
                const text = replyQuill.getText().trim();

                if (text.length < MIN_ANSWER_LENGTH) {
                    validation.classList.remove('hidden');
                    return;
                }
                validation.classList.add('hidden');

                // Loading
                newSubmitBtn.disabled = true;
                spinner.classList.remove('hidden');
                submitText.textContent = 'পাঠানো হচ্ছে...';

                const { data: newAnswer, error } = await supabase
                    .from('answer')
                    .insert({
                        question_id:      state.questionId,
                        body:             html,
                        author_id:        state.currentUserId,
                        votes:            0,
                        is_accepted:      false,
                        parent_answer_id: answer.id,   // optional FK if column exists
                    })
                    .select()
                    .single();

                newSubmitBtn.disabled = false;
                spinner.classList.add('hidden');
                submitText.textContent = 'রিপ্লাই করুন';

                if (error) {
                    console.error('Reply submit error:', error);
                    alert('রিপ্লাই পাঠাতে সমস্যা হয়েছে।');
                    return;
                }

                // Append new answer card
                state.totalAnswers++;
                document.getElementById('answer-count-num').textContent = state.totalAnswers;
                const list = document.getElementById('answer-list');
                const newCard = createAnswerCard(newAnswer);
                list.appendChild(newCard);
                typesetMath(newCard);
                newCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

                // Close reply box
                replyQuill.setContents([]);
                replyBox.classList.add('hidden');
                replyToggleBtn.innerHTML = '<i class="fas fa-reply text-[11px]"></i> রিপ্লাই';
            });

            cancelBtn.addEventListener('click', () => {
                replyBox.classList.add('hidden');
                replyToggleBtn.innerHTML = '<i class="fas fa-reply text-[11px]"></i> রিপ্লাই';
            });
        });
    }

    return card;
}

// ─────────────────────────────────────────────
//  VOTE LOGIC - QUESTION
// ─────────────────────────────────────────────

function bindQuestionVotes(q) {
    const upBtn = document.getElementById('q-vote-up');
    const downBtn = document.getElementById('q-vote-down');
    const countEl = document.getElementById('q-vote-count');

    // Restore vote state from sessionStorage
    const voteKey = `q_vote_${q.id}`;
    const existingVote = sessionStorage.getItem(voteKey); // 'up' | 'down' | null
    if (existingVote === 'up') upBtn.classList.add('active-up');
    if (existingVote === 'down') downBtn.classList.add('active-down');

    upBtn.addEventListener('click', async () => {
        if (!state.currentUserId) { showLoginAlert(); return; }
        const prev = sessionStorage.getItem(voteKey);
        if (prev === 'up') return; // already voted up

        // Optimistic update
        const currentVotes = parseInt(countEl.textContent) || 0;
        const delta = prev === 'down' ? 2 : 1;
        countEl.textContent = currentVotes + delta;
        upBtn.classList.add('active-up');
        downBtn.classList.remove('active-down');
        sessionStorage.setItem(voteKey, 'up');

        // Persist
        const { error } = await supabase
            .from('question')
            .update({ votes: currentVotes + delta })
            .eq('id', q.id);
        if (error) console.error('Vote error:', error);
    });

    downBtn.addEventListener('click', async () => {
        if (!state.currentUserId) { showLoginAlert(); return; }
        const prev = sessionStorage.getItem(voteKey);
        if (prev === 'down') return;

        const currentVotes = parseInt(countEl.textContent) || 0;
        const delta = prev === 'up' ? 2 : 1;
        countEl.textContent = currentVotes - delta;
        downBtn.classList.add('active-down');
        upBtn.classList.remove('active-up');
        sessionStorage.setItem(voteKey, 'down');

        const { error } = await supabase
            .from('question')
            .update({ votes: currentVotes - delta })
            .eq('id', q.id);
        if (error) console.error('Vote error:', error);
    });
}

// ─────────────────────────────────────────────
//  VOTE LOGIC - ANSWER
// ─────────────────────────────────────────────

async function handleAnswerVote(answerId, direction, cardEl) {
    if (!state.currentUserId) { showLoginAlert(); return; }

    const voteKey = `a_vote_${answerId}`;
    const prev = sessionStorage.getItem(voteKey);
    if (prev === direction) return; // already voted this direction

    const countEl = cardEl.querySelector('.answer-vote-count');
    const current = parseInt(countEl.textContent) || 0;
    const delta = (direction === 'up')
        ? (prev === 'down' ? 2 : 1)
        : (prev === 'up' ? -2 : -1);

    // Optimistic UI
    const newVotes = current + delta;
    countEl.textContent = newVotes;

    const upBtn = cardEl.querySelector('.answer-vote-up');
    const downBtn = cardEl.querySelector('.answer-vote-down');
    if (direction === 'up') {
        upBtn.classList.add('active-up');
        downBtn.classList.remove('active-down');
    } else {
        downBtn.classList.add('active-down');
        upBtn.classList.remove('active-up');
    }
    sessionStorage.setItem(voteKey, direction);

    // Persist
    const { error } = await supabase
        .from('answer')
        .update({ votes: newVotes })
        .eq('id', answerId);
    if (error) console.error('Answer vote error:', error);
}

// ─────────────────────────────────────────────
//  ACCEPT ANSWER LOGIC
// ─────────────────────────────────────────────

async function handleAcceptAnswer(answerId) {
    if (!state.currentUserId || !state.question) return;
    if (state.currentUserId !== state.question.author_id) return;

    // Set all answers to is_accepted = false
    const { error: resetError } = await supabase
        .from('answer')
        .update({ is_accepted: false })
        .eq('question_id', state.questionId);

    if (resetError) { console.error('Accept reset error:', resetError); return; }

    // Set selected answer to is_accepted = true
    const { error: acceptError } = await supabase
        .from('answer')
        .update({ is_accepted: true })
        .eq('id', answerId);

    if (acceptError) { console.error('Accept error:', acceptError); return; }

    // Reload answers to reflect new order
    await loadAnswers(true);
}

// ─────────────────────────────────────────────
//  VIEW COUNT (once per session)
// ─────────────────────────────────────────────

async function incrementViewCount() {
    const viewedKey = `viewed_${state.questionId}`;
    if (sessionStorage.getItem(viewedKey)) return; // already viewed this session

    sessionStorage.setItem(viewedKey, 'true');

    // Increment view count atomically via RPC or simple update
    const currentViews = state.question?.views ?? 0;
    await supabase
        .from('question')
        .update({ views: currentViews + 1 })
        .eq('id', state.questionId);
}

// ─────────────────────────────────────────────
//  SORT ANSWERS
// ─────────────────────────────────────────────

function bindSortChange() {
    const sortSelect = document.getElementById('answer-sort');
    sortSelect.addEventListener('change', async (e) => {
        state.sortBy = e.target.value;
        await loadAnswers(true);
    });
}

// ─────────────────────────────────────────────
//  PAGINATION - LOAD MORE
// ─────────────────────────────────────────────

function bindLoadMore() {
    document.getElementById('load-more-btn').addEventListener('click', async () => {
        state.currentPage++;
        await loadAnswers(false);
    });
}

// ─────────────────────────────────────────────
//  FAB + ANSWER MODAL
// ─────────────────────────────────────────────

/**
 * Show the FAB once the question is loaded.
 * Bind open/close events for the answer modal.
 */
function initAnswerModal() {
    const fab        = document.getElementById('fab-answer-btn');
    const overlay    = document.getElementById('answer-modal-overlay');
    const modal      = document.getElementById('answer-modal');
    const closeBtn   = document.getElementById('answer-modal-close');
    const cancelBtn  = document.getElementById('answer-modal-cancel');
    const titlePrev  = document.getElementById('modal-question-title-preview');

    // Show FAB
    fab.classList.remove('hidden');

    // Fill mini title in modal header
    if (titlePrev && state.question?.title) {
        titlePrev.textContent = state.question.title;
    }

    // Open modal
    const openModal = () => {
        overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        // Small delay so transition fires
        requestAnimationFrame(() => {
            requestAnimationFrame(() => modal.classList.add('modal-open'));
        });
        // Init Quill lazily (only once)
        if (!state.quillEditor) initQuillEditor();
    };

    // Close modal
    const closeModal = () => {
        modal.classList.remove('modal-open');
        setTimeout(() => {
            overlay.classList.add('hidden');
            document.body.style.overflow = '';
        }, 300);
    };

    fab.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Close on overlay click (outside modal)
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeModal();
    });
}

// ─────────────────────────────────────────────
//  QUILL EDITOR INITIALIZATION (lazy — called on first modal open)
// ─────────────────────────────────────────────

function initQuillEditor() {
    // If not logged in, hide editor and show notice
    if (!state.currentUserId) {
        document.getElementById('answer-editor').classList.add('hidden');
        document.getElementById('submit-answer-btn').classList.add('hidden');
        document.getElementById('preview-toggle-btn').classList.add('hidden');
        document.getElementById('login-required-notice').classList.remove('hidden');
        return;
    }

    state.quillEditor = new Quill('#answer-editor', {
        theme: 'snow',
        placeholder: 'আপনার উত্তর এখানে লিখুন… (LaTeX: $E=mc^2$ অথবা $$\\frac{d^2x}{dt^2}$$)',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline', 'strike'],
                ['blockquote', 'code-block'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                ['link', 'image', 'formula'],
                ['clean']
            ]
        }
    });

    // Dark mode styles
    if (document.documentElement.classList.contains('dark')) applyQuillDarkMode();
}

function applyQuillDarkMode() {
    const qlContainer = document.querySelector('#answer-editor .ql-container');
    const qlToolbar   = document.querySelector('#answer-editor .ql-toolbar');
    if (qlContainer) {
        qlContainer.style.background  = '#161616';
        qlContainer.style.color       = '#e5e5e5';
        qlContainer.style.borderColor = '#444';
    }
    if (qlToolbar) {
        qlToolbar.style.background  = '#252525';
        qlToolbar.style.borderColor = '#444';
    }
}

// ─────────────────────────────────────────────
//  SUBMIT ANSWER
// ─────────────────────────────────────────────

function bindSubmitAnswer() {
    const submitBtn = document.getElementById('submit-answer-btn');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', async () => {
        const editor = state.quillEditor;
        if (!editor) return;

        const html = editor.root.innerHTML;
        const text = editor.getText().trim();

        // Validation
        const validationMsg = document.getElementById('answer-validation-msg');
        if (text.length < MIN_ANSWER_LENGTH) {
            validationMsg.classList.remove('hidden');
            return;
        }
        validationMsg.classList.add('hidden');

        // Show loading state
        setSubmitLoading(true);

        const { data: newAnswer, error } = await supabase
            .from('answer')
            .insert({
                question_id: state.questionId,
                body: html,
                author_id: state.currentUserId,
                votes: 0,
                is_accepted: false,
            })
            .select()
            .single();

        setSubmitLoading(false);

        if (error) {
            console.error('Submit answer error:', error);
            alert('উত্তর জমা দিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
            return;
        }

        // Update count
        state.totalAnswers++;
        document.getElementById('answer-count-num').textContent = state.totalAnswers;

        // Append new answer to list without reload
        const list = document.getElementById('answer-list');
        const card = createAnswerCard(newAnswer);
        list.appendChild(card);
        typesetMath(card);

        // Scroll to new answer
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Clear editor
        editor.setContents([]);

        // Close modal
        const modal   = document.getElementById('answer-modal');
        const overlay = document.getElementById('answer-modal-overlay');
        modal.classList.remove('modal-open');
        setTimeout(() => {
            overlay.classList.add('hidden');
            document.body.style.overflow = '';
        }, 300);

        // Update structured data
        injectStructuredData(state.question, [...state.answers, newAnswer]);
    });
}

function setSubmitLoading(loading) {
    const btn = document.getElementById('submit-answer-btn');
    const spinner = document.getElementById('submit-spinner');
    const btnText = document.getElementById('submit-btn-text');
    btn.disabled = loading;
    spinner.classList.toggle('hidden', !loading);
    btnText.textContent = loading ? 'জমা হচ্ছে...' : 'উত্তর জমা দিন';
}

// ─────────────────────────────────────────────
//  PREVIEW TOGGLE
// ─────────────────────────────────────────────

function bindPreviewToggle() {
    const toggleBtn = document.getElementById('preview-toggle-btn');
    const previewPanel = document.getElementById('answer-preview');
    if (!toggleBtn) return;

    toggleBtn.addEventListener('click', () => {
        state.previewVisible = !state.previewVisible;
        if (state.previewVisible) {
            const html = state.quillEditor?.root.innerHTML ?? '';
            previewPanel.innerHTML = sanitizeHTML(html);
            previewPanel.classList.remove('hidden');
            typesetMath(previewPanel);
            toggleBtn.innerHTML = '<i class="fas fa-eye-slash mr-1"></i> প্রিভিউ লুকান';
        } else {
            previewPanel.classList.add('hidden');
            toggleBtn.innerHTML = '<i class="fas fa-eye mr-1"></i> প্রিভিউ';
        }
    });
}

// ─────────────────────────────────────────────
//  SHARE BUTTON
// ─────────────────────────────────────────────

function bindShareButton() {
    document.getElementById('q-share-btn')?.addEventListener('click', async () => {
        const url = window.location.href;
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            // Fallback for older browsers
            const ta = document.createElement('textarea');
            ta.value = url;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        const notice = document.getElementById('share-copied');
        notice.classList.remove('hidden');
        setTimeout(() => notice.classList.add('hidden'), 2500);
    });
}

// ─────────────────────────────────────────────
//  BOOKMARK BUTTON
// ─────────────────────────────────────────────

function bindBookmarkButton() {
    const btn = document.getElementById('q-bookmark');
    if (!btn) return;

    // Restore from localStorage
    const bookmarkKey = `bookmark_${state.questionId}`;
    state.bookmarked = localStorage.getItem(bookmarkKey) === 'true';
    updateBookmarkUI(btn);

    btn.addEventListener('click', () => {
        state.bookmarked = !state.bookmarked;
        localStorage.setItem(bookmarkKey, state.bookmarked ? 'true' : 'false');
        updateBookmarkUI(btn);
    });
}

function updateBookmarkUI(btn) {
    const icon = btn.querySelector('i');
    if (state.bookmarked) {
        icon.className = 'fas fa-bookmark text-sm';
        btn.classList.add('active-up');
        btn.title = 'বুকমার্ক সরান';
    } else {
        icon.className = 'far fa-bookmark text-sm';
        btn.classList.remove('active-up');
        btn.title = 'বুকমার্ক';
    }
}

// ─────────────────────────────────────────────
//  RELATED QUESTIONS
// ─────────────────────────────────────────────

async function loadRelatedQuestions() {
    const title = state.question?.title ?? '';
    // Extract keywords (simple: split title, use first 3 meaningful words)
    const keywords = title.split(/\s+/).filter(w => w.length > 3).slice(0, 3);

    if (keywords.length === 0) return;

    // Search using ilike on title for any keyword
    let query = supabase
        .from('question')
        .select('id, title, votes')
        .neq('id', state.questionId)
        .limit(5);

    // Use or filter for keyword matches
    const orFilter = keywords.map(k => `title.ilike.%${k}%`).join(',');
    query = query.or(orFilter);

    const { data: related, error } = await query;

    if (error || !related || related.length === 0) return;

    const section = document.getElementById('related-questions-section');
    const list = document.getElementById('related-questions-list');
    section.classList.remove('hidden');
    list.innerHTML = '';

    related.forEach(q => {
        const li = document.createElement('li');
        li.innerHTML = `
            <a href="question.html?id=${q.id}" 
               class="flex items-start gap-2 group">
                <span class="mt-0.5 shrink-0 text-[11px] text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 min-w-[30px] text-center">
                    ${q.votes ?? 0}
                </span>
                <span class="text-[#0056b3] group-hover:underline leading-snug">
                    ${escapeHTML(q.title)}
                </span>
            </a>
        `;
        list.appendChild(li);
    });
}

// ─────────────────────────────────────────────
//  SEO META INJECTION
// ─────────────────────────────────────────────

function injectSEOMeta(q) {
    // Extract plain text for description
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = q.body ?? '';
    const plainText = (tempDiv.textContent || tempDiv.innerText || '').trim();
    const description = plainText.substring(0, 150) + (plainText.length > 150 ? '...' : '');

    const fullUrl = `https://physflow.pages.dev/question?id=${q.id}`;

    // Title
    document.title = `${q.title} - PhysFlow`;

    // Description
    setMeta('name', 'description', description);

    // OG tags
    setMeta('property', 'og:title', q.title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', 'article');
    setMeta('property', 'og:url', fullUrl);

    // Canonical
    const canonical = document.getElementById('canonical-link');
    if (canonical) canonical.href = fullUrl;
}

function setMeta(attr, value, content) {
    let el = document.querySelector(`meta[${attr}="${value}"]`);
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, value);
        document.head.appendChild(el);
    }
    el.setAttribute('content', content);
}

// ─────────────────────────────────────────────
//  STRUCTURED DATA (JSON-LD)
// ─────────────────────────────────────────────

function injectStructuredData(question, answers) {
    if (!question) return;

    // Remove existing JSON-LD if any
    const existing = document.getElementById('jsonld-qa');
    if (existing) existing.remove();

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = question.body ?? '';
    const questionText = (tempDiv.textContent || '').trim().substring(0, 500);

    const acceptedAnswer = answers.find(a => a.is_accepted);
    const otherAnswers = answers.filter(a => !a.is_accepted);

    const buildAnswerSchema = (a) => {
        const d = document.createElement('div');
        d.innerHTML = a.body ?? '';
        return {
            '@type': 'Answer',
            'text': (d.textContent || '').trim().substring(0, 500),
            'upvoteCount': a.votes ?? 0,
            'dateCreated': a.created_at,
        };
    };

    const schema = {
        '@context': 'https://schema.org',
        '@type': 'QAPage',
        'mainEntity': {
            '@type': 'Question',
            'name': question.title,
            'text': questionText,
            'dateCreated': question.created_at,
            'answerCount': answers.length,
            ...(acceptedAnswer && {
                'acceptedAnswer': buildAnswerSchema(acceptedAnswer)
            }),
            ...(otherAnswers.length > 0 && {
                'suggestedAnswer': otherAnswers.map(buildAnswerSchema)
            })
        }
    };

    const script = document.createElement('script');
    script.id = 'jsonld-qa';
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema, null, 2);
    document.head.appendChild(script);
}

// ─────────────────────────────────────────────
//  AUTHOR PROFILE (name + avatar)
// ─────────────────────────────────────────────

/** Simple in-memory cache: authorId → {name, avatar_url} */
const profileCache = new Map();

/**
 * Fetch author profile (name + avatar_url) from `profile` table.
 * Results cached to avoid duplicate requests for the same user.
 * @param {string} authorId
 * @returns {Promise<{name: string, avatar_url: string|null}>}
 */
async function fetchAuthorProfile(authorId) {
    if (!authorId) return { name: 'অজানা', avatar_url: null };
    if (profileCache.has(authorId)) return profileCache.get(authorId);

    const { data: profile } = await supabase
        .from('profile')                        // adjust table name if needed
        .select('username, full_name, avatar_url')
        .eq('id', authorId)
        .single();

    const result = {
        name: profile?.username || profile?.full_name || 'অজানা ব্যবহারকারী',
        avatar_url: profile?.avatar_url ?? null,
    };
    profileCache.set(authorId, result);
    return result;
}

/**
 * Build an author chip HTML string (avatar + name + timeago).
 * Used both in question header and answer cards.
 * @param {{name:string, avatar_url:string|null}} profile
 * @param {string} authorId
 * @param {string} createdAt  ISO timestamp
 * @param {boolean} large     Larger avatar for question header
 */
function buildAuthorChip(profile, authorId, createdAt, large = false) {
    const size = large ? 'w-8 h-8 text-sm' : 'w-7 h-7 text-xs';
    const avatarHTML = profile.avatar_url
        ? `<img src="${escapeHTML(profile.avatar_url)}"
                alt="${escapeHTML(profile.name)}"
                class="${size} rounded-full object-cover border border-gray-200 dark:border-gray-600 shrink-0"
                onerror="this.replaceWith(buildInitialAvatar('${escapeHTML(profile.name)}', '${size}'))">`
        : `<span class="${size} rounded-full author-avatar shrink-0">${getInitials(profile.name)}</span>`;

    return `
        <div class="flex items-center gap-2">
            <a href="user.html?id=${authorId}" class="shrink-0">${avatarHTML}</a>
            <div class="flex flex-col leading-tight">
                <a href="user.html?id=${authorId}"
                   class="text-[13px] font-medium text-[#0056b3] hover:underline leading-none">${escapeHTML(profile.name)}</a>
                <span class="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">${timeAgo(createdAt)}</span>
            </div>
        </div>
    `;
}

/** Get 1–2 letter initials from a display name. */
function getInitials(name) {
    return (name ?? 'অ').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'অ';
}

// ─────────────────────────────────────────────
//  MATHJAX TYPESETTING
// ─────────────────────────────────────────────

/**
 * Trigger MathJax to typeset a specific DOM element.
 * @param {HTMLElement} element
 */
function typesetMath(element) {
    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([element]).catch(err => {
            console.warn('MathJax typeset error:', err);
        });
    }
}

// ─────────────────────────────────────────────
//  SANITIZE HTML (XSS protection)
// ─────────────────────────────────────────────

/**
 * Sanitize HTML using DOMPurify.
 * Allows safe tags needed for Quill content.
 */
function sanitizeHTML(dirty) {
    if (typeof DOMPurify === 'undefined') return dirty; // fallback if CDN fails
    return DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS: [
            'p', 'br', 'strong', 'em', 'u', 's', 'span', 'div',
            'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'a', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
            'sup', 'sub',
        ],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'style', 'target', 'rel'],
        ALLOW_DATA_ATTR: false,
    });
}

// ─────────────────────────────────────────────
//  UTILITIES
// ─────────────────────────────────────────────

/**
 * Bengali relative time — "কিছুক্ষণ আগে", "৫ মিনিট আগে", "২ ঘন্টা আগে" etc.
 * Falls back to formatted date for old posts.
 */
function timeAgo(isoString) {
    if (!isoString) return '';
    const now  = Date.now();
    const past = new Date(isoString).getTime();
    const diff = Math.floor((now - past) / 1000); // seconds

    const bn = (n) => n.toString().replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);

    if (diff < 60)          return 'কিছুক্ষণ আগে';
    if (diff < 3600)        return `${bn(Math.floor(diff / 60))} মিনিট আগে`;
    if (diff < 86400)       return `${bn(Math.floor(diff / 3600))} ঘন্টা আগে`;
    if (diff < 86400 * 7)   return `${bn(Math.floor(diff / 86400))} দিন আগে`;
    if (diff < 86400 * 30)  return `${bn(Math.floor(diff / 86400 / 7))} সপ্তাহ আগে`;
    if (diff < 86400 * 365) return `${bn(Math.floor(diff / 86400 / 30))} মাস আগে`;
    return `${bn(Math.floor(diff / 86400 / 365))} বছর আগে`;
}

/**
 * Format a UTC timestamp to Bengali-friendly date string.
 */
function formatDate(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('bn-BD', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

/**
 * Format large numbers with k suffix.
 */
function formatNumber(num) {
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return String(num);
}

/**
 * Escape HTML special chars for safe rendering.
 */
function escapeHTML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Show/hide loading skeleton.
 */
function showSkeleton(show) {
    document.getElementById('loading-skeleton')?.classList.toggle('hidden', !show);
}

/**
 * Show the not-found UI with a custom message.
 */
function showNotFound(message) {
    showSkeleton(false);
    const el = document.getElementById('not-found-ui');
    if (el) {
        el.classList.remove('hidden');
        const p = el.querySelector('p');
        if (p && message) p.textContent = message;
    }
}

/**
 * Alert user they need to log in to vote.
 */
function showLoginAlert() {
    // You can replace this with a proper toast/modal
    alert('ভোট দিতে লগ ইন করুন।');
}
