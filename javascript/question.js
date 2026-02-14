/**
 * question.js — PhysFlow Question Detail (Reddit Style)
 * নাম দেখানোর জন্য: setup_user_names_view.sql Supabase SQL Editor-এ একবার run করুন।
 */

import { supabase } from './supabase-config.js';

// ─────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────

const ANSWERS_PER   = 5;
const MIN_ANS       = 30;
const MIN_OPINION   = 10;

const S = {
    qid:          null,
    question:     null,
    answers:      [],
    page:         0,
    total:        0,
    sort:         'votes',
    uid:          null,
    authUser:     null,
    mainQuill:    null,    // answer modal Quill
    opQuill:      null,    // opinion Quill
    opAnswerId:   null,    // which answer opinion modal is open for
};

const nameCache = new Map();

// ─────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────

export async function initQuestionPage() {
    S.qid = new URLSearchParams(location.search).get('id');
    if (!S.qid) { show404(); return; }

    const { data: { user } } = await supabase.auth.getUser();
    S.uid = user?.id ?? null; S.authUser = user ?? null;

    await loadQuestion();
    bindSort();
    bindLoadMore();
    bindShare();
    bindQBookmark();
    bindOpinionModal();
    bindAnswerModal();
}

// ─────────────────────────────────────────
//  LOAD QUESTION
// ─────────────────────────────────────────

async function loadQuestion() {
    setSkeleton(true);
    const { data: q, error } = await supabase.from('question').select('*').eq('id', S.qid).single();
    setSkeleton(false);
    if (error || !q) { show404(); return; }

    S.question = q;
    bumpView();
    renderQuestion(q);
    injectSEO(q);
    await loadAnswers(true);
    loadRelated();

    document.getElementById('question-content').style.display = '';
    document.getElementById('fab').style.display = 'flex';
    const mp = document.getElementById('answer-modal-q-title');
    if (mp) mp.textContent = q.title;
}

function renderQuestion(q) {
    document.getElementById('q-title').textContent   = q.title;
    document.getElementById('q-vote-count').textContent = bn(q.votes ?? 0);
    document.getElementById('q-views').textContent   = `${bn(q.views ?? 0)} বার দেখা হয়েছে`;
    document.getElementById('q-timeago').textContent = ago(q.created_at);
    document.getElementById('q-answer-count').textContent = bn(S.total);

    const body = document.getElementById('q-body');
    body.innerHTML = clean(q.body ?? '');
    MathJax?.typesetPromise?.([body]).catch(() => {});

    renderTags(q.tags ?? []);

    if (S.uid === q.author_id) document.getElementById('q-edit').classList.remove('hidden');

    fetchName(q.author_id).then(name => {
        const a = document.getElementById('q-author-link');
        if (a) { a.textContent = name; a.href = `user.html?id=${q.author_id}`; }
    });

    bindQVotes(q);
}

function renderTags(tags) {
    const c = document.getElementById('q-tags');
    c.innerHTML = '';
    tags.forEach(t => {
        const s = document.createElement('span');
        s.className = 'rh-tag';
        s.textContent = t;
        s.onclick = () => location.href = `questions.html?tag=${encodeURIComponent(t)}`;
        c.appendChild(s);
    });
}

// ─────────────────────────────────────────
//  LOAD ANSWERS
// ─────────────────────────────────────────

