// Profile page
let profileUser = null;

async function loadProfile() {
  const urlParams = new URLSearchParams(window.location.search);
  const username = urlParams.get('user');

  if (!username) {
    window.location.href = '/';
    return;
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username)
      .single();

    if (error) throw error;
    if (!profile) {
      window.location.href = '/';
      return;
    }

    profileUser = profile;
    displayProfile(profile);
    await loadUserQuestions(profile.id);
    await loadUserAnswers(profile.id);
  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

function displayProfile(profile) {
  const container = document.getElementById('profile-container');
  if (!container) return;

  container.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
      <div class="flex items-start gap-4">
        <img src="${profile.avatar_url}" alt="${profile.username}" class="w-32 h-32 rounded-lg">
        <div class="flex-1">
          <h1 class="text-2xl font-medium mb-2 text-gray-900 dark:text-gray-100">${profile.username}</h1>
          ${profile.full_name ? `<p class="text-gray-600 dark:text-gray-400 mb-2">${profile.full_name}</p>` : ''}
          ${profile.bio ? `<p class="text-gray-700 dark:text-gray-300 mb-4">${escapeHtml(profile.bio)}</p>` : ''}
          
          <div class="flex gap-6 text-sm">
            <div>
              <span class="text-gray-600 dark:text-gray-400">রেপুটেশন:</span>
              <span class="font-medium text-orange-600 dark:text-orange-500 ml-1">${formatNumber(profile.reputation)}</span>
            </div>
            <div>
              <span class="text-gray-600 dark:text-gray-400">যোগদান:</span>
              <span class="ml-1">${new Date(profile.created_at).toLocaleDateString('bn-BD')}</span>
            </div>
          </div>

          ${currentUser && currentUser.id === profile.id ? `
            <button onclick="showEditProfile()" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
              প্রোফাইল এডিট করুন
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

async function loadUserQuestions(userId) {
  const container = document.getElementById('user-questions');
  
  try {
    const { data, error } = await supabase
      .from('questions')
      .select(`
        *,
        question_tags (
          tags (name, slug)
        )
      `)
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    if (data.length === 0) {
      container.innerHTML = '<p class="text-gray-600 dark:text-gray-400">কোনো প্রশ্ন নেই</p>';
      return;
    }

    container.innerHTML = data.map(q => `
      <div class="border-b border-gray-200 dark:border-gray-700 py-3">
        <div class="flex gap-3 text-sm text-gray-600 dark:text-gray-400 mb-2">
          <span class="${q.votes > 0 ? 'text-green-600 dark:text-green-500' : q.votes < 0 ? 'text-red-600 dark:text-red-500' : ''}">${q.votes} ভোট</span>
          <span class="${q.is_answered ? 'text-green-600 dark:text-green-500' : ''}">${q.answer_count} উত্তর</span>
          <span>${formatNumber(q.views)} দর্শন</span>
        </div>
        <a href="/question.html?id=${q.id}" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
          ${escapeHtml(q.title)}
        </a>
        <div class="flex gap-2 mt-2">
          ${q.question_tags.map(qt => `
            <span class="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded">
              ${qt.tags.name}
            </span>
          `).join('')}
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">${timeAgo(q.created_at)}</div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading user questions:', error);
    container.innerHTML = '<p class="text-red-600 dark:text-red-400">প্রশ্ন লোড করতে সমস্যা হয়েছে</p>';
  }
}

async function loadUserAnswers(userId) {
  const container = document.getElementById('user-answers');
  
  try {
    const { data, error } = await supabase
      .from('answers')
      .select(`
        *,
        questions (id, title)
      `)
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    if (data.length === 0) {
      container.innerHTML = '<p class="text-gray-600 dark:text-gray-400">কোনো উত্তর নেই</p>';
      return;
    }

    container.innerHTML = data.map(a => `
      <div class="border-b border-gray-200 dark:border-gray-700 py-3">
        <div class="flex gap-3 text-sm text-gray-600 dark:text-gray-400 mb-2">
          <span class="${a.votes > 0 ? 'text-green-600 dark:text-green-500' : a.votes < 0 ? 'text-red-600 dark:text-red-500' : ''}">${a.votes} ভোট</span>
          ${a.is_accepted ? '<span class="text-green-600 dark:text-green-500">✓ গৃহীত</span>' : ''}
        </div>
        <a href="/question.html?id=${a.questions.id}" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
          ${escapeHtml(a.questions.title)}
        </a>
        <div class="text-sm text-gray-700 dark:text-gray-300 mt-2 line-clamp-2">
          ${a.body.substring(0, 150)}${a.body.length > 150 ? '...' : ''}
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">${timeAgo(a.created_at)}</div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading user answers:', error);
    container.innerHTML = '<p class="text-red-600 dark:text-red-400">উত্তর লোড করতে সমস্যা হয়েছে</p>';
  }
}

function showEditProfile() {
  const modal = document.getElementById('edit-modal');
  if (!modal || !profileUser) return;

  document.getElementById('edit-full-name').value = profileUser.full_name || '';
  document.getElementById('edit-bio').value = profileUser.bio || '';
  modal.classList.remove('hidden');
}

function hideEditProfile() {
  const modal = document.getElementById('edit-modal');
  if (modal) modal.classList.add('hidden');
}

async function saveProfile() {
  if (!currentUser || !profileUser || currentUser.id !== profileUser.id) return;

  const fullName = document.getElementById('edit-full-name').value.trim();
  const bio = document.getElementById('edit-bio').value.trim();

  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        bio: bio
      })
      .eq('id', currentUser.id);

    if (error) throw error;

    hideEditProfile();
    await loadProfile();
    alert('প্রোফাইল আপডেট হয়েছে!');
  } catch (error) {
    console.error('Error updating profile:', error);
    alert('প্রোফাইল আপডেট করতে সমস্যা হয়েছে');
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Tab switching
function switchTab(tab) {
  const questionsTab = document.getElementById('questions-tab');
  const answersTab = document.getElementById('answers-tab');
  const questionsContent = document.getElementById('questions-content');
  const answersContent = document.getElementById('answers-content');

  if (tab === 'questions') {
    questionsTab.classList.add('border-b-2', 'border-blue-600', 'text-blue-600');
    questionsTab.classList.remove('text-gray-600', 'dark:text-gray-400');
    answersTab.classList.remove('border-b-2', 'border-blue-600', 'text-blue-600');
    answersTab.classList.add('text-gray-600', 'dark:text-gray-400');
    questionsContent.classList.remove('hidden');
    answersContent.classList.add('hidden');
  } else {
    answersTab.classList.add('border-b-2', 'border-blue-600', 'text-blue-600');
    answersTab.classList.remove('text-gray-600', 'dark:text-gray-400');
    questionsTab.classList.remove('border-b-2', 'border-blue-600', 'text-blue-600');
    questionsTab.classList.add('text-gray-600', 'dark:text-gray-400');
    answersContent.classList.remove('hidden');
    questionsContent.classList.add('hidden');
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadProfile);
} else {
  loadProfile();
}
