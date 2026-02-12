// question.js - Question Detail Page Logic

import { supabase } from './supabase-config.js';

// Global state
let currentQuestion = null;
let currentUser = null;
let allAnswers = [];
let displayedAnswers = 5;
let userVotes = {
    question: null,
    answers: {}
};

/**
 * Initialize the question page
 */
export async function initQuestionPage() {
    // Get current user
    currentUser = await getCurrentUser();
    
    // Extract slug from URL
    const slug = extractSlugFromURL();
    
    if (!slug) {
        showError();
        return;
    }

    // Fetch and display question
    await loadQuestion(slug);
}

/**
 * Get current user from Supabase
 */
async function getCurrentUser() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    } catch (error) {
        console.error('Error getting user:', error);
        return null;
    }
}

/**
 * Extract slug from URL path
 */
function extractSlugFromURL() {
    const path = window.location.pathname;
    const match = path.match(/\/question\/([^\/]+)/);
    
    if (match && match[1]) {
        return decodeURIComponent(match[1]);
    }
    
    return null;
}

/**
 * Load question from database
 */
async function loadQuestion(slug) {
    try {
        // Show loading skeleton
        showLoading();

        // Fetch question with author info
        const { data: question, error } = await supabase
            .from('question')
            .select(`
                *,
                author:profiles!question_author_id_fkey(
                    id,
                    username,
                    avatar_url
                )
            `)
            .eq('slug', slug)
            .single();

        if (error || !question) {
            throw new Error('Question not found');
        }

        currentQuestion = question;

        // Update view count
        await incrementViewCount(question.id);

        // Load user votes if logged in
        if (currentUser) {
            await loadUserVotes(question.id);
        }

        // Display question
        displayQuestion(question);

        // Load answers
        await loadAnswers(question.id);

        // Load related question
        await loadRelatedQuestion(question.tags);

        // Update SEO
        updateSEO(question);

        // Hide loading, show content
        hideLoading();

    } catch (error) {
        console.error('Error loading question:', error);
        showError();
    }
}

/**
 * Increment view count for question
 */
async function incrementViewCount(questionId) {
    try {
        const { data: question } = await supabase
            .from('question')
            .select('views')
            .eq('id', questionId)
            .single();

        if (question) {
            await supabase
                .from('question')
                .update({ views: (question.views || 0) + 1 })
                .eq('id', questionId);
        }
    } catch (error) {
        console.error('Error incrementing view count:', error);
    }
}

/**
 * Load user's votes
 */
async function loadUserVotes(questionId) {
    try {
        // Load question vote
        const { data: questionVote } = await supabase
            .from('question_votes')
            .select('vote_type')
            .eq('question_id', questionId)
            .eq('user_id', currentUser.id)
            .single();

        if (questionVote) {
            userVotes.question = questionVote.vote_type;
        }

        // Load answer votes
        const { data: answerVotes } = await supabase
            .from('answer_votes')
            .select('answer_id, vote_type')
            .eq('user_id', currentUser.id);

        if (answerVotes) {
            answerVotes.forEach(vote => {
                userVotes.answers[vote.answer_id] = vote.vote_type;
            });
        }

    } catch (error) {
        console.error('Error loading user votes:', error);
    }
}

/**
 * Display question on page
 */
function displayQuestion(question) {
    // Title
    document.getElementById('question-title').textContent = question.title;

    // Author info
    const authorAvatar = document.getElementById('author-avatar');
    const authorName = document.getElementById('author-name');
    
    if (question.author) {
        authorAvatar.src = question.author.avatar_url || 'https://via.placeholder.com/40';
        authorName.textContent = question.author.username || 'অজ্ঞাত ব্যবহারকারী';
    }

    // Date
    document.getElementById('question-date').textContent = formatDate(question.created_at);

    // View count
    document.getElementById('view-count').textContent = formatNumber(question.views || 0);

    // Tags
    displayTags(question.tags);

    // Body (render markdown)
    const bodyHTML = renderMarkdown(question.body);
    document.getElementById('question-body').innerHTML = bodyHTML;

    // Votes
    document.getElementById('question-votes').textContent = question.votes || 0;
    
    // Update vote button states
    if (userVotes.question === 'up') {
        document.getElementById('upvote-question').classList.add('voted', 'text-green-500');
    } else if (userVotes.question === 'down') {
        document.getElementById('downvote-question').classList.add('voted', 'text-red-500');
    }

    // Breadcrumb
    document.getElementById('breadcrumb-title').textContent = question.title.substring(0, 50) + '...';
    document.getElementById('breadcrumb').classList.remove('hidden');

    // Setup event listeners
    setupQuestionEventListeners(question.id);
}

