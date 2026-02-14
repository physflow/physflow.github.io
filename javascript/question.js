/**
 * question.js — PhysFlow Question Detail Page
 *
 * নাম দেখানোর জন্য Supabase SQL Editor-এ setup_user_names_view.sql একবার run করতে হবে।
 */

import { supabase } from './supabase-config.js';

// ─────────────────────────────────────────────
//  CONSTANTS & STATE
// ─────────────────────────────────────────────

const ANSWERS_PER_PAGE  = 5;
const MIN_ANSWER_LENGTH = 30;
const MIN_OPINION_LEN   = 10;

const state = {
    questionId:     null,
    question:       null,
    answers:        [],
    currentPage:    0,
    totalAnswers:   0,
    sortBy:         'votes',
    currentUserId:  null,
    currentUser:    null,
    quillEditor:    null,   // main answer editor (lazy)
    opinionQuill:   null,   // মতামত editor (lazy)
    previewVisible: false,
    opinionAnswerId: null,  // which answer the opinion modal is for
};

/** authorId → displayName */
const nameCache = new Map();

// ─────────────────────────────────────────────
//  ENTRY POINT
// ─────────────────────────────────────────────

export async function initQuestionPage() {
    const params = new URLSearchParams(window.location.search);
    state.questionId = params.get('id');
    if (!state.questionId) { showNotFound(); return; }

    const { data: { user } } = await supabase.auth.getUser();
    state.currentUserId = user?.id ?? null;
    state.currentUser   = user ?? null;

    await loadQuestion();
    bindSortChange();
    bindLoadMore();
    bindShareButton();
    bindBookmarkButton();
    initOpinionModal();
}

// ─────────────────────────────────────────────
//  LOAD & RENDER QUESTION
// ─────────────────────────────────────────────

async function loadQuestion() {
    showSkeleton(true);

    const { data: question, error } = await supabase
        .from('question').select('*').eq('id', state.questionId).single();

    showSkeleton(false);

    if (error || !question) { showNotFound(); return; }

    state.question = question;
    incrementViewCount();
    renderQuestion(question);
    injectSEOMeta(question);

    await loadAnswers(true);
    loadRelatedQuestions();
    initMainAnswerEditor();
    bindSubmitAnswer();
    bindPreviewToggle();
    initAnswerFAB();

    document.getElementById('question-content').classList.remove('hidden');
}

function renderQuestion(q) {
    document.getElementById('question-title').textContent = q.title;
    document.getElementById('q-vote-count').textContent   = q.votes ?? 0;
    document.getElementById('question-views').innerHTML   =
        `<i class="far fa-eye"></i> ${formatNumber(q.views ?? 0)} বার দেখা হয়েছে`;

    const bodyEl = document.getElementById('question-body');
    bodyEl.innerHTML = sanitizeHTML(q.body ?? '');
    typesetMath(bodyEl);

    renderTags(q.tags ?? []);

    if (state.currentUserId === q.author_id)
        document.getElementById('q-edit-btn').classList.remove('hidden');

    bindQuestionVotes(q);

    // Author name + time
    fetchName(q.author_id).then(name => {
        const link = document.getElementById('question-author-link');
        const time = document.getElementById('question-timeago');
        if (link) { link.textContent = name; link.href = `user.html?id=${q.author_id}`; }
        if (time)   time.textContent = timeAgo(q.created_at);
    });
}

function renderTags(tags) {
    const c = document.getElementById('question-tags');
    c.innerHTML = '';
    tags.forEach(tag => {
        const a = document.createElement('a');
        a.href = `questions.html?tag=${encodeURIComponent(tag)}`;
        a.className = 'tag-badge';
        a.textContent = tag;
        c.appendChild(a);
    });
}

// ─────────────────────────────────────────────
//  LOAD ANSWERS
// ─────────────────────────────────────────────

