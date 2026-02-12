/**
 * question.js
 * 
 * Question Page Logic for PhysFlow
 * - Fetches question and answers from Supabase
 * - Renders markdown and LaTeX
 * - Handles voting, bookmarking, answer submission
 * - Implements SEO meta tags and structured data
 * - Manages related questions
 */

import { supabase } from './supabase-config.js';

// =============================================
// GLOBAL STATE
// =============================================

let currentQuestion = null;
let currentAnswers = [];
let currentSort = 'votes';
let currentUserId = null;
let userVotes = {
    question: null,
    answers: {}
};

// =============================================
// UTILITY FUNCTIONS
// =============================================

/**
 * Get question ID and slug from URL
 * Supports: /question/123/slug-here or question.html?id=123
 */
function getQuestionParams() {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    
    // Try path-based routing first: /question/123/slug
    const pathMatch = path.match(/\/question\/(\d+)\/?([^\/]*)?/);
    if (pathMatch) {
        return {
            id: pathMatch[1],
            slug: pathMatch[2] || ''
        };
    }
    
    // Fallback to query parameter: ?id=123
    const id = params.get('id');
    if (id) {
        return { id, slug: '' };
    }
    
    return null;
}

/**
 * Format date to Bengali
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
    if (diffHours < 24) return `${diffHours} ঘণ্টা আগে`;
    if (diffDays < 7) return `${diffDays} দিন আগে`;
    
    return date.toLocaleDateString('bn-BD', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

/**
 * Render Markdown with LaTeX support
 */
function renderMarkdown(text) {
    if (!text) return '';
    
    // Configure marked for safe HTML
    marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: false,
        mangle: false
    });
    
    // Render markdown
    let html = marked.parse(text);
    
    return html;
}

/**
 * Render LaTeX in element
 */
function renderLaTeX(element) {
    if (typeof renderMathInElement !== 'undefined') {
        renderMathInElement(element, {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false}
            ],
            throwOnError: false
        });
    }
}

/**
 * Generate slug from title
 */
function generateSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^\u0980-\u09FF\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 100);
}

/**
 * Update SEO meta tags
 */