/**
 * Display tags
 */
function displayTags(tags) {
    const tagsContainer = document.getElementById('question-tags');
    tagsContainer.innerHTML = '';

    if (!tags || tags.length === 0) return;

    tags.forEach(tag => {
        const tagEl = document.createElement('a');
        tagEl.href = `tags.html?tag=${encodeURIComponent(tag)}`;
        tagEl.className = 'tag';
        tagEl.textContent = tag;
        tagsContainer.appendChild(tagEl);
    });
}

/**
 * Setup question event listeners
 */
function setupQuestionEventListeners(questionId) {
    // Upvote
    document.getElementById('upvote-question').addEventListener('click', () => {
        handleQuestionVote(questionId, 'up');
    });

    // Downvote
    document.getElementById('downvote-question').addEventListener('click', () => {
        handleQuestionVote(questionId, 'down');
    });

    // Share
    document.getElementById('share-btn').addEventListener('click', () => {
        shareQuestion();
    });

    // Submit answer
    document.getElementById('submit-answer').addEventListener('click', () => {
        submitAnswer(questionId);
    });

    // Show/hide answer editor based on auth
    if (currentUser) {
        document.getElementById('answer-editor').classList.remove('hidden');
        document.getElementById('login-prompt').classList.add('hidden');
    } else {
        document.getElementById('answer-editor').classList.add('hidden');
        document.getElementById('login-prompt').classList.remove('hidden');
    }
}

/**
 * Handle question voting
 */
async function handleQuestionVote(questionId, voteType) {
    if (!currentUser) {
        showToast('ভোট দিতে লগ ইন করুন', 'error');
        return;
    }

    try {
        const currentVote = userVotes.question;
        let newVote = voteType;

        // If clicking same vote, remove it
        if (currentVote === voteType) {
            newVote = null;
        }

        // Update in database
        if (newVote === null) {
            // Delete vote
            await supabase
                .from('question_votes')
                .delete()
                .eq('question_id', questionId)
                .eq('user_id', currentUser.id);
        } else {
            // Upsert vote
            await supabase
                .from('question_votes')
                .upsert({
                    question_id: questionId,
                    user_id: currentUser.id,
                    vote_type: newVote
                });
        }

        // Calculate vote delta
        let voteDelta = 0;
        if (currentVote === 'up' && newVote === 'down') voteDelta = -2;
        else if (currentVote === 'down' && newVote === 'up') voteDelta = 2;
        else if (currentVote === 'up' && newVote === null) voteDelta = -1;
        else if (currentVote === 'down' && newVote === null) voteDelta = 1;
        else if (currentVote === null && newVote === 'up') voteDelta = 1;
        else if (currentVote === null && newVote === 'down') voteDelta = -1;

        // Update question votes
        const currentVotes = parseInt(document.getElementById('question-votes').textContent);
        const newVotes = currentVotes + voteDelta;
        
        await supabase
            .from('question')
            .update({ votes: newVotes })
            .eq('id', questionId);

        // Update UI
        document.getElementById('question-votes').textContent = newVotes;
        userVotes.question = newVote;

        // Update button states
        const upBtn = document.getElementById('upvote-question');
        const downBtn = document.getElementById('downvote-question');
        
        upBtn.classList.remove('voted', 'text-green-500');
        downBtn.classList.remove('voted', 'text-red-500');

        if (newVote === 'up') {
            upBtn.classList.add('voted', 'text-green-500');
        } else if (newVote === 'down') {
            downBtn.classList.add('voted', 'text-red-500');
        }

    } catch (error) {
        console.error('Error voting:', error);
        showToast('ভোট দিতে সমস্যা হয়েছে', 'error');
    }
}

/**
 * Share question
 */
function shareQuestion() {
    const url = window.location.href;
    
    if (navigator.share) {
        navigator.share({
            title: currentQuestion.title,
            url: url
        });
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(url);
        showToast('লিংক কপি হয়েছে', 'success');
    }
}

/**
 * Load answers for question
 */
async function loadAnswers(questionId) {
    try {
        const { data: answers, error } = await supabase
            .from('answers')
            .select(`
                *,
                author:profiles!answers_user_id_fkey(
                    id,
                    username,
                    avatar_url
                )
            `)
            .eq('question_id', questionId)
            .order('is_accepted', { ascending: false })
            .order('votes', { ascending: false })
            .order('created_at', { ascending: true });

        if (error) throw error;

        allAnswers = answers || [];
        
        // Update answer count
        document.getElementById('answer-count').textContent = allAnswers.length;

        // Display first batch
        displayAnswers();

    } catch (error) {
        console.error('Error loading answers:', error);
    }
}

