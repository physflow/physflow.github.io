import { supabase } from './supabase-config.js';

/**
 * লেআউট ইনজেক্ট করার ফাংশন
 * এটি বডির বর্তমান কন্টেন্টকে 'main-content' এর ভেতর ঢুকিয়ে দেয়
 */
export function injectLayout() {
    const mainArea = document.getElementById('main-content');
    if (!mainArea) return;

    // মোবাইল মেনু টগল লজিক
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mobileSidebar = document.getElementById('mobile-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    const toggleSidebar = () => {
        mobileSidebar.classList.toggle('hidden-mobile');
        overlay.classList.toggle('hidden');
    };

    if (hamburgerBtn) hamburgerBtn.onclick = toggleSidebar;
    if (overlay) overlay.onclick = toggleSidebar;

    // থিম টগল লজিক
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');

    if (themeToggle) {
        themeToggle.onclick = () => {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            
            // আইকন পরিবর্তন
            if (themeIcon) {
                themeIcon.classList.toggle('fa-moon', !isDark);
                themeIcon.classList.toggle('fa-sun', isDark);
            }
        };
    }
}

/**
 * থিম ইনিশিয়ালাইজ করার ফাংশন
 */
export function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeIcon = document.getElementById('theme-icon');
    const isDark = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
        document.documentElement.classList.add('dark');
        if (themeIcon) themeIcon.classList.replace('fa-moon', 'fa-sun');
    } else {
        document.documentElement.classList.remove('dark');
        if (themeIcon) themeIcon.classList.replace('fa-sun', 'fa-moon');
    }
}

/**
 * Supabase Auth সেটআপ এবং UI আপডেট
 */
export function setupAuth() {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userMenu = document.getElementById('user-menu');
    const userAvatar = document.getElementById('user-avatar');

    // লগইন বাটন ক্লিক করলে গুগল লগইন হবে
    if (loginBtn) {
        loginBtn.onclick = async () => {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin }
            });
            if (error) console.error('Login Error:', error.message);
        };
    }

    // লগআউট লজিক
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            const { error } = await supabase.auth.signOut();
            if (error) console.error('Logout Error:', error.message);
        };
    }

    // অথেন্টিকেশন স্টেট পরিবর্তন ট্র্যাক করা
    supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
            // ইউজার লগইন থাকলে
            if (loginBtn) loginBtn.classList.add('hidden');
            if (userMenu) userMenu.classList.remove('hidden');
            if (userAvatar) userAvatar.src = session.user.user_metadata.avatar_url;
        } else {
            // ইউজার লগআউট থাকলে
            if (loginBtn) loginBtn.classList.remove('hidden');
            if (userMenu) userMenu.classList.add('hidden');
        }
    });
}