async function loadAnswers(reset = false) {
    if (reset) { S.page = 0; S.answers = []; document.getElementById('answer-list').innerHTML = ''; }

    const off = S.page * ANSWERS_PER;
    let q = supabase.from('answer').select('*', { count:'exact' })
        .eq('question_id', S.qid).is('parent_answer_id', null)
        .range(off, off + ANSWERS_PER - 1);

    if      (S.sort === 'newest') q = q.order('created_at', { ascending: false });
    else if (S.sort === 'oldest') q = q.order('created_at', { ascending: true  });
    else    q = q.order('votes', { ascending: false }).order('created_at', { ascending: true });

    const { data: ans, count } = await q;
    S.total   = count ?? 0;
    S.answers = reset ? (ans ?? []) : [...S.answers, ...(ans ?? [])];

    document.getElementById('q-answer-count').textContent = bn(S.total);

    const list = document.getElementById('answer-list');
    for (const a of (ans ?? [])) list.appendChild(makeAnswerCard(a));
    MathJax?.typesetPromise?.([list]).catch(() => {});

    const loaded = (S.page + 1) * ANSWERS_PER;
    document.getElementById('load-more-container').classList.toggle('hidden', S.total <= loaded);
    injectJSONLD(S.question, S.answers);
}

// ─────────────────────────────────────────
//  ANSWER CARD (Reddit comment style)
// ─────────────────────────────────────────

function makeAnswerCard(ans) {
    const wrap = document.createElement('div');
    wrap.id = `ans-${ans.id}`;
    wrap.className = 'rh-comment';

    const prevVote = sessionStorage.getItem(`av_${ans.id}`);
    const isBm     = localStorage.getItem(`abm_${ans.id}`) === 'true';

    wrap.innerHTML = `
        <!-- Author header -->
        <div class="rh-comment-header">
            <div class="rh-avatar" data-uid="${ans.author_id}">
                <span class="av-initials">…</span>
            </div>
            <div class="rh-comment-meta">
                <a href="user.html?id=${ans.author_id}" class="rh-username av-name">…</a>
                <span class="rh-timestamp">${ago(ans.created_at)}</span>
            </div>
        </div>

        <!-- Body -->
        <div class="rh-comment-body">${clean(ans.body ?? '')}</div>

        <!-- Actions -->
        <div class="rh-comment-actions">
            <!-- vote -->
            <div class="rh-c-vote">
                <button class="rh-c-vote-btn up ${prevVote==='up'?'active-up':''}" title="উপভোট">
                    <i class="fas fa-arrow-up" style="font-size:12px"></i>
                </button>
                <span class="rh-c-vote-count av-vc">${bn(ans.votes ?? 0)}</span>
                <button class="rh-c-vote-btn down ${prevVote==='down'?'active-down':''}" title="ডাউনভোট">
                    <i class="fas fa-arrow-down" style="font-size:12px"></i>
                </button>
            </div>

            <!-- opinion -->
            <button class="rh-c-pill av-opinion">
                <i class="far fa-comment" style="font-size:11px"></i>
                <span class="av-oc">মতামত</span>
            </button>

            <!-- bookmark -->
            <button class="rh-c-pill av-bm ${isBm?'':''}">
                <i class="${isBm?'fas':'far'} fa-bookmark" style="font-size:11px"></i>
                ${isBm ? 'সেভ করা' : 'সেভ'}
            </button>
        </div>

        <!-- Opinion thread (collapsed by default, shown inline) -->
        <div class="av-thread" style="display:none"></div>`;

    // Fetch name + initials
    fetchName(ans.author_id).then(name => {
        wrap.querySelectorAll('.av-name').forEach(el => el.textContent = name);
        wrap.querySelectorAll('.av-initials').forEach(el => el.textContent = initials(name));
    });

    // Vote events
    const upBtn   = wrap.querySelector('.rh-c-vote-btn.up');
    const downBtn = wrap.querySelector('.rh-c-vote-btn.down');
    const vcEl    = wrap.querySelector('.av-vc');
    upBtn.addEventListener('click',   () => doAnswerVote(ans.id, 'up',   upBtn, downBtn, vcEl));
    downBtn.addEventListener('click', () => doAnswerVote(ans.id, 'down', upBtn, downBtn, vcEl));

    // Bookmark
    const bmBtn = wrap.querySelector('.av-bm');
    bmBtn.addEventListener('click', () => {
        const was = localStorage.getItem(`abm_${ans.id}`) === 'true';
        localStorage.setItem(`abm_${ans.id}`, was ? 'false' : 'true');
        const icon = bmBtn.querySelector('i');
        icon.className = `${was?'far':'fas'} fa-bookmark`;
        icon.style.fontSize = '11px';
        bmBtn.lastChild.textContent = was ? ' সেভ' : ' সেভ করা';
    });

    // Opinion — opens bottom sheet modal
    const opBtn = wrap.querySelector('.av-opinion');
    opBtn.addEventListener('click', () => openOpinionModal(ans));

    // Load reply count
    loadReplyCount(ans.id, wrap.querySelector('.av-oc'));

    return wrap;
}

