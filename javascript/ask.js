import { supabase } from './supabase-config.js';

// ১. ট্যাগ ডাটাবেস (আপডেটেড)
const categoryTags = {
    'গতি ও গতিবিদ্যা': ['গতি', 'বেগ', 'ত্বরণ', 'দূরত্ব', 'স্থানান্তর', 'スケলার', 'ভেক্টর', 'বৃত্তীয় গতি', 'সরল ছন্দিত গতি', 'দোলন'],
    'বলবিদ্যা': ['নিউটনের সূত্র', 'জড়তা', 'বল', 'ভরবেগ', 'সংঘর্ষ', 'ঘর্ষণ', 'কাজ', 'শক্তি', 'ক্ষমতা', 'মহাকর্ষ', 'কেপলারের সূত্র', 'কেন্দ্রভর', 'রিজিড বডি', 'নন-ইনারশিয়াল ফ্রেম', 'ল্যাগ্রাঞ্জিয়ান', 'হ্যামিল্টোনিয়ান'],
    'পদার্থের ধর্ম': ['স্থিতিস্থাপকতা', 'পৃষ্ঠটান', 'সান্দ্রতা', 'তরল বলবিদ্যা', 'চাপ', 'ঘনত্ব'],
    'তাপ ও তাপগতিবিদ্যা': ['তাপ', 'তাপমাত্রা', 'নির্দিষ্ট তাপ', 'গোপন তাপ', 'তাপ পরিবহন', 'তাপীয় সম্প্রসারণ', 'গ্যাসের সূত্র', 'কার্নো ইঞ্জিন', 'তাপীয় ইঞ্জিন', 'এন্ট্রপি', 'ফেজ ট্রানজিশন', 'পার্টিশন ফাংশন'],
    'তরঙ্গ ও শব্দ': ['তরঙ্গ', 'শব্দ', 'কম্পাঙ্ক', 'বিস্তার', 'প্রতিধ্বনি', 'অনুনাদ', 'তরঙ্গ সমীকরণ', 'ডপলার প্রভাব', 'ফুরিয়ার সিরিজ', 'কোহেরেন্স'],
    'জ্যোতির্পদার্থবিজ্ঞান ও মহাবিশ্ববিদ্যা': ['তারা', 'গ্রহ', 'গ্যালাক্সি', 'বিগ ব্যাং', 'ডার্ক ম্যাটার', 'ডার্ক এনার্জি', 'হাবলের সূত্র', 'নিউট্রন স্টার', 'সুপারনোভা', 'মহাকর্ষীয় লেন্সিং'],
    'আলো ও অপটিক্স': ['প্রতিফলন', 'প্রতিসরণ', 'দর্পণ', 'লেন্স', 'আলোর গতি', 'ব্যতিচার', 'ব্যপন', 'হস্তক্ষেপ', 'পোলারাইজেশন', 'ফ্রেনেল ব্যতিচার', 'হোলোগ্রাফি'],
    'তড়িৎ ও চুম্বকত্ব': ['বিদ্যুৎ', 'তড়িৎধারা', 'ভোল্টেজ', 'রোধ', 'ওহমের সূত্র', 'সার্কিট', 'কুলম্বের সূত্র', 'তড়িৎ ক্ষেত্র', 'ধারক', 'চৌম্বক ক্ষেত্র', 'ফ্যারাডের সূত্র', 'ইন্ডাকশন', 'এসি সার্কিট', 'ম্যাক্সওয়েল সমীকরণ', 'গাউস সূত্র'],
    'আধুনিক পদার্থবিজ্ঞান': ['ফটোইলেকট্রিক প্রভাব', 'বোর মডেল', 'তেজস্ক্রিয়তা', 'সেমিকন্ডাক্টর', 'ব্যান্ড থিওরি', 'সুপারকন্ডাক্টিভিটি'],
    'আপেক্ষিকতা': ['বিশেষ আপেক্ষিকতা', 'সাধারণ আপেক্ষিকতা', 'লরেঞ্জ ট্রান্সফরমেশন', 'সময় প্রসারণ', 'দৈর্ঘ্য সংকোচন', 'E=mc²', 'স্পেসটাইম কার্ভেচার', 'ব্ল্যাক হোল', 'গ্র্যাভিটেশনাল ওয়েভ'],
    'কোয়ান্টাম মেকানিক্স': ['শ্রোডিঙ্গার সমীকরণ', 'অপারেটর', 'ইজেনভ্যালু', 'কমিউটেটর', 'টানেলিং'],
    'নিউক্লিয়ার ও কণা পদার্থবিজ্ঞান': ['নিউক্লিয়ার ফিশন', 'ফিউশন', 'কোয়ার্ক', 'লেপ্টন', 'স্ট্যান্ডার্ড মডেল'],
    'গাণিতিক পদার্থবিজ্ঞান': ['গ্রিন ফাংশন', 'টেনসর', 'লাপ্লাস সমীকরণ', 'বেসেল ফাংশন'],
    'ঘনীভূত পদার্থ পদার্থবিজ্ঞান': ['ক্রিস্টাল স্ট্রাকচার', 'ফোনন', 'ইলেকট্রন ব্যান্ড', 'সুপারফ্লুইডিটি', 'ফেরোম্যাগনেটিজম', 'কোয়ান্টাম হল ইফেক্ট', 'ন্যানোটেকনোলজি'],
    'পরমাণু ও অণু পদার্থবিজ্ঞান': ['পরমাণু স্পেকট্রা', 'লেজার', 'মলিকুলার বন্ডিং', 'আইওনাইজেশন', 'এক্সাইটেড স্টেট', 'স্পেকট্রোস্কোপি'],
    'পরিসংখ্যানিক বলবিদ্যা': ['বল্টজম্যান ডিস্ট্রিবিউশন', 'ফার্মি-ডিরাক স্ট্যাটিসটিক্স', 'বোস-আইনস্টাইন কনডেনসেশন', 'মাইক্রোস্টেট', 'এনসেম্বল'],
    'জৈবপদার্থবিজ্ঞান': ['প্রোটিন ফোল্ডিং', 'ডিএনএ স্ট্রাকচার', 'মেমব্রেন ডায়নামিক্স', 'নিউরোফিজিক্স', 'বায়োমেকানিক্স'],
    'প্লাজমা পদার্থবিজ্ঞান': ['প্লাজমা ওয়েভ', 'ফিউশন রিয়্যাকশন', 'ম্যাগনেটোহাইড্রোডায়নামিক্স', 'আয়নাইজড গ্যাস', 'সোলার উইন্ড']
};

