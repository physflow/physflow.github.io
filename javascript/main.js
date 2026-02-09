import { supabase } from './supabase-config.js';

// সময়কে 'কতক্ষণ আগে' ফরমেটে দেখানোর ফাংশন (বাংলায়) 
function timeAgo(dateString) {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return interval.toLocaleString('bn-BD') + " বছর আগে";
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return interval.toLocaleString('bn-BD') + " মাস আগে";
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return interval.toLocaleString('bn-BD') + " দিন আগে";
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return interval.toLocaleString('bn-BD') + " ঘণ্টা আগে";
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return interval.toLocaleString('bn-BD') + " মিনিট আগে";
    return "এইমাত্র";
}

// প্রশ্নগুলো লোড করার মূল ফাংশন
async function fetchQuestions() {
    const questionsList = document.getElementById('questions-list');
    const questionCountDisplay = document.getElementById('question-count');

    try {
        // Supabase থেকে ডাটা ফেচ করা (approved প্রশ্নগুলো আগে আসবে)
        const { data: questions, error } = await supabase
            .from('questions')
            .select('*')
            .eq('status', 'approved')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // প্রশ্ন সংখ্যা আপডেট
        if (questionCountDisplay) {
            questionCountDisplay.innerText = questions.length.toLocaleString('bn-BD') + " প্রশ্ন";
        }

        // যদি কোনো প্রশ্ন না থাকে
        if (questions.length === 0) {
            questionsList.innerHTML = '<p class="py-10 text-center text-gray-500">কোনো প্রশ্ন পাওয়া যায়নি।</p>';
            return;
        }

        // HTML রেন্ডার করা
        let html = '';
        questions.forEach(q => {
            html += `
            <div class="flex p-4 gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition border-b dark:border-gray-800">
                <div class="hidden md:flex flex-col items-end gap-2 text-xs text-gray-500 dark:text-gray-400 min-w-[80px]">
                    <div class="font-medium">${(q.votes || 0).toLocaleString('bn-BD')} ভোট</div>
                    <div class="border border-green-600 text-green-600 px-1 rounded">${(q.answer_count || 0).toLocaleString('bn-BD')} উত্তর</div>
                    <div class="text-orange-600">${(q.views || 0).toLocaleString('bn-BD')} ভিউ</div>
                </div>

                <div class="flex-1">
                    <h3 class="text-lg text-[#0a95ff] dark:text-[#60a5fa] hover:text-[#0074cc] mb-1 font-normal">
                        <a href="question.html?id=${q.id}">${q.title}</a>
                    </h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                        ${q.description?.replace(/<[^>]*>/g, '') || ''}
                    </p>
                    
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <div class="flex gap-1">
                            ${(q.tags || []).map(tag => `
                                <a href="tags.html?id=${tag}" class="bg-[#e1f0ff] dark:bg-blue-900/30 text-[#0078d4] dark:text-blue-400 px-2 py-0.5 rounded text-[11px] hover:bg-blue-100 transition">
                                    ${tag}
                                </a>
                            `).join('')}
                        </div>

                        <div class="flex items-center gap-2 text-[12px] text-gray-500">
                            <img src="${q.user_avatar || 'assets/default-avatar.png'}" class="w-4 h-4 rounded-sm">
                            <span class="text-blue-500 hover:underline cursor-pointer">${q.user_name}</span>
                            <span>${timeAgo(q.created_at)}</span>
                        </div>
                    </div>
                </div>
            </div>`;
        });

        questionsList.innerHTML = html;

    } catch (err) {
        console.error('Error fetching questions:', err.message);
        questionsList.innerHTML = '<p class="py-10 text-center text-red-500">ডাটা লোড করতে সমস্যা হয়েছে।</p>';
    }
}

// পেজ লোড হলে ফাংশনটি রান করবে
document.addEventListener('DOMContentLoaded', fetchQuestions);
