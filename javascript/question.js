/**
 * question.js — PhysFlow Question Detail Page
 *
 * নাম দেখানোর পদ্ধতি:
 *   Supabase-এ auth.users সরাসরি JS client দিয়ে query করা যায় না।
 *   তাই setup_user_names_view.sql দিয়ে public.user_names view তৈরি করতে হবে।
 *   এই ফাইল সেই view থেকেই নাম নেয়।
 *   View না থাকলে: logged-in user হলে auth metadata থেকে, অন্যথায় "ব্যবহারকারী" দেখায়।
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
    currentUser:    null,     // full auth user object (for metadata fallback)
    quillEditor:    null,
    previewVisible: false,
    replyQuillEditor: null,   // for reply modal
    replyPreviewVisible: false,
    currentReplyAnswerId: null,
};

/** authorId → displayName */
const nameCache = new Map();

// ─────────────────────────────────────────────
//  ENTRY POINT
// ─────────────────────────────────────────────

export async function initQuestionPage() {
    const params = new URLSearchParams(window.location.search);
    state.questionId = params.get('id');

    if (!state.questionId) { showNotFound('প্রশ্নের আইডি পাওয়া যায়নি।'); return; }

    const { data: { user } } = await supabase.auth.getUser();
    state.currentUserId = user?.id ?? null;
    state.currentUser   = user ?? null;

    await loadQuestion();
    bindSortChange();
    bindLoadMore();
    bindShareButton();
    bindBookmarkButton();
    initReplyModal();
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
    document.getElementById('question-title').textContent = q.title;

    document.getElementById('question-views').innerHTML =
        `<i class="far fa-eye"></i> ${formatNumber(q.views ?? 0)} বার দেখা হয়েছে`;

    document.getElementById('q-vote-count').textContent = q.votes ?? 0;

    const bodyEl = document.getElementById('question-body');
    bodyEl.innerHTML = sanitizeHTML(q.body ?? '');
    typesetMath(bodyEl);

    renderTags(q.tags ?? []);

    if (state.currentUserId && state.currentUserId === q.author_id)
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
    (tags ?? []).forEach(tag => {
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
        state.currentPage = 0;
        state.answers     = [];
        document.getElementById('answer-list').innerHTML = '';
    }

    const offset = state.currentPage * ANSWERS_PER_PAGE;

    let query = supabase
        .from('answer')
        .select('*', { count: 'exact' })
        .eq('question_id', state.questionId)
        .is('parent_answer_id', null)
        .range(offset, offset + ANSWERS_PER_PAGE - 1);

    if      (state.sortBy === 'newest') query = query.order('created_at', { ascending: false });
    else if (state.sortBy === 'oldest') query = query.order('created_at', { ascending: true  });
    else    query = query.order('votes', { ascending: false }).order('created_at', { ascending: true });

    const { data: answers, error, count } = await query;
    if (error) { console.error('loadAnswers:', error); return; }

    state.totalAnswers = count ?? 0;
    state.answers      = reset ? (answers ?? []) : [...state.answers, ...(answers ?? [])];

    document.getElementById('answer-count-num').textContent = state.totalAnswers;

    const list = document.getElementById('answer-list');
    for (const a of (answers ?? [])) {
        list.appendChild(await buildAnswerThread(a, 0));
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

async function buildAnswerThread(answer, depth) {
    const wrapper = document.createElement('div');
    wrapper.id = `answer-${answer.id}`;

    const row = document.createElement('div');
    row.className = depth === 0 ? 'answer-card' : 'pt-2';

    const col = document.createElement('div');
    col.className = 'min-w-0';

    // ── Author: name · time ──────────────────
    const authorName = await fetchName(answer.author_id);
    const authorLine = document.createElement('div');
    authorLine.className = 'flex items-center gap-1 text-[12px] text-gray-500 dark:text-gray-500 mb-1.5';
    authorLine.innerHTML = `
        <a href="user.html?id=${answer.author_id}"
           class="font-medium text-[#0056b3] hover:underline">${escapeHTML(authorName)}</a>
        <span class="text-gray-300 dark:text-gray-700 select-none px-0.5">·</span>
        <span>${timeAgo(answer.created_at)}</span>`;

    // ── Body ─────────────────────────────────
    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'answer-body prose prose-sm max-w-none text-gray-800 dark:text-gray-200 leading-relaxed text-[14.5px]';
    bodyDiv.innerHTML = sanitizeHTML(answer.body ?? '');

    // ── Action row: ↑ count ↓ | bm | reply ──
    const voteKey  = `a_vote_${answer.id}`;
    const bmKey    = `abm_${answer.id}`;
    const prevVote = sessionStorage.getItem(voteKey);
    const isBm     = localStorage.getItem(bmKey) === 'true';

    const actionRow = document.createElement('div');
    actionRow.className = 'flex items-center gap-0 mt-2';
    actionRow.innerHTML = `
        <button class="ans-up action-btn px-2 ${prevVote === 'up' ? 'vote-active-up' : ''}" title="উপভোট">
            <i class="fas fa-arrow-up" style="font-size:10px"></i>
        </button>
        <span class="ans-count text-[12px] font-medium text-gray-500 dark:text-gray-500 px-0.5 min-w-[16px] text-center">
            ${answer.votes ?? 0}
        </span>
        <button class="ans-down action-btn px-2 ${prevVote === 'down' ? 'vote-active-down' : ''}" title="ডাউনভোট">
            <i class="fas fa-arrow-down" style="font-size:10px"></i>
        </button>
        <span class="w-px h-3 bg-gray-200 dark:bg-gray-800 mx-1.5 shrink-0"></span>
        <button class="ans-bm action-btn px-2 ${isBm ? 'bm-active' : ''}" title="${isBm ? 'বুকমার্ক সরান' : 'বুকমার্ক'}">
            <i class="${isBm ? 'fas' : 'far'} fa-bookmark" style="font-size:10px"></i>
        </button>
        <span class="w-px h-3 bg-gray-200 dark:bg-gray-800 mx-1.5 shrink-0"></span>
        <button class="ans-reply action-btn px-2" title="মতামত দিন">
            <i class="fas fa-comment" style="font-size:10px"></i> মতামত
        </button>`;

    col.appendChild(authorLine);
    col.appendChild(bodyDiv);
    col.appendChild(actionRow);
    row.appendChild(col);
    wrapper.appendChild(row);

    // ── Thread replies ───────────────────────
    const { data: replies } = await supabase
        .from('answer').select('*')
        .eq('parent_answer_id', answer.id)
        .order('created_at', { ascending: true });

    if (replies?.length) {
        const block = document.createElement('div');
        block.className = 'flex gap-2 mt-0.5 ml-2';

        const line = document.createElement('div');
        line.className = 'thread-line';
        line.title = 'ক্লিক করুন ভাঁজ / খুলতে';

        const rWrap = document.createElement('div');
        rWrap.className = 'flex-1 min-w-0';

        for (const r of replies)
            rWrap.appendChild(await buildAnswerThread(r, depth + 1));

        let collapsed = false;
        line.addEventListener('click', () => {
            collapsed = !collapsed;
            rWrap.style.display  = collapsed ? 'none' : '';
            line.style.opacity   = collapsed ? '0.2'  : '1';
        });

        block.appendChild(line);
        block.appendChild(rWrap);
        wrapper.appendChild(block);
    }

    // ── Events ───────────────────────────────
    const upBtn   = actionRow.querySelector('.ans-up');
    const downBtn = actionRow.querySelector('.ans-down');
    const bmBtn   = actionRow.querySelector('.ans-bm');
    const rplBtn  = actionRow.querySelector('.ans-reply');

    upBtn.addEventListener('click',   () => handleAnswerVote(answer.id, 'up',   actionRow));
    downBtn.addEventListener('click', () => handleAnswerVote(answer.id, 'down', actionRow));

    bmBtn.addEventListener('click', () => {
        const active = localStorage.getItem(bmKey) === 'true';
        localStorage.setItem(bmKey, active ? 'false' : 'true');
        bmBtn.querySelector('i').className = `${active ? 'far' : 'fas'} fa-bookmark`;
        bmBtn.querySelector('i').style.fontSize = '10px';
        bmBtn.title = active ? 'বুকমার্ক' : 'বুকমার্ক সরান';
        bmBtn.classList.toggle('bm-active', !active);
    });

    rplBtn.addEventListener('click', () => {
        openReplyModal(answer);
    });

    return wrapper;
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
        if (!state.currentUserId) { showLoginToast(); return; }
        const p = sessionStorage.getItem(key);
        if (p === 'up') return;
        const cur = parseInt(count.textContent) || 0;
        const d   = p === 'down' ? 2 : 1;
        count.textContent = cur + d;
        up.classList.add('active-up'); down.classList.remove('active-down');
        sessionStorage.setItem(key, 'up');
        await supabase.from('question').update({ votes: cur + d }).eq('id', q.id);
    });

    down.addEventListener('click', async () => {
        if (!state.currentUserId) { showLoginToast(); return; }
        const p = sessionStorage.getItem(key);
        if (p === 'down') return;
        const cur = parseInt(count.textContent) || 0;
        const d   = p === 'up' ? 2 : 1;
        count.textContent = cur - d;
        down.classList.add('active-down'); up.classList.remove('active-up');
        sessionStorage.setItem(key, 'down');
        await supabase.from('question').update({ votes: cur - d }).eq('id', q.id);
    });
}

// ─────────────────────────────────────────────
//  VOTE — ANSWER
// ─────────────────────────────────────────────

async function handleAnswerVote(answerId, dir, row) {
    if (!state.currentUserId) { showLoginToast(); return; }

    const key  = `a_vote_${answerId}`;
    const prev = sessionStorage.getItem(key);
    if (prev === dir) return;

    const countEl = row.querySelector('.ans-count');
    const cur     = parseInt(countEl.textContent) || 0;
    const delta   = dir === 'up' ? (prev === 'down' ? 2 : 1) : (prev === 'up' ? -2 : -1);

    countEl.textContent = cur + delta;

    const upBtn   = row.querySelector('.ans-up');
    const downBtn = row.querySelector('.ans-down');
    if (dir === 'up') {
        upBtn.classList.add('vote-active-up');
        downBtn.classList.remove('vote-active-down');
    } else {
        downBtn.classList.add('vote-active-down');
        upBtn.classList.remove('vote-active-up');
    }
    sessionStorage.setItem(key, dir);

    const { error } = await supabase.from('answer').update({ votes: cur + delta }).eq('id', answerId);
    if (error) console.error('vote error:', error);
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
//  FAB + MODAL
// ─────────────────────────────────────────────

function initAnswerModal() {
    const fab       = document.getElementById('fab-answer-btn');
    const overlay   = document.getElementById('answer-modal-overlay');
    const modal     = document.getElementById('answer-modal');
    const closeBtn  = document.getElementById('answer-modal-close');
    const cancelBtn = document.getElementById('answer-modal-cancel');
    const preview   = document.getElementById('modal-question-title-preview');

    fab.classList.remove('hidden');
    if (preview && state.question?.title) preview.textContent = state.question.title;

    const open  = () => {
        overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('modal-open')));
        if (!state.quillEditor) initQuillEditor();
    };
    const close = () => {
        modal.classList.remove('modal-open');
        setTimeout(() => { overlay.classList.add('hidden'); document.body.style.overflow = ''; }, 280);
    };

    fab.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close();
    });
}

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
    if (document.documentElement.classList.contains('dark')) {
        const c = document.querySelector('#answer-editor .ql-container');
        const t = document.querySelector('#answer-editor .ql-toolbar');
        if (c) { c.style.background='#111'; c.style.color='#e5e5e5'; c.style.borderColor='#252525'; }
        if (t) { t.style.background='#181818'; t.style.borderColor='#252525'; }
    }
}

