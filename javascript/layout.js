// javascript/layout.js


export function injectLayout() {
    const layoutHTML = `
    <header class="border-t-4 border-[#f48225] bg-white dark:bg-[#393939] shadow-sm sticky top-0 z-50 border-b dark:border-gray-700">
        <div class="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between">
            <div class="flex items-center space-x-4">
                <a href="index.html" class="text-lg font-bold tracking-tighter">Phys<span class="font-black">flow</span></a>
            </div>
            <div class="flex items-center space-x-3">
                <button onclick="window.toggleTheme()" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">🌓</button>
                <div id="auth-section">
                    <button id="login-btn" class="bg-[#e1ecf4] dark:bg-[#3d4952] text-[#39739d] dark:text-[#9cc3db] px-3 py-1.5 rounded text-[12px] border border-[#7aa7c7] dark:border-gray-600 hover:bg-[#b3d3ea] transition">Log in</button>
                </div>
            </div>
        </div>
    </header>

    <div class="max-w-7xl mx-auto flex">
        <aside class="w-48 hidden md:block border-r dark:border-gray-700 min-h-screen pt-4 text-[13px] sticky top-12 h-[calc(100vh-48px)]">
            <nav class="space-y-1">
                <a href="index.html" class="block py-2 px-4 border-r-4 border-[#f48225] bg-gray-50 dark:bg-gray-800 font-bold">Home</a>
                <div class="px-4 py-2 uppercase text-[11px] font-semibold text-gray-500">Public</div>
                <a href="#" class="block py-2 px-8 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition">Questions</a>
                <a href="#" class="block py-2 px-8 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition">Tags</a>
            </nav>
        </aside>

        <main id="main-content" class="flex-1 p-6 border-l dark:border-gray-700 min-h-screen"></main>
    </div>

    <footer class="bg-[#232629] text-gray-400 py-8 mt-12 text-[11px]">
        <div class="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
            <div class="col-span-1">
                <h5 class="font-bold text-gray-200 uppercase mb-3">Physflow</h5>
                <ul class="space-y-2">
                    <li><a href="#" class="hover:text-gray-100 transition">Questions</a></li>
                    <li><a href="#" class="hover:text-gray-100 transition">Help</a></li>
                </ul>
            </div>
            <div>
                <h5 class="font-bold text-gray-200 uppercase mb-3">Products</h5>
                <ul class="space-y-2">
                    <li><a href="#" class="hover:text-gray-100 transition">Teams</a></li>
                    <li><a href="#" class="hover:text-gray-100 transition">Advertising</a></li>
                </ul>
            </div>
            <div>
                <h5 class="font-bold text-gray-200 uppercase mb-3">Company</h5>
                <ul class="space-y-2">
                    <li><a href="#" class="hover:text-gray-100 transition">About</a></li>
                    <li><a href="#" class="hover:text-gray-100 transition">Contact Us</a></li>
                </ul>
            </div>
            <div class="flex flex-col justify-between">
                <ul class="flex space-y-0 space-x-3">
                    <li><a href="#" class="hover:text-gray-100">Blog</a></li>
                    <li><a href="#" class="hover:text-gray-100">Facebook</a></li>
                    <li><a href="#" class="hover:text-gray-100">Twitter</a></li>
                </ul>
                <p class="mt-8">Site design / logo © 2026 Physflow Inc; user contributions licensed under <span class="underline">CC BY-SA</span>.</p>
            </div>
        </div>
    </footer>`;

    const bodyContent = document.body.innerHTML;
    document.body.innerHTML = layoutHTML;
    document.getElementById('main-content').innerHTML = bodyContent;
}
