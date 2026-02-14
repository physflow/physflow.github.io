// question.js - Individual question detail page functionality

import { supabase } from './supabase-config.js';

let currentQuestion = null;
let currentUser = null;
let answers = [];
let currentAnswerSort = 'votes';

// Initialize question page
export async function initQuestionPage() {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;

    // Get question ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const questionId = urlParams.get('id');

    if (!questionId) {
        window.location.href = 'index.html';
        return;
    }

    await loadQuestion(questionId);
    setupEventListeners();
}

// Setup event listeners
function setupEventListeners() {
    // Question voting
    const upvoteBtn = document.getElementById('question-upvote');
    const downvoteBtn = document.getElementById('question-downvote');
    
    if (upvoteBtn) {
        upvoteBtn.addEventListener('click', () => handleQuestionVote('upvote'));
    }
    if (downvoteBtn) {
        downvoteBtn.addEventListener('click', () => handleQuestionVote('downvote'));
    }

    // Bookmark
    const bookmarkBtn = document.getElementById('question-bookmark');
    if (bookmarkBtn) {
        bookmarkBtn.addEventListener('click', handleBookmark);
    }

    // Share button
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', handleShare);
    }

    // Answer sorting
    const answerSort = document.getElementById('answer-sort');
    if (answerSort) {
        answerSort.addEventListener('change', (e) => {
            currentAnswerSort = e.target.value;
            renderAnswers();
        });
    }

    // Submit answer
    const submitAnswerBtn = document.getElementById('submit-answer');
    if (submitAnswerBtn) {
        submitAnswerBtn.addEventListener('click', handleSubmitAnswer);
    }
}

// Load question details
async function loadQuestion(questionId) {
    const loading = document.getElementById('loading-state');
    const content = document.getElementById('question-content');

    try {
        // Increment view count
        await supabase.rpc('increment_view_count', { question_id: questionId });

        // Fetch question with related data
        const { data: question, error } = await supabase
            .from('question')
            .select(`
                *,
                profiles:user_id(username, avatar_url),
                category:category_id(name, name_bn),
                question_tag(
                    tag:tag_id(name, name_bn)
                )
            `)
            .eq('id', questionId)
            .single();

        if (error) throw error;

        currentQuestion = question;

        // Fetch answers
        await loadAnswers(questionId);

        // Render question
        renderQuestion(question);

        // Load related questions
        await loadRelatedQuestions(questionId);

        // Check user's vote status
        if (currentUser) {
            await checkUserVoteStatus(questionId);
            await checkUserBookmarkStatus(questionId);
        }

        loading.classList.add('hidden');
        content.classList.remove('hidden');

    } catch (error) {
        console.error('Error loading question:', error);
        loading.innerHTML = `
            <div class="text-center text-red-600">
                <i class="fas fa-exclamation-circle text-4xl mb-2"></i>
                <p>প্রশ্ন লোড করতে সমস্যা হয়েছে</p>
            </div>
        `;
    }
}

// Render question
function renderQuestion(question) {
    // Title
    document.getElementById('question-title').textContent = question.title;

    // Time
    document.getElementById('question-time').textContent = getTimeAgo(question.created_at);

    // Views
    document.getElementById('question-views').textContent = question.view_count || 0;

    // Votes
    const votes = (question.upvote || 0) - (question.downvote || 0);
    document.getElementById('question-votes').textContent = votes;

    // Description
    const descriptionEl = document.getElementById('question-description');
    descriptionEl.innerHTML = formatContent(question.description || '');

    // Category
    const categoryEl = document.getElementById('question-category');
    categoryEl.textContent = question.category?.name_bn || question.category?.name || 'অন্যান্য';

    // Tags
    const tagsContainer = document.getElementById('question-tags');
    const tags = question.question_tag?.map(qt => qt.tag) || [];
    tagsContainer.innerHTML = tags.map(tag => `
        <a href="questions.html?tag=${encodeURIComponent(tag.name)}" 
           class="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition">
            ${escapeHtml(tag.name_bn || tag.name)}
        </a>
    `).join('');

    // Author info
    const authorAvatar = document.getElementById('author-avatar');
    const authorUsername = document.getElementById('author-username');
    
    authorAvatar.src = question.profiles?.avatar_url || 'https://via.placeholder.com/40';
    authorAvatar.alt = question.profiles?.username || 'User';
    authorUsername.textContent = question.profiles?.username || 'Anonymous';
    authorUsername.href = `profile.html?user=${question.profiles?.username}`;

    // Show edit button if current user is author
    if (currentUser && currentUser.id === question.user_id) {
        document.getElementById('edit-btn').classList.remove('hidden');
    }

    // Update page title
    document.title = `${question.title} - physflow`;
}

