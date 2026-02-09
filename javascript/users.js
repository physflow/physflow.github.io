// Users Page

async function loadUsers() {
    const usersContainer = document.getElementById('usersContainer');
    if (!usersContainer) return;
    
    usersContainer.innerHTML = '<div class="text-center py-8 text-gray-500 dark:text-gray-400">Loading users...</div>';
    
    try {
        const { data: users, error } = await supabase
            .from('profiles')
            .select('*')
            .order('reputation', { ascending: false })
            .limit(50);
        
        if (error) throw error;
        
        if (!users || users.length === 0) {
            usersContainer.innerHTML = '<div class="text-center py-8 text-gray-500 dark:text-gray-400">No users found.</div>';
            return;
        }
        
        const usersHTML = users.map(user => renderUserCard(user)).join('');
        usersContainer.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${usersHTML}</div>`;
        
    } catch (error) {
        console.error('Error loading users:', error);
        usersContainer.innerHTML = '<div class="text-center py-8 text-red-500">Error loading users.</div>';
    }
}

function renderUserCard(user) {
    return `
        <a href="/profile.html?user=${user.id}" 
            class="block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-orange-500 dark:hover:border-orange-500 transition-colors">
            <div class="flex items-center gap-4">
                <img src="${user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=random`}" 
                    alt="${escapeHtml(user.username)}" 
                    class="w-16 h-16 rounded-full">
                <div class="flex-1">
                    <h3 class="font-semibold text-gray-900 dark:text-white">${escapeHtml(user.username)}</h3>
                    ${user.full_name ? `<p class="text-sm text-gray-600 dark:text-gray-400">${escapeHtml(user.full_name)}</p>` : ''}
                    <div class="flex items-center gap-2 mt-1">
                        <span class="text-sm font-semibold text-orange-600 dark:text-orange-400">${user.reputation || 0}</span>
                        <span class="text-xs text-gray-500 dark:text-gray-400">reputation</span>
                    </div>
                </div>
            </div>
            ${user.bio ? `<p class="mt-3 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">${escapeHtml(user.bio)}</p>` : ''}
        </a>
    `;
}

// Search users
async function searchUsers(searchTerm) {
    if (!searchTerm.trim()) {
        loadUsers();
        return;
    }
    
    const usersContainer = document.getElementById('usersContainer');
    if (!usersContainer) return;
    
    try {
        const { data: users, error } = await supabase
            .from('profiles')
            .select('*')
            .or(`username.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`)
            .order('reputation', { ascending: false })
            .limit(50);
        
        if (error) throw error;
        
        if (!users || users.length === 0) {
            usersContainer.innerHTML = '<div class="text-center py-8 text-gray-500 dark:text-gray-400">No users found matching your search.</div>';
            return;
        }
        
        const usersHTML = users.map(user => renderUserCard(user)).join('');
        usersContainer.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${usersHTML}</div>`;
        
    } catch (error) {
        console.error('Error searching users:', error);
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    loadUsers();
    
    const searchInput = document.getElementById('userSearch');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchUsers(e.target.value);
            }, 300);
        });
    }
});
