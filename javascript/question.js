/**
 * question.js  —  PhysFlow Question Detail Page
 *
 * Changes applied:
 *  1. accept answer feature fully removed
 *  2. no profile pic; author name · time on one line (name THEN time, no newline)
 *  3. Reddit-style threaded replies (collapsible vertical line)
 *  4. Share opens browser native share menu (Web Share API), clipboard fallback
 *  5. dark mode: answer cards have NO visible border — only a very faint divider
 */

import { supabase } from './supabase-config.js';

// ─────────────────────────────────────────────
//  CONSTANTS & STATE
// ─────────────────────────────────────────────

const ANSWERS_PER_PAGE  = 5;
const MIN_ANSWER_LENGTH = 30;

const state = {
    questionId:     null,
    question:       null,
    answers:        [],
    currentPage:    0,
    totalAnswers:   0,
    sortBy:         'votes',
    currentUserId:  null,
    quillEditor:    null,
    previewVisible: false,
    bookmarked:     false,
};

/** name cache — avoids re-fetching same author */
const profileCache = new Map();

/** Quill instances for reply boxes: answerId → Quill */
const replyQuillMap = new Map();

// ─────────────────────────────────────────────
//  ENTRY POINT
// ─────────────────────────────────────────────

export async function initQuestionPage() {
    const params = new URLSearchParams(window.location.search);
    state.questionId = params.get('id');

    if (!state.questionId) {
        showNotFound('প্রশ্নের আইডি পাওয়া যায়নি।');
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    state.currentUserId = user?.id ?? null;

    await loadQuestion();

    bindSortChange();
    bindLoadMore();
    bindShareButton();   // native share
    bindBookmarkButton();
}

// ─────────────────────────────────────────────
//  LOAD & RENDER QUESTION
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
    incrementViewCount();
    renderQuestion(question);
    injectSEOMeta(question);

    await loadAnswers(true);
    loadRelatedQuestions();
    initAnswerModal();
    bindSubmitAnswer();
    bindPreviewToggle();

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

    // Body
    const bodyEl = document.getElementById('question-body');
    bodyEl.innerHTML = sanitizeHTML(q.body ?? '');
    typesetMath(bodyEl);

    // Tags
    renderTags(q.tags ?? []);

    // Edit button (own question)
    if (state.currentUserId && state.currentUserId === q.author_id) {
        document.getElementById('q-edit-btn').classList.remove('hidden');
    }

    // Vote bindings
    bindQuestionVotes(q);

    // Author: name · timeago (no avatar, name THEN time on same line)
    fetchAuthorName(q.author_id).then(name => {
        const link = document.getElementById('question-author-link');
        const time = document.getElementById('question-timeago');
        if (link) { link.textContent = name; link.href = `user.html?id=${q.author_id}`; }
        if (time) time.textContent = timeAgo(q.created_at);
    });
}

function renderTags(tags) {
    const container = document.getElementById('question-tags');
    container.innerHTML = '';
    (tags ?? []).forEach(tag => {
        const a = document.createElement('a');
        a.href      = `questions.html?tag=${encodeURIComponent(tag)}`;
        a.className = 'tag-badge';
        a.textContent = tag;
        container.appendChild(a);
    });
}

// ─────────────────────────────────────────────
//  LOAD ANSWERS  (top-level only, parent_answer_id IS NULL)
// ─────────────────────────────────────────────

