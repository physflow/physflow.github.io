import { supabase } from './supabase-config.js';

// গ্লোবাল ভেরিয়েবল
let allAnswers = []; 
let currentSort = 'votes';

const toBanglaNumber = (num) => {
    const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(num).split('').map(digit => banglaDigits[parseInt(digit)] || digit).join('');
};

const formatTimeAgo = (date) => {
    if (!date) return '';
    const now = new Date();
    const then = new Date(date);
    const seconds = Math.floor((now - then) / 1000);
    if (seconds < 60) return `${toBanglaNumber(seconds)} সেকেন্ড আগে`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${toBanglaNumber(minutes)} মিনিট আগে`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${toBanglaNumber(hours)} ঘণ্টা আগে`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${toBanglaNumber(days)} দিন আগে`;
    return `${toBanglaNumber(Math.floor(days / 30))} মাস আগে`;
};

const getInitials = (name) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
};

const getQuestionId = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
};

// প্রোফাইল পিকচার রেন্ডার লজিক
const getAvatarHtml = (avatarUrl, name, sizeClass = "w-9 h-9") => {
    if (avatarUrl) {
        return `<img src="${avatarUrl}" class="${sizeClass} rounded-full object-cover border border-gray-100 dark:border-gray-800" alt="${name}">`;
    }
    const initials = getInitials(name);
    return `<div class="${sizeClass} rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-[12px] shadow-sm">${initials}</div>`;
};

const incrementViewCount = async (questionId) => {
    const sessionKey = `viewed_${questionId}`;
    if (sessionStorage.getItem(sessionKey)) return;
    await supabase.rpc('increment_views', { question_id: questionId });
    sessionStorage.setItem(sessionKey, 'true');
};

// ===== প্রশ্ন রেন্ডার =====
const renderQuestion = (question, currentUser) => {
    document.getElementById('question-skeleton').classList.add('hidden');
    document.getElementById('question-content').classList.remove('hidden');
    document.getElementById('answers-section').classList.remove('hidden');

    document.title = `${question.title} - physflow`;
    document.getElementById('question-title').textContent = question.title;
    document.getElementById('question-author-name').textContent = question.profile?.username || 'অজ্ঞাত';
    document.getElementById('question-time').textContent = formatTimeAgo(question.created_at);
    document.getElementById('question-views').textContent = toBanglaNumber(question.views || 0);
    document.getElementById('q-vote-count').textContent = toBanglaNumber(question.votes || 0);
    document.getElementById('question-body').innerHTML = question.body || '';

    const tagsContainer = document.getElementById('question-tags');
    let tagsHTML = '';
    if (question.category) {
        tagsHTML += `<span class="px-2 py-0.5 text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-[#0056b3] rounded">${question.category}</span>`;
    }
    const tags = Array.isArray(question.tag) ? question.tag : [];
    tagsHTML += tags.map(t => `<span class="px-2 py-0.5 text-[10px] font-bold bg-gray-50 dark:bg-gray-800/50 text-gray-600 rounded">#${t}</span>`).join('');
    tagsContainer.innerHTML = tagsHTML;

    setupVoteButtons(question.id, question.votes || 0, currentUser, 'question');
};

// ===== ভোট সিস্টেম =====
const setupVoteButtons = (id, initialVotes, currentUser, type = 'question') => {
    const prefix = type === 'question' ? 'q' : `ans-${id}`;
    const upBtn = document.getElementById(`${prefix}-vote-up`);
    const downBtn = document.getElementById(`${prefix}-vote-down`);
    const countEl = document.getElementById(`${prefix}-vote-count`);
    if (!upBtn || !downBtn || !countEl) return;

    const handleVote = async (direction) => {
        if (!currentUser) { alert('ভোট দিতে লগ ইন করো।'); return; }
        const { data: currentData } = await supabase.from(type === 'question' ? 'question' : 'answer').select('votes').eq('id', id).single();
        let newVotes = (currentData?.votes || 0) + (direction === 'up' ? 1 : -1);
        countEl.textContent = toBanglaNumber(newVotes);
        await supabase.from(type === 'question' ? 'question' : 'answer').update({ votes: newVotes }).eq('id', id);
    };

    upBtn.onclick = () => handleVote('up');
    downBtn.onclick = () => handleVote('down');
};


