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

// ===== ডিবাগ হেল্পার: পেজেই error দেখাবে =====
const showDebug = (containerId, msg, type = 'error') => {
    const el = document.getElementById(containerId);
    if (!el) return;
    const color = type === 'error' ? 'red' : type === 'warn' ? 'yellow' : 'blue';
    el.innerHTML = `
        <div class="p-3 my-2 bg-${color}-50 dark:bg-${color}-900/20 border border-${color}-200 rounded text-[12px] text-${color}-700 dark:text-${color}-300 font-mono whitespace-pre-wrap break-all">
${msg}
        </div>
    `;
};

const renderQuestion = (question, currentUser) => {
    document.getElementById('question-skeleton').classList.add('hidden');
    document.getElementById('question-content').classList.remove('hidden');
    document.getElementById('answers-section').classList.remove('hidden');
    document.getElementById('answer-form-section').classList.remove('hidden');

    const breadcrumb = document.getElementById('breadcrumb-title');
    if (breadcrumb) {
        breadcrumb.textContent = question.title.substring(0, 50) + (question.title.length > 50 ? '...' : '');
    }

    document.title = `${question.title} - physflow`;
    document.getElementById('question-title').textContent = question.title;
    document.getElementById('question-time').textContent = formatTimeAgo(question.created_at);
    document.getElementById('question-views').textContent = toBanglaNumber(question.views || 0);

    const categoryBadge = document.getElementById('question-category-badge');
    if (question.category) {
        categoryBadge.innerHTML = `
            <a href="categories.html?cat=${encodeURIComponent(question.category)}"
               class="px-2 py-0.5 text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-[#0056b3] dark:text-blue-400 border border-gray-200 dark:border-gray-700 rounded hover:bg-blue-50 transition">
                ${question.category}
            </a>
        `;
    }

    document.getElementById('q-vote-count').textContent = toBanglaNumber(question.votes || 0);
    document.getElementById('question-body').innerHTML = question.body || '';

    const tagsContainer = document.getElementById('question-tags');
    const tags = Array.isArray(question.tag) ? question.tag : [];
    tagsContainer.innerHTML = tags.map(t => `
        <a href="tags.html?tag=${encodeURIComponent(t)}"
           class="px-2 py-0.5 text-[10px] font-bold bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded hover:bg-blue-50 hover:text-[#0056b3] hover:border-blue-200 transition">
            #${t}
        </a>
    `).join('');

    const authorName = question.profile?.username || question.profile?.full_name || 'অজ্ঞাত';
    document.getElementById('author-name').textContent = authorName;
    document.getElementById('author-avatar-placeholder').textContent = getInitials(authorName);
    if (question.profile?.avatar_url) {
        const avatarEl = document.getElementById('author-avatar-placeholder');
        avatarEl.outerHTML = `<img src="${question.profile.avatar_url}" class="w-7 h-7 rounded object-cover" alt="${authorName}">`;
    }

    setupVoteButtons(question.id, question.votes || 0, currentUser, 'question');
};

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
        if (!currentUser) {
            alert('ভোট দিতে হলে লগ ইন করতে হবে।');
            return;
        }
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

