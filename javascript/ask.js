import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Supabase Configuration
const SUPABASE_URL = 'https://hmzcipbchhsdycgozhzd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtemNpcGJjaGhzZHljZ296aHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1ODIzNDksImV4cCI6MjA4NjE1ODM0OX0.5rMQnPHo6haSnJwdagPOt9c4MnLWJWKx5gk8eKRO66A';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Tags Management
const tags = [];
const MAX_TAGS = 5;

// DOM Elements
const form = document.getElementById('ask-form');
const titleInput = document.getElementById('question-title');
const bodyInput = document.getElementById('question-body');
const categorySelect = document.getElementById('question-category');
const tagsInput = document.getElementById('question-tags-input');
const tagsHidden = document.getElementById('question-tags');
const tagContainer = document.getElementById('tag-container');
const submitBtn = document.getElementById('submit-btn');
const messageDiv = document.getElementById('ask-message');

// Utility: Generate slug from Bangla/English text
function generateSlug(text) {
    // Bangla to English transliteration map
    const banglaToEnglish = {
        'অ': 'o', 'আ': 'a', 'ই': 'i', 'ঈ': 'i', 'উ': 'u', 'ঊ': 'u',
        'ঋ': 'ri', 'এ': 'e', 'ঐ': 'oi', 'ও': 'o', 'ঔ': 'ou',
        'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ng',
        'চ': 'ch', 'ছ': 'chh', 'জ': 'j', 'ঝ': 'jh', 'ঞ': 'n',
        'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh', 'ণ': 'n',
        'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n',
        'প': 'p', 'ফ': 'ph', 'ব': 'b', 'ভ': 'bh', 'ম': 'm',
        'য': 'j', 'র': 'r', 'ল': 'l', 'শ': 'sh', 'ষ': 'sh',
        'স': 's', 'হ': 'h', 'ড়': 'r', 'ঢ়': 'rh', 'য়': 'y',
        'ৎ': 't', 'ং': 'ng', 'ঃ': 'h', 'ঁ': 'n',
        'া': 'a', 'ি': 'i', 'ী': 'i', 'ু': 'u', 'ূ': 'u',
        'ৃ': 'ri', 'ে': 'e', 'ৈ': 'oi', 'ো': 'o', 'ৌ': 'ou',
        '্': '', 'ৰ': 'r', 'ৱ': 'w', 'ঽ': '',
        '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
        '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
    };

    let slug = '';
    
    // Convert Bangla characters to English
    for (let char of text) {
        if (banglaToEnglish[char]) {
            slug += banglaToEnglish[char];
        } else {
            slug += char;
        }
    }

    // Standard slug processing
    slug = slug
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-')      // Replace spaces with hyphens
        .replace(/-+/g, '-')       // Remove consecutive hyphens
        .substring(0, 100);        // Limit length

    // Add timestamp for uniqueness
    const timestamp = Date.now().toString(36);
    slug = `${slug}-${timestamp}`;

    return slug;
}

// Show message
function showMessage(message, type = 'success') {
    messageDiv.textContent = message;
    messageDiv.classList.remove('hidden', 'text-green-600', 'text-red-600', 'text-blue-600');
    
    if (type === 'success') {
        messageDiv.classList.add('text-green-600');
    } else if (type === 'error') {
        messageDiv.classList.add('text-red-600');
    } else {
        messageDiv.classList.add('text-blue-600');
    }
    
    messageDiv.classList.remove('hidden');
}

// Hide message
function hideMessage() {
    messageDiv.classList.add('hidden');
}

// Add tag
function addTag(tagText) {
    const trimmedTag = tagText.trim().toLowerCase();
    
    if (!trimmedTag) return;
    
    if (tags.length >= MAX_TAGS) {
        showMessage(`সর্বোচ্চ ${MAX_TAGS}টি ট্যাগ যোগ করতে পারবেন`, 'error');
        return;
    }
    
    if (tags.includes(trimmedTag)) {
        showMessage('এই ট্যাগটি ইতিমধ্যে যোগ করা হয়েছে', 'error');
        return;
    }
    
    tags.push(trimmedTag);
    renderTags();
    tagsInput.value = '';
    updateHiddenTagsInput();
}

// Remove tag
function removeTag(tagText) {
    const index = tags.indexOf(tagText);
    if (index > -1) {
        tags.splice(index, 1);
        renderTags();
        updateHiddenTagsInput();
    }
}

// Render tags
function renderTags() {
    // Clear existing tags (except input)
    const existingTags = tagContainer.querySelectorAll('.tag-badge');
    existingTags.forEach(tag => tag.remove());
    
    // Add tags before input
    tags.forEach(tag => {
        const tagBadge = document.createElement('div');
        tagBadge.className = 'tag-badge';
        tagBadge.innerHTML = `
            <span>${tag}</span>
            <button type="button" onclick="window.removeTagHandler('${tag}')">&times;</button>
        `;
        tagContainer.insertBefore(tagBadge, tagsInput);
    });
}

// Update hidden input
function updateHiddenTagsInput() {
    tagsHidden.value = tags.join(',');
}

