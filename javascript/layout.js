// javascript/layout.js
import { supabase } from './supabase-config.js';

export function injectLayout() {
    const originalContent = document.body.innerHTML;
    
    const layoutHTML = `
    <header class="border-t-4 border-[#f48225] bg-white dark:bg-[#393939] shadow-sm sticky top-0 z-50 border-b dark:border-gray-700">
        <div class="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between">
            <div class="flex items-center space-x-4">
                <a href="index.html" class="text-lg font-bold tracking-tighter">Phys<span class="font-black">flow</span></a>
            </div>
            <div class="flex items-center space-x-3">
                <button id="theme-toggle-btn" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">🌓</button>
                <div id="auth-section">
                    <button id="login-btn" class="bg-[#e1ecf4] dark:bg-[#3d4952] text-[#39739d] dark:text-[#9cc3db] px-3 py-1.5 rounded text-[12px] border border-[#7aa7c7] dark:border-gray-600 hover:bg-[#b3d3ea] transition">Log in</button>
                    <div id="user-profile" class="hidden flex items-center space-x-2">
                        <img id="user-avatar" class="w-6 h-6 rounded-sm" src="" alt="">
                        <span id="user-name" class="text-[12px] font-medium"></span>
                        <button id="logout-btn" class="text-[12px] text-red-500 ml-2 hover:underline">Logout</button>
                    </div>
                </div>
            </div>
        </div>
    </header>

    <div class="max-w-7xl mx-auto flex flex-col md:flex-row">
        <aside class="w-full md:w-48 hidden md:block border-r dark:border-gray-700 min-h-[calc(100vh-48px)] pt-4 text-[13px] sticky top-12 h-fit">
            <nav class="space-y-1">
                <a href="index.html" class="block py-2 px-4 border-r-4 border-[#f48225] bg-gray-50 dark:bg-gray-800 font-bold">Home</a>
                <div class="px-4 py-2 uppercase text-[11px] font-semibold text-gray-500">Public</div>
                <a href="#" class="block py-2 px-8 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition">Questions</a>
                <a href="#" class="block py-2 px-8 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition">Tags</a>
            </nav>
        </aside>

        <main id="main-content" class="flex-1 p-4 md:p-6 border-l-0 md:border-l dark:border-gray-700 min-h-[calc(100vh-48px)]">
            ${originalContent}
        </main>
    </div>

    <footer class="bg-[#232629] text-gray-400 py-8 text-[11px] mt-10">
        <div class="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div><h5 class="font-bold text-gray-200 uppercase mb-3 text-[12px]">Physflow</h5></div>
            <div><p>Site design © 2026 Physflow Inc.</p></div>
        </div>
    </footer>`;

    document.body.innerHTML = layoutHTML;
    
    // কন্টেন্ট ইনজেক্ট করার পর ইভেন্ট লিসেনার সেট করা
    setupEventListeners();
}

function setupEventListeners() {
    // Theme Toggle
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
        themeBtn.onclick = () => {
            document.documentElement.classList.toggle('dark');
            localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        };
    }
}

export function initTheme() {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

export function setupAuth() {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    if (loginBtn) loginBtn.onclick = () => supabase.auth.signInWithOAuth({ provider: 'google' });
    if (logoutBtn) logoutBtn.onclick = () => supabase.auth.signOut();

    supabase.auth.onAuthStateChange((event, session) => {
        const userProfile = document.getElementById('user-profile');
        const loginBtn = document.getElementById('login-btn');

        if (session) {
            loginBtn?.classList.add('hidden');
            userProfile?.classList.remove('hidden');
            if(document.getElementById('user-name')) document.getElementById('user-name').innerText = session.user.user_metadata.full_name;
            if(document.getElementById('user-avatar')) document.getElementById('user-avatar').src = session.user.user_metadata.avatar_url;
        } else {
            loginBtn?.classList.remove('hidden');
            userProfile?.classList.add('hidden');
        }
    });
}