// ===== রিপ্লাই ও কমেন্ট লজিক (Hyvor Style) =====
window.toggleReplyBox = (answerId) => {
    const box = document.getElementById(`reply-box-${answerId}`);
    if (box) {
        box.classList.toggle('hidden');
        if (!box.classList.contains('hidden')) document.getElementById(`reply-input-${answerId}`)?.focus();
    }
};

window.submitReply = async (answerId) => {
    const input = document.getElementById(`reply-input-${answerId}`);
    const text = input?.value.trim();
    if (!text) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert('রিপ্লাই দিতে লগ ইন করো।'); return; }

    const { error } = await supabase.from('comment').insert([{
        answer_id: answerId,
        body: text,
        author_id: user.id
    }]);

    if (!error) {
        input.value = '';
        window.toggleReplyBox(answerId);
        await loadComments(answerId);
    }
};

const loadComments = async (answerId) => {
    const listEl = document.getElementById(`nested-comments-${answerId}`);
    if (!listEl) return;

    const { data, error } = await supabase
        .from('comment')
        .select('*, profile(username, avatar_url)')
        .eq('answer_id', answerId)
        .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) return;

    listEl.innerHTML = data.map(c => {
        const name = c.profile?.username || 'অজ্ঞাত';
        return `
            <div class="flex gap-2.5 relative">
                <div class="shrink-0 mt-1">${getAvatarHtml(c.profile?.avatar_url, name, "w-6 h-6")}</div>
                <div class="flex-1">
                    <div class="flex items-center gap-2">
                        <span class="text-[12px] font-bold text-gray-800 dark:text-gray-200">${name}</span>
                        <span class="text-[10px] text-gray-400">${formatTimeAgo(c.created_at)}</span>
                    </div>
                    <p class="text-[13px] text-gray-600 dark:text-gray-400 leading-snug mt-0.5">${c.body}</p>
                </div>
            </div>
        `;
    }).join('');
};

// ===== উত্তর কার্ড ও রেন্ডারিং =====
const createAnswerCard = (answer, questionAuthorId, currentUser) => {
    const name = answer.profile?.username || 'অজ্ঞাত';
    return `
        <div class="py-6 border-b border-gray-100 dark:border-gray-800 last:border-0" id="answer-card-${answer.id}">
            <div class="flex gap-4">
                <div class="shrink-0">${getAvatarHtml(answer.profile?.avatar_url, name)}</div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1.5">
                        <span class="font-bold text-[14px] text-gray-900 dark:text-gray-100">${name}</span>
                        <span class="text-gray-400 text-[11px]">${formatTimeAgo(answer.created_at)}</span>
                    </div>
                    <div class="answer-body-content text-[15px] text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                        ${answer.body || ''}
                    </div>
                    <div class="flex items-center gap-6">
                        <div class="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-full px-3 py-1">
                            <button id="ans-${answer.id}-vote-up" class="text-gray-400 hover:text-blue-600 transition-colors"><i class="fas fa-arrow-up text-[13px]"></i></button>
                            <span id="ans-${answer.id}-vote-count" class="text-[12px] font-bold text-gray-600 dark:text-gray-400">${toBanglaNumber(answer.votes || 0)}</span>
                            <button id="ans-${answer.id}-vote-down" class="text-gray-400 hover:text-red-500 transition-colors"><i class="fas fa-arrow-down text-[13px]"></i></button>
                        </div>
                        <button onclick="toggleReplyBox('${answer.id}')" class="text-gray-500 hover:text-blue-600 text-[13px] font-semibold transition-colors">রিপ্লাই</button>
                    </div>
                    <div id="reply-box-${answer.id}" class="hidden mt-4 pl-4 border-l-2 border-blue-500">
                        <textarea id="reply-input-${answer.id}" class="w-full p-2 text-sm bg-white dark:bg-[#2d2d2d] border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none" placeholder="রিপ্লাই লেখো..."></textarea>
                        <div class="flex justify-end gap-2 mt-2">
                            <button onclick="toggleReplyBox('${answer.id}')" class="text-xs text-gray-500">বাতিল</button>
                            <button onclick="submitReply('${answer.id}')" class="bg-blue-600 text-white px-3 py-1 rounded text-xs">পাঠাও</button>
                        </div>
                    </div>
                    <div id="nested-comments-${answer.id}" class="mt-4 ml-2 pl-6 border-l-2 border-gray-100 dark:border-gray-800 space-y-4"></div>
                </div>
            </div>
        </div>
    `;
};