async function loadAnswers(reset = false) {
    if (reset) {
        state.currentPage = 0; state.answers = [];
        document.getElementById('answer-list').innerHTML = '';
    }

    const offset = state.currentPage * ANSWERS_PER_PAGE;

    let query = supabase
        .from('answer').select('*', { count: 'exact' })
        .eq('question_id', state.questionId)
        .is('parent_answer_id', null)
        .range(offset, offset + ANSWERS_PER_PAGE - 1);

    if      (state.sortBy === 'newest') query = query.order('created_at', { ascending: false });
    else if (state.sortBy === 'oldest') query = query.order('created_at', { ascending: true  });
    else    query = query.order('votes', { ascending: false }).order('created_at', { ascending: true });

    const { data: answers, count } = await query;

    state.totalAnswers = count ?? 0;
    state.answers = reset ? (answers ?? []) : [...state.answers, ...(answers ?? [])];

    document.getElementById('answer-count-num').textContent = state.totalAnswers;

    const list = document.getElementById('answer-list');
    for (const a of (answers ?? [])) list.appendChild(createAnswerCard(a));
    typesetMath(list);

    const loaded = (state.currentPage + 1) * ANSWERS_PER_PAGE;
    document.getElementById('load-more-container').classList.toggle('hidden', state.totalAnswers <= loaded);
    injectStructuredData(state.question, state.answers);
}

// ─────────────────────────────────────────────
//  CREATE ANSWER CARD
// ─────────────────────────────────────────────

function createAnswerCard(answer) {
    const card = document.createElement('div');
    card.id = `answer-${answer.id}`;
    card.className = 'answer-card flex gap-4 pb-6';

    // ── Vote column ──────────────────────────
    const voteCol = document.createElement('div');
    voteCol.className = 'flex flex-col items-center gap-1.5 pt-1 shrink-0';

    const prevVote = sessionStorage.getItem(`a_vote_${answer.id}`);
    voteCol.innerHTML = `
        <button class="vote-btn ans-vote-up ${prevVote === 'up' ? 'active-up' : ''}" title="উপভোট">
            <i class="fas fa-chevron-up text-sm"></i>
        </button>
        <span class="ans-vote-count text-base font-semibold text-gray-700 dark:text-gray-300 min-w-[24px] text-center">
            ${answer.votes ?? 0}
        </span>
        <button class="vote-btn ans-vote-down ${prevVote === 'down' ? 'active-down' : ''}" title="ডাউনভোট">
            <i class="fas fa-chevron-down text-sm"></i>
        </button>`;

    // ── Content column ───────────────────────
    const col = document.createElement('div');
    col.className = 'flex-1 min-w-0';

    // Author: name · time
    const authorLine = document.createElement('div');
    authorLine.className = 'flex items-center gap-1.5 text-[12px] text-gray-500 dark:text-gray-500 mb-2';
    authorLine.innerHTML = `
        <a href="user.html?id=${answer.author_id}" class="font-medium text-[#0056b3] hover:underline">…</a>
        <span class="text-gray-300 dark:text-gray-600 select-none">·</span>
        <span>${timeAgo(answer.created_at)}</span>`;

    fetchName(answer.author_id).then(name => {
        const a = authorLine.querySelector('a');
        if (a) a.textContent = name;
    });

    // Body
    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'answer-body prose prose-sm max-w-none text-gray-800 dark:text-gray-200 leading-relaxed mb-3';
    bodyDiv.innerHTML = sanitizeHTML(answer.body ?? '');

    // Action row: bookmark | মতামত (reply count)
    const isBm = localStorage.getItem(`abm_${answer.id}`) === 'true';

    const actionRow = document.createElement('div');
    actionRow.className = 'flex items-center gap-1 flex-wrap';
    actionRow.innerHTML = `
        <button class="ans-bm action-btn flex items-center gap-1 ${isBm ? 'text-[#0056b3]' : ''}" title="${isBm ? 'বুকমার্ক সরান' : 'বুকমার্ক'}">
            <i class="${isBm ? 'fas' : 'far'} fa-bookmark text-[11px]"></i> বুকমার্ক
        </button>
        <span class="text-gray-200 dark:text-gray-700 select-none mx-0.5">|</span>
        <button class="ans-opinion action-btn flex items-center gap-1" data-id="${answer.id}">
            <i class="far fa-comment-dots text-[11px]"></i>
            <span class="opinion-count"></span> মতামত
        </button>`;

    col.appendChild(authorLine);
    col.appendChild(bodyDiv);
    col.appendChild(actionRow);

    card.appendChild(voteCol);
    card.appendChild(col);

    // ── Vote events ──────────────────────────
    voteCol.querySelector('.ans-vote-up').addEventListener('click',
        () => handleAnswerVote(answer.id, 'up', voteCol));
    voteCol.querySelector('.ans-vote-down').addEventListener('click',
        () => handleAnswerVote(answer.id, 'down', voteCol));

    // ── Bookmark event ───────────────────────
    const bmBtn = actionRow.querySelector('.ans-bm');
    bmBtn.addEventListener('click', () => {
        const active = localStorage.getItem(`abm_${answer.id}`) === 'true';
        localStorage.setItem(`abm_${answer.id}`, active ? 'false' : 'true');
        const icon = bmBtn.querySelector('i');
        icon.className = `${active ? 'far' : 'fas'} fa-bookmark text-[11px]`;
        bmBtn.classList.toggle('text-[#0056b3]', !active);
        bmBtn.title = active ? 'বুকমার্ক' : 'বুকমার্ক সরান';
    });

    // ── মতামত button event ───────────────────
    actionRow.querySelector('.ans-opinion').addEventListener('click', () => {
        openOpinionModal(answer);
    });

    // ── Load reply count ─────────────────────
    loadReplyCount(answer.id, actionRow.querySelector('.opinion-count'));

    return card;
}

