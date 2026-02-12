import { supabase } from './supabase-config.js';

async function loadQuestion() {
    // ১. এলিমেন্টগুলো সিলেক্ট করা
    const skeleton = document.getElementById('loading-skeleton');
    const content = document.getElementById('question-content');
    const errorState = document.getElementById('error-state');

    try {
        // ২. URL থেকে ID বের করা (physflow.pages.dev/question/ID/SLUG)
        const path = window.location.pathname;
        const parts = path.split('/').filter(p => p.length > 0);
        
        // parts[0] = question, parts[1] = uuid
        const qId = parts[1];

        if (!qId || qId === 'question') {
            console.error("No ID found");
            throw new Error("Invalid ID");
        }

        // ৩. সরাসরি Supabase থেকে ডাটা আনা (কোনো জটিল রিলেশন নেই)
        const { data: question, error } = await supabase
            .from('question')
            .select('*')
            .eq('id', qId)
            .single();

        if (error || !question) {
            console.error("Supabase error:", error);
            throw new Error("Question not found");
        }

        // ৪. UI-তে ডাটা বসানো
        document.title = question.title;
        
        const titleEl = document.getElementById('q-title');
        const bodyEl = document.getElementById('q-body');
        const dateEl = document.getElementById('q-date');

        if (titleEl) titleEl.textContent = question.title;
        if (bodyEl) bodyEl.innerHTML = question.body; // মার্কডাউন থাকলে পরে অ্যাড করা যাবে
        if (dateEl) dateEl.textContent = new Date(question.created_at).toLocaleDateString('bn-BD');

        // ৫. লোডিং বন্ধ করে কন্টেন্ট দেখানো
        if (skeleton) skeleton.classList.add('hidden');
        if (content) content.classList.remove('hidden');

    } catch (err) {
        console.error("Final Error:", err);
        if (skeleton) skeleton.classList.add('hidden');
        if (errorState) errorState.classList.remove('hidden');
    }
}

// পেজ লোড হলে ফাংশনটি চালু করো
document.addEventListener('DOMContentLoaded', loadQuestion);
