import { supabase } from './supabase-config.js';

/**
 * ইউআরএল থেকে আইডি এবং স্লাগ আলাদা করা
 * URL ফরম্যাট: /question/uuid/slug-text
 */
function getQuestionParams() {
    const path = window.location.pathname;
    const parts = path.split('/').filter(p => p.length > 0);
    
    // parts[0] = 'question', parts[1] = 'id', parts[2] = 'slug'
    return {
        id: parts[1] || null,
        slug: parts[2] || null
    };
}

/**
 * ডাটাবেস থেকে প্রশ্ন লোড করা
 */
async function loadQuestion() {
    const { id, slug } = getQuestionParams();
    
    // এলিমেন্টগুলো ধরা
    const skeleton = document.getElementById('loading-skeleton');
    const content = document.getElementById('question-content');
    const errorState = document.getElementById('error-state');

    // যদি আইডি না থাকে তবে সরাসরি এরর
    if (!id) {
        if(skeleton) skeleton.classList.add('hidden');
        if(errorState) errorState.classList.remove('hidden');
        return;
    }

    try {
        // আইডি দিয়ে সরাসরি প্রশ্ন খোঁজা (author-এর তথ্যসহ)
        const { data: question, error } = await supabase
            .from('question')
            .select(`
                *,
                author:profiles(
                    username,
                    avatar_url
                )
            `)
            .eq('id', id)
            .single();

        if (error || !question) throw new Error('Question not found');

        // যদি ইউআরএল এর স্লাগ ডাটাবেসের স্লাগের সাথে না মিলে, তবে সঠিক ইউআরএল এ রিপ্লেস করা (SEO এর জন্য)
        if (slug !== question.slug) {
            window.history.replaceState(null, '', `/question/${question.id}/${question.slug}`);
        }

        // ডাটা রেন্ডার করা
        displayQuestion(question);
        
        // লোডিং হাইড এবং কন্টেন্ট শো
        if(skeleton) skeleton.classList.add('hidden');
        if(content) content.classList.remove('hidden');

    } catch (error) {
        console.error('Load Error:', error);
        if(skeleton) skeleton.classList.add('hidden');
        if(errorState) errorState.classList.remove('hidden');
    }
}

/**
 * পেজে ডাটা দেখানো
 */
function displayQuestion(question) {
    // শিরোনাম
    const titleEl = document.getElementById('q-title');
    if(titleEl) titleEl.textContent = question.title;
    document.title = `${question.title} - physflow`;

    // বডি (Marked.js থাকলে সেটা ব্যবহার করবে)
    const bodyEl = document.getElementById('q-body');
    if(bodyEl) {
        bodyEl.innerHTML = typeof marked !== 'undefined' ? marked.parse(question.body) : question.body;
    }

    // তারিখ
    const dateEl = document.getElementById('q-date');
    if(dateEl) dateEl.textContent = new Date(question.created_at).toLocaleDateString('bn-BD');

    // লেখক
    const author = question.author || { username: 'অজানা লেখক', avatar_url: 'https://via.placeholder.com/40' };
    const authorNameEl = document.getElementById('q-author-name');
    const authorImgEl = document.getElementById('q-author-img');
    
    if(authorNameEl) authorNameEl.textContent = author.username;
    if(authorImgEl) authorImgEl.src = author.avatar_url;

    // ট্যাগ
    const tagsContainer = document.getElementById('q-tags');
    if(tagsContainer && question.tag) {
        tagsContainer.innerHTML = '';
        question.tag.forEach(t => {
            const span = document.createElement('span');
            span.className = "bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs dark:bg-blue-900/30 dark:text-blue-300";
            span.textContent = `#${t}`;
            tagsContainer.appendChild(span);
        });
    }
}

// পেজ লোড হলে রান করবে
document.addEventListener('DOMContentLoaded', loadQuestion);
