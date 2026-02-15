import { supabase } from './supabase-config.js';
 
// গ্লোবাল ভেরিয়েবল
let allAnswers = [];
let currentSort = 'votes';

// ১. সংখ্যাকে বাংলায় রূপান্তর
const toBanglaNumber = (num) => {
    const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(num || 0).split('').map(digit => banglaDigits[parseInt(digit)] || digit).join('');
};

// ২. সময়কে ফরম্যাটে দেখানো
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

// ৩. প্রোফাইল পিকচার বা লেটার অবতার রেন্ডার
const getAvatarHtml = (avatarUrl, name, sizeClass = "w-9 h-9") => {
    if (avatarUrl) {
        return `<img src="${avatarUrl}" class="${sizeClass} rounded-full object-cover border border-gray-100 dark:border-gray-800" alt="${name}">`;
    }
    const initials = name ? name.charAt(0).toUpperCase() : '?';
    return `<div class="${sizeClass} rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-[12px] shadow-sm">${initials}</div>`;
};

// ৪. ইউআরএল থেকে আইডি নেওয়া
const getQuestionId = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
};

// ৫. ভিউ কাউন্ট বাড়ানো
const incrementViewCount = async (questionId) => {
    const sessionKey = `viewed_${questionId}`;
    if (sessionStorage.getItem(sessionKey)) return;
    await supabase.rpc('increment_views', { question_id: questionId });
    sessionStorage.setItem(sessionKey, 'true');
};

// ৬. মূল প্রশ্নটি স্ক্রিনে দেখানো
const renderQuestion = (question, currentUser) => {
    document.getElementById('question-skeleton')?.classList.add('hidden');
    document.getElementById('question-content')?.classList.remove('hidden');
    document.getElementById('answers-section')?.classList.remove('hidden');

    document.title = `${question.title} - physflow`;
    document.getElementById('question-title').textContent = question.title;
    document.getElementById('question-time').textContent = formatTimeAgo(question.created_at);
    document.getElementById('question-views').textContent = toBanglaNumber(question.views || 0);
    document.getElementById('q-vote-count').textContent = toBanglaNumber(question.votes || 0);
    document.getElementById('question-body').innerHTML = question.body || '';

    // প্রোফাইল ছবি ও লিংক আপডেট
    const avatarImg = document.getElementById('q-author-avatar');
    const profileLink = document.getElementById('author-profile-link');
    if (avatarImg) avatarImg.src = question.profile?.avatar_url || `https://ui-avatars.com/api/?name=${question.profile?.username || 'U'}&background=0056b3&color=fff`;
    if (profileLink) profileLink.href = `profile.html?id=${question.author_id}`;

    // ক্যাটাগরি ও ট্যাগ রেন্ডার (সাইজ ৮ পিক্সেল)
    const catBadge = document.getElementById('question-category-badge');
    const tagsContainer = document.getElementById('question-tags');

    if (catBadge && question.category) {
        catBadge.innerHTML = `<span class="px-2 py-1 text-[8px] font-bold bg-blue-50 dark:bg-blue-900/20 text-[#0056b3] rounded border border-blue-100 dark:border-blue-800">${question.category}</span>`;
    }

    if (tagsContainer) {
        const tags = Array.isArray(question.tag) ? question.tag : [];
        tagsContainer.innerHTML = tags.map(t => `<span class="px-2 py-1 text-[8px] font-bold bg-gray-50 dark:bg-gray-800/50 text-gray-600 rounded border border-gray-200 dark:border-gray-700">#${t}</span>`).join('');
    }

    setupVoteButtons(question.id, question.votes || 0, currentUser, 'question');
};