function updateSEO(question) {
    // Title
    document.title = `${question.title} - physflow`;
    
    // Meta description
    const description = question.body.substring(0, 150).replace(/[#*`]/g, '');
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
        metaDesc.content = description;
    }
    
    // Open Graph
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = `${question.title} - physflow`;
    
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.content = description;
    
    const ogUrl = document.querySelector('meta[property="og:url"]');
    const canonicalUrl = `${window.location.origin}/question/${question.id}/${question.slug || generateSlug(question.title)}`;
    if (ogUrl) ogUrl.content = canonicalUrl;
    
    // Canonical link
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;
}

/**
 * Update structured data (JSON-LD)
 */
function updateStructuredData(question, answers) {
    const structuredData = {
        "@context": "https://schema.org",
        "@type": "QAPage",
        "mainEntity": {
            "@type": "Question",
            "name": question.title,
            "text": question.body,
            "answerCount": answers.length,
            "upvoteCount": question.votes || 0,
            "dateCreated": question.created_at,
            "author": {
                "@type": "Person",
                "name": question.author?.name || "Anonymous"
            }
        }
    };
    
    // Add accepted answer
    const acceptedAnswer = answers.find(a => a.is_accepted);
    if (acceptedAnswer) {
        structuredData.mainEntity.acceptedAnswer = {
            "@type": "Answer",
            "text": acceptedAnswer.body,
            "dateCreated": acceptedAnswer.created_at,
            "upvoteCount": acceptedAnswer.votes || 0,
            "author": {
                "@type": "Person",
                "name": acceptedAnswer.author?.name || "Anonymous"
            }
        };
    }
    
    // Add suggested answers
    if (answers.length > 0) {
        structuredData.mainEntity.suggestedAnswer = answers
            .filter(a => !a.is_accepted)
            .slice(0, 5)
            .map(a => ({
                "@type": "Answer",
                "text": a.body,
                "dateCreated": a.created_at,
                "upvoteCount": a.votes || 0,
                "author": {
                    "@type": "Person",
                    "name": a.author?.name || "Anonymous"
                }
            }));
    }
    
    const script = document.getElementById('structured-data');
    if (script) {
        script.textContent = JSON.stringify(structuredData, null, 2);
    }
}

// =============================================
// DATA FETCHING
// =============================================

/**
 * Fetch question by ID
 */
async function fetchQuestion(questionId) {
    try {
        const { data, error } = await supabase
            .from('questions')
            .select(`
                *,
                author:profiles(id, name, avatar)
            `)
            .eq('id', questionId)
            .single();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching question:', error);
        return null;
    }
}

/**
 * Fetch answers for question
 */
async function fetchAnswers(questionId) {
    try {
        const { data, error } = await supabase
            .from('answers')
            .select(`
                *,
                author:profiles(id, name, avatar)
            `)
            .eq('question_id', questionId)
            .order('is_accepted', { ascending: false })
            .order('votes', { ascending: false });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching answers:', error);
        return [];
    }
}

/**
 * Fetch related questions based on tags
 */
async function fetchRelatedQuestions(questionId, tags) {
    try {
        // Simple approach: fetch questions with similar tags
        // In production, you might want more sophisticated matching
        const { data, error } = await supabase
            .from('questions')
            .select('id, title, slug, votes, views')
            .neq('id', questionId)
            .limit(5);
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching related questions:', error);
        return [];
    }
}

/**
 * Increment view count
 * Uses session storage to prevent refresh spam
 */
async function incrementViewCount(questionId) {
    const viewKey = `viewed_${questionId}`;
    
    // Check if already viewed in this session
    if (sessionStorage.getItem(viewKey)) {
        return;
    }
    
    try {
        const { error } = await supabase.rpc('increment_question_views', {
            question_id: questionId
        });
        
        if (!error) {
            sessionStorage.setItem(viewKey, 'true');
        }
    } catch (error) {
        console.error('Error incrementing views:', error);
    }
}

/**
 * Fetch user's votes for question and answers
 */
async function fetchUserVotes(questionId) {
    if (!currentUserId) return;
    
    try {
        // Fetch question vote
        const { data: questionVote } = await supabase
            .from('votes')
            .select('vote_type')
            .eq('user_id', currentUserId)
            .eq('question_id', questionId)
            .eq('answer_id', null)
            .single();
        
        if (questionVote) {
            userVotes.question = questionVote.vote_type;
        }
        
        // Fetch answer votes
        const { data: answerVotes } = await supabase
            .from('votes')
            .select('answer_id, vote_type')
            .eq('user_id', currentUserId)
            .eq('question_id', questionId)
            .not('answer_id', 'is', null);
        
        if (answerVotes) {
            answerVotes.forEach(vote => {
                userVotes.answers[vote.answer_id] = vote.vote_type;
            });
        }
    } catch (error) {
        console.error('Error fetching user votes:', error);
    }
}

// =============================================
// RENDERING FUNCTIONS
// =============================================

/**
 * Render question
 */
function renderQuestion(question) {
    // Title
    document.getElementById('question-title').textContent = question.title;
    
    // Meta info
    document.getElementById('question-date').textContent = formatDate(question.created_at);
    document.getElementById('question-views').textContent = question.views || 0;
    document.getElementById('question-author').textContent = question.author?.name || 'Anonymous';
    
    // Tags
    const tagsContainer = document.getElementById('question-tags');
    tagsContainer.innerHTML = '';
    if (question.tags && question.tags.length > 0) {
        question.tags.forEach(tag => {
            const tagEl = document.createElement('a');
            tagEl.href = `tags.html?tag=${encodeURIComponent(tag)}`;
            tagEl.className = 'tag';
            tagEl.textContent = tag;
            tagsContainer.appendChild(tagEl);
        });
    }
    
    // Body
    const bodyEl = document.getElementById('question-body');
    bodyEl.innerHTML = renderMarkdown(question.body);
    renderLaTeX(bodyEl);
    
    // Vote count
    document.getElementById('question-vote-count').textContent = question.votes || 0;
    
    // Update vote buttons based on user's vote
    if (userVotes.question) {
        const voteType = userVotes.question;
        if (voteType === 'up') {
            document.querySelector('.vote-btn.upvote').classList.add('active');
        } else if (voteType === 'down') {
            document.querySelector('.vote-btn.downvote').classList.add('active');
        }
    }
}

/**
 * Render answers
 */
function renderAnswers(answers) {
    document.getElementById('answer-count').textContent = answers.length;
    
    const answersList = document.getElementById('answers-list');
    answersList.innerHTML = '';
    
    if (answers.length === 0) {
        answersList.innerHTML = `
            <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                এখনও কোনো উত্তর নেই। প্রথম উত্তর দিন!
            </div>
        `;
        return;
    }
    
    answers.forEach(answer => {
        const answerEl = createAnswerElement(answer);
        answersList.appendChild(answerEl);
    });
}

/**
 * Create answer element
 */
function createAnswerElement(answer) {
    const div = document.createElement('div');
    div.className = `border-b dark:border-gray-700 pb-6 ${answer.is_accepted ? 'accepted-answer' : ''}`;
    div.dataset.answerId = answer.id;
    
    const isAuthor = currentUserId && currentUserId === currentQuestion.author_id;
    const userVote = userVotes.answers[answer.id];
    
    div.innerHTML = `
        <div class="flex gap-4">
            <!-- Vote Panel -->
            <div class="vote-panel flex-shrink-0">
                <button class="vote-btn upvote ${userVote === 'up' ? 'active' : ''}" 
                        data-type="answer" 
                        data-id="${answer.id}" 
                        data-vote="up">
                    <i class="fas fa-chevron-up text-2xl"></i>
                </button>
                <div class="vote-count">${answer.votes || 0}</div>
                <button class="vote-btn downvote ${userVote === 'down' ? 'active' : ''}" 
                        data-type="answer" 
                        data-id="${answer.id}" 
                        data-vote="down">
                    <i class="fas fa-chevron-down text-2xl"></i>
                </button>
                ${answer.is_accepted ? `
                    <div class="mt-4 text-green-600 dark:text-green-400" title="গৃহীত উত্তর">
                        <i class="fas fa-check-circle text-2xl"></i>
                    </div>
                ` : isAuthor ? `
                    <button class="vote-btn accept-btn mt-4" 
                            data-id="${answer.id}" 
                            title="উত্তর গ্রহণ করুন">
                        <i class="far fa-check-circle text-xl"></i>
                    </button>
                ` : ''}
            </div>

            <!-- Answer Content -->
            <div class="flex-1">
                <div class="answer-body content-body prose dark:prose-invert max-w-none">
                    ${renderMarkdown(answer.body)}
                </div>
                
                <div class="flex items-center justify-between mt-4 pt-4 border-t dark:border-gray-700">
                    <div class="flex gap-4 text-sm">
                        <button class="text-gray-600 dark:text-gray-400 hover:text-brand-600">
                            <i class="fas fa-share-alt"></i> শেয়ার
                        </button>
                        <button class="text-gray-600 dark:text-gray-400 hover:text-brand-600">
                            <i class="fas fa-flag"></i> রিপোর্ট
                        </button>
                    </div>
                    
                    <div class="text-sm text-gray-600 dark:text-gray-400">
                        <span class="font-medium">${answer.author?.name || 'Anonymous'}</span>
                        <span class="mx-2">•</span>
                        <span>${formatDate(answer.created_at)}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Render LaTeX
    const bodyEl = div.querySelector('.answer-body');
    renderLaTeX(bodyEl);
    
    return div;
}

/**
 * Render related questions
 */
function renderRelatedQuestions(questions) {
    const container = document.getElementById('related-questions');
    container.innerHTML = '';
    
    if (questions.length === 0) {
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400">কোনো সম্পর্কিত প্রশ্ন পাওয়া যায়নি।</p>';
        return;
    }
    
    questions.forEach(q => {
        const slug = q.slug || generateSlug(q.title);
        const div = document.createElement('div');
        div.className = 'border-l-2 border-brand-600 pl-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition';
        div.innerHTML = `
            <a href="/question/${q.id}/${slug}" class="text-brand-600 hover:underline font-medium">
                ${q.title}
            </a>
            <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                ${q.votes || 0} ভোট • ${q.views || 0} দেখা
            </div>
        `;
        container.appendChild(div);
    });
}

// =============================================
// VOTING LOGIC
// =============================================

/**
 * Handle vote
 */
async function handleVote(type, id, voteDirection) {
    if (!currentUserId) {
        alert('ভোট দিতে লগ ইন করুন');
        return;
    }
    
    try {
        let currentVote;
        if (type === 'question') {
            currentVote = userVotes.question;
        } else {
            currentVote = userVotes.answers[id];
        }
        
        // Determine new vote
        let newVote = null;
        if (currentVote === voteDirection) {
            // Remove vote
            newVote = null;
        } else {
            // Set new vote
            newVote = voteDirection;
        }
        
        // Update in database
        const params = {
            user_id: currentUserId,
            question_id: currentQuestion.id,
            vote_type: newVote
        };
        
        if (type === 'answer') {
            params.answer_id = id;
        }
        
        if (newVote) {
            // Insert or update vote
            const { error } = await supabase
                .from('votes')
                .upsert(params);
            
            if (error) throw error;
        } else {
            // Delete vote
            const deleteParams = {
                user_id: currentUserId,
                question_id: currentQuestion.id
            };
            if (type === 'answer') {
                deleteParams.answer_id = id;
            }
            
            const { error } = await supabase
                .from('votes')
                .delete()
                .match(deleteParams);
            
            if (error) throw error;
        }
        
        // Update local state
        if (type === 'question') {
            userVotes.question = newVote;
        } else {
            userVotes.answers[id] = newVote;
        }
        
        // Refresh data
        await loadQuestionData();
        
    } catch (error) {
        console.error('Error voting:', error);
        alert('ভোট দিতে সমস্যা হয়েছে');
    }
}

/**
 * Handle accept answer
 */
async function handleAcceptAnswer(answerId) {
    if (!currentUserId || currentUserId !== currentQuestion.author_id) {
        alert('শুধুমাত্র প্রশ্নকর্তা উত্তর গ্রহণ করতে পারবেন');
        return;
    }
    
    try {
        // Unaccept all other answers
        await supabase
            .from('answers')
            .update({ is_accepted: false })
            .eq('question_id', currentQuestion.id);
        
        // Accept this answer
        const { error } = await supabase
            .from('answers')
            .update({ is_accepted: true })
            .eq('id', answerId);
        
        if (error) throw error;
        
        // Reload answers
        await loadQuestionData();
        
    } catch (error) {
        console.error('Error accepting answer:', error);
        alert('উত্তর গ্রহণ করতে সমস্যা হয়েছে');
    }
}

// =============================================
// ANSWER SUBMISSION
// =============================================

/**
 * Setup answer editor
 */
function setupAnswerEditor() {
    const writeTab = document.querySelector('[data-tab="write"]');
    const previewTab = document.querySelector('[data-tab="preview"]');
    const writeContent = document.getElementById('write-tab');
    const previewContent = document.getElementById('preview-tab');
    const editor = document.getElementById('answer-editor');
    const preview = document.getElementById('answer-preview');
    
    // Tab switching
    writeTab.addEventListener('click', () => {
        writeTab.classList.add('active', 'border-brand-600', 'text-brand-600');
        previewTab.classList.remove('active', 'border-brand-600', 'text-brand-600');
        writeContent.classList.remove('hidden');
        previewContent.classList.add('hidden');
    });
    
    previewTab.addEventListener('click', () => {
        previewTab.classList.add('active', 'border-brand-600', 'text-brand-600');
        writeTab.classList.remove('active', 'border-brand-600', 'text-brand-600');
        previewContent.classList.remove('hidden');
        writeContent.classList.add('hidden');
        
        // Update preview
        const markdown = editor.value;
        preview.innerHTML = renderMarkdown(markdown);
        renderLaTeX(preview);
    });
    
    // Submit answer
    const submitBtn = document.getElementById('submit-answer-btn');
    submitBtn.addEventListener('click', async () => {
        await submitAnswer();
    });
}

/**
 * Submit answer
 */
async function submitAnswer() {
    if (!currentUserId) {
        showFeedback('উত্তর পোস্ট করতে লগ ইন করুন', 'error');
        return;
    }
    
    const editor = document.getElementById('answer-editor');
    const body = editor.value.trim();
    
    if (!body) {
        showFeedback('উত্তর লিখুন', 'error');
        return;
    }
    
    const submitBtn = document.getElementById('submit-answer-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'পোস্ট হচ্ছে...';
    
    try {
        const { data, error } = await supabase
            .from('answers')
            .insert({
                question_id: currentQuestion.id,
                body: body,
                author_id: currentUserId,
                votes: 0,
                is_accepted: false
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // Clear editor
        editor.value = '';
        
        // Show success
        showFeedback('উত্তর সফলভাবে পোস্ট হয়েছে!', 'success');
        
        // Reload answers
        await loadQuestionData();
        
    } catch (error) {
        console.error('Error submitting answer:', error);
        showFeedback('উত্তর পোস্ট করতে সমস্যা হয়েছে', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'উত্তর পোস্ট করুন';
    }
}

/**
 * Show feedback message
 */
function showFeedback(message, type) {
    const feedback = document.getElementById('answer-feedback');
    feedback.className = `mt-4 p-3 rounded ${type === 'success' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}`;
    feedback.textContent = message;
    feedback.classList.remove('hidden');
    
    setTimeout(() => {
        feedback.classList.add('hidden');
    }, 5000);
}

// =============================================
// SORTING
// =============================================

/**
 * Setup sorting
 */
function setupSorting() {
    const sortBtns = document.querySelectorAll('.sort-btn');
    
    sortBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const sortType = btn.dataset.sort;
            
            // Update active state
            sortBtns.forEach(b => {
                b.classList.remove('active', 'bg-blue-50', 'dark:bg-gray-800', 'text-brand-600');
                b.classList.add('text-gray-600', 'dark:text-gray-400');
            });
            btn.classList.add('active', 'bg-blue-50', 'dark:bg-gray-800', 'text-brand-600');
            btn.classList.remove('text-gray-600', 'dark:text-gray-400');
            
            // Sort and render
            currentSort = sortType;
            sortAnswers();
            renderAnswers(currentAnswers);
        });
    });
}

/**
 * Sort answers
 */
function sortAnswers() {
    currentAnswers.sort((a, b) => {
        // Accepted answer always first
        if (a.is_accepted && !b.is_accepted) return -1;
        if (!a.is_accepted && b.is_accepted) return 1;
        
        // Then sort by selected criteria
        switch (currentSort) {
            case 'votes':
                return (b.votes || 0) - (a.votes || 0);
            case 'newest':
                return new Date(b.created_at) - new Date(a.created_at);
            case 'oldest':
                return new Date(a.created_at) - new Date(b.created_at);
            default:
                return 0;
        }
    });
}

// =============================================
// EVENT LISTENERS
// =============================================

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Vote buttons (using event delegation)
    document.addEventListener('click', (e) => {
        const voteBtn = e.target.closest('.vote-btn.upvote, .vote-btn.downvote');
        if (voteBtn) {
            const type = voteBtn.dataset.type;
            const id = voteBtn.dataset.id || null;
            const vote = voteBtn.dataset.vote;
            handleVote(type, id, vote);
        }
        
        // Accept button
        const acceptBtn = e.target.closest('.accept-btn');
        if (acceptBtn) {
            const answerId = acceptBtn.dataset.id;
            handleAcceptAnswer(answerId);
        }
    });
    
    // Bookmark button
    document.querySelector('.bookmark')?.addEventListener('click', async () => {
        if (!currentUserId) {
            alert('বুকমার্ক করতে লগ ইন করুন');
            return;
        }
        
        // Implement bookmark logic here
        alert('বুকমার্ক ফিচার শীঘ্রই আসছে!');
    });
}

// =============================================
// MAIN LOAD FUNCTION
// =============================================

/**
 * Load question data
 */
async function loadQuestionData() {
    const params = getQuestionParams();
    if (!params) {
        showError();
        return;
    }
    
    const questionId = params.id;
    
    // Show loading
    document.getElementById('loading-skeleton').classList.remove('hidden');
    document.getElementById('question-container').classList.add('hidden');
    document.getElementById('error-container').classList.add('hidden');
    
    try {
        // Fetch question
        const question = await fetchQuestion(questionId);
        
        if (!question) {
            showError();
            return;
        }
        
        currentQuestion = question;
        
        // Fetch answers
        const answers = await fetchAnswers(questionId);
        currentAnswers = answers;
        sortAnswers();
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        currentUserId = user?.id || null;
        
        // Fetch user votes if logged in
        if (currentUserId) {
            await fetchUserVotes(questionId);
        }
        
        // Fetch related questions
        const relatedQuestions = await fetchRelatedQuestions(questionId, question.tags);
        
        // Render everything
        renderQuestion(question);
        renderAnswers(currentAnswers);
        renderRelatedQuestions(relatedQuestions);
        
        // Update SEO
        updateSEO(question);
        updateStructuredData(question, answers);
        
        // Increment view count
        incrementViewCount(questionId);
        
        // Show content
        document.getElementById('loading-skeleton').classList.add('hidden');
        document.getElementById('question-container').classList.remove('hidden');
        
    } catch (error) {
        console.error('Error loading question:', error);
        showError();
    }
}

/**
 * Show error
 */
function showError() {
    document.getElementById('loading-skeleton').classList.add('hidden');
    document.getElementById('question-container').classList.add('hidden');
    document.getElementById('error-container').classList.remove('hidden');
}

// =============================================
// INITIALIZATION
// =============================================

/**
 * Initialize question page
 */
export function initQuestionPage() {
    loadQuestionData();
    setupAnswerEditor();
    setupSorting();
    setupEventListeners();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQuestionPage);
} else {
    initQuestionPage();
}