const createAnswerCard = (answer, questionAuthorId, currentUser) => {
    const authorName = answer.profile?.username || answer.profile?.full_name || 'অজ্ঞাত';
    const initials = getInitials(authorName);
    const timeAgo = formatTimeAgo(answer.created_at);
    const isBest = answer.is_best_answer;
    const isQuestionAuthor = currentUser && currentUser.id === questionAuthorId;

    return `
        <div class="border ${isBest ? 'border-green-300 dark:border-green-700' : 'border-gray-200 dark:border-gray-800'} rounded-md p-4 bg-white dark:bg-transparent" id="answer-card-${answer.id}">
            ${isBest ? `
                <div class="flex items-center gap-1.5 mb-3">
                    <span class="best-answer-badge px-2 py-0.5 text-[11px] font-semibold rounded-full flex items-center gap-1">
                        <i class="fas fa-check-circle"></i> সেরা উত্তর
                    </span>
                </div>
            ` : ''}
            <div class="flex gap-3">
                <div class="flex flex-col items-center gap-1 shrink-0 pt-1">
                    <button id="ans-${answer.id}-vote-up" class="vote-btn w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-gray-600 text-gray-500 hover:border-[#0056b3] hover:text-[#0056b3] text-[12px]">
                        <i class="fas fa-caret-up text-lg"></i>
                    </button>
                    <span id="ans-${answer.id}-vote-count" class="text-[13px] font-semibold text-gray-700 dark:text-gray-300">${toBanglaNumber(answer.votes || 0)}</span>
                    <button id="ans-${answer.id}-vote-down" class="vote-btn w-7 h-7 flex items-center justify-center rounded border border-gray-300 dark:border-gray-600 text-gray-500 hover:border-red-500 hover:text-red-500 text-[12px]">
                        <i class="fas fa-caret-down text-lg"></i>
                    </button>
                    ${isQuestionAuthor && !isBest ? `
                        <button class="mark-best-btn mt-1 text-gray-300 dark:text-gray-600 hover:text-green-500 dark:hover:text-green-400 transition"
                                data-answer-id="${answer.id}" title="সেরা উত্তর হিসেবে চিহ্নিত করুন">
                            <i class="fas fa-check-circle text-lg"></i>
                        </button>
                    ` : ''}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="answer-body-content text-[14px] text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
                        ${answer.body || ''}
                    </div>
                    <div class="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                        <time class="text-[11px] text-gray-400">${timeAgo}</time>
                        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded px-2 py-1.5 text-[11px] flex items-center gap-1.5">
                            <div class="w-5 h-5 rounded bg-[#0056b3] flex items-center justify-center text-white text-[9px] font-bold">${initials}</div>
                            <span class="text-[#0056b3] font-medium">${authorName}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};

let allAnswers = [];
let currentSort = 'votes';

const renderAnswers = (answers, questionAuthorId, currentUser) => {
    const answerList = document.getElementById('answer-list');
    if (!answers || answers.length === 0) {
        answerList.innerHTML = `
            <div class="text-center py-6 text-gray-400 text-[13px]">
                <i class="far fa-comment-dots text-3xl block mb-2 opacity-40"></i>
                এখনো কোনো উত্তর নেই। প্রথম উত্তর দাও!
            </div>
        `;
        return;
    }

    const sorted = [...answers].sort((a, b) => {
        if (a.is_best_answer && !b.is_best_answer) return -1;
        if (!a.is_best_answer && b.is_best_answer) return 1;
        if (currentSort === 'votes') return (b.votes || 0) - (a.votes || 0);
        return new Date(b.created_at) - new Date(a.created_at);
    });

    answerList.innerHTML = sorted.map(ans => createAnswerCard(ans, questionAuthorId, currentUser)).join('');
    sorted.forEach(ans => setupVoteButtons(ans.id, ans.votes || 0, currentUser, 'answer'));
    document.querySelectorAll('.mark-best-btn').forEach(btn => {
        btn.addEventListener('click', () => markBestAnswer(btn.dataset.answerId));
    });
};

const markBestAnswer = async (answerId) => {
    const questionId = getQuestionId();
    if (!confirm('এই উত্তরটিকে সেরা উত্তর হিসেবে চিহ্নিত করবে?')) return;
    await supabase.from('answer').update({ is_best_answer: false }).eq('question_id', questionId);
    await supabase.from('answer').update({ is_best_answer: true }).eq('id', answerId);
    window.location.reload();
};

const setupSortButtons = (questionAuthorId, currentUser) => {
    const sortVotesBtn = document.getElementById('sort-votes');
    const sortLatestBtn = document.getElementById('sort-latest');

    sortVotesBtn?.addEventListener('click', () => {
        currentSort = 'votes';
        sortVotesBtn.className = 'px-2 py-1 rounded text-[#0056b3] bg-blue-50 dark:bg-blue-900/20 font-medium text-[12px]';
        sortLatestBtn.className = 'px-2 py-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 text-[12px]';
        renderAnswers(allAnswers, questionAuthorId, currentUser);
    });

    sortLatestBtn?.addEventListener('click', () => {
        currentSort = 'latest';
        sortLatestBtn.className = 'px-2 py-1 rounded text-[#0056b3] bg-blue-50 dark:bg-blue-900/20 font-medium text-[12px]';
        sortVotesBtn.className = 'px-2 py-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 text-[12px]';
        renderAnswers(allAnswers, questionAuthorId, currentUser);
    });
};

const setupAnswerForm = (questionId, currentUser) => {
    const answerLoginPrompt = document.getElementById('answer-login-prompt');
    const answerForm = document.getElementById('answer-form');
    const answerTextarea = document.getElementById('answer-textarea');
    const charCount = document.getElementById('answer-char-count');
    const submitBtn = document.getElementById('answer-submit-btn');

    if (!currentUser) {
        answerLoginPrompt.classList.remove('hidden');
        document.getElementById('answer-login-btn')?.addEventListener('click', () => {
            document.getElementById('login-btn')?.click();
        });
        return;
    }

    answerForm.classList.remove('hidden');

    answerTextarea.addEventListener('input', () => {
        const len = answerTextarea.value.length;
        charCount.textContent = `${toBanglaNumber(len)} অক্ষর`;
        charCount.className = len < 20 ? 'text-[11px] text-red-400' : 'text-[11px] text-green-500';
    });

    answerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = answerTextarea.value.trim();
        if (body.length < 20) {
            showAnswerMessage('উত্তর কমপক্ষে ২০ অক্ষর হতে হবে।', 'error');
            return;
        }

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

            showAnswerMessage('উত্তর সফলভাবে জমা হয়েছে!', 'success');
            answerTextarea.value = '';
            charCount.textContent = '০ অক্ষর';
            charCount.className = 'text-[11px] text-gray-400';
            await loadAnswers(questionId, currentUser);

        } catch (err) {
            showAnswerMessage('ত্রুটি: ' + err.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane mr-1.5"></i> উত্তর জমা দিন';
        }
    });
};

const showAnswerMessage = (msg, type) => {
    const el = document.getElementById('answer-message');
    el.textContent = msg;
    el.className = `text-[12px] mt-2 ${type === 'error' ? 'text-red-500' : 'text-green-600'}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
};