async function loadReplyCount(answerId, countEl) {
    const { count } = await supabase
        .from('answer').select('id', { count: 'exact', head: true })
        .eq('parent_answer_id', answerId);
    if (countEl) countEl.textContent = count ? `(${count})` : '';
}

// ─────────────────────────────────────────────
//  মতামত MODAL
// ─────────────────────────────────────────────

function initOpinionModal() {
    const overlay  = document.getElementById('opinion-modal-overlay');
    const modal    = document.getElementById('opinion-modal');
    const closeBtn = document.getElementById('opinion-modal-close');

    const close = () => {
        modal.classList.remove('modal-open');
        setTimeout(() => { overlay.classList.add('hidden'); }, 250);
        state.opinionAnswerId = null;
    };

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close();
    });
}

async function openOpinionModal(answer) {
    state.opinionAnswerId = answer.id;

    const overlay  = document.getElementById('opinion-modal-overlay');
    const modal    = document.getElementById('opinion-modal');
    const preview  = document.getElementById('opinion-answer-preview');
    const list     = document.getElementById('opinion-reply-list');
    const loading  = document.getElementById('opinion-loading');
    const empty    = document.getElementById('opinion-empty');

    // Set answer preview text
    const tmp = document.createElement('div');
    tmp.innerHTML = sanitizeHTML(answer.body ?? '');
    preview.textContent = tmp.textContent.trim().substring(0, 120) + (tmp.textContent.length > 120 ? '…' : '');

    // Show modal
    overlay.classList.remove('hidden');
    loading.classList.remove('hidden');
    empty.classList.add('hidden');

    // Clear old replies (keep loading + empty nodes)
    Array.from(list.children).forEach(c => {
        if (c.id !== 'opinion-empty' && c.id !== 'opinion-loading') c.remove();
    });

    requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('modal-open')));

    // Fetch replies
    const { data: replies, error } = await supabase
        .from('answer').select('*')
        .eq('parent_answer_id', answer.id)
        .order('created_at', { ascending: true });

    loading.classList.add('hidden');

    if (error || !replies?.length) {
        empty.classList.remove('hidden');
    } else {
        for (const r of replies) {
            list.insertBefore(buildOpinionItem(r), empty);
        }
    }

    // Init Quill editor for reply (lazy)
    initOpinionEditor();

    // Bind submit
    bindOpinionSubmit(answer.id);
}

function buildOpinionItem(reply) {
    const item = document.createElement('div');
    item.className = 'opinion-reply-item';
    item.innerHTML = `
        <div class="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-500 mb-1">
            <a href="user.html?id=${reply.author_id}" class="font-medium text-[#0056b3] hover:underline opinion-author-name">…</a>
            <span class="text-gray-300 dark:text-gray-700 select-none">·</span>
            <span>${timeAgo(reply.created_at)}</span>
        </div>
        <div class="answer-body prose prose-xs max-w-none text-gray-700 dark:text-gray-300 text-[13px] leading-relaxed">
            ${sanitizeHTML(reply.body ?? '')}
        </div>`;

    fetchName(reply.author_id).then(name => {
        const el = item.querySelector('.opinion-author-name');
        if (el) el.textContent = name;
    });

    typesetMath(item);
    return item;
}

