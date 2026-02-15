import { supabase } from './supabase-config.js';

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
    const months = Math.floor(days / 30);
    if (months < 12) return `${toBanglaNumber(months)} মাস আগে`;
    const years = Math.floor(months / 12);
    return `${toBanglaNumber(years)} বছর আগে`;
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

const getInitials = (name) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
};

// ===== প্রশ্ন রেন্ডার =====
const renderQuestion = (question, currentUser) => {
    document.getElementById('question-skeleton').classList.add('hidden');
    document.getElementById('question-content').classList.remove('hidden');
    document.getElementById('answers-section').classList.remove('hidden');

    const breadcrumb = document.getElementById('breadcrumb-title');
    if (breadcrumb) {
        breadcrumb.textContent = question.title.substring(0, 50) + (question.title.length > 50 ? '...' : '');
    }

    document.title = `${question.title} - physflow`;
    document.getElementById('question-title').textContent = question.title;

    // ২. প্রশ্নকর্তার username টাইটেলের নিচে সময়ের আগে
    const authorUsername = question.profile?.username || question.profile?.full_name || 'অজ্ঞাত';
    document.getElementById('question-author-name').textContent = authorUsername;
    document.getElementById('question-time').textContent = formatTimeAgo(question.created_at);
    document.getElementById('question-views').textContent = toBanglaNumber(question.views || 0);

    document.getElementById('q-vote-count').textContent = toBanglaNumber(question.votes || 0);
    document.getElementById('question-body').innerHTML = question.body || '';

    // ১. ক্যাটাগরি ও ট্যাগ — body-র নিচে একসাথে
    const tagsContainer = document.getElementById('question-tags');
    const tags = Array.isArray(question.tag) ? question.tag : [];
    let tagsHTML = '';

    if (question.category) {
        tagsHTML += `
            <a href="categories.html?cat=${encodeURIComponent(question.category)}"
               class="px-2 py-0.5 text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-[#0056b3] dark:text-blue-400 border border-gray-200 dark:border-gray-700 rounded hover:bg-blue-50 transition">
                ${question.category}
            </a>
        `;
    }

    tagsHTML += tags.map(t => `
        <a href="tags.html?tag=${encodeURIComponent(t)}"
           class="px-2 py-0.5 text-[10px] font-bold bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded hover:bg-blue-50 hover:text-[#0056b3] hover:border-blue-200 transition">
            #${t}
        </a>
    `).join('');

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

    let currentVote = null;
    let voteCount = initialVotes;
    const voteKey = `vote_${type}_${id}`;
    const saved = localStorage.getItem(voteKey);
    if (saved) {
        currentVote = saved;
        if (saved === 'up') upBtn.classList.add('voted-up');
        else downBtn.classList.add('voted-down');
    }

    const handleVote = async (direction) => {
        if (!currentUser) { alert('ভোট দিতে হলে লগ ইন করতে হবে।'); return; }
        const table = type === 'question' ? 'question' : 'answer';
        if (currentVote === direction) {
            voteCount += direction === 'up' ? -1 : 1;
            currentVote = null;
            localStorage.removeItem(voteKey);
            upBtn.classList.remove('voted-up');
            downBtn.classList.remove('voted-down');
        } else {
            if (currentVote !== null) voteCount += currentVote === 'up' ? -1 : 1;
            voteCount += direction === 'up' ? 1 : -1;
            currentVote = direction;
            localStorage.setItem(voteKey, direction);
            upBtn.classList.toggle('voted-up', direction === 'up');
            downBtn.classList.toggle('voted-down', direction === 'down');
        }
        countEl.textContent = toBanglaNumber(voteCount);
        await supabase.from(table).update({ votes: voteCount }).eq('id', id);
    };

    upBtn.addEventListener('click', () => handleVote('up'));
    downBtn.addEventListener('click', () => handleVote('down'));
};

// ===== বুকমার্ক =====
const setupBookmark = (answerId) => {
    const btn = document.getElementById(`ans-${answerId}-bookmark`);
    if (!btn) return;
    const key = `bookmark_answer_${answerId}`;
    if (localStorage.getItem(key)) {
        btn.classList.add('text-[#0056b3]');
        btn.classList.remove('text-gray-400');
    }
    btn.addEventListener('click', () => {
        if (localStorage.getItem(key)) {
            localStorage.removeItem(key);
            btn.classList.remove('text-[#0056b3]');
            btn.classList.add('text-gray-400');
        } else {
            localStorage.setItem(key, '1');
            btn.classList.add('text-[#0056b3]');
            btn.classList.remove('text-gray-400');
        }
    });
};

