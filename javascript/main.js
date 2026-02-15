import { supabase } from './supabase-config.js';

const PAGE_SIZE = 20;

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

const truncateText = (text, maxLength = 130) => {
    if (!text) return '';
    const stripped = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (stripped.length <= maxLength) return stripped;
    return stripped.substring(0, maxLength) + '...';
};

window.shareQuestion = async (title, url) => {
    const fullUrl = window.location.origin + url;
    if (navigator.share) {
        try {
            await navigator.share({ title: title, url: fullUrl });
        } catch (err) { console.log('Share failed'); }
    } else {
        navigator.clipboard.writeText(fullUrl);
        alert('লিঙ্ক কপি করা হয়েছে!');
    }
};

const createQuestionCard = (question) => {
    const excerpt = truncateText(question.body, 120); 
    const timeAgo = formatTimeAgo(question.created_at);
    const questionLink = `/question.html?id=${question.id}`;
    
    const authorName = question.profile?.full_name || question.profile?.username || 'অজানা ইউজার';
    const authorAvatar = question.profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=random&color=fff`;
    
    const answerCount = question.answer?.[0]?.count || 0;
    const voteCount = (question.upvotes || 0) - (question.downvotes || 0);
    const viewCount = question.views || 0;

    return `
        <article class="mx-2 my-1 p-3 border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-transparent shadow-sm flex flex-col gap-2">
            
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <img src="${authorAvatar}" class="w-7 h-7 rounded-full object-cover border border-gray-100" alt="User">
                    <span class="text-[13px] font-bold text-gray-800 dark:text-gray-200">${authorName}</span>
                </div>
                <time class="text-[11px] text-gray-400 shrink-0">${timeAgo}</time>
            </div>

            <div class="min-w-0">
                <h3 class="text-[16px] font-medium mb-1 leading-tight">
                    <a href="${questionLink}" class="text-gray-900 dark:text-gray-100 hover:text-blue-600 transition-colors">
                        ${question.title}
                    </a>
                </h3>
                <p class="text-[13px] text-gray-500 dark:text-gray-400 line-clamp-2">
                    ${excerpt}
                </p>
            </div>

            <div class="flex items-center gap-2 mt-1">
                <div class="flex items-center bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5 gap-2">
                    <button class="hover:text-orange-600 transition p-1"><i class="fas fa-arrow-up text-xs"></i></button>
                    <span class="text-[12px] font-bold text-gray-700 dark:text-gray-300">${toBanglaNumber(voteCount)}</span>
                    <button class="hover:text-blue-600 transition p-1"><i class="fas fa-arrow-down text-xs"></i></button>
                </div>

                <a href="${questionLink}" class="flex items-center bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1.5 gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                    <i class="far fa-comment text-sm"></i>
                    <span class="text-[12px] font-medium text-gray-700 dark:text-gray-300">${toBanglaNumber(answerCount)}</span>
                </a>

                <div class="flex items-center bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1.5 gap-2">
                    <i class="far fa-eye text-sm text-gray-500"></i>
                    <span class="text-[12px] font-medium text-gray-700 dark:text-gray-300">${toBanglaNumber(viewCount)}</span>
                </div>

                <button onclick="shareQuestion('${question.title.replace(/'/g, "\\'")}', '${questionLink}')" 
                    class="flex items-center bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1.5 gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                    <i class="fas fa-share text-sm"></i>
                    <span class="text-[12px] font-medium text-gray-700 dark:text-gray-300">শেয়ার</span>
                </button>
            </div>

        </article>
    `;
};

const loadLatestQuestion = async () => {
    const questionList = document.getElementById('question-list');
    if (!questionList) return;
    
    try {
        const { data: questionData, error } = await supabase
            .from('question')
            .select(`
                *,
                profile:author_id (full_name, username, avatar_url),
                answer(count)
            `)
            .order('created_at', { ascending: false })
            .limit(PAGE_SIZE);
        
        if (error) throw error;

        if (questionData && questionData.length > 0) {
            questionList.innerHTML = questionData.map(q => createQuestionCard(q)).join('');
        }
    } catch (err) {
        console.error('Error:', err);
    }
};

export const initHomePage = () => {
    loadLatestQuestion();
};

document.addEventListener('DOMContentLoaded', initHomePage);
