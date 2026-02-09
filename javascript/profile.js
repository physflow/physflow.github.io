// Profile Page

let currentUserId = null;

async function loadProfile() {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user');
    
    if (!userId) {
        const currentUser = await getCurrentUser();
        if (currentUser) {
            window.location.href = `/profile.html?user=${currentUser.id}`;
        } else {
            window.location.href = '/index.html';
        }
        return;
    }
    
    currentUserId = userId;
    
    try {
        // Load user profile
        const profile = await getUserProfile(userId);
        if (!profile) {
            document.getElementById('profileContainer').innerHTML = '<div class="text-center py-8 text-red-500">User not found.</div>';
            return;
        }
        
        renderProfile(profile);
        
        // Load user's questions
        await loadUserQuestions(userId);
        
        // Load user's answers
        await loadUserAnswers(userId);
        
        // Check if viewing own profile
        const currentUser = await getCurrentUser();
        if (currentUser && currentUser.id === userId) {
            document.getElementById('editProfileBtn')?.classList.remove('hidden');
        }
        
    } catch (error) {
        console.error('Error loading profile:', error);
        document.getElementById('profileContainer').innerHTML = '<div class="text-center py-8 text-red-500">Error loading profile.</div>';
    }
}

function renderProfile(profile) {
    const profileHTML = `
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
            <div class="flex items-start gap-6">
                <img src="${profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.username)}&background=random&size=128`}" 
                    alt="${escapeHtml(profile.username)}" 
                    class="w-32 h-32 rounded-lg">
                <div class="flex-1">
                    <div class="flex items-start justify-between mb-4">
                        <div>
                            <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-1">${escapeHtml(profile.username)}</h1>
                            ${profile.full_name ? `<p class="text-gray-600 dark:text-gray-400">${escapeHtml(profile.full_name)}</p>` : ''}
                        </div>
                        <button id="editProfileBtn" onclick="showEditProfile()" class="hidden px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                            Edit Profile
                        </button>
                    </div>
                    
                    <div class="flex gap-6 mb-4">
                        <div>
                            <div class="text-2xl font-bold text-orange-600 dark:text-orange-400">${profile.reputation || 0}</div>
                            <div class="text-sm text-gray-500 dark:text-gray-400">reputation</div>
                        </div>
                        <div id="questionCount">
                            <div class="text-2xl font-bold text-gray-900 dark:text-white">0</div>
                            <div class="text-sm text-gray-500 dark:text-gray-400">questions</div>
                        </div>
                        <div id="answerCount">
                            <div class="text-2xl font-bold text-gray-900 dark:text-white">0</div>
                            <div class="text-sm text-gray-500 dark:text-gray-400">answers</div>
                        </div>
                    </div>
                    
                    ${profile.bio ? `<p class="text-gray-700 dark:text-gray-300">${escapeHtml(profile.bio)}</p>` : '<p class="text-gray-500 dark:text-gray-400 italic">No bio yet</p>'}
                    
                    <div class="mt-4 text-sm text-gray-500 dark:text-gray-400">
                        Member since ${formatDate(profile.created_at)}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('profileContainer').innerHTML = profileHTML;
}

async function loadUserQuestions(userId) {
    try {
        const { data: questions, error } = await supabase
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
        
        const questionCountEl = document.querySelector('#questionCount .text-2xl');
        if (questionCountEl) {
            questionCountEl.textContent = questions?.length || 0;
        }
        
        const container = document.getElementById('userQuestions');
        if (!container) return;
        
        if (!questions || questions.length === 0) {
            container.innerHTML = '<p class="text-center py-8 text-gray-500 dark:text-gray-400">No questions yet.</p>';
            return;
        }
        
        const questionsHTML = questions.map(q => `
            <div class="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 last:border-0">
                <h3 class="font-medium mb-2">
                    <a href="/question.html?id=${q.id}" class="text-blue-600 dark:text-blue-400 hover:text-blue-700">
                        ${escapeHtml(q.title)}
                    </a>
                </h3>
                <div class="flex gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>${q.votes || 0} votes</span>
                    <span>${q.answer_count || 0} answers</span>
                    <span>${q.views || 0} views</span>
                    <span class="ml-auto">${formatDate(q.created_at)}</span>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = questionsHTML;
        
    } catch (error) {
        console.error('Error loading user questions:', error);
    }
}

async function loadUserAnswers(userId) {
    try {
        const { data: answers, error } = await supabase
            .from('answers')
            .select(`
                *,
                questions (id, title)
            `)
            .eq('author_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        
        const answerCountEl = document.querySelector('#answerCount .text-2xl');
        if (answerCountEl) {
            answerCountEl.textContent = answers?.length || 0;
        }
        
        const container = document.getElementById('userAnswers');
        if (!container) return;
        
        if (!answers || answers.length === 0) {
            container.innerHTML = '<p class="text-center py-8 text-gray-500 dark:text-gray-400">No answers yet.</p>';
            return;
        }
        
        const answersHTML = answers.map(a => `
            <div class="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 last:border-0">
                ${a.is_accepted ? '<span class="inline-block px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs rounded mb-2">Accepted</span>' : ''}
                <h3 class="font-medium mb-2">
                    <a href="/question.html?id=${a.questions?.id}" class="text-blue-600 dark:text-blue-400 hover:text-blue-700">
                        ${escapeHtml(a.questions?.title || 'Question')}
                    </a>
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                    ${escapeHtml(a.body.substring(0, 150))}...
                </p>
                <div class="flex gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>${a.votes || 0} votes</span>
                    <span class="ml-auto">${formatDate(a.created_at)}</span>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = answersHTML;
        
    } catch (error) {
        console.error('Error loading user answers:', error);
    }
}

function showEditProfile() {
    const modal = document.getElementById('editProfileModal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    
    // Load current profile data
    getUserProfile(currentUserId).then(profile => {
        if (profile) {
            document.getElementById('editUsername').value = profile.username || '';
            document.getElementById('editFullName').value = profile.full_name || '';
            document.getElementById('editBio').value = profile.bio || '';
        }
    });
}

function hideEditProfile() {
    const modal = document.getElementById('editProfileModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

async function saveProfile() {
    const username = document.getElementById('editUsername').value.trim();
    const fullName = document.getElementById('editFullName').value.trim();
    const bio = document.getElementById('editBio').value.trim();
    
    if (!username) {
        showToast('Username is required', 'error');
        return;
    }
    
    try {
        const { error } = await supabase
            .from('profiles')
            .update({
                username: username,
                full_name: fullName,
                bio: bio
            })
            .eq('id', currentUserId);
        
        if (error) throw error;
        
        showToast('Profile updated successfully!', 'success');
        hideEditProfile();
        loadProfile();
        
    } catch (error) {
        console.error('Error updating profile:', error);
        showToast('Error updating profile', 'error');
    }
}

// Tab switching
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('border-orange-500', 'text-orange-600', 'dark:text-orange-400');
        btn.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400');
    });
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('border-orange-500', 'text-orange-600', 'dark:text-orange-400');
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById(`${tabName}Tab`)?.classList.remove('hidden');
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    loadProfile();
});
