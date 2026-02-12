/**
 * question.js
 * * Question Page Logic for PhysFlow
 * UPDATED: Optimized for Bengali slugs and robust data fetching
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
 * Supports: /question/slug-name or /question/123
 */
function getQuestionParams() {
    // বর্তমান পাথ থেকে স্লাগ নেওয়া হচ্ছে
    const path = window.location.pathname;
    const pathSegments = path.split('/').filter(segment => segment !== "");
    
    // পাথ চেক: ["question", "slug-name"]
    if (pathSegments.length >= 2 && pathSegments[0] === 'question') {
        const lastSegment = pathSegments[pathSegments.length - 1];
        
        // যদি এটি একটি সংখ্যা হয় তবে আইডি হিসেবে ধরবে, নয়তো স্লাগ
        if (/^\d+$/.test(lastSegment)) {
            return { id: lastSegment, slug: null };
        } else {
            return { id: null, slug: decodeURIComponent(lastSegment) };
        }
    }
    
    // কুয়েরি প্যারামিটার ব্যাকআপ
    const params = new URLSearchParams(window.location.search);
    const queryId = params.get('id');
    const querySlug = params.get('slug');
    
    if (queryId) return { id: queryId, slug: null };
    if (querySlug) return { id: null, slug: decodeURIComponent(querySlug) };
    
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
    marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: false,
        mangle: false
    });
    return marked.parse(text);
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
    document.title = `${question.title} - physflow`;
    const description = question.body.substring(0, 150).replace(/[#*`]/g, '');
    
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.content = description;
    
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = `${question.title} - physflow`;
    
    const ogUrl = document.querySelector('meta[property="og:url"]');
    const canonicalUrl = `${window.location.origin}/question/${question.slug || question.id}`;
    if (ogUrl) ogUrl.content = canonicalUrl;
    
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
    
    const script = document.getElementById('structured-data');
    if (script) {
        script.textContent = JSON.stringify(structuredData, null, 2);
    }
}

// =============================================
// DATA FETCHING
// =============================================

async function fetchQuestion(params) {
    try {
        let query = supabase.from('question').select(`*, author:profiles(id, name, avatar)`);
        
        if (params.id) {
            query = query.eq('id', params.id);
        } else if (params.slug) {
            query = query.eq('slug', params.slug);
        } else {
            return null;
        }
        
        const { data, error } = await query.single();
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching question:', error);
        return null;
    }
}

async function fetchAnswers(questionId) {
    try {
        const { data, error } = await supabase
            .from('answers')
            .select(`*, author:profiles(id, name, avatar)`)
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

async function fetchRelatedQuestions(questionId, tags) {
    try {
        const { data, error } = await supabase
            .from('question')
            .select('id, title, slug, votes, views')
            .neq('id', questionId)
            .limit(5);
        if (error) throw error;
        return data || [];
    } catch (error) {
        return [];
    }
}

async function incrementViewCount(questionId) {
    const viewKey = `viewed_${questionId}`;
    if (sessionStorage.getItem(viewKey)) return;
    
    try {
        const { error } = await supabase.rpc('increment_question_views', { question_id: questionId });
        if (!error) sessionStorage.setItem(viewKey, 'true');
    } catch (error) {
        console.error('Error incrementing views:', error);
    }
}

async function fetchUserVotes(questionId) {
    if (!currentUserId) return;
    try {
        const { data: qVote } = await supabase.from('votes').select('vote_type').eq('user_id', currentUserId).eq('question_id', questionId).is('answer_id', null).single();
        if (qVote) userVotes.question = qVote.vote_type;

        const { data: aVotes } = await supabase.from('votes').select('answer_id, vote_type').eq('user_id', currentUserId).eq('question_id', questionId).not('answer_id', 'is', null);
        if (aVotes) aVotes.forEach(v => userVotes.answers[v.answer_id] = v.vote_type);
    } catch (error) {
        console.error('Error fetching user votes:', error);
    }
}

// =============================================
// RENDERING FUNCTIONS
// =============================================

function renderQuestion(question) {
    document.getElementById('question-title').textContent = question.title;
    document.getElementById('question-date').textContent = formatDate(question.created_at);
    document.getElementById('question-views').textContent = question.views || 0;
    document.getElementById('question-author').textContent = question.author?.name || 'Anonymous';
    
    const tagsContainer = document.getElementById('question-tags');
    tagsContainer.innerHTML = '';
    if (question.tags) {
        question.tags.forEach(tag => {
            const tagEl = document.createElement('a');
            tagEl.href = `/tags.html?tag=${encodeURIComponent(tag)}`;
            tagEl.className = 'tag';
            tagEl.textContent = tag;
            tagsContainer.appendChild(tagEl);
        });
    }
    
    const bodyEl = document.getElementById('question-body');
    bodyEl.innerHTML = renderMarkdown(question.body);
    renderLaTeX(bodyEl);
    
    document.getElementById('question-vote-count').textContent = question.votes || 0;
    if (userVotes.question === 'up') document.querySelector('.vote-btn.upvote').classList.add('active');
    if (userVotes.question === 'down') document.querySelector('.vote-btn.downvote').classList.add('active');
}

function renderAnswers(answers) {
    document.getElementById('answer-count').textContent = answers.length;
    const answersList = document.getElementById('answers-list');
    answersList.innerHTML = answers.length === 0 ? '<div class="text-center py-8 text-gray-500">এখনও কোনো উত্তর নেই।</div>' : '';
    answers.forEach(answer => answersList.appendChild(createAnswerElement(answer)));
}

function createAnswerElement(answer) {
    const div = document.createElement('div');
    div.className = `border-b dark:border-gray-700 pb-6 ${answer.is_accepted ? 'accepted-answer' : ''}`;
    const isAuthor = currentUserId && currentUserId === currentQuestion.author_id;
    const userVote = userVotes.answers[answer.id];
    
    div.innerHTML = `
        <div class="flex gap-4">
            <div class="vote-panel flex-shrink-0">
                <button class="vote-btn upvote ${userVote === 'up' ? 'active' : ''}" data-type="answer" data-id="${answer.id}" data-vote="up"><i class="fas fa-chevron-up text-2xl"></i></button>
                <div class="vote-count">${answer.votes || 0}</div>
                <button class="vote-btn downvote ${userVote === 'down' ? 'active' : ''}" data-type="answer" data-id="${answer.id}" data-vote="down"><i class="fas fa-chevron-down text-2xl"></i></button>
                ${answer.is_accepted ? '<div class="mt-4 text-green-500"><i class="fas fa-check-circle text-2xl"></i></div>' : isAuthor ? `<button class="vote-btn accept-btn mt-4" data-id="${answer.id}"><i class="far fa-check-circle text-xl"></i></button>` : ''}
            </div>
            <div class="flex-1">
                <div class="answer-body content-body prose dark:prose-invert max-w-none">${renderMarkdown(answer.body)}</div>
                <div class="flex items-center justify-between mt-4 pt-4 border-t dark:border-gray-700 text-sm text-gray-500">
                    <span>${answer.author?.name || 'Anonymous'} • ${formatDate(answer.created_at)}</span>
                </div>
            </div>
        </div>
    `;
    renderLaTeX(div.querySelector('.answer-body'));
    return div;
}

function renderRelatedQuestions(questions) {
    const container = document.getElementById('related-questions');
    container.innerHTML = questions.length === 0 ? '<p>কোনো সম্পর্কিত প্রশ্ন নেই।</p>' : '';
    questions.forEach(q => {
        const div = document.createElement('div');
        div.className = 'border-l-2 border-brand-600 pl-3 py-2';
        div.innerHTML = `<a href="/question/${q.slug || q.id}" class="text-brand-600 font-medium">${q.title}</a>`;
        container.appendChild(div);
    });
}

// =============================================
// MAIN LOAD FUNCTION
// =============================================

async function loadQuestionData() {
    const params = getQuestionParams();
    if (!params) { showError(); return; }
    
    document.getElementById('loading-skeleton').classList.remove('hidden');
    document.getElementById('question-container').classList.add('hidden');
    
    try {
        const question = await fetchQuestion(params);
        if (!question) { showError(); return; }
        
        currentQuestion = question;
        const qId = question.id;
        
        const { data: { user } } = await supabase.auth.getUser();
        currentUserId = user?.id || null;

        await fetchUserVotes(qId);
        const answers = await fetchAnswers(qId);
        currentAnswers = answers;
        
        renderQuestion(question);
        renderAnswers(currentAnswers);
        renderRelatedQuestions(await fetchRelatedQuestions(qId, question.tags));
        
        updateSEO(question);
        incrementViewCount(qId);
        
        document.getElementById('loading-skeleton').classList.add('hidden');
        document.getElementById('question-container').classList.remove('hidden');
    } catch (error) {
        showError();
    }
}

function showError() {
    document.getElementById('loading-skeleton').classList.add('hidden');
    document.getElementById('error-container').classList.remove('hidden');
}

// =============================================
// INITIALIZATION
// =============================================

export function initQuestionPage() {
    loadQuestionData();
    // এখানে তোমার setupAnswerEditor, setupSorting ইত্যাদি আগের ফাংশনগুলো কল করো
}

initQuestionPage();