// ৭. উত্তর কার্ড তৈরি (UI-এর সাথে সামঞ্জস্য রেখে)
const createAnswerCard = (answer, currentUser) => {
    const name = answer.profile?.username || 'অজ্ঞাত';
    const avatarUrl = answer.profile?.avatar_url || `https://ui-avatars.com/api/?name=${name}&background=0056b3&color=fff`;

    return `
    <div class="py-2 border-b border-gray-100 dark:border-gray-800 last:border-0" id="answer-card-${answer.id}">
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

// ৮. ভোট সিস্টেম (১ ইউজার ১ ভোট লজিক)
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
        if (!userVote) voteChange = (direction === 'up' ? 1 : -1);
        else voteChange = (direction === 'up' ? 2 : -2);

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

// ৯. ডাটাবেস থেকে উত্তর লোড করা (ans-count-label ফিক্স সহ)
const loadAnswers = async (qId, user) => {
    const { data, error } = await supabase.from('answer').select('*, profile(username, avatar_url)').eq('question_id', qId);
    const listEl = document.getElementById('answer-list');
    const ansCountLabel = document.getElementById('ans-count-label');

    if (error || !data || data.length === 0) {
        if (listEl) listEl.innerHTML = `<div class="text-center py-6 text-gray-400 text-[13px]">এখনো কোনো উত্তর নেই।</div>`;
        if (ansCountLabel) ansCountLabel.textContent = toBanglaNumber(0);
        return;
    }

    // সঠিক উত্তরের সংখ্যা সেট করা
    if (ansCountLabel) ansCountLabel.textContent = toBanglaNumber(data.length);

    allAnswers = data;

    listEl.innerHTML = allAnswers
        .sort((a, b) => (b.votes || 0) - (a.votes || 0))
        .map(ans => createAnswerCard(ans, user))
        .join('');

    allAnswers.forEach(ans => {
        setupVoteButtons(ans.id, ans.votes || 0, user, 'answer');
    });
};

// ১০. মূল ইনিশিয়ালাইজেশন
export const initQuestionPage = async () => {
    const qId = getQuestionId();
    if (!qId) return;

    try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: q } = await supabase.from('question').select('*, profile(username, avatar_url)').eq('id', qId).single();

        if (q) {
            renderQuestion(q, user);
            incrementViewCount(qId);
            await loadAnswers(qId, user);
            setupAnswerFAB(qId, user);
        }
    } catch (err) {
        console.error("Initialization Error:", err);
    }
};

// ১১. FAB এবং মডাল ফাংশন
const setupAnswerFAB = (questionId, currentUser) => {
    const fab = document.getElementById('answer-fab');
    if (fab) {
        fab.onclick = () => {
            if (!currentUser) { alert('লগ ইন করো।'); return; }
            openAnswerModal(questionId, currentUser);
        };
    }
};

const openAnswerModal = (questionId, currentUser) => {
    const oldModal = document.getElementById('answer-modal');
    if (oldModal) oldModal.remove();

    const modalHtml = `
<div id="answer-modal" class="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
    <div class="bg-white dark:bg-[#1a1a1b] w-full max-w-lg rounded-xl shadow-xl p-4">
        <div class="flex justify-between items-center mb-4 border-b dark:border-gray-800 pb-2">
            <h3 class="font-bold dark:text-white">আপনার উত্তর লিখুন</h3>
            <button onclick="document.getElementById('answer-modal').remove()" class="text-gray-500 hover:text-red-500 text-2xl">&times;</button>
        </div>
        <textarea id="modal-answer-body" class="w-full h-40 p-3 bg-gray-50 dark:bg-[#2d2d2d] dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg resize-none" placeholder="কমপক্ষে ২০ অক্ষরে উত্তরটি লিখুন..."></textarea>
        <div class="mt-4 flex justify-end gap-3">
            <button onclick="document.getElementById('answer-modal').remove()" class="px-4 py-2 text-gray-500">বাতিল</button>
            <button id="submit-modal-answer" class="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold">জমা দিন</button>
        </div>
    </div>
</div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('submit-modal-answer').onclick = async () => {
        const body = document.getElementById('modal-answer-body').value.trim();
        if (body.length < 10) { alert("উত্তরটি কমপক্ষে ১০ অক্ষর হতে হবে।"); return; }

        const { error } = await supabase.from('answer').insert([{
            question_id: questionId,
            body: body,
            author_id: currentUser.id,
            votes: 0
        }]);

        if (!error) {
            document.getElementById('answer-modal').remove();
            location.reload();
        }
    };
};

// গ্লোবাল ফাংশন
window.toggleReplyBox = (answerId) => {
    const box = document.getElementById(`reply-box-${answerId}`);
    if (box) box.classList.toggle('hidden');
};

window.submitReply = async (answerId) => {
    const input = document.getElementById(`reply-input-${answerId}`);
    const replyText = input?.value.trim();
    
    if (!replyText || replyText.length < 5) {
        alert('রিপ্লাই কমপক্ষে ৫ অক্ষর হতে হবে।');
        return;
    }

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            alert('রিপ্লাই করতে লগ ইন করুন।');
            return;
        }

        // এখানে আপনার comments টেবিলে ডেটা ইনসার্ট করুন
        const { error } = await supabase.from('comments').insert([{
            answer_id: answerId,
            body: replyText,
            author_id: user.id
        }]);

        if (!error) {
            input.value = '';
            window.toggleReplyBox(answerId);
            // রিপ্লাই লোড করার ফাংশন কল করুন
            alert('রিপ্লাই সফলভাবে যোগ হয়েছে!');
        } else {
            alert('রিপ্লাই যোগ করতে সমস্যা হয়েছে।');
        }
    } catch (err) {
        console.error('Reply submission error:', err);
        alert('একটি ত্রুটি ঘটেছে।');
    }
};
