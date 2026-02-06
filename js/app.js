/* ==========================================
   js/app.js - Global UI & Component Loader
   ========================================== */

// ১. কম্পোনেন্ট লোডার ফাংশন
async function loadComponent(elementId, filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`${filePath} পাওয়া যায়নি`);
        const html = await response.text();
        const element = document.getElementById(elementId);
        
        if (element) {
            element.innerHTML = html;
            return true; // লোড সফল হলে true রিটার্ন করবে
        }
    } catch (error) {
        console.error("Component error:", error);
        return false;
    }
}

// ২. থিম কন্ট্রোল
function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const html = document.documentElement;

    const applyTheme = (theme) => {
        if (theme === 'dark') {
            html.classList.add('dark');
            if(themeIcon) {
                themeIcon.classList.replace('fa-moon', 'fa-sun');
            }
        } else {
            html.classList.remove('dark');
            if(themeIcon) {
                themeIcon.classList.replace('fa-sun', 'fa-moon');
            }
        }
    };

    applyTheme(localStorage.getItem('theme') || 'light');

    if (themeToggle) {
        themeToggle.onclick = (e) => {
            e.preventDefault();
            const newTheme = html.classList.contains('dark') ? 'light' : 'dark';
            localStorage.setItem('theme', newTheme);
            applyTheme(newTheme);
        };
    }
}

// ৩. মোবাইল মেনু ও সাইডবার কন্ট্রোল
function setupSidebar() {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('#hamburger-btn');
        const sidebar = document.getElementById('main-sidebar');
        const overlay = document.getElementById('sidebar-overlay');

        if (btn && sidebar) {
            e.preventDefault();
            sidebar.classList.toggle('open');
            if (overlay) overlay.classList.toggle('hidden');
        }

        if (overlay && e.target === overlay) {
            sidebar?.classList.remove('open');
            overlay.classList.add('hidden');
        }
    });
}

// ৪. পেজ লোড হলে কার্যক্রম শুরু (এটিকে async করা হয়েছে)
document.addEventListener("DOMContentLoaded", async () => {
    // সাইডবার সেটআপ
    setupSidebar(); 
    
    // সব কম্পোনেন্ট লোড হওয়ার জন্য অপেক্ষা করবে (await ব্যবহার করা হয়েছে)
    await Promise.all([
        loadComponent('header-placeholder', 'components/header.html'),
        loadComponent('sidebar-left-placeholder', 'components/sidebar-left.html'),
        loadComponent('footer-placeholder', 'components/footer.html')
    ]);

    // --- এই অংশের নিচে যা থাকবে তা হেডার লোড হওয়ার পর রান হবে ---
    
    // থিম টগল সেটআপ
    setupThemeToggle();

    // গুরুত্বপূর্ণ: লগইন চেক করার ফাংশন এখানে কল করো
    // যদি তোমার auth.js এ checkAuthState নামে কোনো ফাংশন থাকে:
    if (typeof checkAuthState === 'function') {
        checkAuthState();
    } else if (window.checkAuthState) {
        window.checkAuthState();
    }

    console.log("সব কম্পোনেন্ট লোড শেষ এবং অথেন্টিকেশন চেক সম্পন্ন।");
});
