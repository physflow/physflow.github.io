/* ==========================================
   js/auth.js - User Authentication Logic
   ========================================== */

import { auth } from './config.js';
import { 
    onAuthStateChanged, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const provider = new GoogleAuthProvider();

// ১. অথেন্টিকেশন স্টেট অবজার্ভার (তোমার মূল লজিক অনুযায়ী)
onAuthStateChanged(auth, user => {
    const loginBtn = document.getElementById('login-btn');
    const userMenu = document.getElementById('user-menu');
    const headerAskBtn = document.getElementById('header-ask-btn');
    const adminEmails = ["phys.arif@gmail.com", "physflow.devs@gmail.com"];

    if (user) {
        // লগইন থাকলে
        if (loginBtn) loginBtn.classList.add('hidden');
        if (userMenu) {
            userMenu.classList.remove('hidden');
            // ড্রপডাউন মেনুর ভেতর ডাটা বসানো
            const profileBtn = document.getElementById('profile-btn');
            if (profileBtn) profileBtn.src = user.photoURL;
        }
        if (headerAskBtn) headerAskBtn.classList.remove('hidden');

        // অ্যাডমিন চেক
        checkAdminStatus(user, adminEmails);

        // প্রোফাইল ড্রপডাউন টগল (যদি আগে থেকে app.js এ না থাকে)
        setupUserDropdown();

    } else {
        // লগআউট থাকলে
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (userMenu) userMenu.classList.add('hidden');
        if (headerAskBtn) headerAskBtn.classList.add('hidden');
        document.getElementById('admin-badge')?.remove();
    }
});

// ২. গুগল লগইন ফাংশন
export const loginWithGoogle = () => {
    signInWithPopup(auth, provider)
        .then((result) => console.log("Logged in:", result.user))
        .catch((error) => console.error("Login Error:", error));
};

// ৩. লগআউট ফাংশন
export const logoutUser = () => {
    signOut(auth).then(() => {
        window.location.reload(); // ক্লিন স্টেটের জন্য রিলোড
    });
};

// ৪. অ্যাডমিন ব্যাজ দেখানো
function checkAdminStatus(user, adminEmails) {
    const logoContainer = document.querySelector('header .container > div:first-child');
    if (adminEmails.includes(user.email) && !document.getElementById('admin-badge')) {
        const adminBadge = document.createElement('a');
        adminBadge.id = 'admin-badge';
        adminBadge.href = 'admin.html';
        adminBadge.className = 'ml-2 px-2 py-0.5 bg-[#F48024] !text-white text-[10px] font-bold rounded uppercase';
        adminBadge.innerText = 'ADMIN';
        logoContainer?.querySelector('a')?.insertAdjacentElement('afterend', adminBadge);
    }
}

// ৫. প্রোফাইল ড্রপডাউন সেটআপ
function setupUserDropdown() {
    const profileBtn = document.getElementById('profile-btn');
    const dropdown = document.getElementById('profile-dropdown');
    const logoutBtn = document.getElementById('logout-btn');

    if (profileBtn && dropdown) {
        profileBtn.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        };
        // বাইরে ক্লিক করলে বন্ধ হবে
        window.addEventListener('click', () => dropdown.classList.add('hidden'));
    }

    if (logoutBtn) {
        logoutBtn.onclick = logoutUser;
    }
}

// গ্লোবাল এক্সেসের জন্য লগইন বাটন সেটআপ
document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'login-btn') {
        loginWithGoogle();
    }
});
