import { supabase } from './supabase-config.js';

// ১. ইউআরএল থেকে আইডি এবং স্লাগ নেওয়া
function getQuestionParams() {
    const path = window.location.pathname;
    const parts = path.split('/').filter(p => p.length > 0);
    return {
        id: parts[1] || null,
        slug: parts[2] || null
    };
}

// ২. প্রশ্ন লোড করা (একদম সহজ পদ্ধতিতে)
async function loadQuestion() {
    const { id } = getQuestionParams();
    
    const skeleton = document.getElementById('loading-skeleton');
    const content = document.getElementById('question-content');
    const errorState = document.getElementById('error-state');

    if (!id || id === 'question') {
        if(skeleton) skeleton.classList.add('hidden');
        if(errorState) errorState.classList.remove('hidden');
        return;
    }

    try {
        // কোনো প্রোফাইল বা জয়েন কোয়েরি নেই, সরাসরি প্রশ্ন টেবিল থেকে ডাটা আনা
        const { data: question, error } = await supabase
            .from('question')
            .select('*') 
            .eq('id', id)
            .single();

        if (error || !question) throw new Error('Data not found');

        // ডাটা দেখানো
        document.title = question.title;
        document.getElementById('q-title').textContent = question.title;
        document.getElementById('q-body').innerHTML = question.body; // Marked থাকলে marked.parse(question.body) দেবে
        document.getElementById('q-date').textContent = new Date(question.created_at).toLocaleDateString('bn-BD');

        // লোডিং বন্ধ
        if(skeleton) skeleton.classList.add('hidden');
        if(content) content.classList.remove('hidden');

    } catch (err) {
        console.error(err);
        if(skeleton) skeleton.classList.add('hidden');
        if(errorState) errorState.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', loadQuestion);
