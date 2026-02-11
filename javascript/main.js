import { supabase } from './supabase-config.js';

// State management
const PAGE_SIZE = 20;

// ১. বাংলা সংখ্যা কনভার্টার
const toBanglaNumber = (num) => {
    const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(num).split('').map(digit => banglaDigits[parseInt(digit)] || digit).join('');
};

// ২. সময় ফরম্যাট
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
    return `${toBanglaNumber(days)} দিন আগে`;
};

// ৩. টেক্সট ছোট করা
const truncateText = (text, maxLength = 130) => {
    if (!text) return '';
    const stripped = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    return stripped.length <= maxLength ? stripped : stripped.substring(0, maxLength) + '...';
};

// ৪. কোশ্চেন কার্ড তৈরি (সংশোধিত tag লজিক)
const createQuestionCard = (questionData) => {
    // এখানে questionData.tag সরাসরি ব্যবহার করা হয়েছে
    let tagList = [];
    if (Array.isArray(questionData.tag)) {
        tagList = questionData.tag;
    } else if (typeof questionData.tag === 'string') {
        try {
            tagList = JSON.parse(questionData.tag);
        } catch (e) {
            tagList = [];
        }
    }

    const excerpt = truncateText(questionData.body, 130); 
    const timeAgo = formatTimeAgo(questionData.created_at);
    
    return `
        <article class="p-4 border border-gray-200 dark:border-gray-700 bg-transparent mb-4">
            <div class="flex items-center justify-between mb-3">
                <div class="flex gap-4">
                    <div class="flex items-center gap-1">
                        <span class="text-base font-bold text-red-600">${toBanglaNumber(questionData.votes || 0)}</span>
                        <span class="text-sm text-gray-500">ভোট</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <span class="text-base font-bold text-green-600">${toBanglaNumber(questionData.answers_count || 0)}</span>
                        <span class="text-sm text-gray-500">উত্তর</span>
                    </div>
                </div>
                <time class="text-xs text-gray-400">${timeAgo}</time>
            </div>

            <h3 class="text-xl font-normal mb-2">
                <a href="question.html?slug=${questionData.slug}" style="color: #0a95ff;" class="hover:underline">
                    ${questionData.title}
                </a>
            </h3>
            
            <p class="text-[15px] text-gray-600 mb-4 line-clamp-2">${excerpt}</p>
            
            <div class="flex flex-wrap gap-2">
                ${tagList.map(t => `<span class="px-2 py-1 text-xs bg-gray-100 rounded">#${t}</span>`).join('')}
            </div>
        </article>
    `;
};

// ৫. ডাটা লোড ফাংশন
const loadLatestQuestion = async () => {
    const questionListContainer = document.getElementById('question-list');
    if (!questionListContainer) {
        console.error('Error: "question-list" ID টি HTML এ পাওয়া যায়নি।');
        return;
    }
    
    try {
        const { data, error } = await supabase
            .from('question') // টেবিলের নাম এখন question
            .select('*')
            .order('created_at', { ascending: false })
            .range(0, PAGE_SIZE - 1);
        
        if (error) throw error;

        if (data && data.length > 0) {
            questionListContainer.innerHTML = data.map(item => createQuestionCard(item)).join('');
            
            const countEl = document.getElementById('question-count');
            if (countEl) countEl.textContent = `সর্বশেষ ${toBanglaNumber(data.length)} টি প্রশ্ন`;
        } else {
            questionListContainer.innerHTML = '<p class="p-4 text-gray-500">কোনো প্রশ্ন পাওয়া যায়নি।</p>';
        }
    } catch (err) {
        console.error('Fetch Error:', err.message);
        questionListContainer.innerHTML = `<p class="p-4 text-red-500">লোড করতে সমস্যা হয়েছে।</p>`;
    }
};

// ৬. অটো-রান
document.addEventListener('DOMContentLoaded', loadLatestQuestion);

export { loadLatestQuestion };
