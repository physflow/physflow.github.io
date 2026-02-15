import { supabase } from './supabase-config.js';

let allAnswers = [];
let currentSort = 'votes';

// ১. সংখ্যাকে বাংলায় রূপান্তর
const toBanglaNumber = (num) => {
    const banglaDigits = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
    return String(num ?? 0)
        .split('')
        .map(d => banglaDigits[parseInt(d)] ?? d)
        .join('');
};

// ২. সময় ফরম্যাট
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

// ৩. অবতার রেন্ডার
const getAvatarHtml = (avatarUrl, name, sizeClass = "w-9 h-9") => {
    if (avatarUrl) {
        return `<img src="${avatarUrl}" class="${sizeClass} rounded-full object-cover border border-gray-100 dark:border-gray-800" alt="${name}">`;
    }
    const initials = name ? name.charAt(0).toUpperCase() : '?';
    return `
        <div class="${sizeClass} rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-[12px] shadow-sm">
            ${initials}
        </div>
    `;
};

// ৪. URL থেকে প্রশ্ন আইডি
const getQuestionId = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
};

// ৫. ভিউ কাউন্ট
const incrementViewCount = async (questionId) => {
    const sessionKey = `viewed_${questionId}`;
    if (sessionStorage.getItem(sessionKey)) return;

    try {
        await supabase.rpc('increment_views', { question_id: questionId });
        sessionStorage.setItem(sessionKey, 'true');
    } catch {
        console.warn("View increment failed");
    }
};

// ৬. প্রশ্ন রেন্ডার
const renderQuestion = (question, currentUser) => {
    document.getElementById('question-skeleton')?.classList.add('hidden');
    document.getElementById('question-content')?.classList.remove('hidden');
    document.getElementById('answers-section')?.classList.remove('hidden');

    document.title = `${question.title} - physflow`;

    document.getElementById('question-title').textContent = question.title;
    document.getElementById('question-time').textContent = formatTimeAgo(question.created_at);
    document.getElementById('question-views').textContent = toBanglaNumber(question.views || 0);
    document.getElementById('q-vote-count').textContent = toBanglaNumber(question.votes || 0);

    const bodyEl = document.getElementById('question-body');
    if (bodyEl) bodyEl.innerHTML = question.body || '';

    const avatarHtml = getAvatarHtml(
        question.profile?.avatar_url,
        question.profile?.username || 'U'
    );

    const avatarContainer = document.getElementById('q-author-avatar');
    if (avatarContainer) avatarContainer.innerHTML = avatarHtml;

    const profileLink = document.getElementById('author-profile-link');
    if (profileLink) profileLink.href = `profile.html?id=${question.author_id}`;

    const catBadge = document.getElementById('question-category-badge');
    if (catBadge && question.category) {
        catBadge.innerHTML = `
            <span class="px-2 py-1 text-[10px] font-bold bg-blue-50 dark:bg-blue-900/20 text-[#0056b3] rounded border border-blue-100 dark:border-blue-800">
                ${question.category}
            </span>
        `;
    }

    const tagsContainer = document.getElementById('question-tags');
    if (tagsContainer) {
        const tags = Array.isArray(question.tag) ? question.tag : [];
        tagsContainer.innerHTML = tags.map(t => `
            <span class="px-2 py-1 text-[10px] font-bold bg-gray-50 dark:bg-gray-800/50 text-gray-600 rounded border border-gray-200 dark:border-gray-700">
                #${t}
            </span>
        `).join('');
    }

    setupVoteButtons(question.id, question.votes || 0, currentUser, 'question');
};

// ৭. ভোট সিস্টেম
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

        const { data, error } = await supabase
            .from(table)
            .select('votes')
            .eq('id', id)
            .single();

        if (error) return;

        let currentDBVotes = data?.votes || 0;
        let voteChange = 0;

        if (!userVote) {
            voteChange = direction === 'up' ? 1 : -1;
        } else if (userVote === 'up' && direction === 'down') {
            voteChange = -2;
        } else if (userVote === 'down' && direction === 'up') {
            voteChange = 2;
        }

        const newVotes = currentDBVotes + voteChange;

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