// ===== কমেন্ট modal =====
const openCommentModal = async (answerId, currentUser) => {
    // backdrop
    let backdrop = document.getElementById('comment-backdrop');
    if (!backdrop) {
        backdrop = document.createElement('div');
        backdrop.id = 'comment-backdrop';
        backdrop.className = 'fixed inset-0 bg-black/50 z-[200] flex items-end md:items-center justify-center';
        document.body.appendChild(backdrop);
    }

    backdrop.innerHTML = `
        <div class="bg-white dark:bg-[#1a1a1b] w-full md:w-[500px] md:rounded-xl rounded-t-2xl shadow-2xl flex flex-col max-h-[80vh]">
            <!-- হেডার -->
            <div class="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700 shrink-0">
                <span class="font-semibold text-[15px] text-gray-800 dark:text-gray-200">কমেন্ট</span>
                <button id="close-comment-modal" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <!-- কমেন্ট লিস্ট -->
            <div id="comment-list" class="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                <div class="text-center text-gray-400 text-[13px] py-4">
                    <i class="fas fa-spinner fa-spin"></i> লোড হচ্ছে...
                </div>
            </div>

            <!-- কমেন্ট ইনপুট -->
            <div class="border-t dark:border-gray-700 px-4 py-3 shrink-0">
                ${currentUser ? `
                    <div class="flex gap-2 items-end">
                        <textarea id="comment-input"
                            placeholder="কমেন্ট লেখো..."
                            rows="2"
                            class="flex-1 border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2 text-[13px] bg-white dark:bg-[#2d2d2d] text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#0056b3] resize-none transition"></textarea>
                        <button id="comment-submit"
                            class="bg-[#0056b3] text-white px-4 py-2 rounded-xl text-[13px] font-medium hover:bg-blue-700 active:scale-95 transition shrink-0">
                            পাঠাও
                        </button>
                    </div>
                ` : `
                    <p class="text-center text-[13px] text-gray-500">কমেন্ট করতে <button id="comment-login-btn" class="text-[#0056b3] font-medium hover:underline">লগ ইন করো</button></p>
                `}
            </div>
        </div>
    `;

    backdrop.classList.remove('hidden');

    // বন্ধ করার লজিক
    document.getElementById('close-comment-modal').addEventListener('click', () => backdrop.remove());
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
    document.getElementById('comment-login-btn')?.addEventListener('click', () => {
        backdrop.remove();
        document.getElementById('login-btn')?.click();
    });

    // কমেন্ট লোড
    await loadComments(answerId, currentUser);

    // কমেন্ট সাবমিট
    document.getElementById('comment-submit')?.addEventListener('click', async () => {
        const input = document.getElementById('comment-input');
        const text = input?.value.trim();
        if (!text || text.length < 2) return;

        const submitBtn = document.getElementById('comment-submit');
        submitBtn.disabled = true;
        submitBtn.textContent = '...';

        const { error } = await supabase.from('comment').insert([{
            answer_id: answerId,
            body: text,
            author_id: currentUser.id,
            created_at: new Date().toISOString()
        }]);

        if (!error) {
            input.value = '';
            await loadComments(answerId, currentUser);
        }
        submitBtn.disabled = false;
        submitBtn.textContent = 'পাঠাও';
    });
};

