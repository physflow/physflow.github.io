import { supabase } from './supabase-config.js';

/**
 * মোবাইল ব্রাউজারের জন্য বিশেষ URL হ্যান্ডলার
 */
function getQuestionParams() {
    const path = window.location.pathname;
    // স্ল্যাশ দিয়ে পাথ ভেঙে ফেলা
    const parts = path.split('/').filter(p => p.length > 0);
    
    // /question/uuid/slug ফরম্যাটে parts[1] হবে ID
    return {
        id: parts[1] || null,
        slug: parts[2] || null
    };
}

/**
 * প্রশ্ন লোড করার মূল ফাংশন
 */
async function loadQuestion() {
    const params = getQuestionParams();
    const qId = params.id;
    
    const skeleton = document.getElementById('loading-skeleton');
    const content = document.getElementById('question-content');
    const errorState = document.getElementById('error-state');

    // যদি আইডি না থাকে
    if (!qId || qId === 'question') {
        if(skeleton) skeleton.classList.add('hidden');
        if(errorState) errorState.classList.remove('hidden');
        return;
    }

    try {
        // সরাসরি আইডি দিয়ে কুয়েরি
        const { data: question, error } = await supabase
            .from('question')
            .select(`
                *,
                author:profiles(username, avatar_url)
            `)
            .eq('id', qId)
            .single();

        if (error || !question) throw new Error('Data not found');

        // ইউআই আপডেট
        renderUI(question);
        
        if(skeleton) skeleton.classList.add('hidden');
        if(content) content.classList.remove('hidden');

    } catch (err) {
        console.error(err);
        if(skeleton) skeleton.classList.add('hidden');
        if(errorState) errorState.classList.remove('hidden');
    }
}

function renderUI(question) {
    document.title = question.title;
    
    // টাইটেল
    const t = document.getElementById('q-title');
    if(t) t.textContent = question.title;

    // বডি
    const b = document.getElementById('q-body');
    if(b) {
        // Marked লাইব্রেরি থাকলে ব্যবহার করবে, নাহলে নরমাল টেক্সট
        b.innerHTML = (typeof marked !== 'undefined') ? marked.parse(question.body) : question.body;
    }

    // লেখক ও তারিখ
    const authName = document.getElementById('q-author-name');
    const authImg = document.getElementById('q-author-img');
    const date = document.getElementById('q-date');

    if(authName) authName.textContent = question.author?.username || 'অজানা';
    if(authImg) authImg.src = question.author?.avatar_url || '';
    if(date) date.textContent = new Date(question.created_at).toLocaleDateString('bn-BD');

    // ট্যাগ
    const tagsContainer = document.getElementById('q-tags');
    if(tagsContainer && question.tag) {
        tagsContainer.innerHTML = '';
        const tags = Array.isArray(question.tag) ? question.tag : [];
        tags.forEach(tag => {
            const s = document.createElement('span');
            s.className = "bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs mr-2";
            s.textContent = '#' + tag;
            tagsContainer.appendChild(s);
        });
    }
}

document.addEventListener('DOMContentLoaded', loadQuestion);
