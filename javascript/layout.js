import { supabase } from './supabase-config.js';

/**
 * থিম ইনিশিয়ালাইজ করার ফাংশন
 */
export function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeIcon = document.getElementById('theme-icon');
    const themeToggle = document.getElementById('theme-toggle'); 
    const isDark = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
        document.documentElement.classList.add('dark');
        if (themeIcon) themeIcon.className = 'fas fa-moon text-blue-400';
        if (themeToggle) themeToggle.checked = true; 
    } else {
        document.documentElement.classList.remove('dark');
        if (themeIcon) themeIcon.className = 'fas fa-sun text-yellow-500';
        if (themeToggle) themeToggle.checked = false; 
    }
}

/**
 * Layout এর সব interactivity setup করে
 */
export function setupLayout() {
    setupMobileSidebar();
    setupThemeToggle();
    setActivePage();
}

/**
 * Mobile Sidebar Toggle
 */
function setupMobileSidebar() {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mobileSidebar = document.getElementById('mobile-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    function toggleSidebar() {
        mobileSidebar.classList.toggle('-translate-x-full');
        overlay.classList.toggle('hidden');
    }

    hamburgerBtn?.addEventListener('click', toggleSidebar);
    overlay?.addEventListener('click', toggleSidebar);

    const sidebarLinks = mobileSidebar?.querySelectorAll('a');
    sidebarLinks?.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth < 768) {
                toggleSidebar();
            }
        });
    });
}

/**
 * Theme Toggle Setup (চেকবক্স বা টগল সুইচের জন্য)
 */
function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');

    themeToggle?.addEventListener('change', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        
        if (themeIcon) {
            themeIcon.className = isDark ? 'fas fa-moon text-blue-400' : 'fas fa-sun text-yellow-500';
        }
    });
}

/**
 * Active Page Highlight
 */
function setActivePage() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const links = document.querySelectorAll('aside a');
    
    links.forEach(link => {
        link.classList.remove('sidebar-active');
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('sidebar-active');
        }
    });
}

/**
 * User Menu Dropdown Toggle
 */
function setupUserDropdown() {
    const userMenu = document.getElementById('user-menu');
    const userAvatar = document.getElementById('user-avatar');
    
    if (!userMenu || !userAvatar) return;

    const dropdown = document.createElement('div');
    dropdown.id = 'user-dropdown';
    dropdown.className = 'hidden absolute top-12 right-0 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg w-48 py-2 z-[110]';
    dropdown.innerHTML = `
        <a href="profile.html" class="block px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition">
            <i class="fas fa-user mr-2 text-gray-400"></i>প্রোফাইল
        </a>
        <a href="notifications.html" class="block px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition">
            <i class="fas fa-bell mr-2 text-gray-400"></i>নোটিফিকেশন
        </a>
        <hr class="my-2 border-gray-200 dark:border-gray-700">
        <button id="dropdown-logout-btn" class="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
            <i class="fas fa-sign-out-alt mr-2"></i>লগআউট
        </button>
    `;

    userMenu.style.position = 'relative';
    userMenu.appendChild(dropdown);

    userAvatar.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
        dropdown.classList.add('hidden');
    });

    dropdown.addEventListener('click', (e) => e.stopPropagation());

    const dropdownLogoutBtn = dropdown.querySelector('#dropdown-logout-btn');
    dropdownLogoutBtn?.addEventListener('click', handleLogout);
}

/**
 * Logout Handler (মেসেজ ছাড়া)
 */
async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (!error) {
        window.location.reload();
    }
}

/**
 * Supabase Authentication Setup (মেসেজ ছাড়া)
 */
export function setupAuth() {
    const loginBtn = document.getElementById('login-btn');
    const userMenu = document.getElementById('user-menu');
    const userAvatar = document.getElementById('user-avatar');

    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.href }
            });
        });
    }

    supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
            if (loginBtn) loginBtn.classList.add('hidden');
            if (userMenu) userMenu.classList.remove('hidden');
            if (userAvatar) {
                userAvatar.src = session.user.user_metadata.avatar_url || 'https://via.placeholder.com/32';
                userAvatar.alt = session.user.user_metadata.full_name || 'User';
            }
            setupUserDropdown();
        } else {
            if (loginBtn) loginBtn.classList.remove('hidden');
            if (userMenu) userMenu.classList.add('hidden');
        }
    });

    checkCurrentSession();
}

/**
 * Current Session Check
 */
async function checkCurrentSession() {
    const { data: { session } } = await supabase.auth.getSession();
    const loginBtn = document.getElementById('login-btn');
    const userMenu = document.getElementById('user-menu');
    const userAvatar = document.getElementById('user-avatar');

    if (session) {
        if (loginBtn) loginBtn.classList.add('hidden');
        if (userMenu) userMenu.classList.remove('hidden');
        if (userAvatar) {
            userAvatar.src = session.user.user_metadata.avatar_url || 'https://via.placeholder.com/32';
            userAvatar.alt = session.user.user_metadata.full_name || 'User';
        }
        setupUserDropdown();
    }
}
