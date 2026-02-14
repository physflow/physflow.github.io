import { supabase } from './supabase-config.js';
import { setupLayout, initTheme } from './layout.js';

// লেআউট ইনিশিয়ালাইজেশন
initTheme();
setupLayout();

const urlParams = new URLSearchParams(window.location.search);
const questionId = urlParams.get('id');

async function fetchQuestionDetails() {
    if (!questionId) return;

    // ১. প্রশ্নের ডাটা ফেচ করা
    const { data: question, error } = await supabase
        .from('questions')
        .select(`*, profiles(username, avatar_url)`)
        .eq('id', questionId)
        .single();

    if (error) {
        console.error('Error:', error);
        return;
    }

    // UI আপডেট
    document.title = `${question.title} - physflow`;
    document.getElementById('question-title').innerText = question.title;
    document.getElementById('question-body').innerText = question.content;
    document.getElementById('author-name').innerText = `u/${question.profiles.username}`;
    document.getElementById('vote-count').innerText = question.votes || 0;
    
    loadComments();
}

async function loadComments() {
    const { data: comments, error } = await supabase
        .from('comments')
        .select(`*, profiles(username, avatar_url)`)
        .eq('question_id', questionId)
        .order('created_at', { ascending: false });

    if (error) return;

    const commentsSection = document.getElementById('comments-section');
    const commentCountText = document.getElementById('comment-count-text');
    commentCountText.innerText = `${comments.length} Comments`;
    
    commentsSection.innerHTML = comments.map(comment => `
        <div class="flex gap-2">
            <div class="flex flex-col items-center shrink-0">
                <img src="${comment.profiles.avatar_url || 'https://via.placeholder.com/30'}" class="w-7 h-7 rounded-full">
                <div class="w-0.5 h-full bg-gray-200 dark:bg-[#343536] my-1"></div>
            </div>
            <div class="flex-1">
                <div class="flex items-center gap-2 text-xs mb-1">
                    <span class="font-bold text-gray-900 dark:text-[#D7DADC]">${comment.profiles.username}</span>
                    <span class="text-gray-500">${new Date(comment.created_at).toLocaleDateString()}</span>
                </div>
                <div class="text-sm mb-2">${comment.content}</div>
                <div class="flex items-center gap-3 text-gray-500 text-xs font-bold">
                    <div class="flex items-center gap-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-1 rounded">
                        <i class="fas fa-arrow-up"></i> 0 <i class="fas fa-arrow-down"></i>
                    </div>
                    <span class="cursor-pointer hover:underline">Reply</span>
                </div>
            </div>
        </div>
    `).join('');
}

// কমেন্ট সাবমিট ফাংশন
document.getElementById('submit-comment').addEventListener('click', async () => {
    const content = document.getElementById('comment-input').value;
    if (!content) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        alert('কমেন্ট করতে লগইন করুন');
        return;
    }

    const { error } = await supabase
        .from('comments')
        .insert([{ 
            question_id: questionId, 
            user_id: user.id, 
            content: content 
        }]);

    if (!error) {
        document.getElementById('comment-input').value = '';
        loadComments();
    }
});

// পেজ লোড হলে কল হবে
fetchQuestionDetails();
