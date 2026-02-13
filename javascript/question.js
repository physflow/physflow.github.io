// javascript/question.js - Simplified version with ID-only URLs

import { supabase } from './supabase-config.js';

const CONFIG = {
    ANSWERS_PER_PAGE: 5,
    MIN_ANSWER_LENGTH: 50,
    SESSION_KEY: 'question_views',
    SITE_URL: 'https://physflow.pages.dev'
};

let state = {
    questionId: null,
    question: null,
    answers: [],
    currentSort: 'votes',
    answersLoaded: 0,
    totalAnswers: 0,
    currentUser: null
};

// ============================================
// URL PARSING - SIMPLE VERSION (ID only)
// ============================================

/**
 * Extract question ID from URL
 * Supports: /question/ID or /question/ID/slug (slug ignored)
 */
function parseURLParams() {
    // Check pathname
    const path = window.location.pathname;
    
    // Match: /question/ID or /question/ID/anything
    const match = path.match(/\/question\/([^\/]+)/);
    
    if (match) {
        return { id: match[1] }; // ID can be number or UUID string
    }
    
    return { id: null };
}

// ============================================
// DATA FETCHING
// ============================================

async function fetchQuestion(questionId) {
    try {
        const { data, error } = await supabase
            .from('question')
            .select('*')
            .eq('id', questionId)
            .single();
        
        if (error) throw error;
        if (!data) {
            showError();
            return null;
        }
        
        return data;
    } catch (error) {
        console.error('Error fetching question:', error);
        showError();
        return null;
    }
}

async function fetchAnswers(questionId, sort = 'votes', offset = 0, limit = CONFIG.ANSWERS_PER_PAGE) {
    try {
        let query = supabase
            .from('answer')
            .select('*', { count: 'exact' })
            .eq('question_id', questionId)
            .range(offset, offset + limit - 1);
        
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
        
        return { answers: data || [], total: count || 0 };
    } catch (error) {
        console.error('Error fetching answers:', error);
        return { answers: [], total: 0 };
    }
}

async function fetchRelatedQuestions(questionId, tag) {
    try {
        let { data, error } = await supabase
            .from('question')
            .select('id, title, slug, votes, answers_count')
            .neq('id', questionId)
            .limit(5);
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching related:', error);
        return [];
    }
}

// ============================================
// VIEW INCREMENT
// ============================================

async function incrementViewCount(questionId) {
    const viewed = JSON.parse(sessionStorage.getItem(CONFIG.SESSION_KEY) || '[]');
    if (viewed.includes(questionId)) return;
    
    try {
        const { error } = await supabase
            .from('question')
            .update({ views: state.question.views + 1 })
            .eq('id', questionId);
        
        if (!error) {
            viewed.push(questionId);
            sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(viewed));
        }
    } catch (error) {
        console.error('View increment error:', error);
    }
}

// ============================================
// RENDERING
// ============================================

function renderMarkdown(markdown) {
    if (typeof marked !== 'undefined') {
        return marked.parse(markdown);
    }
    return markdown.replace(/\n/g, '<br>');
}

function renderQuestion() {
    document.getElementById('question-title').textContent = state.question.title;
    document.getElementById('question-date').textContent = formatDate(state.question.created_at);
    document.getElementById('question-views').textContent = state.question.views || 0;
    document.getElementById('question-author').textContent = 'Anonymous';
    document.getElementById('question-votes').textContent = state.question.votes || 0;
    
    // Tags
    const tagsContainer = document.getElementById('question-tags');
    tagsContainer.innerHTML = '';
    if (state.question.tag && Array.isArray(state.question.tag)) {
        state.question.tag.forEach(tag => {
            const tagEl = document.createElement('span');
            tagEl.className = 'px-3 py-1 bg-gray-100 dark:bg-gray-800 text-sm rounded-full';
            tagEl.textContent = tag;
            tagsContainer.appendChild(tagEl);
        });
    }
    
    // Body
    const bodyContainer = document.getElementById('question-body');
    bodyContainer.innerHTML = renderMarkdown(state.question.body);
    
    // SEO
    document.title = `${state.question.title} - PhysFlow`;
}

