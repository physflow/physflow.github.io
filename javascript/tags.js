// Tags Page

async function loadTags() {
    const tagsContainer = document.getElementById('tagsContainer');
    if (!tagsContainer) return;
    
    tagsContainer.innerHTML = '<div class="text-center py-8 text-gray-500 dark:text-gray-400">Loading tags...</div>';
    
    try {
        // Get tags with question count
        const { data: tags, error } = await supabase
            .from('tags')
            .select(`
                *,
                question_tags (count)
            `)
            .order('name');
        
        if (error) throw error;
        
        if (!tags || tags.length === 0) {
            tagsContainer.innerHTML = '<div class="text-center py-8 text-gray-500 dark:text-gray-400">No tags found.</div>';
            return;
        }
        
        // Process tags to get question counts
        const tagsWithCounts = await Promise.all(tags.map(async tag => {
            const { count } = await supabase
                .from('question_tags')
                .select('*', { count: 'exact', head: true })
                .eq('tag_id', tag.id);
            
            return {
                ...tag,
                question_count: count || 0
            };
        }));
        
        // Sort by question count
        tagsWithCounts.sort((a, b) => b.question_count - a.question_count);
        
        const tagsHTML = tagsWithCounts.map(tag => renderTagCard(tag)).join('');
        tagsContainer.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${tagsHTML}</div>`;
        
    } catch (error) {
        console.error('Error loading tags:', error);
        tagsContainer.innerHTML = '<div class="text-center py-8 text-red-500">Error loading tags.</div>';
    }
}

function renderTagCard(tag) {
    return `
        <a href="/index.html?tag=${tag.slug}" 
            class="block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-orange-500 dark:hover:border-orange-500 transition-colors">
            <div class="flex items-start justify-between mb-2">
                <span class="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm font-medium">
                    ${escapeHtml(tag.name)}
                </span>
                <span class="text-sm text-gray-500 dark:text-gray-400">
                    ${tag.question_count} question${tag.question_count !== 1 ? 's' : ''}
                </span>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                Questions tagged with ${escapeHtml(tag.name)}
            </p>
        </a>
    `;
}

// Search tags
async function searchTags(searchTerm) {
    if (!searchTerm.trim()) {
        loadTags();
        return;
    }
    
    const tagsContainer = document.getElementById('tagsContainer');
    if (!tagsContainer) return;
    
    try {
        const { data: tags, error } = await supabase
            .from('tags')
            .select('*')
            .ilike('name', `%${searchTerm}%`)
            .order('name');
        
        if (error) throw error;
        
        if (!tags || tags.length === 0) {
            tagsContainer.innerHTML = '<div class="text-center py-8 text-gray-500 dark:text-gray-400">No tags found matching your search.</div>';
            return;
        }
        
        const tagsWithCounts = await Promise.all(tags.map(async tag => {
            const { count } = await supabase
                .from('question_tags')
                .select('*', { count: 'exact', head: true })
                .eq('tag_id', tag.id);
            
            return {
                ...tag,
                question_count: count || 0
            };
        }));
        
        const tagsHTML = tagsWithCounts.map(tag => renderTagCard(tag)).join('');
        tagsContainer.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${tagsHTML}</div>`;
        
    } catch (error) {
        console.error('Error searching tags:', error);
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    loadTags();
    
    const searchInput = document.getElementById('tagSearch');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchTags(e.target.value);
            }, 300);
        });
    }
});
