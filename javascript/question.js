// javascript/question.js
// Production-ready Question Detail Page Module for PhysFlow

import { supabase } from 'javascript/supabase-config.js';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    ANSWERS_PER_PAGE: 5,
    MIN_ANSWER_LENGTH: 50,
    SESSION_KEY: 'question_views',
    SITE_URL: 'https://physflow.pages.dev'
};

// ============================================
// STATE MANAGEMENT
// ============================================

let state = {
    questionId: null,
    questionSlug: null,
    question: null,
    answers: [],
    currentSort: 'votes',
    answersLoaded: 0,
    totalAnswers: 0,
    currentUser: null,
    userVotes: {
        question: null,
        answers: {}
    }
};

// ============================================
// URL PARSING & VALIDATION
// ============================================

/**
 * Extract question ID and slug from URL pathname
 * Expected format: /question/{id}/{slug}
 */
function parseURLParams() {
    const path = window.location.pathname;
    
    // Match pattern: /question/123/some-slug-here
    const match = path.match(/\/question\/(\d+)\/([^\/]+)/);
    
    if (!match) {
        return { id: null, slug: null };
    }
    
    return {
        id: parseInt(match[1], 10),
        slug: match[2]
    };
}

/**
 * Redirect to canonical URL if slug doesn't match
 */
function validateAndRedirectSlug(correctSlug) {
    if (state.questionSlug !== correctSlug) {
        const canonicalURL = `${CONFIG.SITE_URL}/question/${state.questionId}/${correctSlug}`;
        window.location.replace(canonicalURL);
        return true;
    }
    return false;
}

/**
 * Generate slug from title
 */
function generateSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^\u0980-\u09FFa-z0-9\s-]/g, '') // Keep Bengali, English, numbers
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 100);
}

// ============================================
// SEO & META INJECTION
// ============================================

/**
 * Update page meta tags dynamically
 */
function injectSEOMeta(question) {
    // Title
    document.title = `${question.title} - PhysFlow`;
    
    // Description (first 150 chars of body)
    const description = question.body
        .replace(/[#*`\[\]]/g, '')
        .substring(0, 150) + '...';
    
    let descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) {
        descMeta.setAttribute('content', description);
    }
    
    // Open Graph
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', question.title + ' - PhysFlow');
    
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', description);
    
    const ogType = document.querySelector('meta[property="og:type"]');
    if (ogType) ogType.setAttribute('content', 'article');
    
    const ogUrl = document.querySelector('meta[property="og:url"]');
    const canonicalURL = `${CONFIG.SITE_URL}/question/${question.id}/${question.slug}`;
    if (ogUrl) ogUrl.setAttribute('content', canonicalURL);
    
    // Canonical link
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalURL);
}

/**
 * Inject JSON-LD structured data
 */
function injectStructuredData(question, answers) {
    const acceptedAnswer = answers.find(a => a.is_accepted);
    const topAnswers = answers.slice(0, 3);
    
    const structuredData = {
        "@context": "https://schema.org",
        "@type": "QAPage",
        "mainEntity": {
            "@type": "Question",
            "name": question.title,
            "text": question.body,
            "answerCount": state.totalAnswers,
            "dateCreated": question.created_at,
            "author": {
                "@type": "Person",
                "name": question.author_name || "Anonymous"
            }
        }
    };
    
    // Add accepted answer
    if (acceptedAnswer) {
        structuredData.mainEntity.acceptedAnswer = {
            "@type": "Answer",
            "text": acceptedAnswer.body,
            "dateCreated": acceptedAnswer.created_at,
            "author": {
                "@type": "Person",
                "name": acceptedAnswer.author_name || "Anonymous"
            },
            "upvoteCount": acceptedAnswer.votes
        };
    }
    
    // Add suggested answers
    if (topAnswers.length > 0) {
        structuredData.mainEntity.suggestedAnswer = topAnswers.map(answer => ({
            "@type": "Answer",
            "text": answer.body,
            "dateCreated": answer.created_at,
            "author": {
                "@type": "Person",
                "name": answer.author_name || "Anonymous"
            },
            "upvoteCount": answer.votes
        }));
    }
    
    // Remove existing script if any
    const existingScript = document.querySelector('script[type="application/ld+json"]');
    if (existingScript) existingScript.remove();
    
    // Inject new script
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);
}