// Load answers
async function loadAnswers(questionId) {
    try {
        const { data, error } = await supabase
            .from('answer')
            .select(`
                *,
                profiles:user_id(username, avatar_url)
            `)
            .eq('question_id', questionId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        answers = data.map(a => ({
            ...a,
            votes: (a.upvote || 0) - (a.downvote || 0)
        }));

        renderAnswers();

    } catch (error) {
        console.error('Error loading answers:', error);
    }
}

// Render answers
function renderAnswers() {
    const answersList = document.getElementById('answers-list');
    const answerCount = document.getElementById('answer-count');

    if (!answersList) return;

    // Update answer count
    answerCount.textContent = answers.length;

    // Sort answers
    let sortedAnswers = [...answers];
    switch (currentAnswerSort) {
        case 'votes':
            sortedAnswers.sort((a, b) => b.votes - a.votes);
            break;
        case 'newest':
            sortedAnswers.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
        case 'oldest':
            sortedAnswers.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            break;
    }

    // Show accepted answer first if exists
    const acceptedAnswer = sortedAnswers.find(a => a.is_accepted);
    if (acceptedAnswer) {
        sortedAnswers = [acceptedAnswer, ...sortedAnswers.filter(a => !a.is_accepted)];
    }

    if (sortedAnswers.length === 0) {
        answersList.innerHTML = `
            <div class="p-8 text-center text-gray-500 dark:text-gray-400">
                <i class="far fa-comment-dots text-4xl mb-2"></i>
                <p>এখনও কোন উত্তর নেই</p>
                <p class="text-sm mt-1">প্রথম উত্তর দিন!</p>
            </div>
        `;
        return;
    }

    answersList.innerHTML = sortedAnswers.map(answer => createAnswerCard(answer)).join('');
    addAnswerVoteListeners();
}

// Create answer card
function createAnswerCard(answer) {
    const timeAgo = getTimeAgo(answer.created_at);
    const isAccepted = answer.is_accepted;
    const isAuthor = currentUser && currentUser.id === answer.user_id;
    const isQuestionAuthor = currentUser && currentUser.id === currentQuestion.user_id;

    return `
        <div class="border-b dark:border-gray-700 last:border-0">
            <div class="flex gap-4 p-6 ${isAccepted ? 'bg-green-50 dark:bg-green-900/10' : ''}">
                
                <!-- Vote Section -->
                <div class="flex flex-col items-center gap-2 text-gray-600 dark:text-gray-400">
                    <button class="answer-vote-btn hover:text-orange-500 transition p-1" data-answer-id="${answer.id}" data-action="upvote">
                        <i class="fas fa-arrow-up text-xl"></i>
                    </button>
                    <span class="font-semibold answer-vote-count">${answer.votes}</span>
                    <button class="answer-vote-btn hover:text-blue-500 transition p-1" data-answer-id="${answer.id}" data-action="downvote">
                        <i class="fas fa-arrow-down text-xl"></i>
                    </button>
                    ${isQuestionAuthor && !isAccepted ? `
                        <button class="mt-2 text-gray-400 hover:text-green-500 transition" onclick="acceptAnswer('${answer.id}')" title="সঠিক উত্তর হিসেবে চিহ্নিত করুন">
                            <i class="far fa-check-circle text-2xl"></i>
                        </button>
                    ` : ''}
                    ${isAccepted ? `
                        <div class="mt-2 text-green-500" title="সঠিক উত্তর">
                            <i class="fas fa-check-circle text-2xl"></i>
                        </div>
                    ` : ''}
                </div>

                <!-- Answer Content -->
                <div class="flex-1 min-w-0">
                    ${isAccepted ? `
                        <div class="mb-3 text-sm text-green-600 dark:text-green-400 font-medium">
                            <i class="fas fa-check-circle mr-1"></i>সঠিক উত্তর
                        </div>
                    ` : ''}
                    
                    <div class="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 mb-4">
                        ${formatContent(answer.content)}
                    </div>

                    <!-- Answer Meta -->
                    <div class="flex items-center justify-between mt-4">
                        <div class="flex items-center gap-3">
                            <img src="${answer.profiles?.avatar_url || 'https://via.placeholder.com/40'}" 
                                 alt="${answer.profiles?.username || 'User'}" 
                                 class="w-8 h-8 rounded-lg object-cover border-2 border-gray-300 dark:border-gray-600">
                            <div>
                                <a href="profile.html?user=${answer.profiles?.username}" 
                                   class="text-sm font-medium text-gray-800 dark:text-gray-100 hover:text-brand-600 transition">
                                    ${escapeHtml(answer.profiles?.username || 'Anonymous')}
                                </a>
                                <p class="text-xs text-gray-500 dark:text-gray-400">${timeAgo}</p>
                            </div>
                        </div>
                        ${isAuthor ? `
                            <button class="text-sm text-gray-600 dark:text-gray-400 hover:text-brand-600 transition">
                                <i class="fas fa-edit mr-1"></i>সম্পাদনা
                            </button>
                        ` : ''}
                    </div>
                </div>

            </div>
        </div>
    `;
}

// Add answer vote listeners
function addAnswerVoteListeners() {
    const voteButtons = document.querySelectorAll('.answer-vote-btn');
    voteButtons.forEach(btn => {
        btn.addEventListener('click', handleAnswerVote);
    });
}

// Handle question vote
async function handleQuestionVote(action) {
    if (!currentUser) {
        alert('ভোট দিতে লগ ইন করুন');
        return;
    }

    try {
        const { data: existingVote } = await supabase
            .from('question_vote')
            .select('*')
            .eq('question_id', currentQuestion.id)
            .eq('user_id', currentUser.id)
            .single();

        if (existingVote) {
            if (existingVote.vote_type === action) {
                // Remove vote
                await supabase
                    .from('question_vote')
                    .delete()
                    .eq('id', existingVote.id);

                await supabase
                    .from('question')
                    .update({ [action]: supabase.sql`${action} - 1` })
                    .eq('id', currentQuestion.id);
            } else {
                // Change vote
                await supabase
                    .from('question_vote')
                    .update({ vote_type: action })
                    .eq('id', existingVote.id);

                const increment = action === 'upvote' ? 'upvote' : 'downvote';
                const decrement = action === 'upvote' ? 'downvote' : 'upvote';

                await supabase
                    .from('question')
                    .update({
                        [increment]: supabase.sql`${increment} + 1`,
                        [decrement]: supabase.sql`${decrement} - 1`
                    })
                    .eq('id', currentQuestion.id);
            }
        } else {
            // New vote
            await supabase
                .from('question_vote')
                .insert({
                    question_id: currentQuestion.id,
                    user_id: currentUser.id,
                    vote_type: action
                });

            await supabase
                .from('question')
                .update({ [action]: supabase.sql`${action} + 1` })
                .eq('id', currentQuestion.id);
        }

        // Refresh question
        await loadQuestion(currentQuestion.id);

    } catch (error) {
        console.error('Error voting:', error);
        alert('ভোট দিতে সমস্যা হয়েছে');
    }
}

// Handle answer vote
async function handleAnswerVote(e) {
    e.preventDefault();

    if (!currentUser) {
        alert('ভোট দিতে লগ ইন করুন');
        return;
    }

    const button = e.currentTarget;
    const answerId = button.dataset.answerId;
    const action = button.dataset.action;

    try {
        const { data: existingVote } = await supabase
            .from('answer_vote')
            .select('*')
            .eq('answer_id', answerId)
            .eq('user_id', currentUser.id)
            .single();

        if (existingVote) {
            if (existingVote.vote_type === action) {
                await supabase
                    .from('answer_vote')
                    .delete()
                    .eq('id', existingVote.id);

                await supabase
                    .from('answer')
                    .update({ [action]: supabase.sql`${action} - 1` })
                    .eq('id', answerId);
            } else {
                await supabase
                    .from('answer_vote')
                    .update({ vote_type: action })
                    .eq('id', existingVote.id);

                const increment = action === 'upvote' ? 'upvote' : 'downvote';
                const decrement = action === 'upvote' ? 'downvote' : 'upvote';

                await supabase
                    .from('answer')
                    .update({
                        [increment]: supabase.sql`${increment} + 1`,
                        [decrement]: supabase.sql`${decrement} - 1`
                    })
                    .eq('id', answerId);
            }
        } else {
            await supabase
                .from('answer_vote')
                .insert({
                    answer_id: answerId,
                    user_id: currentUser.id,
                    vote_type: action
                });

            await supabase
                .from('answer')
                .update({ [action]: supabase.sql`${action} + 1` })
                .eq('id', answerId);
        }

        await loadAnswers(currentQuestion.id);

    } catch (error) {
        console.error('Error voting answer:', error);
        alert('ভোট দিতে সমস্যা হয়েছে');
    }
}

// Handle bookmark
async function handleBookmark() {
    if (!currentUser) {
        alert('সংরক্ষণ করতে লগ ইন করুন');
        return;
    }

    try {
        const { data: existing } = await supabase
            .from('bookmark')
            .select('*')
            .eq('question_id', currentQuestion.id)
            .eq('user_id', currentUser.id)
            .single();

        const bookmarkBtn = document.getElementById('question-bookmark');
        const icon = bookmarkBtn.querySelector('i');

        if (existing) {
            await supabase
                .from('bookmark')
                .delete()
                .eq('id', existing.id);
            
            icon.classList.remove('fas');
            icon.classList.add('far');
        } else {
            await supabase
                .from('bookmark')
                .insert({
                    question_id: currentQuestion.id,
                    user_id: currentUser.id
                });
            
            icon.classList.remove('far');
            icon.classList.add('fas');
        }

    } catch (error) {
        console.error('Error bookmarking:', error);
    }
}

// Handle submit answer
async function handleSubmitAnswer() {
    if (!currentUser) {
        alert('উত্তর দিতে লগ ইন করুন');
        return;
    }

    const answerInput = document.getElementById('answer-input');
    const content = answerInput.value.trim();

    if (!content) {
        alert('উত্তর লিখুন');
        return;
    }

    try {
        const { error } = await supabase
            .from('answer')
            .insert({
                question_id: currentQuestion.id,
                user_id: currentUser.id,
                content: content
            });

        if (error) throw error;

        // Update answer count
        await supabase
            .from('question')
            .update({ answer_count: supabase.sql`answer_count + 1` })
            .eq('id', currentQuestion.id);

        answerInput.value = '';
        await loadAnswers(currentQuestion.id);
        alert('উত্তর সফলভাবে যোগ হয়েছে!');

    } catch (error) {
        console.error('Error submitting answer:', error);
        alert('উত্তর যোগ করতে সমস্যা হয়েছে');
    }
}

// Handle share
function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
        navigator.share({
            title: currentQuestion.title,
            url: url
        });
    } else {
        navigator.clipboard.writeText(url);
        alert('লিংক কপি হয়েছে!');
    }
}

