import { supabase } from './supabase-config.js';

async function loadQuestion() {
    const path = window.location.pathname;
    const parts = path.split('/').filter(p => p.length > 0);
    const qId = parts[1]; // /question/ID/slug

    // কন্টেন্ট এলিমেন্টগুলো ধরছি
    const skeleton = document.getElementById('loading-skeleton');
    const content = document.getElementById('question-content');
    const errorState = document.getElementById('error-state');

    // ডিবাগ অ্যালার্ট (শুধু চেক করার জন্য)
    if (!qId) {
        alert("ইউআরএল এ কোনো আইডি পাওয়া যায়নি! পাথ হলো: " + path);
        if(errorState) errorState.classList.remove('hidden');
        return;
    }

    try {
        // সরাসরি আইডি দিয়ে কুয়েরি
        const { data: question, error } = await supabase
            .from('question')
            .select('*')
            .eq('id', qId)
            .single();

        if (error || !question) {
            alert("সুপাবেস ডাটা পায়নি। এরর: " + (error ? error.message : "Not found"));
            throw new Error("No data");
        }

        // ডাটা রেন্ডার
        document.getElementById('q-title').innerText = question.title;
        document.getElementById('q-body').innerHTML = question.body;
        
        // তারিখ (যদি এলিমেন্ট থাকে)
        const dateEl = document.getElementById('q-date');
        if(dateEl) dateEl.innerText = new Date(question.created_at).toLocaleDateString('bn-BD');

        // লোডিং বন্ধ
        if(skeleton) skeleton.classList.add('hidden');
        if(content) content.classList.remove('hidden');

    } catch (err) {
        if(skeleton) skeleton.classList.add('hidden');
        if(errorState) errorState.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', loadQuestion);