async function loadAnswers(reset = false) {
    if (reset) {
        state.currentPage = 0;
        state.answers     = [];
        document.getElementById('answer-list').innerHTML = '';
        replyQuillMap.clear();
    }

    const offset = state.currentPage * ANSWERS_PER_PAGE;

    let query = supabase
        .from('answer')
        .select('*', { count: 'exact' })
        .eq('question_id', state.questionId)
        .is('parent_answer_id', null)
        .range(offset, offset + ANSWERS_PER_PAGE - 1);

    if (state.sortBy === 'newest') {
        query = query.order('created_at', { ascending: false });
    } else if (state.sortBy === 'oldest') {
        query = query.order('created_at', { ascending: true });
    } else {
        query = query
            .order('votes',      { ascending: false })
            .order('created_at', { ascending: true  });
    }

    const { data: answers, error, count } = await query;
    if (error) { console.error('loadAnswers:', error); return; }

    state.totalAnswers = count ?? 0;
    state.answers      = reset
        ? (answers ?? [])
        : [...state.answers, ...(answers ?? [])];

    document.getElementById('answer-count-num').textContent = state.totalAnswers;

    const list = document.getElementById('answer-list');
    for (const answer of (answers ?? [])) {
        const card = await buildAnswerThread(answer, 0);
        list.appendChild(card);
    }
    typesetMath(list);

    const loaded = (state.currentPage + 1) * ANSWERS_PER_PAGE;
    document.getElementById('load-more-container')
        .classList.toggle('hidden', state.totalAnswers <= loaded);

    injectStructuredData(state.question, state.answers);
}

// ─────────────────────────────────────────────
//  BUILD ANSWER THREAD  (recursive)
// ─────────────────────────────────────────────

/**
 * Build one answer row + its nested replies.
 * @param {object} answer
 * @param {number} depth   0 = top-level, 1+ = reply
 */
