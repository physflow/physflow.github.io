// Ask question page
let selectedTags = [];

async function submitQuestion() {
  if (!currentUser) {
    alert('প্রশ্ন করতে লগইন করুন');
    window.location.href = '/';
    return;
  }

  const title = document.getElementById('question-title').value.trim();
  const body = document.getElementById('question-body').value.trim();

  if (!title) {
    alert('শিরোনাম লিখুন');
    return;
  }

  if (title.length < 15) {
    alert('শিরোনাম কমপক্ষে ১৫ অক্ষরের হতে হবে');
    return;
  }

  if (!body) {
    alert('প্রশ্নের বিস্তারিত লিখুন');
    return;
  }

  if (selectedTags.length === 0) {
    alert('কমপক্ষে একটি ট্যাগ যুক্ত করুন');
    return;
  }

  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'জমা দেওয়া হচ্ছে...';

  try {
    // Create slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 100) + '-' + Date.now().toString(36);

    // Insert question
    const { data: question, error: qError } = await supabase
      .from('questions')
      .insert({
        title: title,
        slug: slug,
        body: body,
        author_id: currentUser.id
      })
      .select()
      .single();

    if (qError) throw qError;

    // Link tags
    const tagLinks = selectedTags.map(tagId => ({
      question_id: question.id,
      tag_id: tagId
    }));

    const { error: tagError } = await supabase
      .from('question_tags')
      .insert(tagLinks);

    if (tagError) throw tagError;

    // Redirect to question page
    window.location.href = `/question.html?id=${question.id}`;
  } catch (error) {
    console.error('Error submitting question:', error);
    alert('প্রশ্ন জমা দিতে সমস্যা হয়েছে');
    submitBtn.disabled = false;
    submitBtn.textContent = 'প্রশ্ন জমা দিন';
  }
}

async function loadPopularTags() {
  try {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .limit(20);

    if (error) throw error;

    const container = document.getElementById('popular-tags');
    if (container && data) {
      container.innerHTML = data.map(tag => `
        <button onclick="toggleTag('${tag.id}', '${tag.name}')" 
                id="tag-${tag.id}"
                class="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-sm">
          ${tag.name}
        </button>
      `).join('');
    }
  } catch (error) {
    console.error('Error loading tags:', error);
  }
}

function toggleTag(tagId, tagName) {
  const index = selectedTags.indexOf(tagId);
  const tagBtn = document.getElementById(`tag-${tagId}`);

  if (index === -1) {
    if (selectedTags.length >= 5) {
      alert('সর্বোচ্চ ৫টি ট্যাগ যুক্ত করতে পারবেন');
      return;
    }
    selectedTags.push(tagId);
    if (tagBtn) {
      tagBtn.classList.remove('bg-gray-200', 'dark:bg-gray-700');
      tagBtn.classList.add('bg-blue-600', 'text-white');
    }
  } else {
    selectedTags.splice(index, 1);
    if (tagBtn) {
      tagBtn.classList.remove('bg-blue-600', 'text-white');
      tagBtn.classList.add('bg-gray-200', 'dark:bg-gray-700', 'text-gray-800', 'dark:text-gray-200');
    }
  }

  updateSelectedTagsDisplay();
}

function updateSelectedTagsDisplay() {
  const container = document.getElementById('selected-tags');
  if (container) {
    if (selectedTags.length === 0) {
      container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-sm">কোনো ট্যাগ নির্বাচিত নয়</p>';
    } else {
      container.innerHTML = `<p class="text-sm mb-2">${selectedTags.length}টি ট্যাগ নির্বাচিত</p>`;
    }
  }
}

async function searchTags() {
  const input = document.getElementById('tag-search');
  const query = input.value.trim().toLowerCase();

  if (query.length < 2) {
    await loadPopularTags();
    return;
  }

  try {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(20);

    if (error) throw error;

    const container = document.getElementById('popular-tags');
    if (container && data) {
      if (data.length === 0) {
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400">কোনো ট্যাগ পাওয়া যায়নি</p>';
      } else {
        container.innerHTML = data.map(tag => `
          <button onclick="toggleTag('${tag.id}', '${tag.name}')" 
                  id="tag-${tag.id}"
                  class="px-3 py-1 ${selectedTags.includes(tag.id) ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'} rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-sm">
            ${tag.name}
          </button>
        `).join('');
      }
    }
  } catch (error) {
    console.error('Error searching tags:', error);
  }
}

// Preview markdown
function updatePreview() {
  const body = document.getElementById('question-body').value;
  const preview = document.getElementById('body-preview');
  
  if (preview) {
    if (body.trim()) {
      preview.innerHTML = marked.parse(body);
    } else {
      preview.innerHTML = '<p class="text-gray-500 dark:text-gray-400">প্রিভিউ এখানে দেখাবে...</p>';
    }
  }
}

function togglePreview() {
  const editor = document.getElementById('editor-tab');
  const preview = document.getElementById('preview-tab');
  const editorContent = document.getElementById('editor-content');
  const previewContent = document.getElementById('preview-content');

  const isShowingPreview = preview.classList.contains('border-b-2');

  if (isShowingPreview) {
    // Show editor
    editor.classList.add('border-b-2', 'border-blue-600', 'text-blue-600');
    preview.classList.remove('border-b-2', 'border-blue-600', 'text-blue-600');
    editor.classList.remove('text-gray-600');
    preview.classList.add('text-gray-600');
    editorContent.classList.remove('hidden');
    previewContent.classList.add('hidden');
  } else {
    // Show preview
    preview.classList.add('border-b-2', 'border-blue-600', 'text-blue-600');
    editor.classList.remove('border-b-2', 'border-blue-600', 'text-blue-600');
    preview.classList.remove('text-gray-600');
    editor.classList.add('text-gray-600');
    previewContent.classList.remove('hidden');
    editorContent.classList.add('hidden');
    updatePreview();
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    loadPopularTags();
    
    // Check if user is logged in
    setTimeout(() => {
      if (!currentUser) {
        alert('প্রশ্ন করতে লগইন করুন');
        window.location.href = '/';
      }
    }, 1000);
  });
} else {
  loadPopularTags();
}
