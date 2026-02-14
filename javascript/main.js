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

const createQuestionCard = (question) => {
    const tag = Array.isArray(question.tag) ? question.tag : [];
    const excerpt = truncateText(question.body, 120); 
    const timeAgo = formatTimeAgo(question.created_at);
    const questionLink = `/question.html?id=${question.id}`;
    
    return `
        <article class="mx-2 my-1 p-3 border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-transparent shadow-sm">
            <div class="flex items-center gap-2 mb-2">
                <img src="${question.author_avatar || 'https://via.placeholder.com/32'}" 
                     class="w-8 h-8 rounded-full border border-gray-100 shadow-sm" alt="User">
                <div class="flex items-center gap-2">
                    <span class="text-[14px] font-bold text-gray-800 dark:text-gray-200">${question.author_name || 'অজানা ইউজার'}</span>
                    <time datetime="${question.created_at}" class="text-[11px] text-gray-400">
                        ${timeAgo}
                    </time>
                </div>
            </div>

            <div class="min-w-0">
                <h3 class="text-[16px] font-normal mb-0.5 leading-tight">
                    <a href="${questionLink}" style="color: #0056b3;" class="hover:underline">
                        ${question.title}
                    </a>
                </h3>
                
                <p class="text-[13px] text-gray-500 dark:text-gray-400 mb-2 line-clamp-2 leading-normal">
                    ${excerpt}
                </p>
                
                <div class="flex flex-wrap gap-1.5">
                    ${question.category ? `
                        <span class="px-2 py-0.5 text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-[#0056b3] dark:text-blue-400 border border-gray-200 dark:border-gray-700 rounded">
                            ${question.category}
                        </span>
                    ` : ''}

                    ${tag.map(t => `
                        <span class="px-2 py-0.5 text-[10px] font-bold bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded">
                            #${t}
                        </span>
                    `).join('')}
                </div>
            </div>
        </article>
    `;
};

const loadLatestQuestion = async () => {
    const questionList = document.getElementById('question-list');
    if (!questionList) return;
    
    const skeletonHTML = `
        <div class="mx-2 my-1 p-3 border border-gray-100 dark:border-gray-800 rounded-md animate-pulse">
            <div class="h-4 w-full bg-gray-200 dark:bg-gray-800 rounded mb-2"></div>
            <div class="h-6 w-3/4 bg-gray-200 dark:bg-gray-800 rounded mb-2"></div>
            <div class="h-4 w-full bg-gray-100 dark:bg-gray-800 rounded mb-1"></div>
        </div>
    `;

    questionList.innerHTML = skeletonHTML.repeat(20);

    try {
        const { data: questionData, error, count } = await supabase
            .from('question')
            .select('*', { count: 'exact' }) // যেহেতু ভোট/উত্তর দেখাচ্ছ না, তাই সিম্পল সিলেক্ট রাখা হয়েছে
            .order('created_at', { ascending: false })
            .limit(PAGE_SIZE);
        
        if (error) throw error;

        if (questionData && questionData.length > 0) {
            questionList.innerHTML = questionData.map(q => createQuestionCard(q)).join('');
            
            const countEl = document.getElementById('question-count');
            if (countEl) {
                countEl.textContent = `সর্বমোট ${toBanglaNumber(count)} টি প্রশ্ন`;
            }
        } else {
            questionList.innerHTML = '<p class="p-6 text-center text-gray-500 text-[13px]">কোনো প্রশ্ন পাওয়া যায়নি।</p>';
        }
    } catch (err) {
        console.error('Error:', err);
        questionList.innerHTML = `<p class="p-6 text-center text-red-500 text-[13px]">ত্রুটি: ${err.message}</p>`;
    }
};

export const initHomePage = () => {
    loadLatestQuestion();
};

document.addEventListener('DOMContentLoaded', initHomePage);

export { loadLatestQuestion, formatTimeAgo, toBanglaNumber };
