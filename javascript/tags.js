// Tags page
async function loadTags() {
  const container = document.getElementById('tags-container');
  const loading = document.getElementById('loading');

  if (loading) loading.classList.remove('hidden');

  try {
    const { data, error } = await supabase
      .from('tags')
      .select(`
        *,
        question_tags (count)
      `)
      .order('name');

    if (error) throw error;

    // Count questions for each tag
    const tagsWithCount = await Promise.all(data.map(async (tag) => {
      const { count } = await supabase
        .from('question_tags')
        .select('*', { count: 'exact', head: true })
        .eq('tag_id', tag.id);

      return { ...tag, question_count: count || 0 };
    }));

    displayTags(tagsWithCount);
  } catch (error) {
    console.error('Error loading tags:', error);
    if (container) {
      container.innerHTML = '<div class="text-center py-8 text-red-600 dark:text-red-400">ট্যাগ লোড করতে সমস্যা হয়েছে</div>';
    }
  } finally {
    if (loading) loading.classList.add('hidden');
  }
}

function displayTags(tags) {
  const container = document.getElementById('tags-container');
  if (!container) return;

  if (tags.length === 0) {
    container.innerHTML = '<div class="text-center py-8 text-gray-600 dark:text-gray-400">কোনো ট্যাগ পাওয়া যায়নি</div>';
    return;
  }

  container.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      ${tags.map(tag => `
        <div class="border border-gray-200 dark:border-gray-700 rounded p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <a href="/tags.html?tag=${tag.slug}" class="block mb-2">
            <span class="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm rounded inline-block">
              ${tag.name}
            </span>
          </a>
          <p class="text-sm text-gray-600 dark:text-gray-400">${tag.question_count} প্রশ্ন</p>
        </div>
      `).join('')}
    </div>
  `;
}

async function loadTagQuestions() {
  const urlParams = new URLSearchParams(window.location.search);
  const tagSlug = urlParams.get('tag');

  if (!tagSlug) return;

  try {
    // Get tag info
    const { data: tag, error: tagError } = await supabase
      .from('tags')
      .select('*')
      .eq('slug', tagSlug)
      .single();

    if (tagError) throw tagError;

    // Update page title
    const titleEl = document.getElementById('tag-title');
    if (titleEl) titleEl.textContent = tag.name;

    // Get questions with this tag
    const { data: questionTags, error: qtError } = await supabase
      .from('question_tags')
      .select(`
        questions (
          *,
          profiles:author_id (username, avatar_url, reputation),
          question_tags (
            tags (name, slug)
          )
        )
      `)
      .eq('tag_id', tag.id);

    if (qtError) throw qtError;

    const questions = questionTags.map(qt => qt.questions).filter(q => q !== null);
    displayTagQuestions(questions);
  } catch (error) {
    console.error('Error loading tag questions:', error);
  }
}

function displayTagQuestions(questions) {
  const container = document.getElementById('tag-questions-container');
  if (!container) return;

  if (questions.length === 0) {
    container.innerHTML = '<div class="text-center py-8 text-gray-600 dark:text-gray-400">এই ট্যাগে কোনো প্রশ্ন নেই</div>';
    return;
  }

  container.innerHTML = questions.map(q => `
    <div class="border-b border-gray-200 dark:border-gray-700 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <div class="flex gap-4">
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

        <div class="flex-1">
          <h3 class="text-base mb-2">
            <a href="/question.html?id=${q.id}" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
              ${escapeHtml(q.title)}
            </a>
          </h3>
          
          <div class="flex flex-wrap gap-2 mb-2">
            ${q.question_tags.map(qt => `
              <a href="/tags.html?tag=${qt.tags.slug}" 
                 class="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded hover:bg-blue-200 dark:hover:bg-blue-800">
                ${qt.tags.name}
              </a>
            `).join('')}
          </div>

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

async function searchTags() {
  const input = document.getElementById('tag-search');
  const query = input.value.trim().toLowerCase();

  if (query.length < 2) {
    await loadTags();
    return;
  }

  const container = document.getElementById('tags-container');
  const loading = document.getElementById('loading');

  if (loading) loading.classList.remove('hidden');

  try {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .ilike('name', `%${query}%`)
      .order('name');

    if (error) throw error;

    const tagsWithCount = await Promise.all(data.map(async (tag) => {
      const { count } = await supabase
        .from('question_tags')
        .select('*', { count: 'exact', head: true })
        .eq('tag_id', tag.id);

      return { ...tag, question_count: count || 0 };
    }));

    displayTags(tagsWithCount);
  } catch (error) {
    console.error('Error searching tags:', error);
  } finally {
    if (loading) loading.classList.add('hidden');
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tag')) {
      loadTagQuestions();
    } else {
      loadTags();
    }
  });
} else {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('tag')) {
    loadTagQuestions();
  } else {
    loadTags();
  }
}
