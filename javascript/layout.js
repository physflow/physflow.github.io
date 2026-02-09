// Layout Components (Header, Sidebar, Footer)

function initializeLayout() {
    loadHeader();
    loadSidebar();
    loadFooter();
}

function loadHeader() {
    const headerHTML = `
        <header class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 fixed top-0 left-0 right-0 z-40">
            <div class="max-w-7xl mx-auto px-4">
                <div class="flex items-center justify-between h-14">
                    <!-- Logo -->
                    <div class="flex items-center gap-4">
                        <a href="/index.html" class="flex items-center gap-2 text-xl font-bold">
                            <span class="text-orange-500">Phys</span><span class="text-gray-900 dark:text-white">Flow</span>
                        </a>
                    </div>
                    
                    <!-- Search Bar -->
                    <div class="flex-1 max-w-2xl mx-8">
                        <div class="relative">
                            <input type="text" id="globalSearch" placeholder="Search questions..." 
                                class="w-full px-4 py-2 pl-10 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                            <svg class="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
                        </div>
                    </div>
                    
                    <!-- Auth Buttons -->
                    <div id="authButtons" class="flex items-center gap-2 hidden">
                        <button onclick="signInWithGoogle()" class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md">
                            Log in
                        </button>
                        <button onclick="signInWithGoogle()" class="px-4 py-2 text-sm bg-orange-500 text-white rounded-md hover:bg-orange-600">
                            Sign up
                        </button>
                    </div>
                    
                    <!-- User Menu -->
                    <div id="userMenu" class="flex items-center gap-3 hidden">
                        <a href="/ask.html" class="px-4 py-2 text-sm bg-orange-500 text-white rounded-md hover:bg-orange-600">
                            Ask Question
                        </a>
                        <div class="relative group">
                            <button class="flex items-center gap-2">
                                <img id="userAvatar" src="" alt="User" class="w-8 h-8 rounded-full">
                                <div class="text-left hidden md:block">
                                    <div id="userName" class="text-sm font-medium text-gray-900 dark:text-white"></div>
                                    <div id="userReputation" class="text-xs text-gray-500 dark:text-gray-400"></div>
                                </div>
                            </button>
                            <!-- Dropdown -->
                            <div class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                                <a href="/profile.html" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Profile</a>
                                <a href="/index.html" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Your Questions</a>
                                <a href="/index.html" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Your Answers</a>
                                <hr class="border-gray-200 dark:border-gray-700">
                                <button onclick="signOut()" class="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                                    Sign out
                                </button>
                            </div>
                        </div>
                        <!-- Dark Mode Toggle -->
                        <button onclick="toggleDarkMode()" class="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md">
                            <svg class="w-5 h-5 dark:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
                            </svg>
                            <svg class="w-5 h-5 hidden dark:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </header>
    `;
    
    const headerContainer = document.getElementById('header');
    if (headerContainer) {
        headerContainer.innerHTML = headerHTML;
    }
}

function loadSidebar() {
    const sidebarHTML = `
        <aside class="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 fixed left-0 top-14 bottom-0 overflow-y-auto">
            <nav class="p-4">
                <div class="mb-6">
                    <a href="/index.html" class="flex items-center gap-3 px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
                        </svg>
                        Home
                    </a>
                </div>
                
                <div class="mb-6">
                    <h3 class="px-3 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Public</h3>
                    <a href="/index.html" class="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        Questions
                    </a>
                    <a href="/tags.html" class="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
                        </svg>
                        Tags
                    </a>
                    <a href="/users.html" class="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                        </svg>
                        Users
                    </a>
                </div>
            </nav>
        </aside>
    `;
    
    const sidebarContainer = document.getElementById('sidebar');
    if (sidebarContainer) {
        sidebarContainer.innerHTML = sidebarHTML;
    }
}

function loadFooter() {
    const footerHTML = `
        <footer class="bg-gray-900 text-gray-400 py-8 mt-12">
            <div class="max-w-7xl mx-auto px-4">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div>
                        <h3 class="text-white font-bold mb-3">PhysFlow</h3>
                        <p class="text-sm">A community-driven Q&A platform for researchers and students.</p>
                    </div>
                    <div>
                        <h4 class="text-white font-semibold mb-3">Company</h4>
                        <ul class="space-y-2 text-sm">
                            <li><a href="#" class="hover:text-white">About</a></li>
                            <li><a href="#" class="hover:text-white">Contact</a></li>
                            <li><a href="#" class="hover:text-white">Legal</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 class="text-white font-semibold mb-3">Resources</h4>
                        <ul class="space-y-2 text-sm">
                            <li><a href="#" class="hover:text-white">Help Center</a></li>
                            <li><a href="#" class="hover:text-white">Guidelines</a></li>
                            <li><a href="#" class="hover:text-white">API</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 class="text-white font-semibold mb-3">Follow Us</h4>
                        <ul class="space-y-2 text-sm">
                            <li><a href="#" class="hover:text-white">Twitter</a></li>
                            <li><a href="#" class="hover:text-white">GitHub</a></li>
                            <li><a href="#" class="hover:text-white">LinkedIn</a></li>
                        </ul>
                    </div>
                </div>
                <div class="mt-8 pt-8 border-t border-gray-800 text-center text-sm">
                    <p>&copy; 2026 PhysFlow. All rights reserved.</p>
                </div>
            </div>
        </footer>
    `;
    
    const footerContainer = document.getElementById('footer');
    if (footerContainer) {
        footerContainer.innerHTML = footerHTML;
    }
}

// Dark mode toggle
function toggleDarkMode() {
    const html = document.documentElement;
    const isDark = html.classList.toggle('dark');
    localStorage.setItem('darkMode', isDark ? 'true' : 'false');
}

// Initialize dark mode from localStorage
function initializeDarkMode() {
    const darkMode = localStorage.getItem('darkMode');
    if (darkMode === 'true') {
        document.documentElement.classList.add('dark');
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeDarkMode();
    initializeLayout();
});
