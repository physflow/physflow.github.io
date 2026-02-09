import { supabase } from './supabase-config.js';

/**
 * থিম ইনিশিয়ালাইজ করার ফাংশন (page load এর সাথে সাথে call করতে হবে)
 */
export function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeIcon = document.getElementById('theme-icon');
    const isDark = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
        document.documentElement.classList.add('dark');
        if (themeIcon) themeIcon.className = 'fas fa-sun';
    } else {
        document.documentElement.classList.remove('dark');
        if (themeIcon) themeIcon.className = 'fas fa-moon';
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

    // Sidebar link click করলে mobile এ বন্ধ হবে
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
 * Theme Toggle Setup
 */
function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');

    themeToggle?.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        
        if (themeIcon) {
            themeIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
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
 * Toast Notification দেখানোর function
 */
function showToast(message, type = 'error') {
    // যদি আগে থেকে toast থাকে তাহলে remove করো
    const existingToast = document.getElementById('toast-notification');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = `fixed top-20 right-4 z-[200] px-6 py-3 rounded-lg shadow-lg text-white transform transition-all duration-300 ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
    }`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // 3 সেকেন্ড পর auto remove
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-x-full');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * User Menu Dropdown Toggle
 */
function setupUserDropdown() {
    const userMenu = document.getElementById('user-menu');
    const userAvatar = document.getElementById('user-avatar');
    
    if (!userMenu || !userAvatar) return;

    // Dropdown HTML তৈরি করো
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

    // userMenu কে relative করো এবং dropdown যোগ করো
    userMenu.style.position = 'relative';
    userMenu.appendChild(dropdown);

    // Avatar click করলে dropdown toggle
    userAvatar.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
    });

    // বাইরে click করলে dropdown বন্ধ
    document.addEventListener('click', () => {
        dropdown.classList.add('hidden');
    });

    // Dropdown এর ভিতরে click করলে বন্ধ হবে না
    dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Dropdown এর logout button
    const dropdownLogoutBtn = dropdown.querySelector('#dropdown-logout-btn');
    dropdownLogoutBtn?.addEventListener('click', handleLogout);
}

/**
 * Logout Handler
 */
async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
        showToast('লগআউট করতে সমস্যা হয়েছে', 'error');
        console.error('Logout Error:', error.message);
    } else {
        showToast('সফলভাবে লগআউট হয়েছে', 'success');
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }
}

/**
 * Supabase Authentication Setup
 */
export function setupAuth() {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userMenu = document.getElementById('user-menu');
    const userAvatar = document.getElementById('user-avatar');

    // Login Button Click
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { 
                    redirectTo: window.location.href 
                }
            });
            
            if (error) {
                showToast('লগইন করতে সমস্যা হয়েছে', 'error');
                console.error('Login Error:', error.message);
            }
        });
    }

    // Header এর Logout Button (যদি থাকে)
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Auth State Change Listener
    supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
            // User logged in
            if (loginBtn) loginBtn.classList.add('hidden');
            if (userMenu) userMenu.classList.remove('hidden');
            if (userAvatar) {
                userAvatar.src = session.user.user_metadata.avatar_url || 'https://via.placeholder.com/32';
                userAvatar.alt = session.user.user_metadata.full_name || 'User';
            }

            // User dropdown setup করো
            setupUserDropdown();

            // Login success toast (শুধু login event এ)
            if (event === 'SIGNED_IN') {
                showToast('স্বাগতম! সফলভাবে লগইন হয়েছে', 'success');
            }
        } else {
            // User logged out
            if (loginBtn) loginBtn.classList.remove('hidden');
            if (userMenu) userMenu.classList.add('hidden');
        }
    });

    // Page load এ current session check করো
    checkCurrentSession();
}

/**
 * Current Session Check (page load এ)
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
    } else {
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (userMenu) userMenu.classList.add('hidden');
    }
}