// ============================================
// DATA FETCHING
// ============================================

/**
 * Fetch question by ID
 */
async function fetchQuestion(questionId) {
    try {
        const { data, error } = await supabase
            .from('question')
            .select(`
                *,
                author:profile(name, avatar_url)
            `)
            .eq('id', questionId)
            .single();
        
        if (error) throw error;
        
        if (!data) {
            showError();
            return null;
        }
        
        // Flatten author data
        data.author_name = data.author?.name || 'Anonymous';
        data.author_avatar = data.author?.avatar_url;
        
        return data;
    } catch (error) {
        console.error('Error fetching question:', error);
        showError();
        return null;
    }
}

/**
 * Fetch answers for question with sorting
 */
async function fetchAnswers(questionId, sort = 'votes', offset = 0, limit = CONFIG.ANSWERS_PER_PAGE) {
    try {
        let query = supabase
            .from('answer')
            .select(`
                *,
                author:profile(name, avatar_url)
            `, { count: 'exact' })
            .eq('question_id', questionId)
            .range(offset, offset + limit - 1);
        
        // Apply sorting
        // Order: accepted first, then by sort parameter
        if (sort === 'votes') {
            query = query.order('is_accepted', { ascending: false })
                        .order('votes', { ascending: false })
                        .order('created_at', { ascending: true });
        } else if (sort === 'newest') {
            query = query.order('is_accepted', { ascending: false })
                        .order('created_at', { ascending: false });
        } else if (sort === 'oldest') {
            query = query.order('is_accepted', { ascending: false })
                        .order('created_at', { ascending: true });
        }
        
        const { data, error, count } = await query;
        
        if (error) throw error;
        
        // Flatten author data
        const answers = data.map(answer => ({
            ...answer,
            author_name: answer.author?.name || 'Anonymous',
            author_avatar: answer.author?.avatar_url
        }));
        
        return { answers, total: count };
    } catch (error) {
        console.error('Error fetching answers:', error);
        return { answers: [], total: 0 };
    }
}

/**
 * Fetch related questions based on tags and title similarity
 */
async function fetchRelatedQuestions(questionId, tag, title) {
    try {
        // First try to get questions with same tags
        let { data, error } = await supabase
            .from('question')
            .select('id, title, slug, votes, answers_count')
            .neq('id', questionId)
            .contains('tag', tag || [])
            .order('votes', { ascending: false })
            .limit(5);
        
        if (error) throw error;
        
        // If not enough results, get popular questions
        if (!data || data.length < 3) {
            const { data: popularData, error: popularError } = await supabase
                .from('question')
                .select('id, title, slug, votes, answers_count')
                .neq('id', questionId)
                .order('votes', { ascending: false })
                .limit(5);
            
            if (!popularError && popularData) {
                data = popularData;
            }
        }
        
        return data || [];
    } catch (error) {
        console.error('Error fetching related questions:', error);
        return [];
    }
}

// ============================================
// VIEW TRACKING
// ============================================

/**
 * Increment view count (once per session per question)
 */
async function incrementViewCount(questionId) {
    // Check if already viewed in this session
    const viewedQuestions = JSON.parse(sessionStorage.getItem(CONFIG.SESSION_KEY) || '[]');
    
    if (viewedQuestions.includes(questionId)) {
        return; // Already viewed in this session
    }
    
    try {
        // Increment view count in database
        const { error } = await supabase
            .rpc('increment_question_views', { question_id: questionId });
        
        if (error) throw error;
        
        // Mark as viewed in session
        viewedQuestions.push(questionId);
        sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(viewedQuestions));
        
        // Update UI
        if (state.question) {
            state.question.views = (state.question.views || 0) + 1;
            document.getElementById('question-views').textContent = state.question.views;
        }
    } catch (error) {
        console.error('Error incrementing view count:', error);
    }
}

// ============================================
// VOTING LOGIC
// ============================================

/**
 * Handle question vote
 */
