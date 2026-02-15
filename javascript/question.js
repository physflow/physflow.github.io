import { supabase } from './supabase-config.js';

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

const incrementViewCount = async (questionId) => {
    const sessionKey = `viewed_${questionId}`;
    if (sessionStorage.getItem(sessionKey)) return;
    await supabase.rpc('increment_views', { question_id: questionId });
    sessionStorage.setItem(sessionKey, 'true');
};

// ৭. মূল প্রশ্নটি স্ক্রিনে দেখানো (HTML এর সাথে সামঞ্জস্য রেখে আপডেট করা)
const renderQuestion = (question, currentUser) => {
    document.getElementById('question-skeleton')?.classList.add('hidden');
    document.getElementById('question-content')?.classList.remove('hidden');
    document.getElementById('answers-section')?.classList.remove('hidden');

    document.title = `${question.title} - physflow`;
    
    // টাইটেল ও বডি
    const titleEl = document.getElementById('question-title');
    const bodyEl = document.getElementById('question-body');
    if(titleEl) titleEl.textContent = question.title;
    if(bodyEl) bodyEl.innerHTML = question.body || '';

    // সময় আপডেট (ট্যাগের ডানপাশে)
    const timeEl = document.getElementById('question-time');
    if(timeEl) timeEl.textContent = formatTimeAgo(question.created_at);

    // কাউন্টার আপডেট
    const viewCountEl = document.getElementById('question-views');
    const ansCountEl = document.getElementById('ans-count-label');
    const voteCountEl = document.getElementById('q-vote-count');
    
    if(viewCountEl) viewCountEl.textContent = toBanglaNumber(question.views || 0);
    if(ansCountEl) ansCountEl.textContent = toBanglaNumber(question.answer_count || 0);
    if(voteCountEl) voteCountEl.textContent = toBanglaNumber(question.votes || 0);

    // প্রোফাইল ছবি আপডেট (ভোট বাটনের আগে)
    const avatarImg = document.getElementById('q-author-avatar');
    const profileLink = document.getElementById('author-profile-link');
    if(avatarImg) {
        avatarImg.src = question.profile?.avatar_url || `https://ui-avatars.com/api/?name=${question.profile?.username || 'U'}&background=0056b3&color=fff`;
    }
    if(profileLink) {
        profileLink.href = `profile.html?id=${question.author_id}`;
    }

    // ক্যাটাগরি ও ট্যাগ রেন্ডার
    const tagsContainer = document.getElementById('question-tags');
    const catBadgeContainer = document.getElementById('question-category-badge');
    
    if (catBadgeContainer && question.category) {
        catBadgeContainer.innerHTML = `<span class="px-2 py-0.5 text-[10px] font-bold bg-blue-50 dark:bg-blue-900/20 text-[#0056b3] rounded border border-blue-100 dark:border-blue-800">${question.category}</span>`;
    }

    if (tagsContainer) {
        const tags = Array.isArray(question.tag) ? question.tag : [];
        tagsContainer.innerHTML = tags.map(t => `<span class="px-2 py-0.5 text-[10px] font-bold bg-gray-50 dark:bg-gray-800/50 text-gray-600 rounded border border-gray-200 dark:border-gray-700">#${t}</span>`).join('');
    }

    setupVoteButtons(question.id, question.votes || 0, currentUser, 'question');
};

// ৮. উত্তর কার্ড তৈরি
const createAnswerCard = (answer, questionAuthorId, currentUser) => {
    const name = answer.profile?.username || 'অজ্ঞাত';
    const avatarUrl = answer.profile?.avatar_url || `https://ui-avatars.com/api/?name=${name}&background=0056b3&color=fff`;
    
    return `
        <div class="py-6 border-b border-gray-100 dark:border-gray-800 last:border-0" id="answer-card-${answer.id}">
            <div class="flex gap-4">
                <div class="shrink-0">
                    <img src="${avatarUrl}" class="w-9 h-9 rounded-full object-cover border border-gray-100 dark:border-gray-800" alt="${name}">
                </div>
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
                        <textarea id="reply-input-${answer.id}" class="w-full p-2 text-sm bg-white dark:bg-[#2d2d2d] border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all resize-none" placeholder="আপনার রিপ্লাই লেখো..."></textarea>
                        <div class="flex justify-end gap-2 mt-2">
                            <button onclick="toggleReplyBox('${answer.id}')" class="text-xs text-gray-500 hover:text-gray-700">বাতিল</button>
                            <button onclick="submitReply('${answer.id}')" class="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 transition">পাঠাও</button>
                        </div>
                    </div>
                    <div id="nested-comments-${answer.id}" class="mt-4 ml-2 pl-6 border-l-2 border-gray-100 dark:border-gray-800 space-y-4 relative"></div>
                </div>
            </div>
        </div>
    `;
};

// বাকি ফাংশনগুলো (setupVoteButtons, loadAnswers, initQuestionPage, openAnswerModal ইত্যাদি) তোমার কোডে যেমন ছিল তেমনই থাকবে।
// তবে নিশ্চিত করো যে renderAnswers এবং setupAnswerFAB ফাংশনগুলো নিচে আছে।

