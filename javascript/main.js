// Main page - Questions list
let currentFilter = 'newest';
let currentPage = 1;
const questionsPerPage = 20;

async function loadQuestions(filter = 'newest', page = 1) {
  currentFilter = filter;
  currentPage = page;
  
  const container = document.getElementById('questions-container');
  const loadingEl = document.getElementById('loading');
  
  if (loadingEl) loadingEl.classList.remove('hidden');
  
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

    // Apply sorting
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

    const { data, error, count } = await query;

    if (error) throw error;

    displayQuestions(data);
    displayPagination(count, page);
    updateFilterButtons();
  } catch (error) {
    console.error('Error loading questions:', error);
    if (container) {
      container.innerHTML = '<div class="text-center py-8 text-red-600 dark:text-red-400">প্রশ্ন লোড করতে সমস্যা হয়েছে</div>';
    }
  } finally {
    if (loadingEl) loadingEl.classList.add('hidden');
  }
}

function displayQuestions(questions) {
  const container = document.getElementById('questions-container');
  if (!container) return;

  if (questions.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12">
        <p class="text-gray-600 dark:text-gray-400 text-lg mb-4">কোনো প্রশ্ন পাওয়া যায়নি</p>
        <a href="/ask.html" class="text-blue-600 dark:text-blue-400 hover:underline">প্রথম প্রশ্ন করুন!</a>
      </div>
    `;
    return;
  }

  container.innerHTML = questions.map(q => `
    <div class="border-b border-gray-200 dark:border-gray-700 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <div class="flex gap-4">
        <!-- Stats -->
        <div class="flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-400 min-w-[80px]">
          <div class="flex items-center gap-1">
            <span class="font-medium ${q.votes > 0 ? 'text-green-600 dark:text-green-500' : q.votes < 0 ? 'text-red-600 dark:text-red-500' : ''}">${q.votes}</span>
            <span>ভোট</span>
          </div>
          <div class="flex items-center gap-1 ${q.is_answered ? 'text-green-600 dark:text-green-500 font-medium' : ''}">
            <span>${q.answer_count}</span>
            <span>উত্তর</span>
          </div>
          <div class="flex items-center gap-1">
            <span>${formatNumber(q.views)}</span>
            <span>দর্শন</span>
          </div>
        </div>

        <!-- Content -->
        <div class="flex-1">
          <h3 class="text-base mb-2">
            <a href="/question.html?id=${q.id}" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
              ${escapeHtml(q.title)}
            </a>
          </h3>
          
          <!-- Tags -->
          <div class="flex flex-wrap gap-2 mb-2">
            ${q.question_tags.map(qt => `
              <a href="/tags.html?tag=${qt.tags.slug}" 
                 class="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded hover:bg-blue-200 dark:hover:bg-blue-800">
                ${qt.tags.name}
              </a>
            `).join('')}
          </div>

          <!-- Author info -->
          <div class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <img src="${q.profiles.avatar_url}" alt="${q.profiles.username}" class="w-5 h-5 rounded-full">
            <a href="/profile.html?user=${q.profiles.username}" class="hover:text-blue-600 dark:hover:text-blue-400">${q.profiles.username}</a>
            <span class="text-gray-400">•</span>
            <span>${timeAgo(q.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function displayPagination(totalCount, currentPage) {
  const container = document.getElementById('pagination');
  if (!container || !totalCount) return;

  const totalPages = Math.ceil(totalCount / questionsPerPage);
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let pages = [];
  if (totalPages <= 7) {
    pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  } else {
    if (currentPage <= 3) {
      pages = [1, 2, 3, 4, '...', totalPages];
    } else if (currentPage >= totalPages - 2) {
      pages = [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    } else {
      pages = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
    }
  }

  container.innerHTML = `
    <div class="flex justify-center gap-1 mt-6">
      ${currentPage > 1 ? `
        <button onclick="loadQuestions('${currentFilter}', ${currentPage - 1})" 
                class="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
          পূর্ববর্তী
        </button>
      ` : ''}
      
      ${pages.map(page => {
        if (page === '...') {
          return '<span class="px-3 py-1">...</span>';
        }
        const isActive = page === currentPage;
        return `
          <button onclick="loadQuestions('${currentFilter}', ${page})" 
                  class="px-3 py-1 border ${isActive ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'} rounded">
            ${page}
          </button>
        `;
      }).join('')}
      
      ${currentPage < totalPages ? `
        <button onclick="loadQuestions('${currentFilter}', ${currentPage + 1})" 
                class="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
          পরবর্তী
        </button>
      ` : ''}
    </div>
  `;
}

function updateFilterButtons() {
  const buttons = {
    'newest': document.getElementById('filter-newest'),
    'active': document.getElementById('filter-active'),
    'unanswered': document.getElementById('filter-unanswered'),
    'votes': document.getElementById('filter-votes')
  };

  Object.entries(buttons).forEach(([filter, btn]) => {
    if (btn) {
      if (filter === currentFilter) {
        btn.classList.add('bg-gray-200', 'dark:bg-gray-700');
        btn.classList.remove('hover:bg-gray-100', 'dark:hover:bg-gray-800');
      } else {
        btn.classList.remove('bg-gray-200', 'dark:bg-gray-700');
        btn.classList.add('hover:bg-gray-100', 'dark:hover:bg-gray-800');
      }
    }
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function setupRealtimeSubscription() {
  supabase
    .channel('questions-changes')
    .on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'questions' },
      () => loadQuestions(currentFilter, currentPage)
    )
    .subscribe();
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    loadQuestions();
    setupRealtimeSubscription();
  });
} else {
  loadQuestions();
  setupRealtimeSubscription();
}