import { supabase } from './supabase-config.js';

let allAnswers = [];
let currentSort = 'votes';

// ১. সংখ্যাকে বাংলায় রূপান্তর
const toBanglaNumber = (num) => {
    const banglaDigits = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
    return String(num ?? 0)
        .split('')
        .map(d => banglaDigits[parseInt(d)] ?? d)
        .join('');
};

// ২. সময় ফরম্যাট
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

// ৩. অবতার রেন্ডার
const getAvatarHtml = (avatarUrl, name, sizeClass = "w-9 h-9") => {
    if (avatarUrl) {
        return `<img src="${avatarUrl}" class="${sizeClass} rounded-full object-cover border border-gray-100 dark:border-gray-800" alt="${name}">`;
    }
    const initials = name ? name.charAt(0).toUpperCase() : '?';
    return `
        <div class="${sizeClass} rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-[12px] shadow-sm">
            ${initials}
        </div>
    `;
};

// ৪. URL থেকে প্রশ্ন আইডি
const getQuestionId = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
};

// ৫. ভিউ কাউন্ট
const incrementViewCount = async (questionId) => {
    const sessionKey = `viewed_${questionId}`;
    if (sessionStorage.getItem(sessionKey)) return;

    try {
        await supabase.rpc('increment_views', { question_id: questionId });
        sessionStorage.setItem(sessionKey, 'true');
    } catch {
        console.warn("View increment failed");
    }
};

// ৬. প্রশ্ন রেন্ডার
const renderQuestion = (question, currentUser) => {
    document.getElementById('question-skeleton')?.classList.add('hidden');
    document.getElementById('question-content')?.classList.remove('hidden');
    document.getElementById('answers-section')?.classList.remove('hidden');

    document.title = `${question.title} - physflow`;

    document.getElementById('question-title').textContent = question.title;
    document.getElementById('question-time').textContent = formatTimeAgo(question.created_at);
    document.getElementById('question-views').textContent = toBanglaNumber(question.views || 0);
    document.getElementById('q-vote-count').textContent = toBanglaNumber(question.votes || 0);

    const bodyEl = document.getElementById('question-body');
    if (bodyEl) bodyEl.innerHTML = question.body || '';

    const avatarHtml = getAvatarHtml(
        question.profile?.avatar_url,
        question.profile?.username || 'U'
    );

    const avatarContainer = document.getElementById('q-author-avatar');
    if (avatarContainer) avatarContainer.innerHTML = avatarHtml;

    const profileLink = document.getElementById('author-profile-link');
    if (profileLink) profileLink.href = `profile.html?id=${question.author_id}`;

    const catBadge = document.getElementById('question-category-badge');
    if (catBadge && question.category) {
        catBadge.innerHTML = `
            <span class="px-2 py-1 text-[10px] font-bold bg-blue-50 dark:bg-blue-900/20 text-[#0056b3] rounded border border-blue-100 dark:border-blue-800">
                ${question.category}
            </span>
        `;
    }

    const tagsContainer = document.getElementById('question-tags');
    if (tagsContainer) {
        const tags = Array.isArray(question.tag) ? question.tag : [];
        tagsContainer.innerHTML = tags.map(t => `
            <span class="px-2 py-1 text-[10px] font-bold bg-gray-50 dark:bg-gray-800/50 text-gray-600 rounded border border-gray-200 dark:border-gray-700">
                #${t}
            </span>
        `).join('');
    }

    setupVoteButtons(question.id, question.votes || 0, currentUser, 'question');
};

// ৭. ভোট সিস্টেম
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

        const { data, error } = await supabase
            .from(table)
            .select('votes')
            .eq('id', id)
            .single();

        if (error) return;

        let currentDBVotes = data?.votes || 0;
        let voteChange = 0;

        if (!userVote) {
            voteChange = direction === 'up' ? 1 : -1;
        } else if (userVote === 'up' && direction === 'down') {
            voteChange = -2;
        } else if (userVote === 'down' && direction === 'up') {
            voteChange = 2;
        }

        const newVotes = currentDBVotes + voteChange;

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