async function loadReplyCount(aid, el) {
    const { count } = await supabase.from('answer').select('id',{count:'exact',head:true})
        .eq('parent_answer_id', aid);
    if (el) el.textContent = count ? `মতামত (${bn(count)})` : 'মতামত';
}

// ─────────────────────────────────────────
//  OPINION MODAL
// ─────────────────────────────────────────

function bindOpinionModal() {
    document.getElementById('opinion-overlay').addEventListener('click', e => {
        if (e.target === document.getElementById('opinion-overlay')) closeOpinionModal();
    });
}

export function closeOpinionModal() {
    const ov = document.getElementById('opinion-overlay');
    ov.classList.remove('open');
    S.opAnswerId = null;
}

async function openOpinionModal(ans) {
    S.opAnswerId = ans.id;

    // Preview text
    const tmp = document.createElement('div'); tmp.innerHTML = clean(ans.body ?? '');
    const pv = document.getElementById('opinion-answer-preview');
    pv.textContent = tmp.textContent.trim().substring(0, 120);

    // Clear list
    const list    = document.getElementById('opinion-list');
    const loading = document.getElementById('opinion-loading');
    const empty   = document.getElementById('opinion-empty');
    Array.from(list.children).forEach(c => {
        if (c.id !== 'opinion-loading' && c.id !== 'opinion-empty') c.remove();
    });
    loading.classList.remove('hidden');
    empty.classList.add('hidden');

    // Open overlay
    document.getElementById('opinion-overlay').classList.add('open');

    // Fetch replies
    const { data: replies } = await supabase.from('answer').select('*')
        .eq('parent_answer_id', ans.id).order('created_at', { ascending: true });

    loading.classList.add('hidden');

    if (!replies?.length) {
        empty.classList.remove('hidden');
    } else {
        replies.forEach(r => list.insertBefore(makeOpinionItem(r), empty));
        MathJax?.typesetPromise?.([list]).catch(() => {});
    }

    initOpinionEditor(ans.id);
}

function makeOpinionItem(r) {
    const div = document.createElement('div');
    div.className = 'opinion-item';
    div.innerHTML = `
        <div class="opinion-item-header">
            <div class="rh-avatar" style="width:24px;height:24px;font-size:9px;flex-shrink:0">
                <span class="oi-init">…</span>
            </div>
            <a href="user.html?id=${r.author_id}" class="rh-username oi-name" style="font-size:12px">…</a>
            <span class="rh-timestamp">${ago(r.created_at)}</span>
        </div>
        <div class="opinion-item-body">${clean(r.body ?? '')}</div>`;

    fetchName(r.author_id).then(name => {
        div.querySelectorAll('.oi-name').forEach(e => e.textContent = name);
        div.querySelectorAll('.oi-init').forEach(e => e.textContent = initials(name));
    });
    return div;
}

