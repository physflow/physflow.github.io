// Ask Question Page

let selectedTags = [];

async function submitQuestion() {
    if (!await requireAuth()) return;
    
    const title = document.getElementById('questionTitle').value.trim();
    const body = document.getElementById('questionBody').value.trim();
    
    if (!title) {
        showToast('Please enter a question title', 'error');
        return;
    }
    
    if (title.length < 15) {
        showToast('Title must be at least 15 characters', 'error');
        return;
    }
    
    if (!body) {
        showToast('Please enter question details', 'error');
        return;
    }
    
    if (body.length < 30) {
        showToast('Question body must be at least 30 characters', 'error');
        return;
    }
    
    if (selectedTags.length === 0) {
        showToast('Please add at least one tag', 'error');
        return;
    }
    
    try {
        const user = await getCurrentUser();
        const slug = createSlug(title);
        
        // Insert question
        const { data: question, error: questionError } = await supabase
            .from('questions')
            .insert({
                title: title,
                slug: slug,
                body: body,
                author_id: user.id
            })
            .select()
            .single();
        
        if (questionError) throw questionError;
        
        // Insert tags
        for (const tagName of selectedTags) {
            // Check if tag exists
            let { data: tag } = await supabase
                .from('tags')
                .select('*')
                .eq('slug', createSlug(tagName))
                .single();
            
            // Create tag if it doesn't exist
            if (!tag) {
                const { data: newTag, error: tagError } = await supabase
                    .from('tags')
                    .insert({
                        name: tagName,
                        slug: createSlug(tagName)
                    })
                    .select()
                    .single();
                
                if (tagError) throw tagError;
                tag = newTag;
            }
            
            // Link tag to question
            await supabase
                .from('question_tags')
                .insert({
                    question_id: question.id,
                    tag_id: tag.id
                });
        }
        
        showToast('Question posted successfully!', 'success');
        setTimeout(() => {
            window.location.href = `/question.html?id=${question.id}`;
        }, 1000);
        
    } catch (error) {
        console.error('Error submitting question:', error);
        showToast('Error posting question. Please try again.', 'error');
    }
}

function addTag() {
    const tagInput = document.getElementById('tagInput');
    const tagName = tagInput.value.trim();
    
    if (!tagName) return;
    
    if (selectedTags.length >= 5) {
        showToast('Maximum 5 tags allowed', 'error');
        return;
    }
    
    if (selectedTags.includes(tagName)) {
        showToast('Tag already added', 'error');
        return;
    }
    
    selectedTags.push(tagName);
    renderSelectedTags();
    tagInput.value = '';
}

function removeTag(tagName) {
    selectedTags = selectedTags.filter(t => t !== tagName);
    renderSelectedTags();
}

function renderSelectedTags() {
    const container = document.getElementById('selectedTags');
    if (!container) return;
    
    if (selectedTags.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">No tags added yet</p>';
        return;
    }
    
    const tagsHTML = selectedTags.map(tag => `
        <span class="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
            ${escapeHtml(tag)}
            <button onclick="removeTag('${escapeHtml(tag)}')" class="hover:text-red-600">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </span>
    `).join('');
    
    container.innerHTML = tagsHTML;
}

// Tag suggestions
let tagSuggestions = [];

async function loadTagSuggestions() {
    try {
        const { data: tags, error } = await supabase
            .from('tags')
            .select('name')
            .order('name');
        
        if (error) throw error;
        
        tagSuggestions = tags.map(t => t.name);
    } catch (error) {
        console.error('Error loading tag suggestions:', error);
    }
}

function showTagSuggestions() {
    const input = document.getElementById('tagInput');
    const value = input.value.trim().toLowerCase();
    
    if (!value) {
        hideTagSuggestions();
        return;
    }
    
    const filtered = tagSuggestions.filter(tag => 
        tag.toLowerCase().includes(value) && !selectedTags.includes(tag)
    ).slice(0, 5);
    
    if (filtered.length === 0) {
        hideTagSuggestions();
        return;
    }
    
    const suggestionsHTML = filtered.map(tag => `
        <div onclick="selectTagSuggestion('${escapeHtml(tag)}')" 
            class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm">
            ${escapeHtml(tag)}
        </div>
    `).join('');
    
    const container = document.getElementById('tagSuggestions');
    if (container) {
        container.innerHTML = suggestionsHTML;
        container.classList.remove('hidden');
    }
}

function hideTagSuggestions() {
    const container = document.getElementById('tagSuggestions');
    if (container) {
        container.classList.add('hidden');
    }
}

function selectTagSuggestion(tag) {
    document.getElementById('tagInput').value = tag;
    addTag();
    hideTagSuggestions();
}

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    await loadTagSuggestions();
    renderSelectedTags();
    
    // Tag input enter key
    const tagInput = document.getElementById('tagInput');
    if (tagInput) {
        tagInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
            }
        });
        
        tagInput.addEventListener('input', showTagSuggestions);
    }
    
    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#tagInput') && !e.target.closest('#tagSuggestions')) {
            hideTagSuggestions();
        }
    });
});

// Character counters
function updateCharCount(inputId, countId, minChars) {
    const input = document.getElementById(inputId);
    const counter = document.getElementById(countId);
    
    if (!input || !counter) return;
    
    input.addEventListener('input', () => {
        const length = input.value.length;
        counter.textContent = `${length} characters`;
        
        if (length < minChars) {
            counter.classList.add('text-red-500');
            counter.classList.remove('text-green-500');
        } else {
            counter.classList.add('text-green-500');
            counter.classList.remove('text-red-500');
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    updateCharCount('questionTitle', 'titleCount', 15);
    updateCharCount('questionBody', 'bodyCount', 30);
});
