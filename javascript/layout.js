// Layout and UI utilities
function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.classList.contains('dark') ? 'dark' : 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  if (newTheme === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
  
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  if (icon) {
    icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  }
  updateThemeIcon(savedTheme);
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  if (menu) {
    menu.classList.toggle('hidden');
  }
}

function toggleUserDropdown() {
  const dropdown = document.getElementById('user-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('hidden');
  }
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const userMenu = document.getElementById('user-menu');
  const dropdown = document.getElementById('user-dropdown');
  
  if (dropdown && userMenu && !userMenu.contains(e.target)) {
    dropdown.classList.add('hidden');
  }
});

// Time ago formatter
function timeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + ' বছর আগে';
  
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + ' মাস আগে';
  
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + ' দিন আগে';
  
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + ' ঘণ্টা আগে';
  
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + ' মিনিট আগে';
  
  return 'এইমাত্র';
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
}

// Initialize theme on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTheme);
} else {
  initTheme();
}