async function handleQuestionVote(voteType) {
    if (!state.currentUser) {
        alert('ভোট দিতে লগ ইন করুন');
        return;
    }
    
    try {
        const currentVote = state.userVotes.question;
        let newVoteValue = voteType; // 'up' or 'down'
        
        // If clicking same vote, remove it
        if (currentVote === voteType) {
            newVoteValue = null;
        }
        
        // Update vote in database
        const { error } = await supabase
            .rpc('vote_question', {
                question_id: state.questionId,
                user_id: state.currentUser.id,
                vote_type: newVoteValue
            });
        
        if (error) throw error;
        
        // Update local state
        state.userVotes.question = newVoteValue;
        
        // Recalculate votes
        let voteDelta = 0;
        if (currentVote === 'up' && newVoteValue === 'down') voteDelta = -2;
        else if (currentVote === 'up' && newVoteValue === null) voteDelta = -1;
        else if (currentVote === 'down' && newVoteValue === 'up') voteDelta = 2;
        else if (currentVote === 'down' && newVoteValue === null) voteDelta = 1;
        else if (currentVote === null && newVoteValue === 'up') voteDelta = 1;
        else if (currentVote === null && newVoteValue === 'down') voteDelta = -1;
        
        state.question.votes += voteDelta;
        
        // Update UI
        updateQuestionVoteUI();
    } catch (error) {
        console.error('Error voting on question:', error);
        alert('ভোট দিতে সমস্যা হয়েছে');
    }
}

/**
 * Handle answer vote
 */
async function handleAnswerVote(answerId, voteType) {
    if (!state.currentUser) {
        alert('ভোট দিতে লগ ইন করুন');
        return;
    }
    
    try {
        const currentVote = state.userVotes.answers[answerId];
        let newVoteValue = voteType;
        
        if (currentVote === voteType) {
            newVoteValue = null;
        }
        
        const { error } = await supabase
            .rpc('vote_answer', {
                answer_id: answerId,
                user_id: state.currentUser.id,
                vote_type: newVoteValue
            });
        
        if (error) throw error;
        
        state.userVotes.answers[answerId] = newVoteValue;
        
        // Update answer votes in state
        const answer = state.answers.find(a => a.id === answerId);
        if (answer) {
            let voteDelta = 0;
            if (currentVote === 'up' && newVoteValue === 'down') voteDelta = -2;
            else if (currentVote === 'up' && newVoteValue === null) voteDelta = -1;
            else if (currentVote === 'down' && newVoteValue === 'up') voteDelta = 2;
            else if (currentVote === 'down' && newVoteValue === null) voteDelta = 1;
            else if (currentVote === null && newVoteValue === 'up') voteDelta = 1;
            else if (currentVote === null && newVoteValue === 'down') voteDelta = -1;
            
            answer.votes += voteDelta;
        }
        
        // Update UI for this answer
        updateAnswerVoteUI(answerId);
    } catch (error) {
        console.error('Error voting on answer:', error);
        alert('ভোট দিতে সমস্যা হয়েছে');
    }
}

/**
 * Update question vote UI
 */
function updateQuestionVoteUI() {
    const votesEl = document.getElementById('question-votes');
    const upvoteBtn = document.getElementById('question-upvote');
    const downvoteBtn = document.getElementById('question-downvote');
    
    votesEl.textContent = state.question.votes;
    
    // Update button states
    upvoteBtn.classList.toggle('active', state.userVotes.question === 'up');
    downvoteBtn.classList.toggle('active', state.userVotes.question === 'down');
}

/**
 * Update answer vote UI
 */
function updateAnswerVoteUI(answerId) {
    const answer = state.answers.find(a => a.id === answerId);
    if (!answer) return;
    
    const votesEl = document.querySelector(`[data-answer-id="${answerId}"] .answer-votes`);
    const upvoteBtn = document.querySelector(`[data-answer-id="${answerId}"] .answer-upvote`);
    const downvoteBtn = document.querySelector(`[data-answer-id="${answerId}"] .answer-downvote`);
    
    if (votesEl) votesEl.textContent = answer.votes;
    if (upvoteBtn) upvoteBtn.classList.toggle('active', state.userVotes.answers[answerId] === 'up');
    if (downvoteBtn) downvoteBtn.classList.toggle('active', state.userVotes.answers[answerId] === 'down');
}

// ============================================
// ACCEPT ANSWER
// ============================================

/**
 * Accept/unaccept an answer (question owner only)
 */
