import { supabase } from './supabase-config.js';

const PAGE_SIZE = 30;

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

const getBadge = (type) => {
    const badgeStyles = {
        new: 'bg-blue-50 text-blue-600 border-blue-200',
        trending: 'bg-orange-50 text-orange-600 border-orange-200',
        top: 'bg-yellow-50 text-yellow-700 border-yellow-300'
    };

    const badgeText = {
        new: '🆕 New',
        trending: '🔥 Trending',
        top: '⭐ Top'
    };

    return `
        <span class="px-2 py-0.5 text-[10px] font-bold border rounded ${badgeStyles[type]}">
            ${badgeText[type]}
        </span>
    `;
};

const createQuestionCard = (question) => {
    const tag = Array.isArray(question.tag) ? question.tag : [];
    const excerpt = truncateText(question.body, 120); 
    const timeAgo = formatTimeAgo(question.created_at);
    const questionLink = `/question.html?id=${question.id}`;
    
    return `
        <article class="mx-2 my-1 p-3 border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-transparent shadow-sm">
            <div class="flex items-center justify-between mb-0.5">
                <div class="flex gap-3">
                    <div class="flex items-center gap-1">
                        <span class="text-[14px] font-medium text-red-500">${toBanglaNumber(question.votes || 0)}</span>
                        <span class="text-[11px] text-gray-500">টি ভোট</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <span class="text-[14px] font-medium text-green-500">${toBanglaNumber(question.answer_count || 0)}</span>
                        <span class="text-[11px] text-gray-500">টি উত্তর</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <span class="text-[14px] font-medium text-yellow-500">${toBanglaNumber(question.views || 0)}</span>
                        <span class="text-[11px] text-gray-500">বার দেখেছে</span>
                    </div>
                </div>
                
                <time datetime="${question.created_at}" class="text-[11px] text-gray-400">
                    ${timeAgo}
                </time>
            </div>

            <div class="min-w-0">
                <div class="flex items-center gap-2 mb-1">
                    <h3 class="text-[16px] font-normal leading-tight">
                        <a href="${questionLink}" style="color: #0056b3;" class="hover:underline">
                            ${question.title}
                        </a>
                    </h3>
                    ${question.badge ? getBadge(question.badge) : ''}
                </div>
                
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

const shuffleArray = (array) => {
    return array.sort(() => Math.random() - 0.5);
};

const loadLatestQuestion = async () => {
    const questionList = document.getElementById('question-list');
    if (!questionList) return;

    try {

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const [
            latest,
            weeklyViews,
            weeklyVotes,
            allTimeVotes,
            randomSet
        ] = await Promise.all([

            supabase.from('question')
                .select('*, answer(count)')
                .order('created_at', { ascending: false })
                .limit(8),

            supabase.from('question')
                .select('*, answer(count)')
                .gte('created_at', oneWeekAgo.toISOString())
                .order('views', { ascending: false })
                .limit(7),

            supabase.from('question')
                .select('*, answer(count)')
                .gte('created_at', oneWeekAgo.toISOString())
                .order('votes', { ascending: false })
                .limit(7),

            supabase.from('question')
                .select('*, answer(count)')
                .order('votes', { ascending: false })
                .limit(5),

            supabase.from('question')
                .select('*, answer(count)')
                .limit(15)
        ]);

        const markBadge = (list, type) =>
            (list?.data || []).map(q => ({ ...q, badge: type }));

        const combined = [
            ...markBadge(latest, 'new'),
            ...markBadge(weeklyViews, 'trending'),
            ...markBadge(weeklyVotes, 'trending'),
            ...markBadge(allTimeVotes, 'top'),
            ...(randomSet.data || []).slice(0, 5)
        ];

        const uniqueMap = new Map();
        combined.forEach(q => {
            if (!uniqueMap.has(q.id)) {
                uniqueMap.set(q.id, q);
            }
        });

        const finalQuestions = shuffleArray(Array.from(uniqueMap.values())).slice(0, PAGE_SIZE);

        questionList.innerHTML = finalQuestions.map(q => {
            const answerCount = q.answer?.[0]?.count || 0;
            return createQuestionCard({ ...q, answer_count: answerCount });
        }).join('');

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