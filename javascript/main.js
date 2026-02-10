// ডামি ডেটা (প্রয়োজনে API থেকে fetch করতে পারো)
const sampleQuestions = [
    {
        id: 1,
        title: "মহাকর্ষীয় তরঙ্গ কেন সরাসরি শনাক্ত করা কঠিন?",
        author: "আরিফ হোসেন",
        tags: ["মহাকর্ষ", "গবেষণা"],
        votes: 15,
        answers: 3,
        views: 120,
        time: "১০ মিনিট আগে"
    },
    {
        id: 2,
        title: "কোয়ান্টাম এন্ট্যাঙ্গেলমেন্ট কি আলোর গতির চেয়েও দ্রুত কাজ করে?",
        author: "সারা আহমেদ",
        tags: ["কোয়ান্টাম", "আলো"],
        votes: 42,
        answers: 8,
        views: 450,
        time: "২ ঘণ্টা আগে"
    }
];

function loadQuestions() {
    const container = document.getElementById('questions-container');
    const loader = document.getElementById('loader');

    // ২ সেকেন্ড পর ডেটা দেখাবে (সিমুলেশন)
    setTimeout(() => {
        loader.classList.add('hidden');
        
        sampleQuestions.forEach(post => {
            const questionHTML = `
                <div class="bg-white dark:bg-[#2d2d2d] border border-gray-200 dark:border-gray-700 p-4 rounded-lg shadow-sm hover:border-brand-600 transition flex gap-4">
                    <div class="hidden sm:flex flex-col items-end text-sm text-gray-500 dark:text-gray-400 w-16 shrink-0">
                        <div class="font-bold text-gray-800 dark:text-gray-200">${post.votes} ভোট</div>
                        <div>${post.answers} উত্তর</div>
                        <div class="text-xs">${post.views} ভিউ</div>
                    </div>
                    
                    <div class="flex-1">
                        <h3 class="text-lg font-semibold text-brand-600 hover:text-blue-500 mb-1">
                            <a href="question-detail.html?id=${post.id}">${post.title}</a>
                        </h3>
                        <div class="flex flex-wrap gap-2 mb-3">
                            ${post.tags.map(tag => `<span class="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded text-xs">#${tag}</span>`).join('')}
                        </div>
                        <div class="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                            <div class="sm:hidden flex gap-3 font-medium">
                                <span>${post.votes} ভোট</span> • <span>${post.answers} উত্তর</span>
                            </div>
                            <div class="ml-auto">
                                <span class="text-brand-600 font-medium">${post.author}</span> 
                                <span class="ml-1">${post.time}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += questionHTML;
        });
    }, 1000);
}

// পেজ লোড হলে ফাংশনটি কল হবে
document.addEventListener('DOMContentLoaded', loadQuestions);