function initOpinionEditor() {
    const wrap = document.getElementById('opinion-editor-wrap');

    // Login notice
    const noticeEl = document.getElementById('opinion-login-notice');
    const submitBtn = document.getElementById('opinion-submit-btn');

    if (!state.currentUserId) {
        noticeEl.classList.remove('hidden');
        wrap.classList.add('hidden');
        submitBtn.classList.add('hidden');
        return;
    }

    noticeEl.classList.add('hidden');
    wrap.classList.remove('hidden');
    submitBtn.classList.remove('hidden');

    if (state.opinionQuill) {
        state.opinionQuill.setContents([]);
        return;
    }

    state.opinionQuill = new Quill('#opinion-editor-wrap', {
        theme: 'snow',
        placeholder: 'আপনার মতামত লিখুন…',
        modules: {
            toolbar: [
                ['bold', 'italic', 'code-block'],
                ['link', 'formula'],
            ]
        }
    });

    if (document.documentElement.classList.contains('dark')) {
        const c = wrap.querySelector('.ql-container');
        const t = wrap.querySelector('.ql-toolbar');
        if (c) { c.style.background='#111'; c.style.color='#e5e5e5'; c.style.borderColor='#2d2d2d'; }
        if (t) { t.style.background='#1a1a1a'; t.style.borderColor='#2d2d2d'; }
    }
}

function bindOpinionSubmit(answerId) {
    const btn     = document.getElementById('opinion-submit-btn');
    const txt     = document.getElementById('opinion-submit-txt');
    const spin    = document.getElementById('opinion-submit-spin');
    const valMsg  = document.getElementById('opinion-val-msg');
    const list    = document.getElementById('opinion-reply-list');
    const empty   = document.getElementById('opinion-empty');

    // Remove old listener by cloning
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    // Re-grab the new elements (clone replaces DOM)
    const submitBtn  = document.getElementById('opinion-submit-btn');
    const submitTxt  = document.getElementById('opinion-submit-txt');
    const submitSpin = document.getElementById('opinion-submit-spin');
    const valMsgEl   = document.getElementById('opinion-val-msg');

    submitBtn.addEventListener('click', async () => {
        if (!state.currentUserId) { showToast('লগ ইন করুন।'); return; }
        const q = state.opinionQuill;
        if (!q) return;

        const html = q.root.innerHTML;
        const text = q.getText().trim();

        if (text.length < MIN_OPINION_LEN) { valMsgEl.classList.remove('hidden'); return; }
        valMsgEl.classList.add('hidden');

        submitBtn.disabled = true;
        submitSpin.classList.remove('hidden');
        submitTxt.textContent = 'পাঠানো হচ্ছে…';

        const { data: newReply, error } = await supabase
            .from('answer')
            .insert({
                question_id:      state.questionId,
                parent_answer_id: answerId,
                body:             html,
                author_id:        state.currentUserId,
                votes:            0,
                is_accepted:      false,
            })
            .select().single();

        submitBtn.disabled = false;
        submitSpin.classList.add('hidden');
        submitTxt.textContent = 'মতামত দিন';

        if (error) { showToast('পাঠাতে সমস্যা হয়েছে।'); console.error(error); return; }

        // Append new reply
        empty.classList.add('hidden');
        list.insertBefore(buildOpinionItem(newReply), empty);
        q.setContents([]);

        // Update reply count on card
        const card = document.getElementById(`answer-${answerId}`);
        if (card) {
            const countEl = card.querySelector('.opinion-count');
            if (countEl) loadReplyCount(answerId, countEl);
        }
    });
}

// ─────────────────────────────────────────────
//  VOTE — QUESTION
// ─────────────────────────────────────────────

function bindQuestionVotes(q) {
    const up    = document.getElementById('q-vote-up');
    const down  = document.getElementById('q-vote-down');
    const count = document.getElementById('q-vote-count');
    const key   = `q_vote_${q.id}`;

    const prev = sessionStorage.getItem(key);
    if (prev === 'up')   up.classList.add('active-up');
    if (prev === 'down') down.classList.add('active-down');

    up.addEventListener('click', async () => {
        if (!state.currentUserId) { showToast('লগ ইন করুন।'); return; }
        const p = sessionStorage.getItem(key); if (p === 'up') return;
        const cur = parseInt(count.textContent) || 0;
        const d = p === 'down' ? 2 : 1;
        count.textContent = cur + d;
        up.classList.add('active-up'); down.classList.remove('active-down');
        sessionStorage.setItem(key, 'up');
        await supabase.from('question').update({ votes: cur + d }).eq('id', q.id);
    });

    down.addEventListener('click', async () => {
        if (!state.currentUserId) { showToast('লগ ইন করুন।'); return; }
        const p = sessionStorage.getItem(key); if (p === 'down') return;
        const cur = parseInt(count.textContent) || 0;
        const d = p === 'up' ? 2 : 1;
        count.textContent = cur - d;
        down.classList.add('active-down'); up.classList.remove('active-up');
        sessionStorage.setItem(key, 'down');
        await supabase.from('question').update({ votes: cur - d }).eq('id', q.id);
    });
}

