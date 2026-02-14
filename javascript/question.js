import { supabase } from './supabase-config.js';

const state = {
    questionId: new URLSearchParams(window.location.search).get('id'),
    currentUserId: null,
    quill: null
};

export async function initQuestionPage() {
    if (!state.questionId) return;

    const { data: { user } } = await supabase.auth.getUser();
    state.currentUserId = user?.id ?? null;

    await loadQuestion();
    await loadAnswers();
    initEditor();

    document.getElementById('submit-answer-btn').addEventListener('click', submitAnswer);
}

async function loadQuestion() {
    const { data: q, error } = await supabase
        .from('question').select('*').eq('id', state.questionId).single();

    if (error || !q) return;

    document.getElementById('question-title').textContent = q.title;
    document.getElementById('question-body').innerHTML = q.body;
    document.getElementById('question-time').textContent = new Date(q.created_at).toLocaleDateString('bn-BD');
    
    // Tags
    const tagsContainer = document.getElementById('question-tags');
    q.tags?.forEach(tag => {
        const span = document.createElement('span');
        span.className = "bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs";
        span.textContent = tag;
        tagsContainer.appendChild(span);
    });
}

async function loadAnswers() {
    const { data: answers } = await supabase
        .from('answer')
        .select('*')
        .eq('question_id', state.questionId)
        .order('created_at', { ascending: true });

    const list = document.getElementById('answer-list');
    list.innerHTML = '';
    document.getElementById('answer-count-num').textContent = answers?.length || 0;

    answers?.forEach(ans => {
        const div = document.createElement('div');
        div.className = "bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-500";
        div.innerHTML = `
            <div class="prose max-w-none mb-3">${ans.body}</div>
            <div class="text-xs text-gray-500">উত্তর দিয়েছেন: ${ans.author_id.substring(0,8)}...</div>
        `;
        list.appendChild(div);
    });
}

function initEditor() {
    state.quill = new Quill('#answer-editor', {
        theme: 'snow',
        placeholder: 'এখানে আপনার উত্তর লিখুন...',
        modules: { toolbar: [['bold', 'italic', 'link', 'code-block']] }
    });
}

async function submitAnswer() {
    if (!state.currentUserId) {
        alert('উত্তর দিতে লগ ইন করুন');
        return;
    }

    const body = state.quill.root.innerHTML;
    if (state.quill.getText().trim().length < 10) {
        alert('উত্তর খুব ছোট!');
        return;
    }

    const { error } = await supabase.from('answer').insert({
        question_id: state.questionId,
        body: body,
        author_id: state.currentUserId
    });

    if (!error) {
        state.quill.setContents([]);
        loadAnswers();
    } else {
        alert('ত্রুটি হয়েছে, আবার চেষ্টা করুন।');
    }
}
