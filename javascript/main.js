import { supabase } from './supabase-config.js';

// State management
let currentFilter = 'newest';
let currentPage = 0;
const PAGE_SIZE = 20;
let isLoading = false;
let hasMore = true;

// Bangla number converter
const toBanglaNumber = (num) => {
    const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(num).split('').map(digit => banglaDigits[parseInt(digit)] || digit).join('');
};

// Format time ago in Bangla
const formatTimeAgo = (date) => {
    const now = new Date();
    const then = new Date(date);
    const seconds = Math.floor((now - then) / 1000);
    
    if (seconds < 60) {
        return `${toBanglaNumber(seconds)} সেকেন্ড আগে`;
    }
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${toBanglaNumber(minutes)} মিনিট আগে`;
    }
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${toBanglaNumber(hours)} ঘন্টা আগে`;
    }
    
    const days = Math.floor(hours / 24);
    if (days < 30) {
        return `${toBanglaNumber(days)} দিন আগে`;
    }
    
    const months = Math.floor(days / 30);
    if (months < 12) {
        return `${toBanglaNumber(months)} মাস আগে`;
    }
    
    const years = Math.floor(months / 12);
    return `${toBanglaNumber(years)} বছর আগে`;
};

// Truncate text
const truncateText = (text, maxLength = 150) => {
    if (!text) return '';
    const stripped = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (stripped.length <= maxLength) return stripped;
    return stripped.substring(0, maxLength) + '...';
};