// ─────────────────────────────────────────────
//  VOTE — ANSWER
// ─────────────────────────────────────────────

async function handleAnswerVote(answerId, dir, voteCol) {
    if (!state.currentUserId) { showToast('লগ ইন করুন।'); return; }
    const key  = `a_vote_${answerId}`;
    const prev = sessionStorage.getItem(key);
    if (prev === dir) return;

    const countEl = voteCol.querySelector('.ans-vote-count');
    const cur     = parseInt(countEl.textContent) || 0;
    const delta   = dir === 'up' ? (prev === 'down' ? 2 : 1) : (prev === 'up' ? -2 : -1);

    countEl.textContent = cur + delta;
    const upBtn   = voteCol.querySelector('.ans-vote-up');
    const downBtn = voteCol.querySelector('.ans-vote-down');
    if (dir === 'up') { upBtn.classList.add('active-up'); downBtn.classList.remove('active-down'); }
    else { downBtn.classList.add('active-down'); upBtn.classList.remove('active-up'); }
    sessionStorage.setItem(key, dir);

    await supabase.from('answer').update({ votes: cur + delta }).eq('id', answerId);
}

// ─────────────────────────────────────────────
//  SORT & PAGINATION
// ─────────────────────────────────────────────

function bindSortChange() {
    document.getElementById('answer-sort').addEventListener('change', async e => {
        state.sortBy = e.target.value;
        await loadAnswers(true);
    });
}

function bindLoadMore() {
    document.getElementById('load-more-btn').addEventListener('click', async () => {
        state.currentPage++;
        await loadAnswers(false);
    });
}

// ─────────────────────────────────────────────
//  FAB + MAIN ANSWER MODAL
// ─────────────────────────────────────────────

function initAnswerFAB() {
    const fab      = document.getElementById('fab-answer-btn');
    const overlay  = document.getElementById('answer-modal-overlay');
    const modal    = document.getElementById('answer-modal');
    const closeBtn = document.getElementById('answer-modal-close');
    const cancel   = document.getElementById('answer-modal-cancel');
    const titlePrev = document.getElementById('modal-question-title-preview');

    fab.classList.remove('hidden');
    if (titlePrev && state.question?.title) titlePrev.textContent = state.question.title;

    const open = () => {
        overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('modal-open')));
        if (!state.quillEditor) initModalQuill();
    };
    const close = () => {
        modal.classList.remove('modal-open');
        setTimeout(() => { overlay.classList.add('hidden'); document.body.style.overflow = ''; }, 300);
    };

    fab.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    cancel.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close();
    });
}

function initModalQuill() {
    if (!state.currentUserId) {
        document.getElementById('answer-editor-modal').classList.add('hidden');
        document.getElementById('submit-answer-btn-modal').classList.add('hidden');
        document.getElementById('preview-toggle-btn-modal').classList.add('hidden');
        document.getElementById('login-required-notice-modal').classList.remove('hidden');
        return;
    }
    state.quillEditor = new Quill('#answer-editor-modal', {
        theme: 'snow',
        placeholder: 'আপনার উত্তর এখানে লিখুন… (LaTeX: $E=mc^2$)',
        modules: {
            toolbar: [
                ['bold','italic','underline','strike'],
                ['blockquote','code-block'],
                [{ list:'ordered' },{ list:'bullet' }],
                ['link','image','formula'],
                ['clean']
            ]
        }
    });
    if (document.documentElement.classList.contains('dark')) {
        const c = document.querySelector('#answer-editor-modal .ql-container');
        const t = document.querySelector('#answer-editor-modal .ql-toolbar');
        if (c) { c.style.background='#161616'; c.style.color='#e5e5e5'; c.style.borderColor='#444'; }
        if (t) { t.style.background='#252525'; t.style.borderColor='#444'; }
    }
}

// ─────────────────────────────────────────────
//  SUBMIT MAIN ANSWER (bottom-of-page form)
// ─────────────────────────────────────────────