let selectedTag = [];
const MAX_TAGS = 3;

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

// --- নতুন ফাংশন: ৪ ডিজিটের আইডি জেনারেটর ---
function generateShortId(length = 4) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// ২. ক্যাটাগরি চেঞ্জ লজিক
categorySelect.addEventListener('change', () => {
    const category = categorySelect.value;
    selectedTag = []; 
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
    const index = selectedTag.indexOf(tag);
    if (index > -1) {
        selectedTag.splice(index, 1);
    } else {
        if (selectedTag.length >= MAX_TAGS) {
            alert(`তুমি সর্বোচ্চ ${MAX_TAGS}টি ট্যাগ নিতে পারবে।`);
            return;
        }
        selectedTag.push(tag);
    }
    updateSelectedTagsUI();
}

// ৫. সিলেক্ট করা ট্যাগের UI আপডেট
function updateSelectedTagsUI() {
    selectedTagsDiv.innerHTML = '';
    if (selectedTag.length === 0) {
        selectedTagsDiv.innerHTML = '<span class="text-xs text-gray-400">কোনো ট্যাগ সিলেক্ট করা হয়নি</span>';
        tagsHiddenInput.value = '';
    } else {
        selectedTag.forEach(tag => {
            const span = document.createElement('span');
            span.className = 'px-2 py-1 text-xs bg-brand-600 text-white rounded flex items-center gap-1 animate-in fade-in zoom-in duration-200';
            span.innerHTML = `${tag} <i class="fas fa-times cursor-pointer ml-1"></i>`;
            span.onclick = () => toggleTag(tag);
            selectedTagsDiv.appendChild(span);
        });
        tagsHiddenInput.value = selectedTag.join(',');
    }
}

// ৬. Slug Generation
function generateSlug(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\u0980-\u09FFa-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 60);
}

// ৭. মেসেজ প্রদর্শন
function showMessage(msg, type = 'success') {
    messageDiv.textContent = msg;
    messageDiv.className = `text-sm mt-2 ${type === 'error' ? 'text-red-600' : 'text-green-600'}`;
    messageDiv.classList.remove('hidden');
}

// ৮. ফর্ম সাবমিশন (হোমপেজে রিডাইরেক্ট করার আপডেটসহ)
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (titleInput.value.length < 10 || bodyInput.value.length < 20 || !categorySelect.value) {
        showMessage('সবগুলো ঘর সঠিকভাবে পূরণ করো', 'error');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>জমা হচ্ছে...';

    try {
        const { data: { user } } = await supabase.auth.getUser();
        const slug = generateSlug(titleInput.value);
        const customId = generateShortId();

        const { error } = await supabase
            .from('question')
            .insert([{
                id: customId,
                title: titleInput.value.trim(),
                body: bodyInput.value.trim(),
                category: categorySelect.value,
                tag: selectedTag,
                slug: slug,
                author_id: user?.id || null,
                created_at: new Date().toISOString()
            }]);

        if (error) {
            if (error.code === '23505') {
                throw new Error('আইডি কলিশন হয়েছে, দয়া করে আবার চেষ্টা করুন।');
            }
            throw error;
        }

        localStorage.removeItem('question_draft');
        showMessage('প্রশ্ন সফলভাবে জমা হয়েছে! হোমপেজে ফিরে যাচ্ছি...');
        
        // এখানে ইউআরএল পরিবর্তন করে '/' বা হোমপেজ করে দেওয়া হলো
        setTimeout(() => {
            window.location.href = '/'; 
        }, 1500);

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
        tag: selectedTag,
        timestamp: new Date().toISOString()
    }));
}

document.addEventListener('DOMContentLoaded', () => {
    const draft = JSON.parse(localStorage.getItem('question_draft'));
    if (draft && (new Date() - new Date(draft.timestamp)) < 86400000) {
        titleInput.value = draft.title || '';
        bodyInput.value = draft.body || '';
        categorySelect.value = draft.category || '';
        if (categorySelect.value) {
            tagsSection.classList.remove('hidden');
            renderSuggestedTags(categoryTags[categorySelect.value]);
            selectedTag = draft.tag || [];
            updateSelectedTagsUI();
        }
    }
    setInterval(saveDraft, 15000);
});
