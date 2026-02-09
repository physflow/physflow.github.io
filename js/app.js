/* ==========================================
   js/app.js - Global UI & Component Loader (Supabase Ready)
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
            return true; 
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

// ৪. পেজ লোড হলে কার্যক্রম শুরু
document.addEventListener("DOMContentLoaded", async () => {
    // সাইডবার সেটআপ
    setupSidebar(); 
    
    // কম্পোনেন্ট লোড হওয়ার জন্য অপেক্ষা
    await Promise.all([
        loadComponent('header-placeholder', 'components/header.html'),
        loadComponent('sidebar-left-placeholder', 'components/sidebar-left.html'),
        loadComponent('footer-placeholder', 'components/footer.html')
    ]);

    // থিম টগল সেটআপ
    setupThemeToggle();

    // গুরুত্বপূর্ণ: Supabase Auth স্টেট চেক করার ফাংশন এখানে কল করো
    // তোমার auth.js এ যদি checkSupabaseAuth নামে ফাংশন থাকে:
    if (typeof checkSupabaseAuth === 'function') {
        checkSupabaseAuth();
    } else if (window.checkSupabaseAuth) {
        window.checkSupabaseAuth();
    }

    console.log("সব কম্পোনেন্ট লোড শেষ এবং Supabase Auth চেক সম্পন্ন।");
});