function initMainAnswerEditor() {
    if (!state.currentUserId) {
        document.getElementById('answer-editor').classList.add('hidden');
        document.getElementById('submit-answer-btn').classList.add('hidden');
        document.getElementById('preview-toggle-btn').classList.add('hidden');
        document.getElementById('login-required-notice').classList.remove('hidden');
        return;
    }
    new Quill('#answer-editor', {
        theme: 'snow',
        placeholder: 'আপনার উত্তর লিখুন… (LaTeX: $E=mc^2$)',
        modules: {
            toolbar: [
                ['bold','italic','underline','strike'],
                ['blockquote','code-block'],
                [{ list:'ordered' },{ list:'bullet' }],
                ['link','image','formula'],
                ['clean']
            ]
        }
    });
}

function bindSubmitAnswer() {
    // Modal submit
    document.getElementById('submit-answer-btn-modal')?.addEventListener('click', async () => {
        const ed = state.quillEditor;
        if (!ed) return;
        const html = ed.root.innerHTML;
        const text = ed.getText().trim();
        const msg  = document.getElementById('answer-validation-msg-modal');
        if (text.length < MIN_ANSWER_LENGTH) { msg.classList.remove('hidden'); return; }
        msg.classList.add('hidden');
        await doSubmitAnswer(html,
            document.getElementById('submit-btn-text-modal'),
            document.getElementById('submit-spinner-modal'),
            document.getElementById('submit-answer-btn-modal'));
        ed.setContents([]);
        const modal   = document.getElementById('answer-modal');
        const overlay = document.getElementById('answer-modal-overlay');
        modal.classList.remove('modal-open');
        setTimeout(() => { overlay.classList.add('hidden'); document.body.style.overflow=''; }, 300);
    });

    // Bottom-form submit
    document.getElementById('submit-answer-btn')?.addEventListener('click', async () => {
        // Get the Quill instance by the container
        const qc = document.querySelector('#answer-editor .ql-editor');
        if (!qc) return;
        const html = qc.innerHTML;
        const text = qc.textContent?.trim() ?? '';
        const msg  = document.getElementById('answer-validation-msg');
        if (text.length < MIN_ANSWER_LENGTH) { msg.classList.remove('hidden'); return; }
        msg.classList.add('hidden');
        await doSubmitAnswer(html,
            document.getElementById('submit-btn-text'),
            document.getElementById('submit-spinner'),
            document.getElementById('submit-answer-btn'));
        qc.innerHTML = '<p><br></p>';
    });
}

async function doSubmitAnswer(html, txtEl, spinEl, btnEl) {
    btnEl.disabled = true;
    spinEl.classList.remove('hidden');
    txtEl.textContent = 'জমা হচ্ছে…';

    const { error } = await supabase.from('answer').insert({
        question_id: state.questionId, parent_answer_id: null,
        body: html, author_id: state.currentUserId, votes: 0, is_accepted: false,
    });

    btnEl.disabled = false;
    spinEl.classList.add('hidden');
    txtEl.textContent = btnEl.id === 'submit-answer-btn-modal' ? 'জমা দিন' : 'উত্তর জমা দিন';

    if (error) { showToast('উত্তর জমা দিতে সমস্যা।'); console.error(error); return; }

    await loadAnswers(true);
    document.getElementById('answer-list')?.scrollIntoView({ behavior:'smooth', block:'start' });
}

// ─────────────────────────────────────────────
//  PREVIEW (bottom form)
// ─────────────────────────────────────────────

function bindPreviewToggle() {
    const btn   = document.getElementById('preview-toggle-btn');
    const panel = document.getElementById('answer-preview');
    const modalBtn   = document.getElementById('preview-toggle-btn-modal');
    const modalPanel = document.getElementById('answer-preview-modal');

    btn?.addEventListener('click', () => {
        state.previewVisible = !state.previewVisible;
        const qc = document.querySelector('#answer-editor .ql-editor');
        if (state.previewVisible && qc) {
            panel.innerHTML = sanitizeHTML(qc.innerHTML);
            panel.classList.remove('hidden');
            typesetMath(panel);
            btn.innerHTML = '<i class="fas fa-eye-slash mr-1"></i> লুকান';
        } else {
            panel.classList.add('hidden');
            btn.innerHTML = '<i class="fas fa-eye mr-1"></i> প্রিভিউ';
        }
    });

    modalBtn?.addEventListener('click', () => {
        const open = !modalPanel.classList.contains('hidden');
        if (!open && state.quillEditor) {
            modalPanel.innerHTML = sanitizeHTML(state.quillEditor.root.innerHTML);
            modalPanel.classList.remove('hidden');
            typesetMath(modalPanel);
            modalBtn.innerHTML = '<i class="fas fa-eye-slash text-[10px]"></i> লুকান';
        } else {
            modalPanel.classList.add('hidden');
            modalBtn.innerHTML = '<i class="fas fa-eye text-[10px]"></i> প্রিভিউ';
        }
    });
}