async function toggleAcceptAnswer(answerId) {
    if (!state.currentUser) {
        alert('লগ ইন করুন');
        return;
    }
    
    if (state.currentUser.id !== state.question.author_id) {
        alert('শুধুমাত্র প্রশ্নকর্তা উত্তর গ্রহণ করতে পারবেন');
        return;
    }
    
    try {
        const answer = state.answers.find(a => a.id === answerId);
        const newAcceptedState = !answer.is_accepted;
        
        // If accepting this answer, unaccept all others
        if (newAcceptedState) {
            await supabase
                .from('answer')
                .update({ is_accepted: false })
                .eq('question_id', state.questionId);
        }
        
        // Toggle this answer
        const { error } = await supabase
            .from('answer')
            .update({ is_accepted: newAcceptedState })
            .eq('id', answerId);
        
        if (error) throw error;
        
        // Update state
        state.answers.forEach(a => {
            if (a.id === answerId) {
                a.is_accepted = newAcceptedState;
            } else {
                a.is_accepted = false;
            }
        });
        
        // Re-render answers
        renderAnswers();
    } catch (error) {
        console.error('Error accepting answer:', error);
        alert('উত্তর গ্রহণ করতে সমস্যা হয়েছে');
    }
}

// ============================================
// ANSWER SUBMISSION
// ============================================

/**
 * Submit new answer
 */
async function submitAnswer() {
    if (!state.currentUser) {
        alert('উত্তর দিতে লগ ইন করুন');
        return;
    }
    
    const editor = document.getElementById('answer-editor');
    const answerBody = editor.value.trim();
    
    // Validation
    if (answerBody.length < CONFIG.MIN_ANSWER_LENGTH) {
        showFeedback('সর্বনিম্ন ৫০ অক্ষর প্রয়োজন', 'error');
        return;
    }
    
    const submitBtn = document.getElementById('submit-answer-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'জমা দেওয়া হচ্ছে...';
    
    try {
        // Insert answer
        const { data, error } = await supabase
            .from('answer')
            .insert({
                question_id: state.questionId,
                body: answerBody,
                author_id: state.currentUser.id,
                votes: 0,
                is_accepted: false
            })
            .select(`
                *,
                author:profile(name, avatar_url)
            `)
            .single();
        
        if (error) throw error;
        
        // Flatten author data
        data.author_name = data.author?.name || 'Anonymous';
        data.author_avatar = data.author?.avatar_url;
        
        // Add to state
        state.answers.unshift(data);
        state.totalAnswers++;
        
        // Clear editor
        editor.value = '';
        
        // Update UI
        renderAnswers();
        updateAnswersCount();
        
        // Show success
        showFeedback('আপনার উত্তর সফলভাবে জমা হয়েছে!', 'success');
        
        // Scroll to answer
        setTimeout(() => {
            document.querySelector('[data-answer-id="' + data.id + '"]')?.scrollIntoView({ behavior: 'smooth' });
        }, 300);
        
    } catch (error) {
        console.error('Error submitting answer:', error);
        showFeedback('উত্তর জমা দিতে সমস্যা হয়েছে', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'উত্তর জমা দিন';
    }
}

/**
 * Show submission feedback
 */
function showFeedback(message, type) {
    const feedback = document.getElementById('submit-feedback');
    feedback.textContent = message;
    feedback.className = 'mt-4 p-4 rounded-lg ' + 
        (type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                               'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200');
    feedback.classList.remove('hidden');
    
    setTimeout(() => {
        feedback.classList.add('hidden');
    }, 5000);
}

// ============================================
// MARKDOWN & LATEX RENDERING
// ============================================

/**
 * Render markdown with LaTeX support
 */
function renderMarkdown(markdown) {
    // Configure marked
    marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: true,
        mangle: false,
        sanitize: false
    });
    
    // Render markdown
    let html = marked.parse(markdown);
    
    return html;
}

/**
 * Render LaTeX in element using KaTeX
 */
function renderLaTeX(element) {
    if (window.renderMathInElement) {
        window.renderMathInElement(element, {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false},
                {left: '\\(', right: '\\)', display: false},
                {left: '\\[', right: '\\]', display: true}
            ],
            throwOnError: false
        });
    }
}

// ============================================
// UI RENDERING
// ============================================

