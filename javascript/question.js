import { supabase } from './supabase-config.js';

/**
 * ইউআরএল থেকে আইডি এবং স্লাগ আলাদা করা
 * URL: /question/uuid-here/slug-text
 */
function getParams() {
    const path = window.location.pathname;
    const parts = path.split('/').filter(p => p !== "");
    
    // parts[0] = 'question', parts[1] = id, parts[2] = slug
    return {
        id: parts[1] || null,
        slug: parts[2] || null
    };
}

/**
 * ডাটাবেস থেকে প্রশ্ন লোড করা
 */
async function initPage() {
    const { id, slug } = getParams();
    const skeleton = document.getElementById('loading-skeleton');
    const content = document.getElementById('question-content');
    const errorState = document.getElementById('error-state');

    if (!id) {
        skeleton.classList.add('hidden');
        errorState.classList.remove('hidden');
        return;
    }

    try {
        // প্রশ্ন এবং লেখকের তথ্য একসাথে আনা (Join Query)
        const { data: question, error } = await supabase
            .from('question')
            .select(`
                *,
                author:profiles(username, avatar_url)
            `)
            .eq('id', id)
            .single();

        if (error || !question) throw new Error("Not Found");

        // UI আপডেট করা
        document.title = `${question.title} - physflow`;
        document.getElementById('q-title').textContent = question.title;
        document.getElementById('q-body').innerHTML = marked.parse(question.body);
        document.getElementById('q-date').textContent = new Date(question.created_at).toLocaleDateString('bn-BD');
        
        // লেখক তথ্য
        const author = question.author || { username: 'অজানা লেখক', avatar_url: 'https://via.placeholder.com/40' };
        document.getElementById('q-author-name').textContent = author.username;
        document.getElementById('q-author-img').src = author.avatar_url;

        // ট্যাগ রেন্ডার
        const tagsContainer = document.getElementById('q-tags');
        if (question.tag) {
            question.tag.forEach(t => {
                const span = document.createElement('span');
                span.className = "bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-medium dark:bg-blue-900/30 dark:text-blue-300";
                span.textContent = `#${t}`;
                tagsContainer.appendChild(span);
            });
        }

        // লোডিং শেষ
        skeleton.classList.add('hidden');
        content.classList.remove('hidden');

    } catch (err) {
        console.error("Error loading question:", err);
        skeleton.classList.add('hidden');
        errorState.classList.remove('hidden');
    }
}

// পেজ লোড হলে ফাংশনটি চালু করা
document.addEventListener('DOMContentLoaded', initPage);