// ─────────────────────────────────────────────
//  SHARE
// ─────────────────────────────────────────────

function bindShareButton() {
    document.getElementById('q-share-btn')?.addEventListener('click', async () => {
        const data = { title: state.question?.title ?? 'PhysFlow', url: window.location.href };
        if (navigator.share) {
            try { await navigator.share(data); return; } catch(e) { if (e.name==='AbortError') return; }
        }
        try { await navigator.clipboard.writeText(window.location.href); }
        catch {
            const ta = document.createElement('textarea');
            ta.value = window.location.href;
            Object.assign(ta.style,{position:'fixed',opacity:'0'});
            document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); document.body.removeChild(ta);
        }
        const copied = document.getElementById('share-copied');
        if (copied) { copied.classList.remove('hidden'); setTimeout(()=>copied.classList.add('hidden'),2200); }
    });
}

// ─────────────────────────────────────────────
//  BOOKMARK (question)
// ─────────────────────────────────────────────

function bindBookmarkButton() {
    const btn = document.getElementById('q-bookmark');
    if (!btn) return;
    const key = `qbm_${state.questionId}`;
    let bm = localStorage.getItem(key) === 'true';
    updateQBm(btn, bm);
    btn.addEventListener('click', () => { bm=!bm; localStorage.setItem(key,bm); updateQBm(btn,bm); });
}
function updateQBm(btn, active) {
    btn.querySelector('i').className = `${active?'fas':'far'} fa-bookmark text-sm`;
    if (active) btn.classList.add('active-up'); else btn.classList.remove('active-up');
    btn.title = active ? 'বুকমার্ক সরান' : 'বুকমার্ক';
}

// ─────────────────────────────────────────────
//  VIEW COUNT
// ─────────────────────────────────────────────

async function incrementViewCount() {
    const key = `viewed_${state.questionId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    const cur = state.question?.views ?? 0;
    await supabase.from('question').update({ views: cur+1 }).eq('id', state.questionId);
}

// ─────────────────────────────────────────────
//  RELATED QUESTIONS
// ─────────────────────────────────────────────

async function loadRelatedQuestions() {
    const kw = (state.question?.title ?? '').split(/\s+/).filter(w=>w.length>3).slice(0,3);
    if (!kw.length) return;
    const { data: rel } = await supabase.from('question').select('id,title,votes')
        .neq('id', state.questionId).or(kw.map(k=>`title.ilike.%${k}%`).join(',')).limit(5);
    if (!rel?.length) return;
    document.getElementById('related-questions-section').classList.remove('hidden');
    const ul = document.getElementById('related-questions-list');
    ul.innerHTML = '';
    rel.forEach(q => {
        const li = document.createElement('li');
        li.innerHTML = `<a href="question.html?id=${q.id}" class="flex items-start gap-2 group">
            <span class="shrink-0 text-[11px] text-gray-500 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 min-w-[28px] text-center">${q.votes??0}</span>
            <span class="text-[#0056b3] group-hover:underline text-sm leading-snug">${escapeHTML(q.title)}</span>
        </a>`;
        ul.appendChild(li);
    });
}

// ─────────────────────────────────────────────
//  SEO
// ─────────────────────────────────────────────

function injectSEOMeta(q) {
    const tmp = document.createElement('div'); tmp.innerHTML = q.body ?? '';
    const desc = (tmp.textContent||'').trim().substring(0,150);
    const url  = `https://physflow.pages.dev/question?id=${q.id}`;
    document.title = `${q.title} - PhysFlow`;
    setMeta('name','description',desc);
    setMeta('property','og:title',q.title);
    setMeta('property','og:description',desc);
    setMeta('property','og:url',url);
    const c = document.getElementById('canonical-link'); if (c) c.href = url;
}
function setMeta(attr, val, content) {
    let el = document.querySelector(`meta[${attr}="${val}"]`);
    if (!el) { el=document.createElement('meta'); el.setAttribute(attr,val); document.head.appendChild(el); }
    el.setAttribute('content',content);
}

