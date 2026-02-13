// javascript/question.js

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
// URL PARSING
// ============================================

function getQuestionId() {
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
    if (typeof marked !== 'undefined') return marked.parse(text);
    return text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffHours < 24) return `${Math.floor(diffMs / 60000) < 60 ? Math.floor(diffMs / 60000) + ' মিনিট' : diffHours + ' ঘণ্টা'} আগে`;
    
    return date.toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' });
}

function renderQuestion() {
    const container = document.getElementById('question-container');
    
    // UI Structure
    container.innerHTML = `
        <header class="border-b dark:border-gray-700 pb-6 mb-6">
            <h1 class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">${state.question.title}</h1>
            <div class="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
                <span>প্রশ্ন করা হয়েছে: <b>${formatDate(state.question.created_at)}</b></span>
                <span>দেখা হয়েছে: <b>${state.question.views || 0} বার</b></span>
                <span>লেখক: <b>${state.question.author_name || 'Anonymous'}</b></span>
            </div>
        </header>

        <div class="flex gap-4 md:gap-8">
            <div class="flex flex-col items-center gap-3">
                <button class="p-2 border dark:border-gray-700 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
                </button>
                <span class="text-xl font-bold text-gray-700 dark:text-gray-200">${state.question.votes || 0}</span>
                <button class="p-2 border dark:border-gray-700 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                <button class="mt-2 text-gray-400 hover:text-yellow-500 transition">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>
                </button>
            </div>

            <div class="flex-1 overflow-hidden">
                <div class="prose dark:prose-invert max-w-none mb-8 text-gray-800 dark:text-gray-200">
                    ${renderMarkdown(state.question.body)}
                </div>
                <div class="flex flex-wrap gap-2 mb-8">
                    ${(state.question.tag || []).map(tag => `
                        <span class="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium rounded-md">${tag}</span>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    document.title = `${state.question.title} - PhysFlow`;
}

function renderAnswers() {
    const container = document.getElementById('answers-list');
    container.innerHTML = '';
    
    const visibleAnswers = state.answers.slice(0, state.answersLoaded);
    
    if (visibleAnswers.length === 0) {
        container.innerHTML = '<p class="text-gray-500 py-4">এখনও কোনো উত্তর নেই।</p>';
        return;
    }
    
    visibleAnswers.forEach(answer => {
        const div = document.createElement('div');
        div.className = 'py-6 border-b dark:border-gray-800';
        div.innerHTML = `
            <div class="prose dark:prose-invert max-w-none mb-4">${renderMarkdown(answer.body)}</div>
            <div class="text-xs text-gray-500 text-right">উত্তর দিয়েছেন <b>${formatDate(answer.created_at)}</b></div>
        `;
        container.appendChild(div);
    });

    const loadMoreBtn = document.getElementById('load-more-btn');
    if (state.answersLoaded < state.answers.length) {
        loadMoreBtn?.classList.remove('hidden');
    } else {
        loadMoreBtn?.classList.add('hidden');
    }
}

function updateAnswersCount() {
    const countEl = document.getElementById('answers-count');
    if (countEl) countEl.textContent = `${state.totalAnswers}টি উত্তর`;
}

function showError() {
    const loader = document.getElementById('loading-skeleton');
    const error = document.getElementById('error-container');
    if (loader) loader.classList.add('hidden');
    if (error) error.classList.remove('hidden');
}

// ============================================
// INITIALIZATION
// ============================================

export async function initQuestionPage() {
    const questionId = getQuestionId();
    if (!questionId) return showError();

    state.questionId = questionId;
    const question = await fetchQuestion(questionId);
    
    if (!question) return;
    state.question = question;

    const { answers, total } = await fetchAnswers(questionId);
    state.answers = answers;
    state.totalAnswers = total;
    state.answersLoaded = Math.min(CONFIG.ANSWERS_PER_PAGE, answers.length);

    incrementViewCount(questionId);

    // Toggle Visibility
    document.getElementById('loading-skeleton')?.classList.add('hidden');
    document.getElementById('question-container')?.classList.remove('hidden');

    renderQuestion();
    renderAnswers();
    updateAnswersCount();

    // Load More Event
    document.getElementById('load-more-btn')?.addEventListener('click', () => {
        state.answersLoaded = Math.min(state.answersLoaded + CONFIG.ANSWERS_PER_PAGE, state.answers.length);
        renderAnswers();
    });
}