async function buildAnswerThread(answer, depth) {
    const wrapper = document.createElement('div');
    wrapper.id = `answer-${answer.id}`;

    // ── Row: [vote col] | [content col]
    const row = document.createElement('div');
    row.className = depth === 0 ? 'answer-card flex gap-3' : 'flex gap-3 pt-3';

    // ── Vote column ─────────────────────────
    const voteCol = document.createElement('div');
    voteCol.className = 'flex flex-col items-center gap-0.5 shrink-0 w-8 pt-0.5';
    voteCol.innerHTML = `
        <button class="vote-btn ans-vote-up" title="উপভোট">
            <i class="fas fa-chevron-up" style="font-size:10px"></i>
        </button>
        <span class="ans-vote-count text-xs font-semibold
                     text-gray-600 dark:text-gray-400 text-center leading-none py-0.5">
            ${answer.votes ?? 0}
        </span>
        <button class="vote-btn ans-vote-down" title="ডাউনভোট">
            <i class="fas fa-chevron-down" style="font-size:10px"></i>
        </button>`;

    // ── Content column ────────────────────────
    const contentCol = document.createElement('div');
    contentCol.className = 'flex-1 min-w-0';

    // Author line: name · time  (NO avatar, NO newline between them)
    const name = await fetchAuthorName(answer.author_id);
    const authorLine = document.createElement('div');
    authorLine.className = 'flex items-center gap-1.5 text-[12px] text-gray-500 dark:text-gray-400 mb-1.5 flex-wrap';
    authorLine.innerHTML = `
        <a href="user.html?id=${answer.author_id}"
           class="font-medium text-[#0056b3] hover:underline">${escapeHTML(name)}</a>
        <span class="text-gray-300 dark:text-gray-700">·</span>
        <span>${timeAgo(answer.created_at)}</span>`;

    // Body
    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'answer-body prose prose-sm max-w-none text-gray-800 dark:text-gray-200 leading-relaxed mb-2';
    bodyDiv.innerHTML = sanitizeHTML(answer.body ?? '');

    // Action row: reply button only (NO accept button)
    const actionRow = document.createElement('div');
    actionRow.className = 'flex items-center gap-2 mt-1';
    actionRow.innerHTML = `
        <button class="reply-toggle-btn action-btn" data-id="${answer.id}">
            <i class="fas fa-reply" style="font-size:10px"></i> রিপ্লাই
        </button>`;

    // Reply compose box (hidden by default)
    const replyCompose = document.createElement('div');
    replyCompose.className  = 'reply-compose hidden';
    replyCompose.id         = `compose-${answer.id}`;
    replyCompose.innerHTML  = `
        <div class="reply-quill-target mb-2 rounded border border-gray-200 dark:border-gray-800 overflow-hidden"></div>
        <div class="flex items-center gap-2 mt-2">
            <button class="rs-btn bg-[#0056b3] hover:bg-[#004494] text-white
                           px-3 py-1 rounded text-xs font-medium transition
                           disabled:opacity-50 flex items-center gap-1.5">
                <span class="rs-text">রিপ্লাই</span>
                <span class="rs-spin hidden"><i class="fas fa-spinner fa-spin text-xs"></i></span>
            </button>
            <button class="rc-btn text-xs text-gray-400 dark:text-gray-600
                           hover:text-gray-700 dark:hover:text-gray-300 transition
                           px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-[#222]">বাতিল</button>
            <span class="rv-msg hidden text-red-500 text-xs">কমপক্ষে ৩০ অক্ষর লিখুন।</span>
        </div>`;

    contentCol.appendChild(authorLine);
    contentCol.appendChild(bodyDiv);
    contentCol.appendChild(actionRow);
    contentCol.appendChild(replyCompose);

    row.appendChild(voteCol);
    row.appendChild(contentCol);
    wrapper.appendChild(row);

    // ── Fetch & render existing replies ──────
    const { data: replies } = await supabase
        .from('answer')
        .select('*')
        .eq('parent_answer_id', answer.id)
        .order('created_at', { ascending: true });

    if (replies && replies.length > 0) {
        // Thread row: [clickable line] [replies]
        const threadRow = document.createElement('div');
        threadRow.className = 'flex gap-0 mt-0 ml-11'; // align under content col

        const threadLine = document.createElement('div');
        threadLine.className = 'thread-line mr-3';
        threadLine.title = 'থ্রেড ভাঁজ করুন';

        const repliesWrap = document.createElement('div');
        repliesWrap.className = 'flex-1 min-w-0';

        for (const reply of replies) {
            const replyEl = await buildAnswerThread(reply, depth + 1);
            repliesWrap.appendChild(replyEl);
        }

        // Click line to collapse / expand
        let collapsed = false;
        threadLine.addEventListener('click', () => {
            collapsed = !collapsed;
            repliesWrap.style.display  = collapsed ? 'none' : '';
            threadLine.style.opacity   = collapsed ? '0.3'  : '1';
            threadLine.title = collapsed ? 'থ্রেড খুলুন' : 'থ্রেড ভাঁজ করুন';
        });

        threadRow.appendChild(threadLine);
        threadRow.appendChild(repliesWrap);
        wrapper.appendChild(threadRow);
    }

    // ── Vote events ──────────────────────────
    voteCol.querySelector('.ans-vote-up')
        .addEventListener('click', () => handleAnswerVote(answer.id, 'up', voteCol));
    voteCol.querySelector('.ans-vote-down')
        .addEventListener('click', () => handleAnswerVote(answer.id, 'down', voteCol));

    // ── Reply toggle ──────────────────────────
    actionRow.querySelector('.reply-toggle-btn').addEventListener('click', () => {
        const isOpen = !replyCompose.classList.contains('hidden');
        if (isOpen) {
            replyCompose.classList.add('hidden');
            return;
        }
        replyCompose.classList.remove('hidden');
        initReplyQuill(answer.id, replyCompose);
    });

    return wrapper;
}

// ─────────────────────────────────────────────
//  REPLY QUILL  (lazy — one Quill per answer)
// ─────────────────────────────────────────────

