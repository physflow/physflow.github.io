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
    const excerpt = truncateText(question.body, 120); 
    const timeAgo = formatTimeAgo(question.created_at);
    const questionLink = `/question.html?id=${question.id}`;
    
    // profile:author_id থেকে আসা ডাটা সেট করা
    // তোমার স্ক্রিনশট অনুযায়ী full_name এবং avatar_url ব্যবহার করা হয়েছে
    const authorName = question.profile?.full_name || question.profile?.username || 'অজানা ইউজার';
    const authorAvatar = question.profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=random&color=fff`;
    
    return `
        <article class="mx-2 my-1 p-3 border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-transparent shadow-sm">
            <div class="flex items-center gap-2 mb-2">
                <img src="${authorAvatar}" 
                     class="w-8 h-8 rounded-full border border-gray-100 object-cover shadow-sm" 
                     alt="${authorName}"
                     onerror="this.src='https://ui-avatars.com/api/?name=User'">
                
                <div class="flex items-center gap-2">
                    <span class="text-[14px] font-bold text-gray-800 dark:text-gray-200">${authorName}</span>
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
                <p class="text-[13px] text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
                    ${excerpt}
                </p>
            </div>
        </article>
    `;
};

const loadLatestQuestion = async () => {
    const questionList = document.getElementById('question-list');
    if (!questionList) return;
    
    try {
        // রিলেশনশিপ অনুযায়ী সঠিক সিলেক্ট কুয়েরি
        const { data: questionData, error } = await supabase
            .from('question')
            .select(`
                *,
                profile:author_id (
                    full_name,
                    username,
                    avatar_url
                )
            `)
            .order('created_at', { ascending: false })
            .limit(PAGE_SIZE);
        
        if (error) throw error;

        if (questionData && questionData.length > 0) {
            questionList.innerHTML = questionData.map(q => createQuestionCard(q)).join('');
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

// layout.js থেকে ডাকা হবে অথবা সরাসরি
document.addEventListener('DOMContentLoaded', initHomePage);