// Create question card HTML
const createQuestionCard = (question) => {
    const tags = question.tags ? (Array.isArray(question.tags) ? question.tags : JSON.parse(question.tags)) : [];
    const excerpt = truncateText(question.body, 150);
    const timeAgo = formatTimeAgo(question.created_at);
    
    // Default avatar if none provided
    const avatar = question.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(question.author_name || 'User')}&background=0a95ff&color=fff&size=128`;
    
    return `
        <article class="question-card flex gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
            <!-- Stats Section -->
            <div class="flex flex-col gap-3 items-center text-center min-w-[4rem] shrink-0">
                <div class="stat-badge ${question.votes > 0 ? 'text-green-600 dark:text-green-400' : question.votes < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}">
                    <div class="stat-number">${toBanglaNumber(question.votes || 0)}</div>
                    <div class="stat-label">ভোট</div>
                </div>
                
                <div class="stat-badge ${question.answers_count > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}">
                    <div class="stat-number">${toBanglaNumber(question.answers_count || 0)}</div>
                    <div class="stat-label">উত্তর</div>
                </div>
                
                <div class="stat-badge text-gray-600 dark:text-gray-400">
                    <div class="stat-number">${toBanglaNumber(question.views || 0)}</div>
                    <div class="stat-label">ভিউ</div>
                </div>
            </div>
            
            <!-- Content Section -->
            <div class="flex-1 min-w-0">
                <!-- Title -->
                <h3 class="text-lg font-semibold mb-2">
                    <a href="questions/${question.slug}.html" class="text-brand-600 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition">
                        ${question.title}
                    </a>
                </h3>
                
                <!-- Excerpt -->
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                    ${excerpt}
                </p>
                
                <!-- Tags -->
                <div class="flex flex-wrap gap-1 mb-3">
                    ${tags.map(tag => `
                        <a href="tags.html?tag=${encodeURIComponent(tag)}" class="tag">
                            ${tag}
                        </a>
                    `).join('')}
                </div>
                
                <!-- Meta Info -->
                <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <div class="flex items-center gap-2">
                        <img src="${avatar}" 
                             alt="${question.author_name || 'ব্যবহারকারী'}" 
                             class="w-6 h-6 rounded-full object-cover"
                             onerror="this.src='https://ui-avatars.com/api/?name=User&background=0a95ff&color=fff&size=128'">
                        <a href="users/${question.author_name || 'user'}.html" class="hover:text-brand-600 dark:hover:text-blue-400 transition font-medium">
                            ${question.author_name || 'অজ্ঞাত ব্যবহারকারী'}
                        </a>
                    </div>
                    <time datetime="${question.created_at}" class="whitespace-nowrap">
                        ${timeAgo}
                    </time>
                </div>
            </div>
        </article>
    `;
};

// Fetch questions from Supabase
const fetchQuestions = async (filter = 'newest', page = 0, searchQuery = '') => {
    try {
        let query = supabase
            .from('questions')
            .select('*', { count: 'exact' });
        
        // Apply search filter if query exists
        if (searchQuery) {
            query = query.or(`title.ilike.%${searchQuery}%,body.ilike.%${searchQuery}%`);
        }
        
        // Apply sorting based on filter
        switch (filter) {
            case 'unanswered':
                query = query.eq('answers_count', 0).order('created_at', { ascending: false });
                break;
            case 'popular':
                query = query.order('views', { ascending: false });
                break;
            case 'newest':
            default:
                query = query.order('created_at', { ascending: false });
                break;
        }
        
        // Pagination
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        query = query.range(from, to);
        
        const { data, error, count } = await query;
        
        if (error) {
            console.error('Supabase error:', error);
            throw error;
        }
        
        return {
            questions: data || [],
            totalCount: count || 0,
            hasMore: data && data.length === PAGE_SIZE
        };
    } catch (error) {
        console.error('Error fetching questions:', error);
        throw error;
    }
};

// Render questions
const renderQuestions = (questions, append = false) => {
    const questionsList = document.getElementById('questions-list');
    const emptyState = document.getElementById('empty-state');
    const loadMoreContainer = document.getElementById('load-more-container');
    
    if (questions.length === 0 && !append) {
        questionsList.classList.add('hidden');
        emptyState.classList.remove('hidden');
        loadMoreContainer.classList.add('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    questionsList.classList.remove('hidden');
    
    const questionsHTML = questions.map(q => createQuestionCard(q)).join('');
    
    if (append) {
        questionsList.insertAdjacentHTML('beforeend', questionsHTML);
    } else {
        questionsList.innerHTML = questionsHTML;
    }
    
    // Show/hide load more button
    if (hasMore && questions.length > 0) {
        loadMoreContainer.classList.remove('hidden');
    } else {
        loadMoreContainer.classList.add('hidden');
    }
};

// Update question count
const updateQuestionCount = (count) => {
    const questionCount = document.getElementById('question-count');
    questionCount.textContent = `মোট ${toBanglaNumber(count)} টি প্রশ্ন`;
};

// Show error state
const showErrorState = () => {
    document.getElementById('loading-skeleton').classList.add('hidden');
    document.getElementById('questions-list').classList.add('hidden');
    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('error-state').classList.remove('hidden');
    document.getElementById('load-more-container').classList.add('hidden');
};

// Hide error state
const hideErrorState = () => {
    document.getElementById('error-state').classList.add('hidden');
};

// Load questions
const loadQuestions = async (filter = 'newest', append = false) => {
    if (isLoading) return;
    
    isLoading = true;
    hideErrorState();
    
    if (!append) {
        currentPage = 0;
        showLoadingSkeleton();
    }
    
    try {
        // Get search query from URL
        const urlParams = new URLSearchParams(window.location.search);
        const searchQuery = urlParams.get('q') || '';
        
        const { questions, totalCount, hasMore: more } = await fetchQuestions(filter, currentPage, searchQuery);
        
        hasMore = more;
        
        hideLoadingSkeleton();
        renderQuestions(questions, append);
        
        if (!append) {
            updateQuestionCount(totalCount);
        }
        
        currentPage++;
    } catch (error) {
        console.error('Failed to load questions:', error);
        hideLoadingSkeleton();
        showErrorState();
    } finally {
        isLoading = false;
    }
};

// Setup filter tabs
const setupFilterTabs = () => {
    const filterTabs = document.querySelectorAll('.filter-tab');
    
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            filterTabs.forEach(t => {
                t.classList.remove('active', 'bg-brand-500', 'text-brand-600', 'border-b-2', 'border-brand-600');
                t.classList.add('text-gray-600', 'dark:text-gray-400', 'hover:bg-gray-100', 'dark:hover:bg-gray-800');
            });
            
            // Add active class to clicked tab
            tab.classList.add('active', 'bg-brand-500', 'text-brand-600', 'border-b-2', 'border-brand-600');
            tab.classList.remove('text-gray-600', 'dark:text-gray-400', 'hover:bg-gray-100', 'dark:hover:bg-gray-800');
            
            // Update current filter
            currentFilter = tab.dataset.filter;
            
            // Reload questions
            loadQuestions(currentFilter, false);
        });
    });
    
    // Set initial active tab
    const activeTab = document.querySelector('.filter-tab.active');
    if (activeTab) {
        activeTab.classList.add('bg-brand-500', 'text-brand-600', 'border-b-2', 'border-brand-600');
        activeTab.classList.remove('text-gray-600', 'dark:text-gray-400');
    }
};

// Setup load more button
const setupLoadMore = () => {
    const loadMoreBtn = document.getElementById('load-more-btn');
    
    loadMoreBtn.addEventListener('click', () => {
        loadQuestions(currentFilter, true);
    });
};

// Setup retry button
const setupRetryButton = () => {
    const retryBtn = document.getElementById('retry-btn');
    
    retryBtn.addEventListener('click', () => {
        loadQuestions(currentFilter, false);
    });
};

// Initialize homepage
export const initHomePage = () => {
    // Setup UI components
    setupFilterTabs();
    setupLoadMore();
    setupRetryButton();
    
    // Initial load
    loadQuestions(currentFilter, false);
    
    // Handle browser back/forward
    window.addEventListener('popstate', () => {
        loadQuestions(currentFilter, false);
    });
};

// Export for use in other modules if needed
export { loadQuestions, fetchQuestions, formatTimeAgo, toBanglaNumber };