// Make removeTag available globally
window.removeTagHandler = removeTag;

// Tag input event listeners
tagsInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTag(tagsInput.value);
    } else if (e.key === 'Backspace' && !tagsInput.value && tags.length > 0) {
        removeTag(tags[tags.length - 1]);
    }
});

tagsInput.addEventListener('blur', () => {
    if (tagsInput.value.trim()) {
        addTag(tagsInput.value);
    }
});

// Form validation
function validateForm() {
    hideMessage();
    
    const title = titleInput.value.trim();
    const body = bodyInput.value.trim();
    const category = categorySelect.value;
    
    if (!title) {
        showMessage('প্রশ্নের শিরোনাম লিখুন', 'error');
        titleInput.focus();
        return false;
    }
    
    if (title.length < 10) {
        showMessage('শিরোনাম কমপক্ষে ১০ অক্ষরের হতে হবে', 'error');
        titleInput.focus();
        return false;
    }
    
    if (!body) {
        showMessage('প্রশ্নের বিস্তারিত লিখুন', 'error');
        bodyInput.focus();
        return false;
    }
    
    if (body.length < 20) {
        showMessage('প্রশ্নের বিস্তারিত কমপক্ষে ২০ অক্ষরের হতে হবে', 'error');
        bodyInput.focus();
        return false;
    }
    
    if (!category) {
        showMessage('ক্যাটাগরি নির্বাচন করুন', 'error');
        categorySelect.focus();
        return false;
    }
    
    return true;
}

// Form submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
        return;
    }
    
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>জমা হচ্ছে...';
    
    try {
        const title = titleInput.value.trim();
        const body = bodyInput.value.trim();
        const category = categorySelect.value;
        const slug = generateSlug(title);
        
        // Prepare question data
        const questionData = {
            title: title,
            body: body,
            category: category,
            tags: tags.length > 0 ? tags : null,
            slug: slug,
            author_id: 'demo-user-id', // TODO: Replace with actual user ID from auth
            views: 0,
            votes: 0,
            answers_count: 0,
            created_at: new Date().toISOString()
        };
        
        // Insert into Supabase
        const { data, error } = await supabase
            .from('questions')
            .insert([questionData])
            .select()
            .single();
        
        if (error) {
            console.error('Supabase error:', error);
            throw new Error(error.message);
        }
        
        // Success
        showMessage('প্রশ্ন সফলভাবে জমা হয়েছে! পুনর্নির্দেশ করা হচ্ছে...', 'success');
        
        // Redirect to question page after 1.5 seconds
        setTimeout(() => {
            window.location.href = `question.html?slug=${slug}`;
        }, 1500);
        
    } catch (error) {
        console.error('Error submitting question:', error);
        showMessage('প্রশ্ন জমা দিতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।', 'error');
        
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.textContent = 'প্রশ্ন জমা দিন';
    }
});

// Auto-save to localStorage (draft feature)
function saveDraft() {
    const draft = {
        title: titleInput.value,
        body: bodyInput.value,
        category: categorySelect.value,
        tags: tags,
        timestamp: new Date().toISOString()
    };
    
    localStorage.setItem('question_draft', JSON.stringify(draft));
}

// Load draft
function loadDraft() {
    const draftStr = localStorage.getItem('question_draft');
    if (!draftStr) return;
    
    try {
        const draft = JSON.parse(draftStr);
        
        // Check if draft is less than 24 hours old
        const draftTime = new Date(draft.timestamp);
        const now = new Date();
        const hoursDiff = (now - draftTime) / (1000 * 60 * 60);
        
        if (hoursDiff < 24) {
            if (confirm('আপনার একটি অসমাপ্ত প্রশ্ন আছে। এটি পুনরুদ্ধার করতে চান?')) {
                titleInput.value = draft.title || '';
                bodyInput.value = draft.body || '';
                categorySelect.value = draft.category || '';
                
                if (draft.tags && Array.isArray(draft.tags)) {
                    draft.tags.forEach(tag => {
                        if (tags.length < MAX_TAGS) {
                            tags.push(tag);
                        }
                    });
                    renderTags();
                    updateHiddenTagsInput();
                }
            } else {
                localStorage.removeItem('question_draft');
            }
        } else {
            localStorage.removeItem('question_draft');
        }
    } catch (e) {
        console.error('Error loading draft:', e);
        localStorage.removeItem('question_draft');
    }
}

// Auto-save every 30 seconds
let autoSaveInterval;
function startAutoSave() {
    autoSaveInterval = setInterval(saveDraft, 30000);
}

function stopAutoSave() {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
    }
}

// Clear draft on successful submission
form.addEventListener('submit', () => {
    localStorage.removeItem('question_draft');
    stopAutoSave();
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadDraft();
    startAutoSave();
});

// Clear draft on page unload if form is empty
window.addEventListener('beforeunload', (e) => {
    const hasContent = titleInput.value.trim() || bodyInput.value.trim();
    
    if (hasContent) {
        saveDraft();
    } else {
        localStorage.removeItem('question_draft');
    }
});
