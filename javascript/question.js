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

    // Render question UI
    renderQuestion(question);

    // SEO meta injection
    injectSEOMeta(question);

    // Fetch author name
    fetchAuthorName(question.author_id, 'question-author');

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

    // Date
    document.getElementById('question-date').innerHTML =
        `<i class="far fa-clock"></i> ${formatDate(q.created_at)}`;

    // Views
    document.getElementById('question-views').innerHTML =
        `<i class="far fa-eye"></i> ${formatNumber(q.views ?? 0)} বার দেখা হয়েছে`;

    // Vote count
    document.getElementById('q-vote-count').textContent = q.votes ?? 0;

    // Body (sanitized HTML from Quill)
    const bodyEl = document.getElementById('question-body');
    bodyEl.innerHTML = sanitizeHTML(q.body ?? '');

    // Trigger MathJax typesetting on the body
    typesetMath(bodyEl);

    // Tags
    renderTags(q.tags ?? []);

    // Edit button: show only for question author
    if (state.currentUserId && state.currentUserId === q.author_id) {
        document.getElementById('q-edit-btn').classList.remove('hidden');
    }

    // Vote button events
    bindQuestionVotes(q);
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
 */
function createAnswerCard(answer) {
    const isAccepted = answer.is_accepted === true;
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

    // ---- Vote panel ----
    const votePanel = document.createElement('div');
    votePanel.className = 'flex flex-col items-center gap-1.5 pt-1 shrink-0';
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
            ? `<div class="mt-2 text-green-600 dark:text-green-400" title="গৃহীত উত্তর">
                   <i class="fas fa-check-circle text-xl"></i>
               </div>`
            : isQuestionAuthor
                ? `<button class="accept-answer-btn mt-2 vote-btn text-gray-400 hover:text-green-600 hover:border-green-500" 
                           data-id="${answer.id}" title="এই উত্তরটি গ্রহণ করুন">
                       <i class="fas fa-check text-sm"></i>
                   </button>`
                : ''
        }
    `;

    // ---- Body ----
    const bodyContainer = document.createElement('div');
    bodyContainer.className = 'flex-1 min-w-0';
    bodyContainer.innerHTML = `
        <div class="answer-body prose prose-sm max-w-none text-gray-800 dark:text-gray-200 leading-relaxed mb-3">
            ${sanitizeHTML(answer.body ?? '')}
        </div>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-gray-500 dark:text-gray-400">
            ${isAccepted
                ? `<span class="text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                       <i class="fas fa-check-circle"></i> গৃহীত উত্তর
                   </span>`
                : ''}
            <span class="flex items-center gap-1">
                <i class="far fa-user"></i>
                <a class="answer-author-link text-[#0056b3] hover:underline" 
                   data-author-id="${answer.author_id}" href="#">লোড হচ্ছে...</a>
            </span>
            <span class="flex items-center gap-1">
                <i class="far fa-clock"></i> ${formatDate(answer.created_at)}
            </span>
        </div>
    `;

    card.appendChild(votePanel);
    card.appendChild(bodyContainer);

    // Fetch author name
    const authorLink = bodyContainer.querySelector('.answer-author-link');
    fetchAuthorName(answer.author_id, null, authorLink);

    // Bind vote events for this answer
    votePanel.querySelector('.answer-vote-up').addEventListener('click', () => handleAnswerVote(answer.id, 'up', card));
    votePanel.querySelector('.answer-vote-down').addEventListener('click', () => handleAnswerVote(answer.id, 'down', card));

    // Bind accept event
    const acceptBtn = votePanel.querySelector('.accept-answer-btn');
    if (acceptBtn) {
        acceptBtn.addEventListener('click', () => handleAcceptAnswer(answer.id));
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
        // এখানে বসাও:
        qlContainer.style.minHeight   = '250px'; 
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
//  AUTHOR NAMES
// ─────────────────────────────────────────────

/**
 * Fetch author display name from profiles table.
 * @param {string} authorId - Supabase user ID
 * @param {string|null} elementId - ID of element to update text
 * @param {HTMLElement|null} element - Direct element reference
 */
async function fetchAuthorName(authorId, elementId, element = null) {
    if (!authorId) return;

    const { data: profile } = await supabase
        .from('profile')               // adjust table name if needed
        .select('username, full_name')
        .eq('id', authorId)
        .single();

    const displayName = profile?.username || profile?.full_name || 'অজানা ব্যবহারকারী';

    if (elementId) {
        const el = document.getElementById(elementId);
        if (el) el.textContent = displayName;
    }
    if (element) {
        element.textContent = displayName;
        element.href = `user.html?id=${authorId}`;
    }
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
