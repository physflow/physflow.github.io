import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, orderBy, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyCyGf_NQLsckjUQH1FwbUP1DKZvzpbrYHo",
    authDomain: "phyflow-devs.firebaseapp.com",
    projectId: "phyflow-devs",
    storageBucket: "phyflow-devs.firebasestorage.app",
    messagingSenderId: "34351515593",
    appId: "1:34351515593:web:ca06f69f07ace936b7ca18"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_EMAILS = ['phys.arif@gmail.com', 'physflow.devs@gmail.com'];
let currentFilter = 'pending';
let searchQuery = '';
let unsubscribe = null;

// কম্পোনেন্ট লোডার ফাংশন
async function loadComponent(elementId, filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) return;
        const html = await response.text();
        const element = document.getElementById(elementId);
        if (element) element.innerHTML = html;
    } catch (error) {
        console.error("Error loading component:", error);
    }
}

// সাইডবার কন্ট্রোল (Global Logic)
function setupSidebarEvents() {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('#hamburger-btn');
        const sidebar = document.getElementById('main-sidebar');
        const overlay = document.getElementById('sidebar-overlay');

        if (btn && sidebar) {
            sidebar.classList.toggle('open');
            overlay?.classList.toggle('hidden');
        }

        if (overlay && e.target === overlay) {
            sidebar?.classList.remove('open');
            overlay.classList.add('hidden');
        }
    });
}

// পেজ লোড হলে কম্পোনেন্ট ও ইভেন্ট সেটআপ
document.addEventListener("DOMContentLoaded", async () => {
    // ১. কম্পোনেন্ট লোড করা
    await loadComponent('header-placeholder', 'components/header.html');
    await loadComponent('sidebar-left-placeholder', 'components/sidebar-left.html');
    
    // অ্যাডমিন পেজে ফুটার চাইলে index.html এ <div id="footer-placeholder"></div> যোগ করে এটি আনকমেন্ট করো:
    // await loadComponent('footer-placeholder', 'components/footer.html');

    // ২. সাইডবার ইভেন্ট চালু করা
    setupSidebarEvents();

    // ৩. থিম টগল সেটআপ (হেডার লোড হওয়ার পর)
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.onclick = () => {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        };
    }
});

// অ্যাডমিন অথেন্টিকেশন চেক
onAuthStateChanged(auth, async (user) => {
    const accessDenied = document.getElementById('access-denied');
    const adminContent = document.getElementById('admin-content');

    if (user && ADMIN_EMAILS.includes(user.email)) {
        adminContent?.classList.remove('hidden');
        accessDenied?.classList.add('hidden');
        
        // প্রোফাইল পিকচার আপডেট (হেডারে)
        const profileImg = document.getElementById('profile-btn') || document.getElementById('admin-profile-img');
        if (profileImg) profileImg.src = user.photoURL;

        syncStats();
        loadData('pending');
    } else {
        accessDenied?.classList.remove('hidden');
        adminContent?.classList.add('hidden');
    }
});

// --- বাকি অ্যাডমিন ফাংশনগুলো (loadData, loadUsers, ইত্যাদি) এখানে থাকবে ---
// (তোমার আগের কোড থেকে window.updateStatus সহ বাকি লজিকগুলো এখানে বসিয়ে দাও)