function initReplyQuill(answerId, composeEl) {
    if (replyQuillMap.has(answerId)) return; // already initialized

    const target = composeEl.querySelector('.reply-quill-target');
    const q = new Quill(target, {
        theme:   'snow',
        placeholder: 'রিপ্লাই লিখুন...',
        modules: {
            toolbar: [
                ['bold', 'italic', 'code-block'],
                ['link', 'formula'],
            ]
        }
    });

    // Dark mode
    if (document.documentElement.classList.contains('dark')) {
        const c = target.querySelector('.ql-container');
        const t = target.querySelector('.ql-toolbar');
        if (c) { c.style.background = '#111';    c.style.color = '#e5e5e5'; c.style.borderColor = '#252525'; }
        if (t) { t.style.background = '#1a1a1a'; t.style.borderColor = '#252525'; }
    }

    replyQuillMap.set(answerId, q);

    const submitBtn = composeEl.querySelector('.rs-btn');
    const cancelBtn = composeEl.querySelector('.rc-btn');
    const valMsg    = composeEl.querySelector('.rv-msg');

    submitBtn.addEventListener('click', async () => {
        if (!state.currentUserId) { showLoginToast(); return; }

        const html = q.root.innerHTML;
        const text = q.getText().trim();

        if (text.length < MIN_ANSWER_LENGTH) {
            valMsg.classList.remove('hidden');
            return;
        }
        valMsg.classList.add('hidden');

        // Loading state
        submitBtn.disabled = true;
        composeEl.querySelector('.rs-text').textContent = 'পাঠানো হচ্ছে...';
        composeEl.querySelector('.rs-spin').classList.remove('hidden');

        const { error } = await supabase
            .from('answer')
            .insert({
                question_id:      state.questionId,
                parent_answer_id: answerId,
                body:             html,
                author_id:        state.currentUserId,
                votes:            0,
                is_accepted:      false,
            });

        submitBtn.disabled = false;
        composeEl.querySelector('.rs-text').textContent = 'রিপ্লাই';
        composeEl.querySelector('.rs-spin').classList.add('hidden');

        if (error) {
            console.error('Reply error:', error);
            alert('রিপ্লাই পাঠাতে সমস্যা হয়েছে।');
            return;
        }

        // Reload to show threaded reply
        replyQuillMap.delete(answerId);
        await loadAnswers(true);
    });

    cancelBtn.addEventListener('click', () => {
        composeEl.classList.add('hidden');
    });
}

// ─────────────────────────────────────────────
//  VOTE — QUESTION
// ─────────────────────────────────────────────

function bindQuestionVotes(q) {
    const upBtn   = document.getElementById('q-vote-up');
    const downBtn = document.getElementById('q-vote-down');
    const countEl = document.getElementById('q-vote-count');

    const key  = `q_vote_${q.id}`;
    const prev = sessionStorage.getItem(key);
    if (prev === 'up')   upBtn.classList.add('active-up');
    if (prev === 'down') downBtn.classList.add('active-down');

    upBtn.addEventListener('click', async () => {
        if (!state.currentUserId) { showLoginToast(); return; }
        const p = sessionStorage.getItem(key);
        if (p === 'up') return;
        const cur   = parseInt(countEl.textContent) || 0;
        const delta = p === 'down' ? 2 : 1;
        countEl.textContent = cur + delta;
        upBtn.classList.add('active-up');
        downBtn.classList.remove('active-down');
        sessionStorage.setItem(key, 'up');
        await supabase.from('question').update({ votes: cur + delta }).eq('id', q.id);
    });

    downBtn.addEventListener('click', async () => {
        if (!state.currentUserId) { showLoginToast(); return; }
        const p = sessionStorage.getItem(key);
        if (p === 'down') return;
        const cur   = parseInt(countEl.textContent) || 0;
        const delta = p === 'up' ? 2 : 1;
        countEl.textContent = cur - delta;
        downBtn.classList.add('active-down');
        upBtn.classList.remove('active-up');
        sessionStorage.setItem(key, 'down');
        await supabase.from('question').update({ votes: cur - delta }).eq('id', q.id);
    });
}

