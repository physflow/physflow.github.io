/* ==========================================
   js/auth.js - Supabase Google Auth
   ========================================== */

import { supabase } from './supabase-config.js';

// ১. গুগল দিয়ে লগইন করার ফাংশন
async function loginWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin // লগইন শেষে এই পেজে ফিরে আসবে
        }
    });

    if (error) {
        console.error("Login Error:", error.message);
    }
}

// ২. লগআউট ফাংশন
async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Logout Error:", error.message);
    else window.location.reload();
}

// ৩. অথেন্টিকেশন স্টেট চেক (UI আপডেট করার জন্য)
async function checkSupabaseAuth() {
    const { data: { user } } = await supabase.auth.getUser();

    const loginBtn = document.getElementById('login-btn');
    const userMenu = document.getElementById('user-menu');
    const profileBtn = document.getElementById('profile-btn');
    const headerAskBtn = document.getElementById('header-ask-btn');

    if (user) {
        // ইউজার লগইন থাকলে
        if (loginBtn) loginBtn.classList.add('hidden');
        if (userMenu) userMenu.classList.remove('hidden');
        if (headerAskBtn) headerAskBtn.classList.remove('hidden');
        
        if (profileBtn) {
            profileBtn.src = user.user_metadata.avatar_url || 'default-avatar.png';
        }
    } else {
        // ইউজার লগইন না থাকলে
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (userMenu) userMenu.classList.add('hidden');
        if (headerAskBtn) headerAskBtn.classList.add('hidden');
    }
}

// ৪. ইভেন্ট লিসেনার সেটআপ
document.addEventListener('click', (e) => {
    if (e.target.id === 'login-btn') {
        loginWithGoogle();
    }
    
    if (e.target.id === 'logout-btn') {
        logout();
    }

    // প্রোফাইল ড্রপডাউন টগল
    if (e.target.id === 'profile-btn') {
        const dropdown = document.getElementById('profile-dropdown');
        if (dropdown) dropdown.classList.toggle('hidden');
    }
});

// গ্লোবাল এক্সেস দেওয়ার জন্য (app.js এর জন্য)
window.checkSupabaseAuth = checkSupabaseAuth;