/**
 * Render question
 */
function renderQuestion() {
    // Title
    document.getElementById('question-title').textContent = state.question.title;
    
    // Metadata
    document.getElementById('question-date').textContent = formatDate(state.question.created_at);
    document.getElementById('question-views').textContent = state.question.views || 0;
    document.getElementById('question-author').textContent = state.question.author_name;
    
    // Votes
    document.getElementById('question-votes').textContent = state.question.votes;
    
    // Tags
    const tagsContainer = document.getElementById('question-tags');
    tagsContainer.innerHTML = '';
    if (state.question.tag && state.question.tag.length > 0) {
        state.question.tag.forEach(tag => {
            const tagEl = document.createElement('a');
            tagEl.href = `/tags/${tag}`;
            tagEl.className = 'px-3 py-1 bg-gray-100 dark:bg-gray-800 text-sm rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition';
            tagEl.textContent = tag;
            tagsContainer.appendChild(tagEl);
        });
    }
    
    // Body
    const bodyContainer = document.getElementById('question-body');
    bodyContainer.innerHTML = renderMarkdown(state.question.body);
    renderLaTeX(bodyContainer);
    
    // Update vote UI
    updateQuestionVoteUI();
}

/**
 * Render answers
 */
function renderAnswers() {
    const container = document.getElementById('answers-list');
    container.innerHTML = '';
    
    const visibleAnswers = state.answers.slice(0, state.answersLoaded);
    
    visibleAnswers.forEach(answer => {
        const answerEl = document.createElement('div');
        answerEl.className = 'flex gap-4 pb-6 border-b dark:border-gray-700 ' + 
            (answer.is_accepted ? 'accepted-answer p-4 rounded-lg' : '');
        answerEl.setAttribute('data-answer-id', answer.id);
        
        // Vote panel
        const votePanel = `
            <div class="flex flex-col items-center gap-2 w-12 shrink-0">
                <button class="vote-btn answer-upvote text-gray-400 hover:text-green-600 text-2xl" 
                    data-answer-id="${answer.id}" data-vote="up">
                    <i class="fas fa-caret-up"></i>
                </button>
                <div class="answer-votes text-xl font-semibold text-gray-700 dark:text-gray-300">${answer.votes}</div>
                <button class="vote-btn answer-downvote text-gray-400 hover:text-red-600 text-2xl" 
                    data-answer-id="${answer.id}" data-vote="down">
                    <i class="fas fa-caret-down"></i>
                </button>
                ${answer.is_accepted ? `
                    <i class="fas fa-check-circle text-2xl text-green-500 mt-2" title="গৃহীত উত্তর"></i>
                ` : (state.currentUser && state.currentUser.id === state.question.author_id ? `
                    <button class="vote-btn accept-answer text-gray-400 hover:text-green-600 text-xl mt-2" 
                        data-answer-id="${answer.id}" title="উত্তর গ্রহণ করুন">
                        <i class="far fa-check-circle"></i>
                    </button>
                ` : '')}
            </div>
        `;
        
        // Answer content
        const content = `
            <div class="flex-1">
                <div class="markdown-content prose dark:prose-invert max-w-none mb-4">
                    ${renderMarkdown(answer.body)}
                </div>
                <div class="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400">
                    <div class="flex items-center gap-2">
                        ${answer.author_avatar ? `
                            <img src="${answer.author_avatar}" alt="${answer.author_name}" 
                                class="w-6 h-6 rounded-full">
                        ` : ''}
                        <span>${answer.author_name}</span>
                        <span>•</span>
                        <span>${formatDate(answer.created_at)}</span>
                    </div>
                </div>
            </div>
        `;
        
        answerEl.innerHTML = votePanel + content;
        container.appendChild(answerEl);
        
        // Render LaTeX
        renderLaTeX(answerEl);
        
        // Update vote UI for this answer
        updateAnswerVoteUI(answer.id);
    });
    
    // Show/hide load more button
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (state.answersLoaded < state.answers.length) {
        loadMoreBtn.classList.remove('hidden');
    } else {
        loadMoreBtn.classList.add('hidden');
    }
}

/**
 * Render related questions
 */