const renderAnswers = (answers, questionAuthorId, currentUser) => {
    const listEl = document.getElementById('answer-list');
    if (!listEl) return;
    const sorted = [...answers].sort((a, b) => currentSort === 'votes' ? (b.votes || 0) - (a.votes || 0) : new Date(b.created_at) - new Date(a.created_at));
    listEl.innerHTML = sorted.map(ans => createAnswerCard(ans, questionAuthorId, currentUser)).join('');
    sorted.forEach(ans => {
        setupVoteButtons(ans.id, ans.votes || 0, currentUser, 'answer');
        loadComments(ans.id);
    });
};

const setupSortButtons = (authorId, user) => {
    const vBtn = document.getElementById('sort-votes'), lBtn = document.getElementById('sort-latest');
    vBtn?.addEventListener('click', () => { currentSort = 'votes'; renderAnswers(allAnswers, authorId, user); });
    lBtn?.addEventListener('click', () => { currentSort = 'latest'; renderAnswers(allAnswers, authorId, user); });
};

// ===== FAB ও উত্তর জমা দেওয়া =====
const setupAnswerFAB = (questionId, currentUser) => {
    let fab = document.getElementById('answer-fab');
    if (!fab) {
        fab = document.createElement('button');
        fab.id = 'answer-fab';
        fab.innerHTML = '<i class="fas fa-plus"></i>';
        fab.className = 'fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg z-50';
        document.body.appendChild(fab);
    }
    fab.onclick = () => {
        const body = prompt("আপনার উত্তরটি লিখুন (কমপক্ষে ২০ অক্ষর):");
        if (body && body.length >= 20) submitAnswer(questionId, body, currentUser);
        else if(body) alert("উত্তর খুব ছোট!");
    };
};

const submitAnswer = async (qId, body, user) => {
    if (!user) return alert("লগ ইন করো!");
    const { error } = await supabase.from('answer').insert([{ question_id: qId, body, author_id: user.id, votes: 0 }]);
    if (!error) location.reload();
};

const loadAnswers = async (qId, user, authorId) => {
    const { data } = await supabase.from('answer').select('*').eq('question_id', qId);
    if (!data || data.length === 0) return;
    const uIds = [...new Set(data.map(a => a.author_id))];
    const { data: profs } = await supabase.from('profile').select('id, username, avatar_url').in('id', uIds);
    const pMap = Object.fromEntries(profs?.map(p => [p.id, p]) || []);
    allAnswers = data.map(a => ({ ...a, profile: pMap[a.author_id] }));
    renderAnswers(allAnswers, authorId, user);
    setupSortButtons(authorId, user);
};

export const initQuestionPage = async () => {
    const qId = getQuestionId();
    if (!qId) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data: q } = await supabase.from('question').select('*, profile(username, avatar_url)').eq('id', qId).single();
    if (q) {
        renderQuestion(q, user);
        incrementViewCount(qId);
        await loadAnswers(qId, user, q.author_id);
        setupAnswerFAB(qId, user);
    }
};
