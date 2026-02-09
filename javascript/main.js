// Main Page - Questions List

let currentFilter = 'newest';
let currentPage = 1;
const questionsPerPage = 20;

async function loadQuestions(filter = 'newest', page = 1) {
    const questionsContainer = document.getElementById('questionsList');
    if (!questionsContainer) return;
    
    // Show loading
    questionsContainer.innerHTML = '<div class="text-center py-8 text-gray-500 dark:text-gray-400">Loading questions...</div>';
    
    try {
        let query = supabase
            .from('questions')
            .select(`
                *,
                profiles:author_id (username, avatar_url, reputation),
                question_tags (
                    tags (name, slug)
                )
            `, { count: 'exact' });
        
        // Apply filters
        if (filter === 'newest') {
            query = query.order('created_at', { ascending: false });
        } else if (filter === 'active') {
            query = query.order('updated_at', { ascending: false });
        } else if (filter === 'unanswered') {
            query = query.eq('is_answered', false).order('created_at', { ascending: false });
        } else if (filter === 'votes') {
            query = query.order('votes', { ascending: false });
        }
        
        // Pagination
        const from = (page - 1) * questionsPerPage;
        const to = from + questionsPerPage - 1;
        query = query.range(from, to);
        
        const { data: questions, error, count } = await query;
        
        if (error) throw error;
        
        if (!questions || questions.length === 0) {
            questionsContainer.innerHTML = `
                <div class="text-center py-12">
                    <p class="text-gray-500 dark:text-gray-400 mb-4">No questions found.</p>
                    <a href="/ask.html" class="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 inline-block">
                        Ask the first question
                    </a>
                </div>
            `;
            return;
        }
        
        // Render questions
        const questionsHTML = questions.map(q => renderQuestionCard(q)).join('');
        questionsContainer.innerHTML = questionsHTML;
        
        // Render pagination
        renderPagination(count, page);
        
    } catch (error) {
        console.error('Error loading questions:', error);
        questionsContainer.innerHTML = '<div class="text-center py-8 text-red-500">Error loading questions. Please try again.</div>';
    }
}

function renderQuestionCard(question) {
    const tags = question.question_tags?.map(qt => qt.tags).filter(Boolean) || [];
    const author = question.profiles || { username: 'Unknown', avatar_url: '', reputation: 0 };
    
    return `
        <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
            <div class="flex gap-4">
                <!-- Stats -->
                <div class="flex flex-col gap-2 text-center text-sm min-w-[80px]">
                    <div class="text-gray-900 dark:text-white">
                        <span class="font-semibold">${question.votes || 0}</span>
                        <span class="text-gray-500 dark:text-gray-400 text-xs ml-1">votes</span>
                    </div>
                    <div class="${question.is_answered ? 'bg-green-500 text-white' : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'} rounded px-2 py-1 text-xs">
                        ${question.answer_count || 0} answers
                    </div>
                    <div class="text-gray-500 dark:text-gray-400 text-xs">
                        ${question.views || 0} views
                    </div>
                </div>
                
                <!-- Content -->
                <div class="flex-1">
                    <h3 class="text-lg font-medium mb-2">
                        <a href="/question.html?id=${question.id}" class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                            ${escapeHtml(question.title)}
                        </a>
                    </h3>
                    <div class="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                        ${escapeHtml(question.body.substring(0, 200))}...
                    </div>
                    
                    <!-- Tags -->
                    <div class="flex flex-wrap gap-2 mb-3">
                        ${tags.map(tag => `
                            <a href="/tags.html?tag=${tag.slug}" class="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800">
                                ${escapeHtml(tag.name)}
                            </a>
                        `).join('')}
                    </div>
                    
                    <!-- Author and time -->
                    <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <div class="flex items-center gap-2">
                            <img src="${author.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(author.username)}&background=random`}" 
                                alt="${escapeHtml(author.username)}" 
                                class="w-6 h-6 rounded-full">
                            <a href="/profile.html?user=${question.author_id}" class="hover:text-blue-600 dark:hover:text-blue-400">
                                ${escapeHtml(author.username)}
                            </a>
                            <span class="text-orange-600 dark:text-orange-400 font-semibold">${author.reputation || 0}</span>
                        </div>
                        <span>asked ${formatDate(question.created_at)}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderPagination(totalCount, currentPage) {
    const paginationContainer = document.getElementById('pagination');
    if (!paginationContainer) return;
    
    const totalPages = Math.ceil(totalCount / questionsPerPage);
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    let paginationHTML = '<div class="flex justify-center gap-2 mt-6">';
    
    // Previous button
    if (currentPage > 1) {
        paginationHTML += `<button onclick="changePage(${currentPage - 1})" class="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-sm">Previous</button>`;
    }
    
    // Page numbers
    for (let i = 1; i <= Math.min(totalPages, 5); i++) {
        const pageNum = currentPage <= 3 ? i : currentPage - 3 + i;
        if (pageNum > totalPages) break;
        
        paginationHTML += `
            <button onclick="changePage(${pageNum})" 
                class="px-3 py-1 ${pageNum === currentPage ? 'bg-orange-500 text-white' : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'} rounded text-sm">
                ${pageNum}
            </button>
        `;
    }
    
    // Next button
    if (currentPage < totalPages) {
        paginationHTML += `<button onclick="changePage(${currentPage + 1})" class="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-sm">Next</button>`;
    }
    
    paginationHTML += '</div>';
    paginationContainer.innerHTML = paginationHTML;
}

function changePage(page) {
    currentPage = page;
    loadQuestions(currentFilter, currentPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function changeFilter(filter) {
    currentFilter = filter;
    currentPage = 1;
    
    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('bg-orange-500', 'text-white');
        btn.classList.add('text-gray-700', 'dark:text-gray-300');
    });
    document.querySelector(`[data-filter="${filter}"]`)?.classList.add('bg-orange-500', 'text-white');
    document.querySelector(`[data-filter="${filter}"]`)?.classList.remove('text-gray-700', 'dark:text-gray-300');
    
    loadQuestions(currentFilter, currentPage);
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    loadQuestions();
    
    // Search functionality
    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchQuestions(e.target.value);
            }, 500);
        });
    }
});

async function searchQuestions(searchTerm) {
    if (!searchTerm.trim()) {
        loadQuestions(currentFilter, currentPage);
        return;
    }
    
    const questionsContainer = document.getElementById('questionsList');
    if (!questionsContainer) return;
    
    try {
        const { data: questions, error } = await supabase
            .from('questions')
            .select(`
                *,
                profiles:author_id (username, avatar_url, reputation),
                question_tags (
                    tags (name, slug)
                )
            `)
            .or(`title.ilike.%${searchTerm}%,body.ilike.%${searchTerm}%`)
            .order('created_at', { ascending: false })
            .limit(20);
        
        if (error) throw error;
        
        if (!questions || questions.length === 0) {
            questionsContainer.innerHTML = '<div class="text-center py-8 text-gray-500 dark:text-gray-400">No questions found matching your search.</div>';
            return;
        }
        
        const questionsHTML = questions.map(q => renderQuestionCard(q)).join('');
        questionsContainer.innerHTML = questionsHTML;
        
    } catch (error) {
        console.error('Error searching questions:', error);
    }
}
