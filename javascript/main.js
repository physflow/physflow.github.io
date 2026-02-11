import { supabase } from './supabase-config.js';

// State management
const PAGE_SIZE = 20;

// Bangla number converter
const toBanglaNumber = (num) => {
    const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(num).split('').map(digit => banglaDigits[parseInt(digit)] || digit).join('');
};

// Format time ago in Bangla
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

// Truncate text
const truncateText = (text, maxLength = 130) => {
    if (!text) return '';
    const stripped = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (stripped.length <= maxLength) return stripped;
    return stripped.substring(0, maxLength) + '...';
};

// Create question card HTML (tags পরিবর্তন করে tag করা হয়েছে)
const createQuestionCard = (question) => {
    // এখানে question.tags এর বদলে question.tag ব্যবহার করা হয়েছে
    const tags = question.tag ? (Array.isArray(question.tag) ? question.tag : JSON.parse(question.tag)) : [];
    const excerpt = truncateText(question.body, 130); 
    const timeAgo = formatTimeAgo(question.created_at);
    
    return `
        <article class="p-4 border border-gray-200 dark:border-gray-700 bg-transparent shadow-none transition-none">
            <div class="flex items-center justify-between mb-3">
                <div class="flex gap-4">
                    <div class="flex items-center gap-1">
                        <span class="text-base font-bold text-red-600">${toBanglaNumber(question.votes || 0)}</span>
                        <span class="text-base font-bold text-red-600">ভোট</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <span class="text-base font-bold text-green-600">${toBanglaNumber(question.answers_count || 0)}</span>
                        <span class="text-base font-bold text-green-600">উত্তর</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <span class="text-base font-bold text-amber-500">${toBanglaNumber(question.views || 0)}</span>
                        <span class="text-base font-bold text-amber-500">দেখা</span>
                    </div>
                </div>
                
                <time datetime="${question.created_at}" class="text-sm text-gray-400">
                    ${timeAgo}
                </time>
            </div>

            <div class="min-w-0">
                <h3 class="text-xl font-normal mb-2">
                    <a href="questions/${question.slug}.html" style="color: #0a95ff;" class="hover:underline">
                        ${question.title}
                    </a>
                </h3>
                
                <p class="text-[15px] text-gray-600 dark:text-gray-400 mb-4 leading-relaxed line-clamp-2">
                    ${excerpt}
                </p>
                
                <div class="flex flex-wrap gap-2">
                    ${question.category ? `
                        <span class="px-3 py-1 text-sm font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-500 border border-blue-100 dark:border-blue-900/30 rounded-md">
                            ${question.category}
                        </span>
                    ` : ''}

                    ${tags.map(t => `
                        <span class="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-md">
                            #${t}
                        </span>
                    `).join('')}
                </div>
            </div>
        </article>
    `;
};

// Fetch and Render Questions (টেবিলের নাম question করা হয়েছে)
const loadLatestQuestions = async () => {
    const questionsList = document.getElementById('questions-list');
    if (!questionsList) return;
    
    try {
        const { data: questions } = await supabase
            .from('question') // 'questions' থেকে 'question' করা হয়েছে
            .select('*')
            .order('created_at', { ascending: false })
            .range(0, PAGE_SIZE - 1);
        
        if (questions && questions.length > 0) {
            questionsList.innerHTML = questions.map(q => createQuestionCard(q)).join('');
            
            const countEl = document.getElementById('question-count');
            if (countEl) countEl.textContent = `সর্বশেষ ${toBanglaNumber(questions.length)} টি প্রশ্ন`;
        }
    } catch (error) {
        console.error('Error fetching questions:', error);
    }
};

// Initialize
export const initHomePage = () => {
    loadLatestQuestions();
};

export { loadLatestQuestions, formatTimeAgo, toBanglaNumber };
