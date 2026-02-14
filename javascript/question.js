// javascript/question.js
import { supabase } from './supabase-config.js';

// Get question ID from URL
function getQuestionId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

// Format time ago
function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'কিছুক্ষণ আগে';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} মিনিট আগে`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} ঘণ্টা আগে`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} দিন আগে`;
    if (seconds < 2592000) return `${Math.floor(seconds / 604800)} সপ্তাহ আগে`;
    if (seconds < 31536000) return `${Math.floor(seconds / 2592000)} মাস আগে`;
    return `${Math.floor(seconds / 31536000)} বছর আগে`;
}

// Bengali number converter
function toBengaliNumber(num) {
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(num).split('').map(digit => bengaliDigits[parseInt(digit)] || digit).join('');
}

// Fetch question data
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
        return null;
    }
}

// Fetch answers for question
async function fetchAnswers(questionId) {
    try {
        const { data, error } = await supabase
            .from('answer')
            .select(`
                *,
                profile:profile(username, avatar_url)
            `)
            .eq('question_id', questionId)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching answers:', error);
        return [];
    }
}

// Display question
function displayQuestion(question) {
    document.getElementById('question-title').textContent = question.title;
    document.getElementById('question-body').textContent = question.body;
    document.getElementById('created-time').textContent = timeAgo(question.created_at || new Date());
    
    // Set random view count for demo
    const viewCount = Math.floor(Math.random() * 500) + 10;
    document.getElementById('view-count').textContent = `${toBengaliNumber(viewCount)} বার দেখা হয়েছে`;
    
    // Set random vote count for demo
    const voteCount = Math.floor(Math.random() * 50);
    document.getElementById('vote-count').textContent = toBengaliNumber(voteCount);
    
    // Demo tags
    const tagsContainer = document.getElementById('question-tags');
    const demoTags = ['কোয়ান্টাম', 'তাপগতিবিদ্যা', 'গতিবিদ্যা'];
    const randomTags = demoTags.sort(() => 0.5 - Math.random()).slice(0, 2);
    
    tagsContainer.innerHTML = randomTags.map(tag => `
        <span class="inline-flex items-center gap-1 px-3 py-1 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-sm hover:bg-gray-300 dark:hover:bg-gray-700 cursor-pointer transition">
            <i class="fas fa-tag text-xs"></i>
            ${tag}
        </span>
    `).join('');
}

// Display single answer
function createAnswerCard(answer, index) {
    const username = answer.profile?.username || 'ব্যবহারকারী';
    const avatarUrl = answer.profile?.avatar_url || 'https://via.placeholder.com/40';
    const randomVotes = Math.floor(Math.random() * 30);
    
    return `
        <div class="bg-white dark:bg-[#1a1a1b] rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div class="flex">
                <!-- Vote Section -->
                <div class="flex flex-col items-center gap-2 p-4 bg-gray-50 dark:bg-[#0f0f10] border-r border-gray-200 dark:border-gray-800">
                    <button class="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition">
                        <i class="fas fa-arrow-up text-lg text-gray-400 hover:text-brand-600"></i>
                    </button>
                    <span class="text-base font-bold text-gray-700 dark:text-gray-300">${toBengaliNumber(randomVotes)}</span>
                    <button class="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition">
                        <i class="fas fa-arrow-down text-lg text-gray-400 hover:text-red-500"></i>
                    </button>
                </div>

                <!-- Answer Content -->
                <div class="flex-1 p-6">
                    <!-- Author Info -->
                    <div class="flex items-center gap-3 mb-4">
                        <img src="${avatarUrl}" alt="${username}" class="w-10 h-10 rounded-full border-2 border-gray-200 dark:border-gray-700">
                        <div>
                            <p class="font-medium text-gray-900 dark:text-gray-100 hover:text-brand-600 cursor-pointer">${username}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-500">${timeAgo(answer.created_at)}</p>
                        </div>
                    </div>

                    <!-- Answer Text -->
                    <div class="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                        ${answer.content}
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex gap-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                        <button class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-brand-600 transition">
                            <i class="fas fa-reply"></i>
                            উত্তর দিন
                        </button>
                        <button class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-brand-600 transition">
                            <i class="fas fa-share"></i>
                            শেয়ার করুন
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Display all answers
function displayAnswers(answers) {
    const answersList = document.getElementById('answers-list');
    const noAnswers = document.getElementById('no-answers');
    const answerCount = document.getElementById('answer-count');
    
    answerCount.textContent = toBengaliNumber(answers.length);
    
    if (answers.length === 0) {
        answersList.classList.add('hidden');
        noAnswers.classList.remove('hidden');
    } else {
        answersList.classList.remove('hidden');
        noAnswers.classList.add('hidden');
        
        answersList.innerHTML = answers.map((answer, index) => 
            createAnswerCard(answer, index)
        ).join('');
    }
}

// Handle answer submission
async function handleAnswerSubmit(event) {
    event.preventDefault();
    
    const questionId = getQuestionId();
    const content = document.getElementById('answer-content').value.trim();
    
    if (!content) {
        alert('অনুগ্রহ করে আপনার উত্তর লিখুন');
        return;
    }
    
    // Check if user is logged in
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        alert('উত্তর পোস্ট করতে অনুগ্রহ করে লগ ইন করুন');
        return;
    }
    
    try {
        const { data, error } = await supabase
            .from('answer')
            .insert([
                {
                    question_id: questionId,
                    content: content,
                    user_id: user.id
                }
            ])
            .select()
            .single();
        
        if (error) throw error;
        
        // Clear form
        document.getElementById('answer-content').value = '';
        
        // Reload answers
        const answers = await fetchAnswers(questionId);
        displayAnswers(answers);
        
        // Show success message
        alert('আপনার উত্তর সফলভাবে পোস্ট করা হয়েছে!');
        
    } catch (error) {
        console.error('Error submitting answer:', error);
        alert('উত্তর পোস্ট করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    }
}

// Initialize question page
export async function initQuestionPage() {
    const questionId = getQuestionId();
    
    if (!questionId) {
        // Show error if no ID in URL
        document.getElementById('loading-state').classList.add('hidden');
        document.getElementById('error-state').classList.remove('hidden');
        return;
    }
    
    // Fetch question
    const question = await fetchQuestion(questionId);
    
    if (!question) {
        // Show error if question not found
        document.getElementById('loading-state').classList.add('hidden');
        document.getElementById('error-state').classList.remove('hidden');
        return;
    }
    
    // Fetch answers
    const answers = await fetchAnswers(questionId);
    
    // Hide loading, show content
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('question-content').classList.remove('hidden');
    
    // Display data
    displayQuestion(question);
    displayAnswers(answers);
    
    // Setup form handler
    const answerForm = document.getElementById('answer-form');
    answerForm.addEventListener('submit', handleAnswerSubmit);
}