// ─────────────────────────────────────────────
//  VOTE — ANSWER
// ─────────────────────────────────────────────

async function handleAnswerVote(answerId, direction, voteCol) {
    if (!state.currentUserId) { showLoginToast(); return; }

    const key  = `a_vote_${answerId}`;
    const prev = sessionStorage.getItem(key);
    if (prev === direction) return;

    const countEl = voteCol.querySelector('.ans-vote-count');
    const cur     = parseInt(countEl.textContent) || 0;
    const delta   = direction === 'up'
        ? (prev === 'down' ? 2 : 1)
        : (prev === 'up'   ? -2 : -1);

    // Optimistic UI
    countEl.textContent = cur + delta;
    const upBtn   = voteCol.querySelector('.ans-vote-up');
    const downBtn = voteCol.querySelector('.ans-vote-down');
    if (direction === 'up') {
        upBtn.classList.add('active-up');
        downBtn.classList.remove('active-down');
    } else {
        downBtn.classList.add('active-down');
        upBtn.classList.remove('active-up');
    }
    sessionStorage.setItem(key, direction);

    const { error } = await supabase
        .from('answer')
        .update({ votes: cur + delta })
        .eq('id', answerId);
    if (error) console.error('Answer vote:', error);
}

// ─────────────────────────────────────────────
//  SORT
// ─────────────────────────────────────────────

function bindSortChange() {
    document.getElementById('answer-sort').addEventListener('change', async (e) => {
        state.sortBy = e.target.value;
        await loadAnswers(true);
    });
}

// ─────────────────────────────────────────────
//  PAGINATION
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

function initAnswerModal() {
    const fab       = document.getElementById('fab-answer-btn');
    const overlay   = document.getElementById('answer-modal-overlay');
    const modal     = document.getElementById('answer-modal');
    const closeBtn  = document.getElementById('answer-modal-close');
    const cancelBtn = document.getElementById('answer-modal-cancel');
    const titlePrev = document.getElementById('modal-question-title-preview');

    fab.classList.remove('hidden');
    if (titlePrev && state.question?.title) titlePrev.textContent = state.question.title;

    const openModal = () => {
        overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() =>
            requestAnimationFrame(() => modal.classList.add('modal-open')));
        if (!state.quillEditor) initQuillEditor();
    };

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
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closeModal();
    });
}

// ─────────────────────────────────────────────
//  QUILL — MAIN ANSWER (lazy)
// ─────────────────────────────────────────────

function initQuillEditor() {
    if (!state.currentUserId) {
        document.getElementById('answer-editor').classList.add('hidden');
        document.getElementById('submit-answer-btn').classList.add('hidden');
        document.getElementById('preview-toggle-btn').classList.add('hidden');
        document.getElementById('login-required-notice').classList.remove('hidden');
        return;
    }

    state.quillEditor = new Quill('#answer-editor', {
        theme: 'snow',
        placeholder: 'আপনার উত্তর লিখুন… (LaTeX: $E=mc^2$ বা $$\\frac{d^2x}{dt^2}$$)',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline', 'strike'],
                ['blockquote', 'code-block'],
                [{ list: 'ordered' }, { list: 'bullet' }],
                ['link', 'image', 'formula'],
                ['clean']
            ]
        }
    });

    if (document.documentElement.classList.contains('dark')) {
        const c = document.querySelector('#answer-editor .ql-container');
        const t = document.querySelector('#answer-editor .ql-toolbar');
        if (c) { c.style.background = '#111';    c.style.color = '#e5e5e5'; c.style.borderColor = '#2e2e2e'; }
        if (t) { t.style.background = '#1a1a1a'; t.style.borderColor = '#2e2e2e'; }
    }
}

// ─────────────────────────────────────────────
//  SUBMIT ANSWER
// ─────────────────────────────────────────────