/**
 * Display answers
 */
function displayAnswers() {
    const answersList = document.getElementById('answers-list');
    answersList.innerHTML = '';

    const answersToShow = allAnswers.slice(0, displayedAnswers);

    answersToShow.forEach(answer => {
        const answerCard = createAnswerCard(answer);
        answersList.appendChild(answerCard);
    });

    // Show/hide load more button
    const loadMoreBtn = document.getElementById('load-more-answers');
    if (allAnswers.length > displayedAnswers) {
        loadMoreBtn.classList.remove('hidden');
        loadMoreBtn.onclick = () => {
            displayedAnswers += 5;
            displayAnswers();
        };
    } else {
        loadMoreBtn.classList.add('hidden');
    }
}

/**
 * Create answer card element
 */
function createAnswerCard(answer) {
    const card = document.createElement('div');
    card.className = `answer-card bg-white dark:bg-[#1a1a1b] border border-gray-200 dark:border-gray-700 rounded-lg p-6 ${answer.is_accepted ? 'answer-accepted' : ''}`;
    
    const bodyHTML = renderMarkdown(answer.body);
    const isCollapsible = answer.body.length > 1000;
    
    card.innerHTML = `
        <div class="flex gap-4">
            <!-- Vote Section -->
            <div class="flex flex-col items-center gap-2 shrink-0">
                <button class="vote-btn upvote-answer text-2xl text-gray-400 hover:text-green-500 ${userVotes.answers[answer.id] === 'up' ? 'voted text-green-500' : ''}" data-answer-id="${answer.id}">
                    <i class="fas fa-chevron-up"></i>
                </button>
                <span class="answer-votes text-xl font-bold">${answer.votes || 0}</span>
                <button class="vote-btn downvote-answer text-2xl text-gray-400 hover:text-red-500 ${userVotes.answers[answer.id] === 'down' ? 'voted text-red-500' : ''}" data-answer-id="${answer.id}">
                    <i class="fas fa-chevron-down"></i>
                </button>
                ${answer.is_accepted ? '<i class="fas fa-check-circle text-2xl text-green-500 mt-2" title="গৃহীত উত্তর"></i>' : ''}
                ${currentUser && currentQuestion.author_id === currentUser.id && !answer.is_accepted ? 
                    `<button class="accept-answer text-gray-400 hover:text-green-500 mt-2" data-answer-id="${answer.id}" title="উত্তর গ্রহণ করুন">
                        <i class="far fa-check-circle text-2xl"></i>
                    </button>` : ''
                }
            </div>

            <!-- Content -->
            <div class="flex-1">
                <div class="answer-body prose dark:prose-invert max-w-none ${isCollapsible ? 'answer-collapsed' : ''}" data-answer-id="${answer.id}">
                    ${bodyHTML}
                </div>
                
                ${isCollapsible ? `
                    <button class="expand-answer text-sm text-brand-600 hover:text-brand-700 mt-2" data-answer-id="${answer.id}">
                        আরো দেখুন
                    </button>
                ` : ''}

                <!-- Author & Date -->
                <div class="flex items-center gap-4 mt-6 pt-4 border-t dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
                    <div class="flex items-center gap-2">
                        <img src="${answer.author?.avatar_url || 'https://via.placeholder.com/32'}" class="w-8 h-8 rounded-full" alt="">
                        <span class="font-medium">${answer.author?.username || 'অজ্ঞাত'}</span>
                    </div>
                    <span>•</span>
                    <span>${formatDate(answer.created_at)}</span>
                </div>
            </div>
        </div>
    `;

    // Setup event listeners
    setupAnswerEventListeners(card, answer);

    return card;
}

/**
 * Setup answer event listeners
 */
function setupAnswerEventListeners(card, answer) {
    // Upvote
    const upvoteBtn = card.querySelector('.upvote-answer');
    upvoteBtn?.addEventListener('click', () => handleAnswerVote(answer.id, 'up'));

    // Downvote
    const downvoteBtn = card.querySelector('.downvote-answer');
    downvoteBtn?.addEventListener('click', () => handleAnswerVote(answer.id, 'down'));

    // Accept answer
    const acceptBtn = card.querySelector('.accept-answer');
    acceptBtn?.addEventListener('click', () => acceptAnswer(answer.id));

    // Expand/collapse
    const expandBtn = card.querySelector('.expand-answer');
    const answerBody = card.querySelector('.answer-body');
    
    if (expandBtn && answerBody) {
        expandBtn.addEventListener('click', () => {
            answerBody.classList.toggle('answer-collapsed');
            expandBtn.textContent = answerBody.classList.contains('answer-collapsed') ? 'আরো দেখুন' : 'কম দেখুন';
        });
    }
}