// ─────────────────────────────────────────────
//  JSON-LD
// ─────────────────────────────────────────────

function injectStructuredData(question, answers) {
    document.getElementById('jsonld-qa')?.remove();
    if (!question) return;
    const tmp = document.createElement('div'); tmp.innerHTML = question.body??'';
    const s = document.createElement('script');
    s.id='jsonld-qa'; s.type='application/ld+json';
    s.textContent = JSON.stringify({
        '@context':'https://schema.org','@type':'QAPage',
        mainEntity:{ '@type':'Question', name:question.title,
            text:(tmp.textContent||'').trim().substring(0,500),
            dateCreated:question.created_at, answerCount:answers.length,
            suggestedAnswer: answers.map(a => {
                const d=document.createElement('div'); d.innerHTML=a.body??'';
                return { '@type':'Answer', text:(d.textContent||'').trim().substring(0,500),
                    upvoteCount:a.votes??0, dateCreated:a.created_at };
            })
        }
    },null,2);
    document.head.appendChild(s);
}

// ─────────────────────────────────────────────
//  FETCH NAME
// ─────────────────────────────────────────────

/**
 * user_names view থেকে নাম নেয়।
 * View তৈরির জন্য: setup_user_names_view.sql Supabase SQL Editor-এ run করুন।
 */
async function fetchName(authorId) {
    if (!authorId) return 'অজানা';
    if (nameCache.has(authorId)) return nameCache.get(authorId);

    // 1. public.user_names view
    try {
        const { data, error } = await supabase
            .from('user_names').select('display_name').eq('id',authorId).maybeSingle();
        if (!error && data?.display_name) {
            nameCache.set(authorId, data.display_name);
            return data.display_name;
        }
    } catch(_) {}

    // 2. Current user's own metadata
    if (state.currentUserId === authorId && state.currentUser) {
        const meta = state.currentUser.user_metadata ?? {};
        const name = meta.username || meta.full_name || meta.name ||
            (state.currentUser.email ? state.currentUser.email.split('@')[0] : null) || 'ব্যবহারকারী';
        nameCache.set(authorId, name);
        return name;
    }

    const fb = 'ব্যবহারকারী';
    nameCache.set(authorId, fb);
    return fb;
}

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

function typesetMath(el) { window.MathJax?.typesetPromise?.([el]).catch(()=>{}); }

function sanitizeHTML(dirty) {
    if (typeof DOMPurify === 'undefined') return dirty;
    return DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS:['p','br','strong','em','u','s','span','div','ul','ol','li',
                      'blockquote','pre','code','h1','h2','h3','h4','h5','h6',
                      'a','img','table','thead','tbody','tr','td','th','sup','sub'],
        ALLOWED_ATTR:['href','src','alt','class','style','target','rel'],
        ALLOW_DATA_ATTR:false,
    });
}

function timeAgo(iso) {
    if (!iso) return '';
    const d = Math.floor((Date.now()-new Date(iso))/1000);
    const b = n => String(n).replace(/\d/g, x=>'০১২৩৪৫৬৭৮৯'[x]);
    if (d<60)        return 'এইমাত্র';
    if (d<3600)      return `${b(Math.floor(d/60))} মিনিট আগে`;
    if (d<86400)     return `${b(Math.floor(d/3600))} ঘন্টা আগে`;
    if (d<86400*7)   return `${b(Math.floor(d/86400))} দিন আগে`;
    if (d<86400*30)  return `${b(Math.floor(d/86400/7))} সপ্তাহ আগে`;
    if (d<86400*365) return `${b(Math.floor(d/86400/30))} মাস আগে`;
    return `${b(Math.floor(d/86400/365))} বছর আগে`;
}

function formatNumber(n) { return n>=1000 ? (n/1000).toFixed(1)+'k' : String(n); }

function escapeHTML(s) {
    return (s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                  .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function showSkeleton(show) {
    document.getElementById('loading-skeleton')?.classList.toggle('hidden',!show);
}

function showNotFound() {
    showSkeleton(false);
    document.getElementById('not-found-ui')?.classList.remove('hidden');
}

function showToast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 z-[999] bg-gray-800 dark:bg-[#222] text-white text-xs px-4 py-2 rounded-full shadow-lg';
    document.body.appendChild(t);
    setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(()=>t.remove(),350); }, 2200);
}