function renderRelatedQuestions(questions) {
    const container = document.getElementById('related-questions');
    container.innerHTML = '';
    
    if (questions.length === 0) {
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400">কোন সম্পর্কিত প্রশ্ন পাওয়া যায়নি</p>';
        return;
    }
    
    questions.forEach(q => {
        const questionEl = document.createElement('a');
        questionEl.href = `/question/${q.id}/${q.slug}`;
        questionEl.className = 'block p-3 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition';
        questionEl.innerHTML = `
            <div class="flex justify-between items-start gap-4">
                <div class="flex-1">
                    <h4 class="font-medium text-gray-900 dark:text-gray-100 mb-1">${q.title}</h4>
                    <div class="flex gap-3 text-xs text-gray-600 dark:text-gray-400">
                        <span>${q.votes} ভোট</span>
                        <span>${q.answers_count || 0} উত্তর</span>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(questionEl);
    });
}

/**
 * Update answers count display
 */
function updateAnswersCount() {
    const banglaNumbers = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    const count = state.totalAnswers.toString().split('').map(d => banglaNumbers[parseInt(d)]).join('');
    document.getElementById('answers-count').textContent = `${count}টি উত্তর`;
}

/**
 * Show error page
 */
function showError() {
    document.getElementById('loading-skeleton').classList.add('hidden');
    document.getElementById('question-container').classList.add('hidden');
    document.getElementById('error-container').classList.remove('hidden');
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
    
    if (diffMins < 60) {
        return `${diffMins} মিনিট আগে`;
    } else if (diffHours < 24) {
        return `${diffHours} ঘন্টা আগে`;
    } else if (diffDays < 7) {
        return `${diffDays} দিন আগে`;
    } else {
        return date.toLocaleDateString('bn-BD', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Question votes
    document.getElementById('question-upvote').addEventListener('click', () => {
        handleQuestionVote('up');
    });
    
    document.getElementById('question-downvote').addEventListener('click', () => {
        handleQuestionVote('down');
    });
    
    // Answer votes (delegated)
    document.getElementById('answers-list').addEventListener('click', (e) => {
        const upvoteBtn = e.target.closest('.answer-upvote');
        const downvoteBtn = e.target.closest('.answer-downvote');
        const acceptBtn = e.target.closest('.accept-answer');
        
        if (upvoteBtn) {
            const answerId = parseInt(upvoteBtn.dataset.answerId);
            handleAnswerVote(answerId, 'up');
        } else if (downvoteBtn) {
            const answerId = parseInt(downvoteBtn.dataset.answerId);
            handleAnswerVote(answerId, 'down');
        } else if (acceptBtn) {
            const answerId = parseInt(acceptBtn.dataset.answerId);
            toggleAcceptAnswer(answerId);
        }
    });
    
    // Sort buttons
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const sort = btn.dataset.sort;
            state.currentSort = sort;
            
            // Update button states
            document.querySelectorAll('.sort-btn').forEach(b => {
                b.classList.remove('bg-brand-500', 'text-brand-600');
                b.classList.add('text-gray-600', 'dark:text-gray-400');
            });
            btn.classList.add('bg-brand-500', 'text-brand-600');
            btn.classList.remove('text-gray-600', 'dark:text-gray-400');
            
            // Reload answers
            state.answersLoaded = 0;
            state.answers = [];
            const { answers, total } = await fetchAnswers(state.questionId, sort, 0, CONFIG.ANSWERS_PER_PAGE);
            state.answers = answers;
            state.totalAnswers = total;
            state.answersLoaded = Math.min(CONFIG.ANSWERS_PER_PAGE, answers.length);
            renderAnswers();
        });
    });
    
    // Load more button
    document.getElementById('load-more-btn').addEventListener('click', () => {
        state.answersLoaded = Math.min(state.answersLoaded + CONFIG.ANSWERS_PER_PAGE, state.answers.length);
        renderAnswers();
    });
    
    // Editor tabs
    const writeTab = document.getElementById('write-tab');
    const previewTab = document.getElementById('preview-tab');
    const editor = document.getElementById('answer-editor');
    const preview = document.getElementById('answer-preview');
    
    writeTab.addEventListener('click', () => {
        writeTab.classList.add('text-brand-600', 'border-brand-600');
        writeTab.classList.remove('text-gray-600', 'dark:text-gray-400');
        previewTab.classList.remove('text-brand-600', 'border-brand-600');
        previewTab.classList.add('text-gray-600', 'dark:text-gray-400');
        
        editor.classList.remove('hidden');
        preview.classList.add('hidden');
        document.getElementById('editor-toolbar').classList.remove('hidden');
    });
    
    previewTab.addEventListener('click', () => {
        previewTab.classList.add('text-brand-600', 'border-brand-600');
        previewTab.classList.remove('text-gray-600', 'dark:text-gray-400');
        writeTab.classList.remove('text-brand-600', 'border-brand-600');
        writeTab.classList.add('text-gray-600', 'dark:text-gray-400');
        
        editor.classList.add('hidden');
        preview.classList.remove('hidden');
        document.getElementById('editor-toolbar').classList.add('hidden');
        
        // Render preview
        preview.innerHTML = renderMarkdown(editor.value);
        renderLaTeX(preview);
    });
    
    // Editor toolbar
    document.getElementById('editor-toolbar').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        
        const action = btn.dataset.action;
        insertMarkdown(action);
    });
    
    // Submit answer
    document.getElementById('submit-answer-btn').addEventListener('click', submitAnswer);
    
    // Share button
    document.getElementById('share-btn').addEventListener('click', () => {
        const url = window.location.href;
        if (navigator.share) {
            navigator.share({
                title: state.question.title,
                url: url
            });
        } else {
            navigator.clipboard.writeText(url);
            alert('লিংক কপি করা হয়েছে!');
        }
    });
}

/**
 * Insert markdown syntax into editor
 */
function insertMarkdown(action) {
    const editor = document.getElementById('answer-editor');
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selectedText = editor.value.substring(start, end);
    let insertion = '';
    
    switch (action) {
        case 'bold':
            insertion = `**${selectedText || 'bold text'}**`;
            break;
        case 'italic':
            insertion = `*${selectedText || 'italic text'}*`;
            break;
        case 'heading':
            insertion = `## ${selectedText || 'Heading'}`;
            break;
        case 'code':
            insertion = selectedText.includes('\n') 
                ? `\`\`\`\n${selectedText || 'code'}\n\`\`\`` 
                : `\`${selectedText || 'code'}\``;
            break;
        case 'link':
            insertion = `[${selectedText || 'link text'}](url)`;
            break;
        case 'image':
            insertion = `![${selectedText || 'alt text'}](image-url)`;
            break;
        case 'latex':
            insertion = `$${selectedText || 'E = mc^2'}$`;
            break;
    }
    
    editor.value = editor.value.substring(0, start) + insertion + editor.value.substring(end);
    editor.focus();
    editor.setSelectionRange(start + insertion.length, start + insertion.length);
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Main initialization function
 */
export async function initQuestionPage() {
    // Parse URL
    const { id, slug } = parseURLParams();
    
    if (!id) {
        showError();
        return;
    }
    
    state.questionId = id;
    state.questionSlug = slug;
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    state.currentUser = user;
    
    // Fetch question
    const question = await fetchQuestion(id);
    
    if (!question) {
        return; // Error already shown
    }
    
    state.question = question;
    
    // Validate slug and redirect if necessary
    if (validateAndRedirectSlug(question.slug)) {
        return; // Redirecting...
    }
    
    // Inject SEO meta tags
    injectSEOMeta(question);
    
    // Fetch answers
    const { answers, total } = await fetchAnswers(id, state.currentSort, 0, CONFIG.ANSWERS_PER_PAGE);
    state.answers = answers;
    state.totalAnswers = total;
    state.answersLoaded = Math.min(CONFIG.ANSWERS_PER_PAGE, answers.length);
    
    // Inject structured data
    injectStructuredData(question, answers);
    
    // Fetch related questions
    const relatedQuestions = await fetchRelatedQuestions(id, question.tag, question.title);
    
    // Increment view count
    incrementViewCount(id);
    
    // Hide loading, show content
    document.getElementById('loading-skeleton').classList.add('hidden');
    document.getElementById('question-container').classList.remove('hidden');
    
    // Render all
    renderQuestion();
    renderAnswers();
    renderRelatedQuestions(relatedQuestions);
    updateAnswersCount();
    
    // Setup event listeners
    setupEventListeners();
}