/**
 * Handle answer voting
 */
async function handleAnswerVote(answerId, voteType) {
    if (!currentUser) {
        showToast('ভোট দিতে লগ ইন করুন', 'error');
        return;
    }

    try {
        const currentVote = userVotes.answers[answerId];
        let newVote = voteType;

        // If clicking same vote, remove it
        if (currentVote === voteType) {
            newVote = null;
        }

        // Update in database
        if (newVote === null) {
            await supabase
                .from('answer_votes')
                .delete()
                .eq('answer_id', answerId)
                .eq('user_id', currentUser.id);
        } else {
            await supabase
                .from('answer_votes')
                .upsert({
                    answer_id: answerId,
                    user_id: currentUser.id,
                    vote_type: newVote
                });
        }

        // Calculate vote delta
        let voteDelta = 0;
        if (currentVote === 'up' && newVote === 'down') voteDelta = -2;
        else if (currentVote === 'down' && newVote === 'up') voteDelta = 2;
        else if (currentVote === 'up' && newVote === null) voteDelta = -1;
        else if (currentVote === 'down' && newVote === null) voteDelta = 1;
        else if (currentVote === null && newVote === 'up') voteDelta = 1;
        else if (currentVote === null && newVote === 'down') voteDelta = -1;

        // Find answer in array
        const answerIndex = allAnswers.findIndex(a => a.id === answerId);
        if (answerIndex !== -1) {
            allAnswers[answerIndex].votes = (allAnswers[answerIndex].votes || 0) + voteDelta;
        }

        // Update answer votes in database
        await supabase
            .from('answers')
            .update({ votes: allAnswers[answerIndex].votes })
            .eq('id', answerId);

        // Update UI
        userVotes.answers[answerId] = newVote;
        
        // Re-render answers
        displayAnswers();

    } catch (error) {
        console.error('Error voting:', error);
        showToast('ভোট দিতে সমস্যা হয়েছে', 'error');
    }
}

/**
 * Accept answer
 */
async function acceptAnswer(answerId) {
    if (!currentUser || currentQuestion.author_id !== currentUser.id) {
        showToast('শুধুমাত্র প্রশ্নকর্তা উত্তর গ্রহণ করতে পারেন', 'error');
        return;
    }

    try {
        // Unaccept all other answers first
        await supabase
            .from('answers')
            .update({ is_accepted: false })
            .eq('question_id', currentQuestion.id);

        // Accept this answer
        await supabase
            .from('answers')
            .update({ is_accepted: true })
            .eq('id', answerId);

        // Update local state
        allAnswers.forEach(a => {
            a.is_accepted = a.id === answerId;
        });

        // Re-render
        displayAnswers();

        showToast('উত্তর গৃহীত হয়েছে', 'success');

    } catch (error) {
        console.error('Error accepting answer:', error);
        showToast('সমস্যা হয়েছে', 'error');
    }
}

/**
 * Submit new answer
 */
async function submitAnswer(questionId) {
    if (!currentUser) {
        showToast('উত্তর দিতে লগ ইন করুন', 'error');
        return;
    }

    const textarea = document.getElementById('answer-textarea');
    const body = textarea.value.trim();

    if (body.length < 30) {
        showToast('উত্তর কমপক্ষে ৩০ অক্ষরের হতে হবে', 'error');
        return;
    }

    try {
        const submitBtn = document.getElementById('submit-answer');
        submitBtn.disabled = true;
        submitBtn.textContent = 'পোস্ট হচ্ছে...';

        // Insert answer
        const { data: newAnswer, error } = await supabase
            .from('answers')
            .insert({
                question_id: questionId,
                user_id: currentUser.id,
                body: body,
                votes: 0,
                is_accepted: false
            })
            .select(`
                *,
                author:profiles!answers_user_id_fkey(
                    id,
                    username,
                    avatar_url
                )
            `)
            .single();

        if (error) throw error;

        // Add to local array
        allAnswers.push(newAnswer);

        // Clear textarea
        textarea.value = '';

        // Re-render
        displayAnswers();

        // Update count
        document.getElementById('answer-count').textContent = allAnswers.length;

        showToast('উত্তর পোস্ট হয়েছে', 'success');

    } catch (error) {
        console.error('Error submitting answer:', error);
        showToast('উত্তর পোস্ট করতে সমস্যা হয়েছে', 'error');
    } finally {
        const submitBtn = document.getElementById('submit-answer');
        submitBtn.disabled = false;
        submitBtn.textContent = 'উত্তর পোস্ট করুন';
    }
}

