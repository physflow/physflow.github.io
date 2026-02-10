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
    if (hours < 24) return `${toBanglaNumber(hours)} ঘন্টা আগে`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${toBanglaNumber(days)} দিন আগে`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${toBanglaNumber(months)} মাস আগে`;
    const years = Math.floor(months / 12);
    return `${toBanglaNumber(years)} বছর আগে`;
};

// Truncate text
const truncateText = (text, maxLength = 150) => {
    if (!text) return '';
    const stripped = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (stripped.length <= maxLength) return stripped;
    return stripped.substring(0, maxLength) + '...';
};

// Create question card HTML
const createQuestionCard = (question) => {
    const tags = question.tags ? (Array.isArray(question.tags) ? question.tags : JSON.parse(question.tags)) : [];
    const excerpt = truncateText(question.body, 150);
    const timeAgo = formatTimeAgo(question.created_at);
    
    return `
        <article class="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 transition-all duration-200">
            <div class="flex items-center justify-between mb-3 border-b border-gray-100 dark:border-gray-700 pb-2">
                <div class="flex gap-4">
                    <div class="flex items-center gap-1">
                        <span class="text-sm font-bold text-gray-700 dark:text-gray-300">${toBanglaNumber(question.votes || 0)}</span>
                        <span class="text-xs text-gray-500">ভোট</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <span class="text-sm font-bold text-gray-700 dark:text-gray-300">${toBanglaNumber(question.answers_count || 0)}</span>
                        <span class="text-xs text-gray-500">উত্তর</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <span class="text-sm font-bold text-gray-700 dark:text-gray-300">${toBanglaNumber(question.views || 0)}</span>
                        <span class="text-xs text-gray-500">ভিউ</span>
                    </div>
                </div>
                
                <time datetime="${question.created_at}" class="text-[10px] text-gray-400 whitespace-nowrap">
                    ${timeAgo}
                </time>
            </div>
            
            <div class="min-w-0">
                <h3 class="text-lg font-normal mb-2">
                    <a href="questions/${question.slug}.html" style="color: #0a95ff;" class="hover:underline">
                        ${question.title}
                    </a>
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">${excerpt}</p>
                
                <div class="flex flex-wrap gap-1">
                    ${question.category ? `
                        <span class="px-2 py-1 text-xs text-white rounded" style="background-color: #0a95ff;">
                            ${question.category}
                        </span>
                    ` : ''}

                    ${tags.map(tag => `
                        <span class="px-2 py-1 text-xs bg-gray-500 dark:bg-gray-600 text-white rounded">
                            ${tag}
                        </span>
                    `).join('')}
                </div>
            </div>
        </article>
    `;
};

// Fetch and Render Questions
const loadLatestQuestions = async () => {
    const questionsList = document.getElementById('questions-list');
    if (!questionsList) return;
    
    try {
        const { data: questions } = await supabase
            .from('questions')
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
