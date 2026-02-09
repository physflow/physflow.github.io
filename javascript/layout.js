import { supabase } from './supabase-config.js';

// লেআউট ইনজেক্ট করার ফাংশন
export function injectLayout() {
    const layoutHTML = `
    <header class="border-t-4 border-[#f48225] bg-white dark:bg-[#393939] shadow-sm sticky top-0 z-50 border-b dark:border-gray-700">
        <div class="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between">
            <div class="flex items-center space-x-4">
                <a href="index.html" class="text-lg font-bold tracking-tighter">Phys<span class="font-black">flow</span></a>
            </div>
            <div class="flex items-center space-x-3">
                <button onclick="window.toggleTheme()" class="p-2">🌓</button>
                <div id="auth-section">
                    <button id="login-btn" class="bg-[#e1ecf4] text-[#39739d] px-3 py-1.5 rounded text-[12px] border border-[#7aa7c7]">Log in</button>
                </div>
            </div>
        </div>
    </header>
    <div class="max-w-7xl mx-auto flex">
        <aside class="w-48 hidden md:block border-r dark:border-gray-700 min-h-screen pt-4 text-[13px]">
            <nav class="space-y-1">
                <a href="index.html" class="block py-2 px-4 border-r-4 border-[#f48225] bg-gray-50 dark:bg-gray-800 font-bold">Home</a>
                <div class="px-4 py-2 uppercase text-[11px] font-semibold text-gray-500">Public</div>
                <a href="#" class="block py-2 px-8 text-gray-600 dark:text-gray-400">Questions</a>
            </nav>
        </aside>
        <main id="main-content" class="flex-1 p-6 border-l dark:border-gray-700"></main>
    </div>`;

    const bodyContent = document.body.innerHTML;
    document.body.innerHTML = layoutHTML;
    document.getElementById('main-content').innerHTML = bodyContent;
}

// Theme Logic
export function initTheme() {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

window.toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
};

// Auth UI Logic
export function setupAuth() {
    const loginBtn = document.getElementById('login-btn');
    if(loginBtn) {
        loginBtn.onclick = async () => {
            await supabase.auth.signInWithOAuth({ provider: 'google' });
        };
    }
}