const setupVoteButtons = (id, initialVotes, currentUser, type = 'question') => {
    const prefix = type === 'question' ? 'q' : `ans-${id}`;
    const upBtn = document.getElementById(`${prefix}-vote-up`);
    const downBtn = document.getElementById(`${prefix}-vote-down`);
    const countEl = document.getElementById(`${prefix}-vote-count`);
    if (!upBtn || !downBtn || !countEl) return;

    const voteKey = `voted_${type}_${id}`;
    let userVote = localStorage.getItem(voteKey);

    if (userVote === 'up') upBtn.style.color = '#0056b3';
    if (userVote === 'down') downBtn.style.color = '#ef4444';

    const handleVote = async (direction) => {
        if (!currentUser) { alert('ভোট দিতে লগ ইন করো।'); return; }
        if (userVote === direction) return;

        const table = type === 'question' ? 'question' : 'answer';
        const { data: currentData } = await supabase.from(table).select('votes').eq('id', id).single();
        let currentDBVotes = currentData?.votes || 0;

        let voteChange = 0;
        if (!userVote) voteChange = direction === 'up' ? 1 : -1;
        else voteChange = direction === 'up' ? 2 : -2;

        let newVotes = currentDBVotes + voteChange;
        countEl.textContent = toBanglaNumber(newVotes);
        userVote = direction;
        localStorage.setItem(voteKey, direction);

        upBtn.style.color = direction === 'up' ? '#0056b3' : '';
        downBtn.style.color = direction === 'down' ? '#ef4444' : '';
        await supabase.from(table).update({ votes: newVotes }).eq('id', id);
    };

    upBtn.onclick = () => handleVote('up');
    downBtn.onclick = () => handleVote('down');
};

const renderAnswers = (answers, questionAuthorId, currentUser) => {
    const listEl = document.getElementById('answer-list');
    if (!listEl) return;
    const sorted = [...answers].sort((a, b) => (b.votes || 0) - (a.votes || 0));
    listEl.innerHTML = sorted.map(ans => createAnswerCard(ans, questionAuthorId, currentUser)).join('');
    sorted.forEach(ans => {
        setupVoteButtons(ans.id, ans.votes || 0, currentUser, 'answer');
        loadComments(ans.id);
    });
};

const loadAnswers = async (qId, user, authorId) => {
    const { data, error } = await supabase.from('answer').select('*').eq('question_id', qId);
    if (error || !data || data.length === 0) {
        document.getElementById('answer-list').innerHTML = `<div class="text-center py-6 text-gray-400 text-[13px]">এখনো কোনো উত্তর নেই।</div>`;
        return;
    }
    const uIds = [...new Set(data.map(a => a.author_id))];
    const { data: profs } = await supabase.from('profile').select('id, username, avatar_url').in('id', uIds);
    const pMap = Object.fromEntries(profs?.map(p => [p.id, p]) || []);
    allAnswers = data.map(a => ({ ...a, profile: pMap[a.author_id] }));
    renderAnswers(allAnswers, authorId, user);
};

export const initQuestionPage = async () => {
    const qId = getQuestionId();
    if (!qId) return;
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: q, error } = await supabase.from('question').select('*, profile(username, avatar_url)').eq('id', qId).single();
        if (q) {
            renderQuestion(q, user);
            incrementViewCount(qId);
            await loadAnswers(qId, user, q.author_id);
            setupAnswerFAB(qId, user); 
        }
    } catch (err) { console.error(err); }
};

const setupAnswerFAB = (questionId, currentUser) => {
    const fab = document.getElementById('answer-fab');
    if (!fab) return;
    fab.onclick = () => {
        if (!currentUser) { alert('লগ ইন করো।'); return; }
        openAnswerModal(questionId, currentUser); 
    };
};

const openAnswerModal = (questionId, currentUser) => {
    const oldModal = document.getElementById('answer-modal');
    if (oldModal) oldModal.remove();
    const modalHtml = `
    <div id="answer-modal" class="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
        <div class="bg-white dark:bg-[#1a1a1b] w-full max-w-lg rounded-xl shadow-xl overflow-hidden">
            <div class="p-4 border-b dark:border-gray-800 flex justify-between items-center">
                <h3 class="font-bold text-gray-800 dark:text-white">আপনার উত্তর লিখুন</h3>
                <button onclick="document.getElementById('answer-modal').remove()" class="text-gray-500 hover:text-red-500 text-xl">&times;</button>
            </div>
            <div class="p-4">
                <textarea id="modal-answer-body" class="w-full h-40 p-3 bg-gray-50 dark:bg-[#2d2d2d] dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="কমপক্ষে ২০ অক্ষরে উত্তরটি লিখুন..."></textarea>
                <div class="mt-4 flex justify-end gap-3">
                    <button onclick="document.getElementById('answer-modal').remove()" class="px-4 py-2 text-gray-600 dark:text-gray-400 font-medium">বাতিল</button>
                    <button id="submit-modal-answer" class="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition">জমা দিন</button>
                </div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('submit-modal-answer').onclick = async () => {
        const body = document.getElementById('modal-answer-body').value.trim();
        if (body.length < 20) { alert("উত্তরটি ছোট!"); return; }
        const { error } = await supabase.from('answer').insert([{ question_id: questionId, body: body, author_id: currentUser.id, votes: 0 }]);
        if (!error) { document.getElementById('answer-modal').remove(); location.reload(); }
    };
};

// গ্লোবাল ফাংশন লোড কমেন্ট ও রিপ্লাই (তোমার অরিজিনাল কোড থেকে)
window.toggleReplyBox = (id) => {
    const box = document.getElementById(`reply-box-${id}`);
    if (box) box.classList.toggle('hidden');
};
