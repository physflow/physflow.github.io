import { supabase } from './supabase-config.js';

// ১. কনফিগারেশন ও স্টেট ম্যানেজমেন্ট
const PAGE_SIZE = 15;
const urlParams = new URLSearchParams(window.location.search);
const currentPage = parseInt(urlParams.get('page')) || 1;

// ২. বাংলা সংখ্যা কনভার্টার
const toBanglaNumber = (num) => {
    const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(num).split('').map(digit => banglaDigits[parseInt(digit)] || digit).join('');
};

// ৩. সময় ফরম্যাট (কতক্ষণ আগে)
const formatTimeAgo = (date) => {
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

// ৪. টেক্সট ছোট করা (Excerpt)
const truncateText = (text, maxLength = 130) => {
    if (!text) return '';
    const stripped = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (stripped.length <= maxLength) return stripped;
    return stripped.substring(0, maxLength) + '...';
};

// ৫. কোশ্চেন কার্ড তৈরির HTML
const createQuestionCard = (question) => {
    const tag = Array.isArray(question.tag) ? question.tag : [];
    const excerpt = truncateText(question.body, 130); 
    const timeAgo = formatTimeAgo(question.created_at);
    
    return `
        <article class="p-4 border-b border-gray-100 dark:border-gray-800 bg-transparent hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all">
            <div class="flex items-center justify-between mb-3">
                <div class="flex gap-4">
                    <div class="flex items-center gap-1">
                        <span class="text-base font-bold text-red-600">${toBanglaNumber(question.votes || 0)}</span>
                        <span class="text-[13px] text-gray-500">ভোট</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <span class="text-base font-bold text-green-600">${toBanglaNumber(question.answers_count || 0)}</span>
                        <span class="text-[13px] text-gray-500">উত্তর</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <span class="text-base font-bold text-amber-500">${toBanglaNumber(question.views || 0)}</span>
                        <span class="text-[13px] text-gray-500">দেখা</span>
                    </div>
                </div>
                
                <time datetime="${question.created_at}" class="text-[12px] text-gray-400">
                    ${timeAgo}
                </time>
            </div>

            <div class="min-w-0">
                <h3 class="text-lg font-medium mb-2 leading-snug">
                    <a href="question.html?slug=${question.slug}" style="color: #0a95ff;" class="hover:underline">
                        ${question.title}
                    </a>
                </h3>
                
                <p class="text-[14px] text-gray-600 dark:text-gray-400 mb-4 leading-relaxed line-clamp-2">
                    ${excerpt}
                </p>
                
                <div class="flex flex-wrap gap-2">
                    ${question.category ? `
                        <span class="px-2 py-0.5 text-[11px] font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-500 border border-blue-100 dark:border-blue-900/30 rounded">
                            ${question.category}
                        </span>
                    ` : ''}

                    ${tag.map(t => `
                        <span class="px-2 py-0.5 text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded">
                            #${t}
                        </span>
                    `).join('')}
                </div>
            </div>
        </article>
    `;
};

// ৬. প্যাগিনেশন রেন্ডার ফাংশন (শুধুমাত্র সংখ্যা)
const renderPagination = (totalCount) => {
    let container = document.getElementById('pagination-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'pagination-container';
        container.className = 'flex justify-center items-center gap-2 p-8';
        document.getElementById('question-list').after(container);
    }

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    let html = '';

    if (totalPages > 1) {
        for (let i = 1; i <= totalPages; i++) {
            const activeClass = i === currentPage 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800';
            
            html += `<a href="?page=${i}" class="px-4 py-2 border rounded text-sm font-medium transition-colors ${activeClass}">${toBanglaNumber(i)}</a>`;
        }
    }
    container.innerHTML = html;
};

// ৭. ডাটা লোড করার মেইন ফাংশন
const loadLatestQuestion = async () => {
    const questionList = document.getElementById('question-list');
    if (!questionList) return;
    
    // লোডিং অ্যানিমেশন
    questionList.innerHTML = `
        <div class="flex flex-col items-center justify-center p-20 text-gray-500">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
            <p class="animate-pulse">লোড হচ্ছে...</p>
        </div>
    `;
    
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    try {
        // লোডিং ফিল দেওয়ার জন্য কৃত্রিম ডিলে
        await new Promise(resolve => setTimeout(resolve, 500));

        const { data: questionData, error, count } = await supabase
            .from('question')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);
        
        if (error) throw error;

        if (questionData && questionData.length > 0) {
            questionList.innerHTML = questionData.map(q => createQuestionCard(q)).join('');
            renderPagination(count);
            
            const countEl = document.getElementById('question-count');
            if (countEl) countEl.textContent = `পৃষ্ঠা ${toBanglaNumber(currentPage)} (সর্বমোট ${toBanglaNumber(count)} টি প্রশ্ন)`;
        } else {
            questionList.innerHTML = '<p class="p-8 text-center text-gray-500">এখনো কোনো প্রশ্ন পাওয়া যায়নি।</p>';
        }
    } catch (err) {
        console.error('Error fetching question:', err);
        questionList.innerHTML = `<p class="p-8 text-center text-red-500">ত্রুটি: ${err.message}</p>`;
    }
};

// ৮. ইনিশিয়ালাইজেশন
export const initHomePage = () => {
    loadLatestQuestion();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHomePage);
} else {
    initHomePage();
}

export { loadLatestQuestion, formatTimeAgo, toBanglaNumber };