const loadComments = async (answerId) => {
    const listEl = document.getElementById(`nested-comments-${answerId}`);
    if (!listEl) return;

    const { data, error } = await supabase
        .from('comment')
        .select('*, profile(username, full_name, avatar_url)')
        .eq('answer_id', answerId)
        .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) return;

    listEl.innerHTML = data.map(c => {
        const name = c.profile?.username || c.profile?.full_name || 'অজ্ঞাত';
        const avatar = c.profile?.avatar_url;
        
        return `
            <div class="flex gap-2.5 relative">
                <div class="shrink-0 mt-1">
                    ${avatar 
                        ? `<img src="${avatar}" class="w-6 h-6 rounded-full object-cover shadow-sm">` 
                        : `<div class="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[9px] font-bold text-gray-500">${getInitials(name)}</div>`}
                </div>
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


// ===== উত্তর কার্ড =====
// ১. উত্তর কার্ড তৈরি (Hyvor স্টাইল)
const createAnswerCard = (answer, questionAuthorId, currentUser) => {
    const authorName = answer.profile?.username || answer.profile?.full_name || 'অজ্ঞাত';
    const avatarUrl = answer.profile?.avatar_url; 
    const timeAgo = formatTimeAgo(answer.created_at);

    const profileDisplay = avatarUrl 
        ? `<img src="${avatarUrl}" class="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-100 dark:border-gray-800" alt="${authorName}">`
        : `<div class="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-[12px]">${getInitials(authorName)}</div>`;

    return `
        <div class="py-6 border-b border-gray-100 dark:border-gray-800 last:border-0" id="answer-card-${answer.id}">
            <div class="flex gap-4">
                <div class="shrink-0">${profileDisplay}</div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1.5">
                        <span class="font-bold text-[14px] text-gray-900 dark:text-gray-100">${authorName}</span>
                        <span class="text-gray-400 text-[11px]">${timeAgo}</span>
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
                        <textarea id="reply-input-${answer.id}" class="w-full p-2 text-sm bg-gray-50 dark:bg-[#2d2d2d] border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none" placeholder="আপনার রিপ্লাই লেখো..."></textarea>
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

// ২. রিপ্লাই বক্স টগল করা
window.toggleReplyBox = (answerId) => {
    const box = document.getElementById(`reply-box-${answerId}`);
    box.classList.toggle('hidden');
    if(!box.classList.contains('hidden')) {
        document.getElementById(`reply-input-${answerId}`).focus();
    }
};

// ৩. রিপ্লাই সাবমিট করা (সরাসরি ওই থ্রেডে)
window.submitReply = async (answerId) => {
    const input = document.getElementById(`reply-input-${answerId}`);
    const text = input.value.trim();
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
        toggleReplyBox(answerId);
        loadComments(answerId); // শুধু ওই থ্রেডটি রিলোড হবে
    }
};


// ===== ৪. FAB বাটন + Answer Modal =====
const setupAnswerFAB = (questionId, currentUser) => {
    // FAB বাটন তৈরি
    const fab = document.createElement('button');
    fab.id = 'answer-fab';
    fab.innerHTML = '<i class="fas fa-plus text-xl"></i>';
    fab.className = 'fixed bottom-6 right-6 z-[100] w-14 h-14 bg-[#0056b3] text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all duration-200';
    fab.title = 'উত্তর দিন';
    document.body.appendChild(fab);

    fab.addEventListener('click', () => openAnswerModal(questionId, currentUser));
};

const openAnswerModal = (questionId, currentUser) => {
    let backdrop = document.getElementById('answer-modal-backdrop');
    if (backdrop) backdrop.remove();

    backdrop = document.createElement('div');
    backdrop.id = 'answer-modal-backdrop';
    backdrop.className = 'fixed inset-0 bg-black/50 z-[200] flex items-end md:items-center justify-center';

    backdrop.innerHTML = `
        <div class="bg-white dark:bg-[#1a1a1b] w-full md:w-[600px] md:rounded-xl rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh]">
            <!-- হেডার -->
            <div class="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700 shrink-0">
                <span class="font-semibold text-[15px] text-gray-800 dark:text-gray-200">উত্তর লেখো</span>
                <button id="close-answer-modal" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <!-- বডি -->
            <div class="flex-1 overflow-y-auto px-4 py-3">
                ${currentUser ? `
                    <textarea id="answer-modal-textarea"
                        placeholder="এখানে তোমার উত্তর লেখো... (বিস্তারিত হলে ভালো হয়)"
                        class="w-full h-48 border border-gray-300 dark:border-gray-600 rounded-lg p-3 text-[14px] bg-white dark:bg-[#2d2d2d] text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#0056b3] focus:ring-1 focus:ring-[#0056b3] resize-none transition"></textarea>
                    <div class="flex items-center justify-between mt-2">
                        <span id="answer-modal-char-count" class="text-[11px] text-gray-400">০ অক্ষর</span>
                        <div id="answer-modal-message" class="hidden text-[12px]"></div>
                    </div>
                ` : `
                    <div class="text-center py-8">
                        <i class="fas fa-lock text-3xl text-gray-300 mb-3 block"></i>
                        <p class="text-[14px] text-gray-500 mb-3">উত্তর দিতে লগ ইন করো।</p>
                        <button id="answer-modal-login-btn" class="bg-[#0056b3] text-white px-5 py-2 rounded text-[13px] font-medium hover:bg-blue-700 transition">লগ ইন করুন</button>
                    </div>
                `}
            </div>

            <!-- ফুটার -->
            ${currentUser ? `
                <div class="border-t dark:border-gray-700 px-4 py-3 flex justify-end shrink-0">
                    <button id="answer-modal-submit"
                        class="bg-[#0056b3] text-white px-6 py-2 rounded-lg text-[13px] font-medium hover:bg-blue-700 active:scale-95 transition">
                        <i class="fas fa-paper-plane mr-1.5"></i> উত্তর জমা দিন
                    </button>
                </div>
            ` : ''}
        </div>
    `;

    document.body.appendChild(backdrop);

    // বন্ধ করা
    document.getElementById('close-answer-modal').addEventListener('click', () => backdrop.remove());
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
    document.getElementById('answer-modal-login-btn')?.addEventListener('click', () => {
        backdrop.remove();
        document.getElementById('login-btn')?.click();
    });

    if (!currentUser) return;

    // অক্ষর গণনা
    const textarea = document.getElementById('answer-modal-textarea');
    const charCount = document.getElementById('answer-modal-char-count');
    textarea.addEventListener('input', () => {
        const len = textarea.value.length;
        charCount.textContent = `${toBanglaNumber(len)} অক্ষর`;
        charCount.className = len < 20 ? 'text-[11px] text-red-400' : 'text-[11px] text-green-500';
    });

    // সাবমিট
    document.getElementById('answer-modal-submit').addEventListener('click', async () => {
        const body = textarea.value.trim();
        const msgEl = document.getElementById('answer-modal-message');

        if (body.length < 20) {
            msgEl.textContent = 'উত্তর কমপক্ষে ২০ অক্ষর হতে হবে।';
            msgEl.className = 'text-[12px] text-red-500';
            msgEl.classList.remove('hidden');
            return;
        }

        const submitBtn = document.getElementById('answer-modal-submit');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1.5"></i> জমা হচ্ছে...';

        try {
            const { error } = await supabase.from('answer').insert([{
                question_id: questionId,
                body: body,
                author_id: currentUser.id,
                votes: 0,
                is_best_answer: false,
                created_at: new Date().toISOString()
            }]);

            if (error) throw error;

            // সাকসেস
            backdrop.remove();
            await loadAnswers(questionId, currentUser);

        } catch (err) {
            msgEl.textContent = 'ত্রুটি: ' + err.message;
            msgEl.className = 'text-[12px] text-red-500';
            msgEl.classList.remove('hidden');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane mr-1.5"></i> উত্তর জমা দিন';
        }
    });

    // textarea এ focus
    setTimeout(() => textarea?.focus(), 100);
};

// ===== উত্তর লোড =====
const loadAnswers = async (questionId, currentUser, questionAuthorId) => {
    const { data, error } = await supabase
        .from('answer')
        .select('*')
        .eq('question_id', questionId)
        .order('votes', { ascending: false });

    if (error || !data || data.length === 0) {
        const answerList = document.getElementById('answer-list');
        answerList.innerHTML = `
            <div class="text-center py-6 text-gray-400 text-[13px]">
                <i class="far fa-comment-dots text-3xl block mb-2 opacity-40"></i>
                এখনো কোনো উত্তর নেই। প্রথম উত্তর দাও!
            </div>
        `;
        return;
    }

    // profile আলাদাভাবে fetch
    const authorIds = [...new Set(data.map(a => a.author_id).filter(Boolean))];
    let profileMap = {};
    if (authorIds.length > 0) {
        const { data: profiles } = await supabase
            .from('profile')
            .select('id, username, full_name, avatar_url')
            .in('id', authorIds);
        if (profiles) profiles.forEach(p => { profileMap[p.id] = p; });
    }

    allAnswers = data.map(a => ({ ...a, profile: profileMap[a.author_id] || null }));

    const answerCountText = document.getElementById('answer-count-text');
    if (answerCountText) answerCountText.textContent = toBanglaNumber(allAnswers.length);

    renderAnswers(allAnswers, questionAuthorId, currentUser);
    setupSortButtons(questionAuthorId, currentUser);
};

// ===== মূল ইনিট =====
export const initQuestionPage = async () => {
    const questionId = getQuestionId();

    if (!questionId) {
        document.getElementById('question-skeleton').classList.add('hidden');
        document.getElementById('question-error').classList.remove('hidden');
        document.getElementById('question-error-msg').textContent = 'প্রশ্নের ID পাওয়া যায়নি।';
        return;
    }

    try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();

        const { data: question, error } = await supabase
            .from('question')
            .select('*, profile(username, full_name, avatar_url)')
            .eq('id', questionId)
            .single();

        if (error || !question) {
            document.getElementById('question-skeleton').classList.add('hidden');
            document.getElementById('question-error').classList.remove('hidden');
            document.getElementById('question-error-msg').textContent = 'প্রশ্নটি খুঁজে পাওয়া যায়নি।';
            return;
        }

        renderQuestion(question, currentUser);
        incrementViewCount(questionId);
        await loadAnswers(questionId, currentUser, question.author_id);

        // ৪. FAB বাটন সেটআপ
        setupAnswerFAB(questionId, currentUser);

    } catch (err) {
        document.getElementById('question-skeleton').classList.add('hidden');
        document.getElementById('question-error').classList.remove('hidden');
        document.getElementById('question-error-msg').textContent = 'পেজ লোড ত্রুটি: ' + err.message;
    }
};