function bindSubmitAnswer() {
    document.getElementById('submit-answer-btn').addEventListener('click', async () => {
        const editor = state.quillEditor;
        if (!editor) return;

        const html   = editor.root.innerHTML;
        const text   = editor.getText().trim();
        const valMsg = document.getElementById('answer-validation-msg');

        if (text.length < MIN_ANSWER_LENGTH) {
            valMsg.classList.remove('hidden');
            return;
        }
        valMsg.classList.add('hidden');

        setSubmitLoading(true);

        const { error } = await supabase
            .from('answer')
            .insert({
                question_id:      state.questionId,
                parent_answer_id: null,
                body:             html,
                author_id:        state.currentUserId,
                votes:            0,
                is_accepted:      false,
            });

        setSubmitLoading(false);

        if (error) {
            alert('উত্তর জমা দিতে সমস্যা হয়েছে।');
            console.error(error);
            return;
        }

        editor.setContents([]);
        await loadAnswers(true);

        // Close modal
        const modal   = document.getElementById('answer-modal');
        const overlay = document.getElementById('answer-modal-overlay');
        modal.classList.remove('modal-open');
        setTimeout(() => { overlay.classList.add('hidden'); document.body.style.overflow = ''; }, 300);

        // Scroll to answer list
        document.getElementById('answer-list')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

function setSubmitLoading(on) {
    const btn     = document.getElementById('submit-answer-btn');
    const spinner = document.getElementById('submit-spinner');
    const text    = document.getElementById('submit-btn-text');
    btn.disabled          = on;
    spinner.classList.toggle('hidden', !on);
    text.textContent      = on ? 'জমা হচ্ছে...' : 'জমা দিন';
}

// ─────────────────────────────────────────────
//  PREVIEW
// ─────────────────────────────────────────────

function bindPreviewToggle() {
    const btn   = document.getElementById('preview-toggle-btn');
    const panel = document.getElementById('answer-preview');
    if (!btn) return;

    btn.addEventListener('click', () => {
        state.previewVisible = !state.previewVisible;
        if (state.previewVisible) {
            panel.innerHTML = sanitizeHTML(state.quillEditor?.root.innerHTML ?? '');
            panel.classList.remove('hidden');
            typesetMath(panel);
            btn.innerHTML = '<i class="fas fa-eye-slash" style="font-size:11px"></i> লুকান';
        } else {
            panel.classList.add('hidden');
            btn.innerHTML = '<i class="fas fa-eye" style="font-size:11px"></i> প্রিভিউ';
        }
    });
}

// ─────────────────────────────────────────────
//  SHARE  — browser native share menu
// ─────────────────────────────────────────────

function bindShareButton() {
    document.getElementById('q-share-btn')?.addEventListener('click', async () => {
        const shareData = {
            title: state.question?.title ?? 'PhysFlow প্রশ্ন',
            text:  'PhysFlow-এ এই পদার্থবিজ্ঞান প্রশ্নটি দেখুন',
            url:   window.location.href,
        };

        // Web Share API (mobile + modern desktop)
        if (navigator.share) {
            try {
                await navigator.share(shareData);
                return;
            } catch (e) {
                if (e.name === 'AbortError') return; // user cancelled
            }
        }

        // Clipboard fallback (desktop browsers without share API)
        try {
            await navigator.clipboard.writeText(window.location.href);
        } catch {
            // execCommand fallback for very old browsers
            const ta = document.createElement('textarea');
            ta.value = window.location.href;
            Object.assign(ta.style, { position:'fixed', opacity:'0' });
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        showToast('লিংক কপি হয়েছে!');
    });
}

// ─────────────────────────────────────────────
//  BOOKMARK
// ─────────────────────────────────────────────

function bindBookmarkButton() {
    const btn = document.getElementById('q-bookmark');
    if (!btn) return;
    const key = `bookmark_${state.questionId}`;
    state.bookmarked = localStorage.getItem(key) === 'true';
    updateBookmarkUI(btn);
    btn.addEventListener('click', () => {
        state.bookmarked = !state.bookmarked;
        localStorage.setItem(key, state.bookmarked ? 'true' : 'false');
        updateBookmarkUI(btn);
    });
}

function updateBookmarkUI(btn) {
    const icon = btn.querySelector('i');
    if (state.bookmarked) {
        icon.className = 'fas fa-bookmark';
        icon.style.fontSize = '10px';
        btn.classList.add('active-up');
        btn.title = 'বুকমার্ক সরান';
    } else {
        icon.className = 'far fa-bookmark';
        icon.style.fontSize = '10px';
        btn.classList.remove('active-up');
        btn.title = 'বুকমার্ক';
    }
}

// ─────────────────────────────────────────────
//  VIEW COUNT  (once per session)
// ─────────────────────────────────────────────

async function incrementViewCount() {
    const key = `viewed_${state.questionId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    const cur = state.question?.views ?? 0;
    await supabase.from('question').update({ views: cur + 1 }).eq('id', state.questionId);
}

// ─────────────────────────────────────────────
//  RELATED QUESTIONS
// ─────────────────────────────────────────────

async function loadRelatedQuestions() {
    const keywords = (state.question?.title ?? '')
        .split(/\s+/)
        .filter(w => w.length > 3)
        .slice(0, 3);
    if (!keywords.length) return;

    const orFilter = keywords.map(k => `title.ilike.%${k}%`).join(',');
    const { data: related, error } = await supabase
        .from('question')
        .select('id, title, votes')
        .neq('id', state.questionId)
        .or(orFilter)
        .limit(5);

    if (error || !related?.length) return;

    document.getElementById('related-questions-section').classList.remove('hidden');
    const list = document.getElementById('related-questions-list');
    list.innerHTML = '';
    related.forEach(q => {
        const li = document.createElement('li');
        li.innerHTML = `
            <a href="question.html?id=${q.id}" class="flex items-start gap-2 group">
                <span class="shrink-0 text-[11px] text-gray-400 border border-gray-200
                             dark:border-gray-800 rounded px-1.5 py-0.5 min-w-[28px] text-center">
                    ${q.votes ?? 0}
                </span>
                <span class="text-[#0056b3] group-hover:underline leading-snug text-[13px]">
                    ${escapeHTML(q.title)}
                </span>
            </a>`;
        list.appendChild(li);
    });
}

// ─────────────────────────────────────────────
//  SEO META
// ─────────────────────────────────────────────

function injectSEOMeta(q) {
    const tmp  = document.createElement('div');
    tmp.innerHTML = q.body ?? '';
    const plain = (tmp.textContent || '').trim();
    const desc  = plain.substring(0, 150) + (plain.length > 150 ? '…' : '');
    const url   = `https://physflow.pages.dev/question?id=${q.id}`;

    document.title = `${q.title} - PhysFlow`;
    setMeta('name',     'description',    desc);
    setMeta('property', 'og:title',       q.title);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:type',        'article');
    setMeta('property', 'og:url',         url);
    const canon = document.getElementById('canonical-link');
    if (canon) canon.href = url;
}

function setMeta(attr, val, content) {
    let el = document.querySelector(`meta[${attr}="${val}"]`);
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, val);
        document.head.appendChild(el);
    }
    el.setAttribute('content', content);
}

// ─────────────────────────────────────────────
//  STRUCTURED DATA  (JSON-LD)
// ─────────────────────────────────────────────

function injectStructuredData(question, answers) {
    document.getElementById('jsonld-qa')?.remove();
    if (!question) return;

    const tmp   = document.createElement('div');
    tmp.innerHTML = question.body ?? '';
    const qText = (tmp.textContent || '').trim().substring(0, 500);

    const toSchema = (a) => {
        const d = document.createElement('div');
        d.innerHTML = a.body ?? '';
        return {
            '@type':      'Answer',
            text:          (d.textContent || '').trim().substring(0, 500),
            upvoteCount:   a.votes ?? 0,
            dateCreated:   a.created_at,
        };
    };

    const schema = {
        '@context': 'https://schema.org',
        '@type':    'QAPage',
        mainEntity: {
            '@type':       'Question',
            name:           question.title,
            text:           qText,
            dateCreated:    question.created_at,
            answerCount:    answers.length,
            suggestedAnswer: answers.map(toSchema),
        }
    };

    const s = document.createElement('script');
    s.id   = 'jsonld-qa';
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(schema, null, 2);
    document.head.appendChild(s);
}

// ─────────────────────────────────────────────
//  FETCH AUTHOR NAME  (cached)
// ─────────────────────────────────────────────

async function fetchAuthorName(authorId) {
    if (!authorId) return 'অজানা';
    if (profileCache.has(authorId)) return profileCache.get(authorId);

    const { data: p } = await supabase
        .from('profile')
        .select('username, full_name')
        .eq('id', authorId)
        .single();

    const name = p?.username || p?.full_name || 'অজানা ব্যবহারকারী';
    profileCache.set(authorId, name);
    return name;
}

// ─────────────────────────────────────────────
//  MATHJAX
// ─────────────────────────────────────────────

function typesetMath(el) {
    if (window.MathJax?.typesetPromise) {
        window.MathJax.typesetPromise([el]).catch(e => console.warn('MathJax:', e));
    }
}

// ─────────────────────────────────────────────
//  SANITIZE HTML  (DOMPurify)
// ─────────────────────────────────────────────

function sanitizeHTML(dirty) {
    if (typeof DOMPurify === 'undefined') return dirty;
    return DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS: [
            'p','br','strong','em','u','s','span','div',
            'ul','ol','li','blockquote','pre','code',
            'h1','h2','h3','h4','h5','h6',
            'a','img','table','thead','tbody','tr','td','th',
            'sup','sub',
        ],
        ALLOWED_ATTR: ['href','src','alt','class','style','target','rel'],
        ALLOW_DATA_ATTR: false,
    });
}