/**
 * Load related question
 */
async function loadRelatedQuestion(tags) {
    if (!tags || tags.length === 0) return;

    try {
        const { data: related, error } = await supabase
            .from('question')
            .select('id, title, slug, views')
            .contains('tags', tags)
            .neq('id', currentQuestion.id)
            .order('views', { ascending: false })
            .limit(5);

        if (error || !related || related.length === 0) return;

        const relatedList = document.getElementById('related-list');
        relatedList.innerHTML = '';

        related.forEach(q => {
            const link = document.createElement('a');
            link.href = `/question/${q.slug}`;
            link.className = 'block p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition';
            link.innerHTML = `
                <div class="text-sm font-medium text-gray-800 dark:text-gray-200">${q.title}</div>
                <div class="text-xs text-gray-500 mt-1">${formatNumber(q.views || 0)} বার দেখা হয়েছে</div>
            `;
            relatedList.appendChild(link);
        });

        document.getElementById('related-question').classList.remove('hidden');

    } catch (error) {
        console.error('Error loading related question:', error);
    }
}

/**
 * Update SEO meta tags
 */
function updateSEO(question) {
    // Title
    document.getElementById('page-title').textContent = `${question.title} - physflow`;
    
    // Description
    const description = question.body.substring(0, 150).replace(/[#*`]/g, '') + '...';
    document.getElementById('page-description').content = description;
    
    // OG tags
    document.getElementById('og-title').content = question.title;
    document.getElementById('og-description').content = description;
    
    const url = window.location.href;
    document.getElementById('og-url').content = url;
    document.getElementById('canonical-url').href = url;

    // Schema.org markup
    const schema = {
        "@context": "https://schema.org",
        "@type": "QAPage",
        "mainEntity": {
            "@type": "Question",
            "name": question.title,
            "text": question.body,
            "answerCount": allAnswers.length,
            "dateCreated": question.created_at,
            "author": {
                "@type": "Person",
                "name": question.author?.username || "Anonymous"
            }
        }
    };

    if (allAnswers.length > 0) {
        const acceptedAnswer = allAnswers.find(a => a.is_accepted);
        if (acceptedAnswer) {
            schema.mainEntity.acceptedAnswer = {
                "@type": "Answer",
                "text": acceptedAnswer.body,
                "dateCreated": acceptedAnswer.created_at,
                "upvoteCount": acceptedAnswer.votes || 0,
                "author": {
                    "@type": "Person",
                    "name": acceptedAnswer.author?.username || "Anonymous"
                }
            };
        }
    }

    document.getElementById('schema-markup').textContent = JSON.stringify(schema);
}

/**
 * Render markdown to HTML
 */
function renderMarkdown(text) {
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            breaks: true,
            gfm: true
        });
        return marked.parse(text);
    }
    
    // Fallback: simple conversion
    return text
        .replace(/\n/g, '<br>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
}

/**
 * Format date
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'এইমাত্র';
    if (diffMins < 60) return `${diffMins} মিনিট আগে`;
    if (diffHours < 24) return `${diffHours} ঘন্টা আগে`;
    if (diffDays < 7) return `${diffDays} দিন আগে`;

    return date.toLocaleDateString('bn-BD', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Format number (Bangla)
 */
function formatNumber(num) {
    return num.toLocaleString('bn-BD');
}

/**
 * Show loading state
 */
function showLoading() {
    document.getElementById('loading-skeleton').classList.remove('hidden');
    document.getElementById('error-state').classList.add('hidden');
    document.getElementById('question-content').classList.add('hidden');
}

/**
 * Hide loading state
 */
function hideLoading() {
    document.getElementById('loading-skeleton').classList.add('hidden');
    document.getElementById('question-content').classList.remove('hidden');
}

/**
 * Show error state
 */
function showError() {
    document.getElementById('loading-skeleton').classList.add('hidden');
    document.getElementById('question-content').classList.add('hidden');
    document.getElementById('error-state').classList.remove('hidden');
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}
