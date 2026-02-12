import { supabase } from './supabase-config.js';

/**
 * ইউআরএল থেকে আইডি এবং স্লাগ আলাদা করা
 * URL: /question/uuid-here/slug-text
 */
function getQuestionParams() {
    const path = window.location.pathname;
    const parts = path.split('/').filter(p => p.length > 0);
    
    // কনসোলে চেক করার জন্য - এটি তোমাকে দেখাবে ইউআরএল থেকে সে কি কি পাচ্ছে
    console.log("URL Path Parts:", parts);

    return {
        // parts[0] = 'question'
        id: parts[1] || null, // দ্বিতীয় অংশটি তোমার UUID
        slug: parts[2] || null // তৃতীয় অংশটি তোমার স্লাগ
    };
}

/**
 * ডাটাবেস থেকে প্রশ্ন লোড করার মূল ফাংশন
 */
async function loadQuestion() {
    const { id, slug } = getQuestionParams();
    
    const skeleton = document.getElementById('loading-skeleton');
    const content = document.getElementById('question-content');
    const errorState = document.getElementById('error-state');

    // যদি আইডি না পাওয়া যায়
    if (!id || id === 'question') {
        console.error("Error: URL-এ কোনো ভ্যালিড ID পাওয়া যায়নি!");
        if(skeleton) skeleton.classList.add('hidden');
        if(errorState) errorState.classList.remove('hidden');
        return;
    }

    try {
        console.log("Fetching data for ID:", id);

        // সুপাবেস থেকে শুধু আইডি দিয়ে প্রশ্ন লোড করা হচ্ছে
        const { data: question, error } = await supabase
            .from('question')
            .select(`
                *,
                author:profiles(username, avatar_url)
            `)
            .eq('id', id)
            .single();

        if (error) {
            console.error("Supabase Query Error:", error.message);
            throw error;
        }

        if (!question) {
            console.error("Error: ডাটাবেসে এই আইডি দিয়ে কোনো প্রশ্ন নেই!");
            throw new Error('No data found');
        }

        // যদি ইউআরএল এর স্লাগ ডাটাবেসের স্লাগের সাথে না মিলে, তবে সঠিক স্লাগ দিয়ে ইউআরএল ঠিক করা
        if (slug !== question.slug) {
            window.history.replaceState(null, '', `/question/${question.id}/${question.slug}`);
        }

        // পেজে ডাটা দেখানো
        renderQuestionUI(question);
        
        // UI আপডেট
        if(skeleton) skeleton.classList.add('hidden');
        if(content) content.classList.remove('hidden');
        console.log("Question loaded successfully!");

    } catch (err) {
        console.error('Final Load Error:', err);
        if(skeleton) skeleton.classList.add('hidden');
        if(errorState) errorState.classList.remove('hidden');
    }
}

/**
 * HTML এলিমেন্টগুলোতে ডাটা বসানো
 */
function renderQuestionUI(question) {
    // শিরোনাম
    document.title = `${question.title} - physflow`;
    const titleEl = document.getElementById('q-title');
    if(titleEl) titleEl.textContent = question.title;

    // বডি (marked.js ব্যবহার করলে সেটি কাজ করবে, নাহলে সরাসরি টেক্সট)
    const bodyEl = document.getElementById('q-body');
    if(bodyEl) {
        bodyEl.innerHTML = (typeof marked !== 'undefined') ? marked.parse(question.body) : question.body;
    }

    // তারিখ
    const dateEl = document.getElementById('q-date');
    if(dateEl) dateEl.textContent = new Date(question.created_at).toLocaleDateString('bn-BD');

    // লেখক
    const author = question.author || { username: 'অজানা লেখক', avatar_url: 'https://via.placeholder.com/40' };
    const nameEl = document.getElementById('q-author-name');
    const imgEl = document.getElementById('q-author-img');
    if(nameEl) nameEl.textContent = author.username;
    if(imgEl) imgEl.src = author.avatar_url;

    // ট্যাগ
    const tagsDiv = document.getElementById('q-tags');
    if(tagsDiv && question.tag) {
        tagsDiv.innerHTML = '';
        const tagsArray = Array.isArray(question.tag) ? question.tag : question.tag.split(',');
        tagsArray.forEach(t => {
            const span = document.createElement('span');
            span.className = "bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-medium dark:bg-blue-900/30 dark:text-blue-300";
            span.textContent = `#${t.trim()}`;
            tagsDiv.appendChild(span);
        });
    }
}

// পেজ লোড হওয়া মাত্র ফাংশনটি চালু করো
document.addEventListener('DOMContentLoaded', loadQuestion);
