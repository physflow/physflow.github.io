import { supabase } from './supabase-config.js';

// State management
const PAGE_SIZE = 20;

// ১. বাংলা সংখ্যা কনভার্টার
const toBanglaNumber = (num) => {
    const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(num).split('').map(digit => banglaDigits[parseInt(digit)] || digit).join('');
};

// ২. সময়কে বাংলায় 'কতক্ষণ আগে' ফরম্যাট করা
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

// ৩. লেখার দৈর্ঘ্য সীমিত করা
const truncateText = (text, maxLength = 130) => {
    if (!text) return '';
    const stripped = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (stripped.length <= maxLength) return stripped;
    return stripped.substring(0, maxLength) + '...';
};

// ৪. প্রতিটি প্রশ্নের জন্য কার্ড (HTML) তৈরি
const createQuestionCard = (question) => {
    // ডাটাবেস থেকে ট্যাগ সরাসরি অ্যারে হিসেবে আসে, তাই JSON.parse এর দরকার নেই
    const tag = Array.isArray(question.tag) ? question.tag : [];
    const excerpt = truncateText(question.body, 130); 
    const timeAgo = formatTimeAgo(question.created_at);
    
    return `
        <article class="p-4 border border-gray-200 dark:border-gray-700 bg-transparent mb-4 transition-all hover:border-blue-300">
            <div class="flex items-center justify-between mb-3">
                <div class="flex gap-4 text-sm">
                    <div class="flex items-center gap-1">
                        <span class="font-bold text-red-600">${toBanglaNumber(question.votes || 0)}</span>
                        <span class="text-gray-500">ভোট</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <span class="font-bold text-green-600">${toBanglaNumber(question.answers_count || 0)}</span>
                        <span class="text-gray-500">উত্তর</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <span class="font-bold text-amber-500">${toBanglaNumber(question.views || 0)}</span>
                        <span class="text-gray-500">দেখা</span>
                    </div>
                </div>
                
                <time datetime="${question.created_at}" class="text-xs text-gray-400">
                    ${timeAgo}
                </time>
            </div>

            <div class="min-w-0">
                <h3 class="text-xl font-normal mb-2">
                    <a href="question.html?slug=${question.slug}" style="color: #0a95ff;" class="hover:underline">
                        ${question.title}
                    </a>
                </h3>
                
                <p class="text-[15px] text-gray-600 dark:text-gray-400 mb-4 leading-relaxed line-clamp-2">
                    ${excerpt}
                </p>
                
                <div class="flex flex-wrap gap-2">
                    ${question.category ? `
                        <span class="px-2 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-500 border border-blue-100 rounded">
                            ${question.category}
                        </span>
                    ` : ''}

                    ${tag.map(t => `
                        <span class="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 rounded">
                            #${t}
                        </span>
                    `).join('')}
                </div>
            </div>
        </article>
    `;
};

// ৫. ডাটাবেস থেকে প্রশ্ন নিয়ে আসা এবং রেন্ডার করা
const loadLatestQuestion = async () => {
    const questionList = document.getElementById('question-list');
    if (!questionList) return;
    
    // লোডিং অবস্থা দেখানো
    questionList.innerHTML = '<div class="p-10 text-center text-gray-500">লোড হচ্ছে...</div>';
    
    try {
        const { data: questionData, error } = await supabase
            .from('question') 
            .select('*')
            .order('created_at', { ascending: false })
            .range(0, PAGE_SIZE - 1);
        
        if (error) throw error;

        if (questionData && questionData.length > 0) {
            questionList.innerHTML = questionData.map(q => createQuestionCard(q)).join('');
            
            const countEl = document.getElementById('question-count');
            if (countEl) countEl.textContent = `সর্বশেষ ${toBanglaNumber(questionData.length)} টি প্রশ্ন`;
        } else {
            questionList.innerHTML = '<div class="p-10 text-center text-gray-500">এখনো কোনো প্রশ্ন জমা পড়েনি।</div>';
        }
    } catch (error) {
        console.error('Error fetching question:', error);
        questionList.innerHTML = `<div class="p-10 text-center text-red-500">ত্রুটি: ${error.message}</div>`;
    }
};

// ৬. পেজ ইনিশিয়ালাইজেশন
export const initHomePage = () => {
    loadLatestQuestion();
};

// ৭. অটোমেটিক ফাংশন কল (যাতে পেজ লোড হলেই কাজ করে)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHomePage);
} else {
    initHomePage();
}

export { loadLatestQuestion, formatTimeAgo, toBanglaNumber };