function initOpinionEditor(answerId) {
    const wrap    = document.getElementById('opinion-editor-wrap');
    const notice  = document.getElementById('opinion-login-notice');
    const submitBtn = document.getElementById('opinion-submit-btn');

    if (!S.uid) {
        notice.classList.remove('hidden');
        wrap.style.display = 'none';
        submitBtn.style.display = 'none';
        return;
    }
    notice.classList.add('hidden');
    wrap.style.display = '';
    submitBtn.style.display = '';

    if (S.opQuill) { S.opQuill.setContents([]); }
    else {
        S.opQuill = new Quill('#opinion-editor-wrap', {
            theme: 'snow',
            placeholder: 'আপনার মতামত লিখুন…',
            modules: { toolbar: [['bold','italic','code-block'],['link','formula']] }
        });
    }

    // Re-bind submit (clone to remove old listeners)
    const newBtn = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newBtn, submitBtn);

    document.getElementById('opinion-submit-btn').addEventListener('click', async () => {
        const txt = S.opQuill.getText().trim();
        const val = document.getElementById('opinion-val');
        if (txt.length < MIN_OPINION) { val.style.display = ''; return; }
        val.style.display = 'none';

        const spin = document.getElementById('opinion-spin');
        const stxt = document.getElementById('opinion-submit-txt');
        const btn  = document.getElementById('opinion-submit-btn');
        btn.disabled = true; spin.style.display = ''; stxt.textContent = 'পাঠানো হচ্ছে…';

        const { data: nr, error } = await supabase.from('answer').insert({
            question_id: S.qid, parent_answer_id: answerId,
            body: S.opQuill.root.innerHTML, author_id: S.uid,
            votes: 0, is_accepted: false,
        }).select().single();

        btn.disabled = false; spin.style.display = 'none'; stxt.textContent = 'মতামত দিন';
        if (error) { toast('পাঠাতে সমস্যা হয়েছে।'); return; }

        // Append
        const list  = document.getElementById('opinion-list');
        const empty = document.getElementById('opinion-empty');
        empty.classList.add('hidden');
        list.insertBefore(makeOpinionItem(nr), empty);
        S.opQuill.setContents([]);

        // Update count on card
        const oc = document.querySelector(`#ans-${answerId} .av-oc`);
        if (oc) loadReplyCount(answerId, oc);
    });
}

// ─────────────────────────────────────────
//  ANSWER MODAL
// ─────────────────────────────────────────

function bindAnswerModal() {
    document.getElementById('answer-overlay').addEventListener('click', e => {
        if (e.target === document.getElementById('answer-overlay')) closeAnswerModal();
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeAnswerModal();
            closeOpinionModal();
        }
    });
}

export function openAnswerModal() {
    document.getElementById('answer-overlay').classList.add('open');
    if (!S.mainQuill) initMainQuill();
}

export function closeAnswerModal() {
    document.getElementById('answer-overlay').classList.remove('open');
}