// Load related questions
async function loadRelatedQuestions(questionId) {
    try {
        const { data, error } = await supabase
            .from('question')
            .select('id, title, view_count')
            .neq('id', questionId)
            .limit(5)
            .order('view_count', { ascending: false });

        if (error) throw error;

        const relatedContainer = document.getElementById('related-questions');
        if (relatedContainer && data.length > 0) {
            relatedContainer.innerHTML = data.map(q => `
                <a href="question.html?id=${q.id}" 
                   class="block text-sm text-gray-700 dark:text-gray-300 hover:text-brand-600 transition line-clamp-2">
                    ${escapeHtml(q.title)}
                </a>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading related questions:', error);
    }
}

// Check user vote status
async function checkUserVoteStatus(questionId) {
    try {
        const { data } = await supabase
            .from('question_vote')
            .select('vote_type')
            .eq('question_id', questionId)
            .eq('user_id', currentUser.id)
            .single();

        if (data) {
            const upvoteBtn = document.getElementById('question-upvote');
            const downvoteBtn = document.getElementById('question-downvote');

            if (data.vote_type === 'upvote') {
                upvoteBtn.classList.add('text-orange-500');
            } else {
                downvoteBtn.classList.add('text-blue-500');
            }
        }
    } catch (error) {
        // No vote found
    }
}

// Check user bookmark status
async function checkUserBookmarkStatus(questionId) {
    try {
        const { data } = await supabase
            .from('bookmark')
            .select('*')
            .eq('question_id', questionId)
            .eq('user_id', currentUser.id)
            .single();

        if (data) {
            const bookmarkBtn = document.getElementById('question-bookmark');
            const icon = bookmarkBtn.querySelector('i');
            icon.classList.remove('far');
            icon.classList.add('fas');
        }
    } catch (error) {
        // No bookmark found
    }
}

// Accept answer (global function for onclick)
window.acceptAnswer = async function(answerId) {
    if (!currentUser || currentUser.id !== currentQuestion.user_id) {
        alert('শুধুমাত্র প্রশ্নকর্তা উত্তর গ্রহণ করতে পারবেন');
        return;
    }

    try {
        // Remove previous accepted answer
        await supabase
            .from('answer')
            .update({ is_accepted: false })
            .eq('question_id', currentQuestion.id);

        // Set new accepted answer
        await supabase
            .from('answer')
            .update({ is_accepted: true })
            .eq('id', answerId);

        await loadAnswers(currentQuestion.id);
        alert('উত্তর গৃহীত হয়েছে!');

    } catch (error) {
        console.error('Error accepting answer:', error);
        alert('উত্তর গ্রহণ করতে সমস্যা হয়েছে');
    }
};

// Utility functions
function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    const intervals = {
        'বছর': 31536000,
        'মাস': 2592000,
        'সপ্তাহ': 604800,
        'দিন': 86400,
        'ঘণ্টা': 3600,
        'মিনিট': 60,
        'সেকেন্ড': 1
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit} আগে`;
        }
    }

    return 'এখনই';
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function formatContent(content) {
    // Simple formatting: convert line breaks to <br> and preserve paragraphs
    return content
        .split('\n\n')
        .map(para => `<p>${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
        .join('');
}
