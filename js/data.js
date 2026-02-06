/* ==========================================
   js/data.js - Question & Firestore Logic
   ========================================== */

import { db } from './config.js';
import { 
    collection, 
    query, 
    orderBy, 
    onSnapshot, 
    where, 
    limit 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ১. সময় হিসাব করার ফাংশন (তোমার মূল কোড থেকে)
export function timeAgo(timestamp) {
    if (!timestamp) return 'এইমাত্র';
    const seconds = Math.floor((new Date() - timestamp.toDate()) / 1000);
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

// ২. প্রশ্ন লোড করার মেইন ফাংশন
let unsubscribeQuestions = null;
export function loadQuestions() {
    const questionContainer = document.getElementById('question-container');
    if (!questionContainer) return;

    if (unsubscribeQuestions) unsubscribeQuestions();

    const questionsRef = collection(db, "questions");
    const q = query(questionsRef, where("status", "==", "approved"), orderBy("createdAt", "desc"), limit(12));

    unsubscribeQuestions = onSnapshot(q, (snapshot) => {
        let html = '';
        if (snapshot.empty) {
            questionContainer.innerHTML = '<p class="p-10 text-center text-gray-400 text-xs">কোনো পোস্ট পাওয়া যায়নি।</p>';
            return;
        }
        snapshot.forEach(doc => {
            const data = doc.data();
            const categoryLink = `categories.html?id=${encodeURIComponent(data.category || 'general')}`;
            
            html += `
            <div class="bg-white dark:bg-[#1a1a1b] p-4 border border-gray-200 dark:border-gray-800 -mb-[1px] -mr-[1px]">
                <div class="flex justify-between mb-1.5 text-[11px] font-bold">
                    <div class="flex gap-3">
                        <span class="text-red-500">${data.votes || 0} ভোট</span>
                        <span class="text-green-500">${data.answerCount || 0} উত্তর</span>
                        <span class="text-gray-400">${data.views || 0} দেখা</span>
                    </div>
                    <span class="text-gray-400 font-normal">${timeAgo(data.createdAt)}</span>
                </div>
                <h3 class="line-clamp-2 mb-0">
                    <a href="question.html?id=${doc.id}" class="text-[#0a95ff] hover:text-[#005999] hover:underline">
                        ${data.title}
                    </a>
                </h3>
                <p class="text-xs text-gray-500 line-clamp-2 mb-3">${data.description?.replace(/<[^>]*>/g, '') || ''}</p>
                <div class="flex flex-wrap items-center gap-y-2 gap-x-1 text-[10px]">
                    <a href="${categoryLink}" class="bg-[#e1f0ff] dark:bg-blue-900/30 text-[#0078d4] dark:text-blue-400 px-2 py-0.5 rounded border border-[#0a95ff]/20 font-bold whitespace-nowrap mr-1">
                        ${data.category || 'সাধারণ'}
                    </a>
                    ${(data.tags || []).slice(0,5).map(t => 
                        `<a href="tags.html?id=${encodeURIComponent(t)}" class="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 px-2 py-0.5 rounded font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition whitespace-nowrap">#${t}</a>`
                    ).join('')}
                </div>
            </div>`;
        });
        questionContainer.innerHTML = html;
    });
}

// ৩. ফিচারড লিস্ট লোড করা (Caching লজিক সহ)
export function loadFeaturedList() {
    const popularContainer = document.getElementById('popular-questions-container');
    if (!popularContainer) return;

    const cachedHTML = localStorage.getItem('featured_questions_cache');
    if (cachedHTML) popularContainer.innerHTML = cachedHTML;

    const qFeat = query(collection(db, "questions"), where("featured", "==", true), orderBy("createdAt", "desc"), limit(16));

    onSnapshot(qFeat, (snapshot) => {
        let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">';
        if (snapshot.empty) {
            html += '<p class="text-xs text-blue-400">কোনো নির্বাচিত প্রশ্ন নেই।</p>';
        } else {
            snapshot.forEach(doc => {
                const data = doc.data();
                html += `
                <div class="flex items-start gap-3 group">
                    <span class="text-gray-400 text-lg leading-none mt-1">•</span>
                    <a href="question.html?id=${doc.id}" class="text-sm md:text-base text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 leading-snug">
                        ${data.title}
                    </a>
                </div>`;
            });
        }
        html += '</div>';
        
        if (cachedHTML !== html) {
            popularContainer.innerHTML = html;
            localStorage.setItem('featured_questions_cache', html);
        }
    });
}

// ৪. স্ট্যাটস আপডেট
export async function updateStats() {
    const totalQElem = document.getElementById('total-questions');
    const totalAElem = document.getElementById('total-answers');

    if (totalQElem) {
        onSnapshot(query(collection(db, "questions"), where("status", "==", "approved")), (snap) => {
            totalQElem.innerText = snap.size.toLocaleString('bn-BD');
        });
    }
    if (totalAElem) {
        onSnapshot(collection(db, "answers"), (snap) => {
            totalAElem.innerText = snap.size.toLocaleString('bn-BD');
        });
    }
}

// ৫. সার্চ এবং বাটন ক্লিক হ্যান্ডলার
export function setupInteraction() {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');

    const handleSearch = () => {
        const queryVal = searchInput?.value.trim();
        if (queryVal) window.location.href = `explore.html?id=${encodeURIComponent(queryVal)}`;
    };

    if (searchBtn) searchBtn.onclick = handleSearch;
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch(); });
    }

    // ফিল্টার বাটন নেভিগেশন
    const btnLatest = document.getElementById('btn-latest');
    if (btnLatest) btnLatest.onclick = () => window.location.href = 'index.html';

    const btnFeatured = document.getElementById('btn-featured');
    if (btnFeatured) btnFeatured.onclick = () => window.location.href = 'popular.html';

    const btnTrending = document.getElementById('btn-trending');
    if (btnTrending) btnTrending.onclick = () => window.location.href = 'trending.html';
}

// অটো-রান (যখন ফাইলটি ইনডেক্স পেজে লোড হবে)
updateStats();
loadQuestions();
loadFeaturedList();
setupInteraction();