function initMainQuill() {
    const notice = document.getElementById('answer-login-notice');
    const editor = document.getElementById('main-answer-editor');
    const submitBtn = document.getElementById('submit-answer-btn');
    const previewBtn = document.getElementById('preview-btn');

    if (!S.uid) {
        notice.classList.remove('hidden');
        editor.style.display = 'none';
        submitBtn.style.display = 'none';
        previewBtn.style.display = 'none';
        return;
    }

    S.mainQuill = new Quill('#main-answer-editor', {
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

    // Preview
    const prevPanel = document.getElementById('answer-preview-panel');
    previewBtn.addEventListener('click', () => {
        const open = prevPanel.style.display !== 'none';
        if (!open) {
            prevPanel.innerHTML = clean(S.mainQuill.root.innerHTML);
            prevPanel.style.display = '';
            MathJax?.typesetPromise?.([prevPanel]).catch(() => {});
            previewBtn.innerHTML = '<i class="fas fa-eye-slash" style="font-size:10px"></i> লুকান';
        } else {
            prevPanel.style.display = 'none';
            previewBtn.innerHTML = '<i class="fas fa-eye" style="font-size:10px"></i> প্রিভিউ';
        }
    });

    // Submit
    submitBtn.addEventListener('click', async () => {
        const txt = S.mainQuill.getText().trim();
        const val = document.getElementById('answer-val-msg');
        if (txt.length < MIN_ANS) { val.style.display = ''; return; }
        val.style.display = 'none';

        const spin = document.getElementById('submit-spin');
        const stxt = document.getElementById('submit-txt');
        submitBtn.disabled = true; spin.style.display = ''; stxt.textContent = 'জমা হচ্ছে…';

        const { error } = await supabase.from('answer').insert({
            question_id: S.qid, parent_answer_id: null,
            body: S.mainQuill.root.innerHTML, author_id: S.uid,
            votes: 0, is_accepted: false,
        });

        submitBtn.disabled = false; spin.style.display = 'none'; stxt.textContent = 'জমা দিন';
        if (error) { toast('উত্তর জমা দিতে সমস্যা।'); return; }

        S.mainQuill.setContents([]);
        prevPanel.style.display = 'none';
        previewBtn.innerHTML = '<i class="fas fa-eye" style="font-size:10px"></i> প্রিভিউ';
        closeAnswerModal();
        await loadAnswers(true);
        document.getElementById('answer-list').scrollIntoView({ behavior:'smooth', block:'start' });
    });
}

// ─────────────────────────────────────────
//  QUESTION VOTES
// ─────────────────────────────────────────

function bindQVotes(q) {
    const up   = document.getElementById('q-vote-up');
    const down = document.getElementById('q-vote-down');
    const cnt  = document.getElementById('q-vote-count');
    const key  = `qv_${q.id}`;
    const prev = sessionStorage.getItem(key);
    if (prev === 'up')   up.classList.add('active-up');
    if (prev === 'down') down.classList.add('active-down');

    up.addEventListener('click', async () => {
        if (!S.uid) { toast('লগ ইন করুন।'); return; }
        const p = sessionStorage.getItem(key); if (p==='up') return;
        const c = parseInt(cnt.textContent.replace(/[^\d]/g,'')) || 0;
        const d = p==='down' ? 2 : 1;
        cnt.textContent = bn(c+d);
        up.classList.add('active-up'); down.classList.remove('active-down');
        sessionStorage.setItem(key,'up');
        await supabase.from('question').update({ votes: c+d }).eq('id', q.id);
    });

    down.addEventListener('click', async () => {
        if (!S.uid) { toast('লগ ইন করুন।'); return; }
        const p = sessionStorage.getItem(key); if (p==='down') return;
        const c = parseInt(cnt.textContent.replace(/[^\d]/g,'')) || 0;
        const d = p==='up' ? 2 : 1;
        cnt.textContent = bn(c-d);
        down.classList.add('active-down'); up.classList.remove('active-up');
        sessionStorage.setItem(key,'down');
        await supabase.from('question').update({ votes: c-d }).eq('id', q.id);
    });
}

// ─────────────────────────────────────────
//  ANSWER VOTES
// ─────────────────────────────────────────

async function doAnswerVote(aid, dir, upBtn, downBtn, vcEl) {
    if (!S.uid) { toast('লগ ইন করুন।'); return; }
    const key = `av_${aid}`;
    const prev = sessionStorage.getItem(key);
    if (prev === dir) return;
    const cur = parseInt(vcEl.textContent.replace(/[^\d]/g,'')) || 0;
    const d   = dir==='up' ? (prev==='down'?2:1) : (prev==='up'?-2:-1);
    vcEl.textContent = bn(cur+d);
    if (dir==='up') { upBtn.classList.add('active-up'); downBtn.classList.remove('active-down'); }
    else            { downBtn.classList.add('active-down'); upBtn.classList.remove('active-up'); }
    sessionStorage.setItem(key, dir);
    await supabase.from('answer').update({ votes: cur+d }).eq('id', aid);
}

// ─────────────────────────────────────────
//  SORT + PAGINATION
// ─────────────────────────────────────────

function bindSort() {
    document.getElementById('answer-sort').addEventListener('change', async e => {
        S.sort = e.target.value; await loadAnswers(true);
    });
}
function bindLoadMore() {
    document.getElementById('load-more-btn').addEventListener('click', async () => {
        S.page++; await loadAnswers(false);
    });
}

// ─────────────────────────────────────────
//  SHARE
// ─────────────────────────────────────────

function bindShare() {
    document.getElementById('q-share').addEventListener('click', async () => {
        const data = { title: S.question?.title ?? 'PhysFlow', url: location.href };
        if (navigator.share) {
            try { await navigator.share(data); return; } catch(e) { if (e.name==='AbortError') return; }
        }
        try { await navigator.clipboard.writeText(location.href); }
        catch { const ta=document.createElement('textarea'); ta.value=location.href; Object.assign(ta.style,{position:'fixed',opacity:'0'}); document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
        toast('লিংক কপি হয়েছে!');
    });
}

// ─────────────────────────────────────────
//  BOOKMARK (question)
// ─────────────────────────────────────────

function bindQBookmark() {
    const btn = document.getElementById('q-bookmark');
    const ico = document.getElementById('q-bm-icon');
    const key = `qbm_${S.qid}`;
    let bm = localStorage.getItem(key) === 'true';
    updateBm();
    btn.addEventListener('click', () => { bm=!bm; localStorage.setItem(key,bm); updateBm(); });
    function updateBm() {
        ico.className = `${bm?'fas':'far'} fa-bookmark`;
        btn.title = bm ? 'বুকমার্ক সরান' : 'সেভ';
        if (bm) btn.style.color = '#ff6534'; else btn.style.color = '';
    }
}

// ─────────────────────────────────────────
//  VIEW COUNT
// ─────────────────────────────────────────

async function bumpView() {
    const key = `v_${S.qid}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key,'1');
    const cur = S.question?.views ?? 0;
    await supabase.from('question').update({ views: cur+1 }).eq('id', S.qid);
}

// ─────────────────────────────────────────
//  RELATED
// ─────────────────────────────────────────

async function loadRelated() {
    const kw = (S.question?.title ?? '').split(/\s+/).filter(w=>w.length>3).slice(0,3);
    if (!kw.length) return;
    const { data } = await supabase.from('question').select('id,title,votes')
        .neq('id', S.qid).or(kw.map(k=>`title.ilike.%${k}%`).join(',')).limit(5);
    if (!data?.length) return;
    document.getElementById('related-section').style.display = '';
    const ul = document.getElementById('related-list');
    data.forEach(q => {
        const li = document.createElement('li');
        li.style.cssText = 'margin-bottom:8px;display:flex;gap:8px;align-items:flex-start';
        li.innerHTML = `
            <span style="flex-shrink:0;font-size:11px;color:#818384;background:#272729;border-radius:10px;padding:1px 7px;min-width:28px;text-align:center">${bn(q.votes??0)}</span>
            <a href="question.html?id=${q.id}" style="color:#1484d6;font-size:13px;text-decoration:none;line-height:1.4" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${esc(q.title)}</a>`;
        ul.appendChild(li);
    });
}

// ─────────────────────────────────────────
//  SEO
// ─────────────────────────────────────────

function injectSEO(q) {
    const tmp=document.createElement('div'); tmp.innerHTML=q.body??'';
    const desc=(tmp.textContent||'').trim().substring(0,150);
    const url=`https://physflow.pages.dev/question?id=${q.id}`;
    document.title=`${q.title} - PhysFlow`;
    sm('name','description',desc); sm('property','og:title',q.title);
    sm('property','og:description',desc); sm('property','og:url',url);
    const c=document.getElementById('canonical-link'); if(c) c.href=url;
}
function sm(a,v,c) {
    let el=document.querySelector(`meta[${a}="${v}"]`);
    if(!el){el=document.createElement('meta');el.setAttribute(a,v);document.head.appendChild(el);}
    el.setAttribute('content',c);
}

function injectJSONLD(question, answers) {
    document.getElementById('jsonld-qa')?.remove();
    if (!question) return;
    const tmp=document.createElement('div'); tmp.innerHTML=question.body??'';
    const s=document.createElement('script');
    s.id='jsonld-qa'; s.type='application/ld+json';
    s.textContent=JSON.stringify({
        '@context':'https://schema.org','@type':'QAPage',
        mainEntity:{'@type':'Question',name:question.title,
            text:(tmp.textContent||'').trim().substring(0,500),
            dateCreated:question.created_at,answerCount:answers.length,
            suggestedAnswer:answers.map(a=>{const d=document.createElement('div');d.innerHTML=a.body??'';return{'@type':'Answer',text:(d.textContent||'').trim().substring(0,500),upvoteCount:a.votes??0,dateCreated:a.created_at};})}
    },null,2);
    document.head.appendChild(s);
}

// ─────────────────────────────────────────
//  FETCH NAME (user_names view)
// ─────────────────────────────────────────

async function fetchName(uid) {
    if (!uid) return 'অজানা';
    if (nameCache.has(uid)) return nameCache.get(uid);

    try {
        const { data, error } = await supabase.from('user_names').select('display_name').eq('id',uid).maybeSingle();
        if (!error && data?.display_name) { nameCache.set(uid,data.display_name); return data.display_name; }
    } catch(_) {}

    if (S.uid===uid && S.authUser) {
        const m=S.authUser.user_metadata??{};
        const n=m.username||m.full_name||m.name||(S.authUser.email?.split('@')[0])||'ব্যবহারকারী';
        nameCache.set(uid,n); return n;
    }
    nameCache.set(uid,'ব্যবহারকারী');
    return 'ব্যবহারকারী';
}

// ─────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────

function clean(dirty) {
    if (typeof DOMPurify==='undefined') return dirty;
    return DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS:['p','br','strong','em','u','s','span','div','ul','ol','li','blockquote','pre','code','h1','h2','h3','h4','h5','h6','a','img','table','thead','tbody','tr','td','th','sup','sub'],
        ALLOWED_ATTR:['href','src','alt','class','style','target','rel'],ALLOW_DATA_ATTR:false,
    });
}

function ago(iso) {
    if (!iso) return '';
    const d=Math.floor((Date.now()-new Date(iso))/1000);
    const b=n=>String(n).replace(/\d/g,x=>'০১২৩৪৫৬৭৮৯'[x]);
    if(d<60)        return 'এইমাত্র';
    if(d<3600)      return `${b(Math.floor(d/60))} মিনিট আগে`;
    if(d<86400)     return `${b(Math.floor(d/3600))} ঘন্টা আগে`;
    if(d<86400*7)   return `${b(Math.floor(d/86400))} দিন আগে`;
    if(d<86400*30)  return `${b(Math.floor(d/86400/7))} সপ্তাহ আগে`;
    if(d<86400*365) return `${b(Math.floor(d/86400/30))} মাস আগে`;
    return `${b(Math.floor(d/86400/365))} বছর আগে`;
}

function bn(n) { return String(n).replace(/\d/g,x=>'০১২৩৪৫৬৭৮৯'[x]); }

function esc(s) {
    return (s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                  .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function initials(name) {
    return (name??'অ').split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase() || 'অ';
}

function setSkeleton(show) {
    const s=document.getElementById('loading-skeleton');
    if(s) s.style.display=show?'':'none';
}

function show404() {
    setSkeleton(false);
    document.getElementById('not-found-ui').style.display='';
}

function toast(msg) {
    const t=document.createElement('div');
    t.textContent=msg;
    t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:999;background:#1a1a1b;border:1px solid #343536;color:#d7dadc;font-size:13px;padding:8px 18px;border-radius:20px;box-shadow:0 4px 16px rgba(0,0,0,.5)';
    document.body.appendChild(t);
    setTimeout(()=>{t.style.transition='opacity .3s';t.style.opacity='0';setTimeout(()=>t.remove(),350);},2200);
}