// ─────────────────────────────────────────────
//  SUBMIT MAIN ANSWER
// ─────────────────────────────────────────────

function bindSubmitAnswer() {
    document.getElementById('submit-answer-btn').addEventListener('click', async () => {
        const ed = state.quillEditor;
        if (!ed) return;

        const html = ed.root.innerHTML;
        const text = ed.getText().trim();
        const msg  = document.getElementById('answer-validation-msg');

        if (text.length < MIN_ANSWER_LENGTH) { msg.classList.remove('hidden'); return; }
        msg.classList.add('hidden');

        setSubmitLoading(true);

        const { error } = await supabase.from('answer').insert({
            question_id: state.questionId, parent_answer_id: null,
            body: html, author_id: state.currentUserId, votes: 0, is_accepted: false,
        });

        setSubmitLoading(false);

        if (error) { showToast('উত্তর জমা দিতে সমস্যা হয়েছে।'); console.error(error); return; }

        ed.setContents([]);
        await loadAnswers(true);

        const modal   = document.getElementById('answer-modal');
        const overlay = document.getElementById('answer-modal-overlay');
        modal.classList.remove('modal-open');
        setTimeout(() => { overlay.classList.add('hidden'); document.body.style.overflow = ''; }, 280);
        document.getElementById('answer-list')?.scrollIntoView({ behavior:'smooth', block:'start' });
    });
}

