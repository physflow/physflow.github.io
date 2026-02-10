import { supabase } from './supabase-config.js';

// ১. ট্যাগ ডাটাবেস
const categoryTags = {
    'mechanics': ['নিউটনের সূত্র', 'জড়তা', 'বল', 'ভরবেগ', 'সংঘর্ষ', 'ঘর্ষণ', 'কাজ', 'শক্তি', 'ক্ষমতা', 'মহাকর্ষ', 'কেপলারের সূত্র', 'কেন্দ্রভর', 'রিজিড বডি', 'নন-ইনারশিয়াল ফ্রেম', 'ল্যাগ্রাঞ্জিয়ান', 'হ্যামিল্টোনিয়ান'],
    'motion-dynamics': ['গতি', 'বেগ', 'ত্বরণ', 'দূরত্ব', 'স্থানান্তর', 'স্কেলার', 'ভেক্টর', 'বৃত্তীয় গতি', 'সরল ছন্দিত গতি', 'দোলন'],
    'matter-properties': ['স্থিতিস্থাপকতা', 'পৃষ্ঠটান', 'সান্দ্রতা', 'তরল বলবিদ্যা', 'চাপ', 'ঘনত্ব'],
    'heat-thermodynamics': ['তাপ', 'তাপমাত্রা', 'নির্দিষ্ট তাপ', 'গোপন তাপ', 'তাপ পরিবহন', 'তাপীয় সম্প্রসারণ', 'গ্যাসের সূত্র', 'কার্নো ইঞ্জিন', 'তাপীয় ইঞ্জিন', 'এন্ট্রপি', 'ফেজ ট্রানজিশন', 'পার্টিশন ফাংশন'],
    'waves-sound': ['তরঙ্গ', 'শব্দ', 'কম্পাঙ্ক', 'তরঙ্গদৈর্ঘ্য', 'ব্যতিচার', 'অপবর্তন']
};

let selectedTags = [];
const MAX_TAGS = 5;

// DOM Elements
const form = document.getElementById('ask-form');
const titleInput = document.getElementById('question-title');
const bodyInput = document.getElementById('question-body');
const categorySelect = document.getElementById('question-category');
const tagsSection = document.getElementById('tags-section');
const suggestedTagsDiv = document.getElementById('suggested-tags');
const selectedTagsDiv = document.getElementById('selected-tags-container');
const tagsHiddenInput = document.getElementById('question-tags');
const submitBtn = document.getElementById('submit-btn');
const messageDiv = document.getElementById('ask-message');

// ২. ক্যাটাগরি চেঞ্জ লজিক
categorySelect.addEventListener('change', () => {
    const category = categorySelect.value;
    selectedTags = []; 
    updateSelectedTagsUI();

    if (category && categoryTags[category]) {
        tagsSection.classList.remove('hidden');
        renderSuggestedTags(categoryTags[category]);
    } else {
        tagsSection.classList.add('hidden');
    }
});

// ৩. সাজেস্টেড ট্যাগ রেন্ডার
function renderSuggestedTags(tags) {
    suggestedTagsDiv.innerHTML = '';
    tags.forEach(tag => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full hover:bg-brand-600 hover:text-white transition active:scale-95';
        btn.textContent = tag;
        btn.onclick = () => toggleTag(tag);
        suggestedTagsDiv.appendChild(btn);
    });
}

// ৪. ট্যাগ সিলেক্ট/আন-সিলেক্ট
function toggleTag(tag) {
    const index = selectedTags.indexOf(tag);
    if (index > -1) {
        selectedTags.splice(index, 1);
    } else {
        if (selectedTags.length >= MAX_TAGS) {
            alert(`তুমি সর্বোচ্চ ${MAX_TAGS}টি ট্যাগ নিতে পারবে।`);
            return;
        }
        selectedTags.push(tag);
    }
    updateSelectedTagsUI();
}

