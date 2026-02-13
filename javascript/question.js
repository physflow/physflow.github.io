// javascript/question.js - Query Parameter Version (GUARANTEED!)

import { supabase } from './supabase-config.js';

const CONFIG = {
    ANSWERS_PER_PAGE: 5,
    SESSION_KEY: 'question_views'
};

let state = {
    questionId: null,
    question: null,
    answers: [],
    answersLoaded: 0,
    totalAnswers: 0
};

// ============================================
// URL PARSING - Query Parameter (SIMPLE!)
// ============================================

function getQuestionId() {
    // Get ?id=xyz from URL
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
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

async function fetchAnswers(questionId) {
    try {
        const { data, error, count } = await supabase
            .from('answer')
            .select('*', { count: 'exact' })
            .eq('question_id', questionId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        return { answers: data || [], total: count || 0 };
    } catch (error) {
        console.error('Error fetching answers:', error);
        return { answers: [], total: 0 };
    }
}

// ============================================
// VIEW INCREMENT
// ============================================

async function incrementViewCount(questionId) {
    const viewed = JSON.parse(sessionStorage.getItem(CONFIG.SESSION_KEY) || '[]');
    if (viewed.includes(questionId)) return;
    
    try {
        const currentViews = state.question.views || 0;
        const { error } = await supabase
            .from('question')
            .update({ views: currentViews + 1 })
            .eq('id', questionId);
        
        if (!error) {
            viewed.push(questionId);
            sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(viewed));
            state.question.views = currentViews + 1;
            document.getElementById('question-views').textContent = currentViews + 1;
        }
    } catch (error) {
        console.error('View increment error:', error);
    }
}

// ============================================
// RENDERING
// ============================================

function renderMarkdown(text) {
    if (!text) return '';
    
    // Simple markdown rendering
    if (typeof marked !== 'undefined') {
        return marked.parse(text);
    }
    
    // Fallback: basic formatting
    return text
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

function renderQuestion() {
    document.getElementById('question-title').textContent = state.question.title;
    document.getElementById('question-date').textContent = formatDate(state.question.created_at);
    document.getElementById('question-views').textContent = state.question.views || 0;
    document.getElementById('question-author').textContent = state.question.author_name || 'Anonymous';
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
    
    if (visibleAnswers.length === 0) {
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400">এখনও কোনো উত্তর নেই</p>';
        return;
    }
    
    visibleAnswers.forEach(answer => {
        const answerEl = document.createElement('div');
        answerEl.className = 'pb-6 border-b dark:border-gray-700 mb-6';
        answerEl.innerHTML = `
            <div class="markdown-content prose dark:prose-invert max-w-none mb-4">
                ${renderMarkdown(answer.body)}
            </div>
            <div class="text-sm text-gray-600 dark:text-gray-400">
                <span>উত্তর দেওয়া হয়েছে ${formatDate(answer.created_at)}</span>
                ${answer.votes ? ` • ${answer.votes} ভোট` : ''}
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

function updateAnswersCount() {
    const banglaNumbers = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    const count = state.totalAnswers.toString().split('').map(d => banglaNumbers[parseInt(d)] || d).join('');
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
    
    return date.toLocaleDateString('bn-BD', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            state.answersLoaded = Math.min(
                state.answersLoaded + CONFIG.ANSWERS_PER_PAGE, 
                state.answers.length
            );
            renderAnswers();
        });
    }
}

// ============================================
// INITIALIZATION
// ============================================

export async function initQuestionPage() {
    console.log('🚀 Question page initializing...');
    
    // Get question ID from URL (?id=xyz)
    const questionId = getQuestionId();
    
    console.log('Question ID:', questionId);
    
    if (!questionId) {
        console.error('❌ No question ID in URL');
        showError();
        return;
    }
    
    state.questionId = questionId;
    
    // Fetch question
    console.log('📡 Fetching question...');
    const question = await fetchQuestion(questionId);
    
    if (!question) {
        console.error('❌ Question not found');
        return;
    }
    
    state.question = question;
    console.log('✅ Question loaded:', question.title);
    
    // Fetch answers
    console.log('📡 Fetching answers...');
    const { answers, total } = await fetchAnswers(questionId);
    state.answers = answers;
    state.totalAnswers = total;
    state.answersLoaded = Math.min(CONFIG.ANSWERS_PER_PAGE, answers.length);
    
    console.log(`✅ Loaded ${answers.length} answers`);
    
    // Increment views
    incrementViewCount(questionId);
    
    // Hide loading, show content
    document.getElementById('loading-skeleton').classList.add('hidden');
    document.getElementById('question-container').classList.remove('hidden');
    
    // Render everything
    renderQuestion();
    renderAnswers();
    updateAnswersCount();
    
    // Setup event listeners
    setupEventListeners();
    
    console.log('✅ Initialization complete!');
}