function setSubmitLoading(on) {
    const btn  = document.getElementById('submit-answer-btn');
    const spin = document.getElementById('submit-spinner');
    const txt  = document.getElementById('submit-btn-text');
    btn.disabled = on;
    spin.classList.toggle('hidden', !on);
    txt.textContent = on ? 'জমা হচ্ছে...' : 'জমা দিন';
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
            btn.innerHTML = '<i class="fas fa-eye-slash" style="font-size:10px"></i> লুকান';
        } else {
            panel.classList.add('hidden');
            btn.innerHTML = '<i class="fas fa-eye" style="font-size:10px"></i> প্রিভিউ';
        }
    });
}

// ─────────────────────────────────────────────
//  SHARE — native share sheet
// ─────────────────────────────────────────────

function bindShareButton() {
    document.getElementById('q-share-btn')?.addEventListener('click', async () => {
        const data = {
            title: state.question?.title ?? 'PhysFlow প্রশ্ন',
            text:  'PhysFlow-এ এই পদার্থবিজ্ঞান প্রশ্নটি দেখুন',
            url:   window.location.href,
        };
        if (navigator.share) {
            try { await navigator.share(data); return; }
            catch (e) { if (e.name === 'AbortError') return; }
        }
        try { await navigator.clipboard.writeText(window.location.href); }
        catch {
            const ta = document.createElement('textarea');
            ta.value = window.location.href;
            Object.assign(ta.style, { position:'fixed', opacity:'0' });
            document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); document.body.removeChild(ta);
        }
        showToast('লিংক কপি হয়েছে!');
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
    updateBmUI(btn, bm);
    btn.addEventListener('click', () => { bm = !bm; localStorage.setItem(key, bm); updateBmUI(btn, bm); });
}

function updateBmUI(btn, active) {
    const i = btn.querySelector('i');
    i.className     = active ? 'fas fa-bookmark' : 'far fa-bookmark';
    i.style.fontSize = '9px';
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
    await supabase.from('question').update({ views: cur + 1 }).eq('id', state.questionId);
}

// ─────────────────────────────────────────────
//  RELATED QUESTIONS
// ─────────────────────────────────────────────

async function loadRelatedQuestions() {
    const kw = (state.question?.title ?? '').split(/\s+/).filter(w => w.length > 3).slice(0, 3);
    if (!kw.length) return;

    const { data: rel } = await supabase
        .from('question').select('id, title, votes')
        .neq('id', state.questionId)
        .or(kw.map(k => `title.ilike.%${k}%`).join(','))
        .limit(5);

    if (!rel?.length) return;
    document.getElementById('related-questions-section').classList.remove('hidden');
    const list = document.getElementById('related-questions-list');
    list.innerHTML = '';
    rel.forEach(q => {
        const li = document.createElement('li');
        li.innerHTML = `
            <a href="question.html?id=${q.id}" class="flex items-start gap-2 group">
                <span class="shrink-0 text-[10px] text-gray-400 border border-gray-200 dark:border-[#222]
                             rounded px-1.5 py-0.5 min-w-[24px] text-center">${q.votes ?? 0}</span>
                <span class="text-[#0056b3] group-hover:underline text-[13px] leading-snug">${escapeHTML(q.title)}</span>
            </a>`;
        list.appendChild(li);
    });
}

// ─────────────────────────────────────────────
//  SEO
// ─────────────────────────────────────────────

function injectSEOMeta(q) {
    const tmp = document.createElement('div');
    tmp.innerHTML = q.body ?? '';
    const plain = (tmp.textContent || '').trim();
    const desc  = plain.substring(0, 150) + (plain.length > 150 ? '…' : '');
    const url   = `https://physflow.pages.dev/question?id=${q.id}`;
    document.title = `${q.title} - PhysFlow`;
    setMeta('name','description', desc);
    setMeta('property','og:title', q.title);
    setMeta('property','og:description', desc);
    setMeta('property','og:type','article');
    setMeta('property','og:url', url);
    const canon = document.getElementById('canonical-link');
    if (canon) canon.href = url;
}

function setMeta(attr, val, content) {
    let el = document.querySelector(`meta[${attr}="${val}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, val); document.head.appendChild(el); }
    el.setAttribute('content', content);
}

// ─────────────────────────────────────────────
//  JSON-LD
// ─────────────────────────────────────────────

function injectStructuredData(question, answers) {
    document.getElementById('jsonld-qa')?.remove();
    if (!question) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = question.body ?? '';
    const s = document.createElement('script');
    s.id = 'jsonld-qa'; s.type = 'application/ld+json';
    s.textContent = JSON.stringify({
        '@context':'https://schema.org','@type':'QAPage',
        mainEntity: {
            '@type':'Question', name: question.title,
            text: (tmp.textContent || '').trim().substring(0, 500),
            dateCreated: question.created_at, answerCount: answers.length,
            suggestedAnswer: answers.map(a => {
                const d = document.createElement('div'); d.innerHTML = a.body ?? '';
                return { '@type':'Answer', text:(d.textContent||'').trim().substring(0,500), upvoteCount: a.votes??0, dateCreated: a.created_at };
            }),
        }
    }, null, 2);
    document.head.appendChild(s);
}

// ─────────────────────────────────────────────
//  FETCH NAME — user_names view (auth.users metadata)
// ─────────────────────────────────────────────

/**
 * Gets the display name for a user.
 *
 * Requires: setup_user_names_view.sql を Supabase SQL Editor で実行済みであること
 * = Supabase SQL Editor-এ setup_user_names_view.sql একবার run করতে হবে।
 *
 * view query → logged-in user metadata → fallback
 */
async function fetchName(authorId) {
    if (!authorId) return 'অজানা';
    if (nameCache.has(authorId)) return nameCache.get(authorId);

    // ── 1. public.user_names view (সবচেয়ে নির্ভরযোগ্য) ──
    try {
        const { data, error } = await supabase
            .from('user_names')
            .select('display_name')
            .eq('id', authorId)
            .maybeSingle();

        if (!error && data?.display_name) {
            nameCache.set(authorId, data.display_name);
            return data.display_name;
        }
    } catch (_) { /* view নেই — পরের step-এ যাও */ }

    // ── 2. Currently logged-in user এর নিজের নাম ──
    if (state.currentUserId === authorId && state.currentUser) {
        const meta = state.currentUser.user_metadata ?? {};
        const name =
            meta.username     ||
            meta.full_name    ||
            meta.name         ||
            (state.currentUser.email ? state.currentUser.email.split('@')[0] : null) ||
            'ব্যবহারকারী';
        nameCache.set(authorId, name);
        return name;
    }

    // ── 3. Fallback ──
    const fb = 'ব্যবহারকারী';
    nameCache.set(authorId, fb);
    return fb;
}

// ─────────────────────────────────────────────
//  REPLY MODAL
// ─────────────────────────────────────────────

function initReplyModal() {
    const overlay = document.getElementById('reply-modal-overlay');
    const modal   = document.getElementById('reply-modal');
    const editor  = document.getElementById('reply-editor');
    
    // Initialize Quill editor for replies
    state.replyQuillEditor = new Quill(editor, {
        theme: 'snow',
        placeholder: 'আপনার মতামত লিখুন...',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline'],
                ['code-block', 'blockquote'],
                ['link', 'formula'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }]
            ]
        }
    });

    // Dark mode styling
    if (document.documentElement.classList.contains('dark')) {
        const container = editor.querySelector('.ql-container');
        const toolbar  = editor.querySelector('.ql-toolbar');
        if (container) {
            container.style.background   = '#111';
            container.style.color        = '#e5e5e5';
            container.style.borderColor  = '#252525';
        }
        if (toolbar) {
            toolbar.style.background  = '#181818';
            toolbar.style.borderColor = '#252525';
        }
    }

    // Close handlers
    document.getElementById('reply-modal-close').addEventListener('click', closeReplyModal);
    document.getElementById('reply-modal-cancel').addEventListener('click', closeReplyModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeReplyModal();
    });

    // Preview toggle
    document.getElementById('reply-preview-toggle-btn').addEventListener('click', () => {
        state.replyPreviewVisible = !state.replyPreviewVisible;
        const previewDiv = document.getElementById('reply-preview');
        const editorDiv  = document.getElementById('reply-editor');
        
        if (state.replyPreviewVisible) {
            const html = state.replyQuillEditor.root.innerHTML;
            previewDiv.innerHTML = sanitizeHTML(html);
            typesetMath(previewDiv);
            previewDiv.classList.remove('hidden');
            editorDiv.classList.add('hidden');
        } else {
            previewDiv.classList.add('hidden');
            editorDiv.classList.remove('hidden');
        }
    });

    // Submit reply
    document.getElementById('submit-reply-btn').addEventListener('click', submitReply);
}

function openReplyModal(answer) {
    state.currentReplyAnswerId = answer.id;
    
    // Show login notice if not logged in
    const loginNotice = document.getElementById('reply-login-required-notice');
    const submitBtn   = document.getElementById('submit-reply-btn');
    
    if (!state.currentUserId) {
        loginNotice.classList.remove('hidden');
        submitBtn.disabled = true;
    } else {
        loginNotice.classList.add('hidden');
        submitBtn.disabled = false;
    }
    
    // Set answer preview text
    const preview = document.getElementById('reply-modal-answer-preview');
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = answer.body;
    const plainText = (tempDiv.textContent || '').trim();
    preview.textContent = plainText.substring(0, 60) + (plainText.length > 60 ? '...' : '');
    
    // Clear editor
    state.replyQuillEditor.setText('');
    state.replyPreviewVisible = false;
    document.getElementById('reply-preview').classList.add('hidden');
    document.getElementById('reply-editor').classList.remove('hidden');
    document.getElementById('reply-validation-msg').classList.add('hidden');
    
    // Show modal with animation
    const overlay = document.getElementById('reply-modal-overlay');
    const modal   = document.getElementById('reply-modal');
    
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => {
        modal.classList.add('modal-open');
    });
}

function closeReplyModal() {
    const overlay = document.getElementById('reply-modal-overlay');
    const modal   = document.getElementById('reply-modal');
    
    modal.classList.remove('modal-open');
    setTimeout(() => {
        overlay.classList.add('hidden');
        state.currentReplyAnswerId = null;
    }, 280);
}

async function submitReply() {
    if (!state.currentUserId) {
        showLoginToast();
        return;
    }
    
    const validationMsg = document.getElementById('reply-validation-msg');
    const submitBtn     = document.getElementById('submit-reply-btn');
    const submitText    = document.getElementById('reply-submit-btn-text');
    const submitSpinner = document.getElementById('reply-submit-spinner');
    
    const html = state.replyQuillEditor.root.innerHTML;
    const text = state.replyQuillEditor.getText().trim();
    
    // Validate minimum length
    if (text.length < 10) {
        validationMsg.classList.remove('hidden');
        return;
    }
    
    validationMsg.classList.add('hidden');
    
    // Show loading state
    submitBtn.disabled = true;
    submitText.classList.add('hidden');
    submitSpinner.classList.remove('hidden');
    
    try {
        const { data, error } = await supabase
            .from('answer')
            .insert({
                question_id: state.questionId,
                parent_answer_id: state.currentReplyAnswerId,
                body: html,
                author_id: state.currentUserId,
                votes: 0
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // Close modal
        closeReplyModal();
        
        // Show success message
        showToast('মতামত সফলভাবে যোগ হয়েছে!');
        
        // Reload answers to show new reply
        await loadAnswers(true);
        
    } catch (err) {
        console.error('submitReply:', err);
        showToast('মতামত জমা দিতে সমস্যা হয়েছে।');
    } finally {
        submitBtn.disabled = false;
        submitText.classList.remove('hidden');
        submitSpinner.classList.add('hidden');
    }
}

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────

function typesetMath(el) {
    window.MathJax?.typesetPromise?.([el]).catch(e => console.warn('MathJax:', e));
}

function sanitizeHTML(dirty) {
    if (typeof DOMPurify === 'undefined') return dirty;
    return DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS: ['p','br','strong','em','u','s','span','div','ul','ol','li',
                       'blockquote','pre','code','h1','h2','h3','h4','h5','h6',
                       'a','img','table','thead','tbody','tr','td','th','sup','sub'],
        ALLOWED_ATTR: ['href','src','alt','class','style','target','rel'],
        ALLOW_DATA_ATTR: false,
    });
}

function timeAgo(iso) {
    if (!iso) return '';
    const d = Math.floor((Date.now() - new Date(iso)) / 1000);
    const b = n => String(n).replace(/\d/g, x => '০১২৩৪৫৬৭৮৯'[x]);
    if (d < 60)          return 'এইমাত্র';
    if (d < 3600)        return `${b(Math.floor(d/60))} মিনিট আগে`;
    if (d < 86400)       return `${b(Math.floor(d/3600))} ঘন্টা আগে`;
    if (d < 86400*7)     return `${b(Math.floor(d/86400))} দিন আগে`;
    if (d < 86400*30)    return `${b(Math.floor(d/86400/7))} সপ্তাহ আগে`;
    if (d < 86400*365)   return `${b(Math.floor(d/86400/30))} মাস আগে`;
    return `${b(Math.floor(d/86400/365))} বছর আগে`;
}

function formatNumber(n) { return n >= 1000 ? (n/1000).toFixed(1)+'k' : String(n); }

function escapeHTML(s) {
    return (s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
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

function showToast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.className = 'fixed bottom-20 left-1/2 -translate-x-1/2 z-[999] bg-gray-800 dark:bg-[#222] text-white text-xs px-4 py-2 rounded-full shadow-lg transition-opacity';
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; setTimeout(() => t.remove(), 350); }, 2200);
}