// ৫. সিলেক্ট করা ট্যাগের UI আপডেট
function updateSelectedTagsUI() {
    selectedTagsDiv.innerHTML = '';
    if (selectedTags.length === 0) {
        selectedTagsDiv.innerHTML = '<span class="text-xs text-gray-400">কোনো ট্যাগ সিলেক্ট করা হয়নি</span>';
        tagsHiddenInput.value = '';
    } else {
        selectedTags.forEach(tag => {
            const span = document.createElement('span');
            span.className = 'px-2 py-1 text-xs bg-brand-600 text-white rounded flex items-center gap-1 animate-in fade-in zoom-in duration-200';
            span.innerHTML = `${tag} <i class="fas fa-times cursor-pointer ml-1"></i>`;
            span.onclick = () => toggleTag(tag);
            selectedTagsDiv.appendChild(span);
        });
        tagsHiddenInput.value = selectedTags.join(',');
    }
}

// ৬. Utility: Slug Generation
function generateSlug(text) {
    const banglaToEnglish = {
        'অ': 'o', 'আ': 'a', 'ই': 'i', 'ঈ': 'i', 'উ': 'u', 'ঊ': 'u', 'ঋ': 'ri', 'এ': 'e', 'ঐ': 'oi', 'ও': 'o', 'ঔ': 'ou',
        'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ng', 'চ': 'ch', 'ছ': 'chh', 'জ': 'j', 'ঝ': 'jh', 'ঞ': 'n',
        'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh', 'ণ': 'n', 'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n',
        'প': 'p', 'ফ': 'ph', 'ব': 'b', 'ভ': 'bh', 'ম': 'm', 'য': 'j', 'র': 'r', 'ল': 'l', 'শ': 'sh', 'ষ': 'sh',
        'স': 's', 'হ': 'h', 'ড়': 'r', 'ঢ়': 'rh', 'য়': 'y', 'ৎ': 't', 'ং': 'ng', 'ঃ': 'h', 'ঁ': 'n'
    };
    let slug = '';
    for (let char of text) { slug += banglaToEnglish[char] || char; }
    return slug.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').substring(0, 80) + '-' + Date.now().toString(36);
}

// ৭. মেসেজ প্রদর্শন
function showMessage(msg, type = 'success') {
    messageDiv.textContent = msg;
    messageDiv.className = `text-sm mt-2 ${type === 'error' ? 'text-red-600' : 'text-green-600'}`;
    messageDiv.classList.remove('hidden');
}

// ৮. ফর্ম সাবমিশন
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (titleInput.value.length < 10 || bodyInput.value.length < 20 || !categorySelect.value) {
        showMessage('সবগুলো ঘর সঠিকভাবে পূরণ করো (শিরোনাম ১০ ও বিস্তারিত ২০ অক্ষরের বেশি)', 'error');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>জমা হচ্ছে...';

    try {
        const { data: { user } } = await supabase.auth.getUser();
        const slug = generateSlug(titleInput.value);

        const { error } = await supabase.from('questions').insert([{
            title: titleInput.value.trim(),
            body: bodyInput.value.trim(),
            category: categorySelect.value,
            tags: selectedTags,
            slug: slug,
            author_id: user?.id || null,
            created_at: new Date().toISOString()
        }]);

        if (error) throw error;

        localStorage.removeItem('question_draft');
        showMessage('প্রশ্ন সফলভাবে জমা হয়েছে!');
        setTimeout(() => window.location.href = `question.html?slug=${slug}`, 1500);

    } catch (err) {
        console.error(err);
        showMessage('ত্রুটি: ' + err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'প্রশ্ন জমা দিন';
    }
});

// ৯. ড্রাফট সিস্টেম
function saveDraft() {
    localStorage.setItem('question_draft', JSON.stringify({
        title: titleInput.value,
        body: bodyInput.value,
        category: categorySelect.value,
        tags: selectedTags,
        timestamp: new Date().toISOString()
    }));
}

document.addEventListener('DOMContentLoaded', () => {
    const draft = JSON.parse(localStorage.getItem('question_draft'));
    if (draft && (new Date() - new Date(draft.timestamp)) < 86400000) {
        if (confirm('আপনার অসম্পূর্ণ ড্রাফটটি ফিরিয়ে আনতে চান?')) {
            titleInput.value = draft.title || '';
            bodyInput.value = draft.body || '';
            categorySelect.value = draft.category || '';
            if (categorySelect.value) {
                tagsSection.classList.remove('hidden');
                renderSuggestedTags(categoryTags[categorySelect.value]);
                selectedTags = draft.tags || [];
                updateSelectedTagsUI();
            }
        }
    }
    setInterval(saveDraft, 15000);
});
