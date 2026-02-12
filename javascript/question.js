import { supabase } from './supabase-config.js';

async function loadQuestion() {
    // ১. ইউআরএল থেকে আইডি বের করার সবচেয়ে নিরাপদ উপায়
    const path = window.location.pathname; // উদা: /question/033c6c73.../slug
    const parts = path.split('/').filter(p => p.length > 0);
    
    // parts[0] = 'question', parts[1] = 'uuid'
    const qId = parts[1]; 

    // এলিমেন্ট ধরা
    const skeleton = document.getElementById('loading-skeleton');
    const content = document.getElementById('question-content');
    const errorState = document.getElementById('error-state');

    // যদি আইডি না থাকে (মানে আইডি গায়েব হয়ে গেছে)
    if (!qId || qId === 'question') {
        console.error("ID missing from path: " + path);
        // মোবাইল ইউজারদের জন্য সরাসরি মেসেজ
        document.body.innerHTML = `<div style="padding:20px; text-align:center;">
            <h2>আইডি পাওয়া যায়নি</h2>
            <p>পাথ: ${path}</p>
            <a href="/">ফিরে যান</a>
        </div>`;
        return;
    }

    try {
        // ২. সুপাবেস থেকে শুধু আইডি দিয়ে ডাটা আনা
        const { data: question, error } = await supabase
            .from('question')
            .select('*')
            .eq('id', qId)
            .single();

        if (error || !question) throw new Error("Data not found");

        // ৩. ডাটা দেখানো
        document.title = question.title;
        document.getElementById('q-title').innerText = question.title;
        document.getElementById('q-body').innerHTML = question.body;
        
        // ৪. ইউআই আপডেট
        if(skeleton) skeleton.classList.add('hidden');
        if(content) content.classList.remove('hidden');

    } catch (err) {
        console.error(err);
        if(skeleton) skeleton.classList.add('hidden');
        if(errorState) errorState.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', loadQuestion);