function renderAnswers() {
    const container = document.getElementById('answers-list');
    container.innerHTML = '';
    
    const visibleAnswers = state.answers.slice(0, state.answersLoaded);
    
    visibleAnswers.forEach(answer => {
        const answerEl = document.createElement('div');
        answerEl.className = 'pb-6 border-b dark:border-gray-700';
        answerEl.innerHTML = `
            <div class="markdown-content prose dark:prose-invert max-w-none mb-4">
                ${renderMarkdown(answer.body)}
            </div>
            <div class="text-sm text-gray-600 dark:text-gray-400">
                <span>${formatDate(answer.created_at)}</span>
            </div>
        `;
        container.appendChild(answerEl);
    });
    
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (state.answersLoaded < state.answers.length) {
        loadMoreBtn.classList.remove('hidden');
    } else {
        loadMoreBtn.classList.add('hidden');
    }
}

function renderRelatedQuestions(questions) {
    const container = document.getElementById('related-questions');
    
    if (questions.length === 0) {
        container.innerHTML = '<p class="text-gray-500">কোন সম্পর্কিত প্রশ্ন নেই</p>';
        return;
    }
    
    container.innerHTML = questions.map(q => `
        <a href="/question/${q.id}" class="block p-3 rounded-lg border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
            <h4 class="font-medium text-gray-900 dark:text-gray-100">${q.title}</h4>
        </a>
    `).join('');
}

function updateAnswersCount() {
    const count = state.totalAnswers;
    document.getElementById('answers-count').textContent = `${count}টি উত্তর`;
}

function showError() {
    document.getElementById('loading-skeleton').classList.add('hidden');
    document.getElementById('question-container').classList.add('hidden');
    document.getElementById('error-container').classList.remove('hidden');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) return `${diffMins} মিনিট আগে`;
    if (diffHours < 24) return `${diffHours} ঘন্টা আগে`;
    if (diffDays < 7) return `${diffDays} দিন আগে`;
    
    return date.toLocaleDateString('bn-BD');
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    document.getElementById('load-more-btn')?.addEventListener('click', () => {
        state.answersLoaded = Math.min(state.answersLoaded + CONFIG.ANSWERS_PER_PAGE, state.answers.length);
        renderAnswers();
    });
}

// ============================================
// INITIALIZATION
// ============================================

export async function initQuestionPage() {
    console.log('🚀 Question page init...');
    
    // Parse URL
    const { id } = parseURLParams();
    
    console.log('Question ID:', id);
    
    if (!id) {
        console.error('No ID found');
        showError();
        return;
    }
    
    state.questionId = id;
    
    // Fetch question
    const question = await fetchQuestion(id);
    
    if (!question) {
        console.error('Question not found');
        return;
    }
    
    state.question = question;
    console.log('Question loaded:', question.title);
    
    // Fetch answers
    const { answers, total } = await fetchAnswers(id);
    state.answers = answers;
    state.totalAnswers = total;
    state.answersLoaded = Math.min(CONFIG.ANSWERS_PER_PAGE, answers.length);
    
    console.log(`Loaded ${answers.length} answers`);
    
    // Fetch related
    const related = await fetchRelatedQuestions(id, question.tag);
    
    // Increment views
    incrementViewCount(id);
    
    // Show content
    document.getElementById('loading-skeleton').classList.add('hidden');
    document.getElementById('question-container').classList.remove('hidden');
    
    // Render
    renderQuestion();
    renderAnswers();
    renderRelatedQuestions(related);
    updateAnswersCount();
    
    // Setup events
    setupEventListeners();
    
    console.log('✅ Init complete');
}