// ===== উত্তর লোড (পেজেই error দেখাবে) =====
const loadAnswers = async (questionId, currentUser, questionAuthorId) => {
    const answerList = document.getElementById('answer-list');

    // ধাপ ১: আগে profile join ছাড়া চেষ্টা করি
    const { data, error } = await supabase
        .from('answer')
        .select('*')
        .eq('question_id', questionId)
        .order('votes', { ascending: false });

    if (error) {
        answerList.innerHTML = `
            <div class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded text-[12px] text-red-600 font-mono">
                <div class="font-bold mb-1">⚠️ Answer Load Error:</div>
                <div>Message: ${error.message}</div>
                <div>Code: ${error.code || 'N/A'}</div>
                <div>Details: ${error.details || 'N/A'}</div>
                <div>Hint: ${error.hint || 'N/A'}</div>
                <div class="mt-1">question_id: "${questionId}"</div>
            </div>
        `;
        return;
    }

    if (!data || data.length === 0) {
        answerList.innerHTML = `
            <div class="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 rounded text-[12px] text-yellow-700">
                <div class="font-bold mb-1">ℹ️ Debug Info:</div>
                <div>question_id = "${questionId}" দিয়ে answer টেবিলে কোনো row পাওয়া যায়নি।</div>
                <div class="mt-1">Supabase Dashboard → answer টেবিলে question_id কলাম চেক করো।</div>
            </div>
        `;
        return;
    }

    // data পাওয়া গেলে profile আলাদাভাবে fetch করা (join সমস্যা এড়াতে)
    const authorIds = [...new Set(data.map(a => a.author_id).filter(Boolean))];
    let profileMap = {};

    if (authorIds.length > 0) {
        const { data: profiles } = await supabase
            .from('profile')
            .select('id, username, full_name, avatar_url')
            .in('id', authorIds);

        if (profiles) {
            profiles.forEach(p => { profileMap[p.id] = p; });
        }
    }

    // প্রতিটি answer-এ profile যোগ করা
    allAnswers = data.map(a => ({
        ...a,
        profile: profileMap[a.author_id] || null
    }));

    const answerCountText = document.getElementById('answer-count-text');
    if (answerCountText) {
        answerCountText.textContent = toBanglaNumber(allAnswers.length);
    }

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
            document.getElementById('question-error-msg').textContent =
                `প্রশ্নটি খুঁজে পাওয়া যায়নি। (ID: ${questionId}, Error: ${error?.message || 'null'})`;
            return;
        }

        renderQuestion(question, currentUser);
        incrementViewCount(questionId);
        await loadAnswers(questionId, currentUser, question.author_id);
        setupAnswerForm(questionId, currentUser);

    } catch (err) {
        document.getElementById('question-skeleton').classList.add('hidden');
        document.getElementById('question-error').classList.remove('hidden');
        document.getElementById('question-error-msg').textContent = 'পেজ লোড ত্রুটি: ' + err.message;
    }
};
