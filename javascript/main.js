import { supabase } from './supabase-config.js';

const questionsContainer = document.getElementById('questions-container');

// ১. সময় ফরম্যাট করার ফাংশন
function timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = Math.floor(seconds / 31536000);
    if (interval > 1) return interval + " বছর আগে";
    interval = Math.floor(seconds / 2592000);
    if (interval > 1) return interval + " মাস আগে";
    interval = Math.floor(seconds / 86400);
    if (interval > 1) return interval + " দিন আগে";
    interval = Math.floor(seconds / 3600);
    if (interval > 1) return interval + " ঘণ্টা আগে";
    interval = Math.floor(seconds / 60);
    if (interval > 1) return interval + " মিনিট আগে";
    return "এইমাত্র";
}

// ২. প্রশ্নগুলো লোড করার ফাংশন
async function fetchQuestions() {
    try {
        const { data, error } = await supabase
            .from('questions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        renderQuestions(data);
    } catch (err) {
        console.error('Error fetching questions:', err);
        questionsContainer.innerHTML = `<p class="text-red-500 py-10 text-center">ডেটা লোড করতে সমস্যা হয়েছে।</p>`;
    }
}

// ৩. Stack Overflow স্টাইলে রেন্ডার করা
function renderQuestions(questions) {
    if (!questions || questions.length === 0) {
        questionsContainer.innerHTML = `<p class="py-20 text-center text-gray-500">এখনো কোনো প্রশ্ন নেই। প্রথম প্রশ্নটি আপনিই করুন!</p>`;
        return;
    }

    questionsContainer.innerHTML = questions.map(q => `
        <div class="flex p-4 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
            <div class="flex flex-col gap-2 mr-4 text-xs shrink-0 items-end w-16 md:w-24">
                <div class="text-gray-600 dark:text-gray-400 font-medium">${q.votes || 0} ভোট</div>
                <div class="${q.answers_count > 0 ? 'border border-green-600 text-green-600 rounded px-1' : 'text-gray-600 dark:text-gray-400'}">
                    ${q.answers_count || 0} উত্তর
                </div>
                <div class="text-gray-500 dark:text-gray-500">${q.views || 0} ভিউ</div>
            </div>

            <div class="flex-1">
                <h3 class="text-lg text-brand-600 hover:text-blue-500 font-medium mb-1">
                    <a href="question.html?slug=${encodeURIComponent(q.slug)}">${q.title}</a>
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                    ${q.body.substring(0, 150)}...
                </p>
                
                <div class="flex flex-wrap justify-between items-center gap-2">
                    <div class="flex gap-2">
                        ${(q.tags || []).map(tag => `
                            <a href="tags.html?tag=${tag}" class="bg-blue-50 dark:bg-blue-900/30 text-brand-600 px-2 py-0.5 rounded text-xs hover:bg-blue-100 transition">
                                ${tag}
                            </a>
                        `).join('')}
                    </div>

                    <div class="text-xs text-gray-500 flex items-center gap-2">
                        <span class="font-medium text-gray-700 dark:text-gray-300">PhysUser</span>
                        <span>জিজ্ঞেস করেছেন ${timeAgo(q.created_at)}</span>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// ৪. পেজ লোড হলে রান হবে
document.addEventListener('DOMContentLoaded', fetchQuestions);