// ─────────────────────────────────────────────
//  UTILITIES
// ─────────────────────────────────────────────

/** Bengali relative time */
function timeAgo(iso) {
    if (!iso) return '';
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    const bn   = n => String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);

    if (diff < 60)         return 'এইমাত্র';
    if (diff < 3600)       return `${bn(Math.floor(diff / 60))} মিনিট আগে`;
    if (diff < 86400)      return `${bn(Math.floor(diff / 3600))} ঘন্টা আগে`;
    if (diff < 86400 * 7)  return `${bn(Math.floor(diff / 86400))} দিন আগে`;
    if (diff < 86400 * 30) return `${bn(Math.floor(diff / 86400 / 7))} সপ্তাহ আগে`;
    if (diff < 86400 * 365)return `${bn(Math.floor(diff / 86400 / 30))} মাস আগে`;
    return `${bn(Math.floor(diff / 86400 / 365))} বছর আগে`;
}

function formatNumber(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }

function escapeHTML(str) {
    return (str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showSkeleton(show) {
    document.getElementById('loading-skeleton')?.classList.toggle('hidden', !show);
}

function showNotFound(msg) {
    showSkeleton(false);
    const el = document.getElementById('not-found-ui');
    if (!el) return;
    el.classList.remove('hidden');
    const p = el.querySelector('p');
    if (p && msg) p.textContent = msg;
}

function showLoginToast() { showToast('লগ ইন করুন।'); }

/** Lightweight bottom toast */
function showToast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.className = [
        'fixed bottom-24 left-1/2 -translate-x-1/2 z-[999]',
        'bg-gray-800 dark:bg-gray-700 text-white text-xs',
        'px-4 py-2 rounded-full shadow-lg transition-opacity',
    ].join(' ');
    document.body.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 400);
    }, 2200);
}
