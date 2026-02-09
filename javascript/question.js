// Question Detail Page

let currentQuestionId = null;

async function loadQuestionDetail() {
    const urlParams = new URLSearchParams(window.location.search);
    const questionId = urlParams.get('id');
    
    if (!questionId) {
        window.location.href = '/index.html';
        return;
    }
    
    currentQuestionId = questionId;
    
    try {
        // Load question
        const { data: question, error: questionError } = await supabase
            .from('questions')
            .select(`
                *,
                profiles:author_id (id, username, avatar_url, reputation)
            `)
            .eq('id', questionId)
            .single();
        
        if (questionError) throw questionError;
        
        // Increment view count
        await supabase
            .from('questions')
            .update({ views: (question.views || 0) + 1 })
            .eq('id', questionId);
        
        // Load tags
        const { data: questionTags } = await supabase
            .from('question_tags')
            .select('tags (name, slug)')
            .eq('question_id', questionId);
        
        // Render question
        renderQuestion(question, questionTags);
        
        // Load answers
        await loadAnswers(questionId);
        
        // Check user vote
        const user = await getCurrentUser();
        if (user) {
            await checkUserVote(questionId, 'question');
        }
        
    } catch (error) {
        console.error('Error loading question:', error);
        document.getElementById('questionContainer').innerHTML = '<div class="text-center py-8 text-red-500">Error loading question.</div>';
    }
}

function renderQuestion(question, questionTags) {
    const tags = questionTags?.map(qt => qt.tags).filter(Boolean) || [];
    const author = question.profiles || { username: 'Unknown', avatar_url: '', reputation: 0 };
    
    const questionHTML = `
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
            <!-- Title -->
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">${escapeHtml(question.title)}</h1>
            
            <!-- Meta info -->
            <div class="flex gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <span>Asked ${formatDate(question.created_at)}</span>
                <span>Viewed ${question.views || 0} times</span>
            </div>
            
            <div class="flex gap-6">
                <!-- Vote buttons -->
                <div class="flex flex-col items-center gap-2">
                    <button onclick="voteQuestion(1)" id="upvoteQuestion" class="vote-btn p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                        <svg class="w-8 h-8 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
                        </svg>
                    </button>
                    <span id="questionVotes" class="text-2xl font-bold text-gray-900 dark:text-white">${question.votes || 0}</span>
                    <button onclick="voteQuestion(-1)" id="downvoteQuestion" class="vote-btn p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                        <svg class="w-8 h-8 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                    </button>
                </div>
                
                <!-- Content -->
                <div class="flex-1">
                    <div class="prose dark:prose-invert max-w-none mb-6">
                        ${formatQuestionBody(question.body)}
                    </div>
                    
                    <!-- Tags -->
                    <div class="flex flex-wrap gap-2 mb-6">
                        ${tags.map(tag => `
                            <a href="/tags.html?tag=${tag.slug}" class="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800">
                                ${escapeHtml(tag.name)}
                            </a>
                        `).join('')}
                    </div>
                    
                    <!-- Author card -->
                    <div class="flex justify-end">
                        <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                            <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">asked ${formatDate(question.created_at)}</div>
                            <div class="flex items-center gap-3">
                                <img src="${author.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(author.username)}&background=random`}" 
                                    alt="${escapeHtml(author.username)}" 
                                    class="w-10 h-10 rounded">
                                <div>
                                    <a href="/profile.html?user=${author.id}" class="text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700">
                                        ${escapeHtml(author.username)}
                                    </a>
                                    <div class="text-sm text-gray-600 dark:text-gray-400">
                                        <span class="font-semibold text-orange-600 dark:text-orange-400">${author.reputation || 0}</span> reputation
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('questionContainer').innerHTML = questionHTML;
}

function formatQuestionBody(body) {
    // Simple formatting - convert line breaks to paragraphs
    return body.split('\n\n').map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
}

async function loadAnswers(questionId) {
    try {
        const { data: answers, error } = await supabase
            .from('answers')
            .select(`
                *,
                profiles:author_id (id, username, avatar_url, reputation)
            `)
            .eq('question_id', questionId)
            .order('is_accepted', { ascending: false })
            .order('votes', { ascending: false });
        
        if (error) throw error;
        
        const answersContainer = document.getElementById('answersContainer');
        const answerCount = document.getElementById('answerCount');
        
        if (answerCount) {
            answerCount.textContent = `${answers?.length || 0} Answers`;
        }
        
        if (!answers || answers.length === 0) {
            answersContainer.innerHTML = '<div class="text-center py-8 text-gray-500 dark:text-gray-400">No answers yet. Be the first to answer!</div>';
            return;
        }
        
        const answersHTML = answers.map(a => renderAnswer(a)).join('');
        answersContainer.innerHTML = answersHTML;
        
        // Check user votes for answers
        const user = await getCurrentUser();
        if (user) {
            for (const answer of answers) {
                await checkUserVote(answer.id, 'answer');
            }
        }
        
    } catch (error) {
        console.error('Error loading answers:', error);
    }
}

function renderAnswer(answer) {
    const author = answer.profiles || { username: 'Unknown', avatar_url: '', reputation: 0 };
    
    return `
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-4 ${answer.is_accepted ? 'border-green-500 border-2' : ''}">
            ${answer.is_accepted ? '<div class="mb-4 text-green-600 dark:text-green-400 font-semibold flex items-center gap-2"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg> Accepted Answer</div>' : ''}
            
            <div class="flex gap-6">
                <!-- Vote buttons -->
                <div class="flex flex-col items-center gap-2">
                    <button onclick="voteAnswer('${answer.id}', 1)" id="upvoteAnswer_${answer.id}" class="vote-btn p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                        <svg class="w-8 h-8 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
                        </svg>
                    </button>
                    <span id="answerVotes_${answer.id}" class="text-2xl font-bold text-gray-900 dark:text-white">${answer.votes || 0}</span>
                    <button onclick="voteAnswer('${answer.id}', -1)" id="downvoteAnswer_${answer.id}" class="vote-btn p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                        <svg class="w-8 h-8 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                    </button>
                </div>
                
                <!-- Content -->
                <div class="flex-1">
                    <div class="prose dark:prose-invert max-w-none mb-6">
                        ${formatQuestionBody(answer.body)}
                    </div>
                    
                    <!-- Author card -->
                    <div class="flex justify-end">
                        <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                            <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">answered ${formatDate(answer.created_at)}</div>
                            <div class="flex items-center gap-3">
                                <img src="${author.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(author.username)}&background=random`}" 
                                    alt="${escapeHtml(author.username)}" 
                                    class="w-10 h-10 rounded">
                                <div>
                                    <a href="/profile.html?user=${author.id}" class="text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700">
                                        ${escapeHtml(author.username)}
                                    </a>
                                    <div class="text-sm text-gray-600 dark:text-gray-400">
                                        <span class="font-semibold text-orange-600 dark:text-orange-400">${author.reputation || 0}</span> reputation
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function submitAnswer() {
    if (!await requireAuth()) return;
    
    const answerBody = document.getElementById('answerBody').value.trim();
    if (!answerBody) {
        showToast('Please write your answer', 'error');
        return;
    }
    
    try {
        const user = await getCurrentUser();
        
        const { data, error } = await supabase
            .from('answers')
            .insert({
                question_id: currentQuestionId,
                body: answerBody,
                author_id: user.id
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // Update question answer count
        const { data: question } = await supabase
            .from('questions')
            .select('answer_count')
            .eq('id', currentQuestionId)
            .single();
        
        await supabase
            .from('questions')
            .update({ 
                answer_count: (question?.answer_count || 0) + 1,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentQuestionId);
        
        showToast('Answer posted successfully!', 'success');
        document.getElementById('answerBody').value = '';
        await loadAnswers(currentQuestionId);
        
    } catch (error) {
        console.error('Error submitting answer:', error);
        showToast('Error posting answer', 'error');
    }
}

async function voteQuestion(voteType) {
    if (!await requireAuth()) return;
    
    try {
        const user = await getCurrentUser();
        
        // Check existing vote
        const { data: existingVote } = await supabase
            .from('question_votes')
            .select('*')
            .eq('user_id', user.id)
            .eq('question_id', currentQuestionId)
            .single();
        
        if (existingVote) {
            if (existingVote.vote_type === voteType) {
                // Remove vote
                await supabase
                    .from('question_votes')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('question_id', currentQuestionId);
                
                await updateQuestionVoteCount(-voteType);
            } else {
                // Change vote
                await supabase
                    .from('question_votes')
                    .update({ vote_type: voteType })
                    .eq('user_id', user.id)
                    .eq('question_id', currentQuestionId);
                
                await updateQuestionVoteCount(voteType * 2);
            }
        } else {
            // New vote
            await supabase
                .from('question_votes')
                .insert({
                    user_id: user.id,
                    question_id: currentQuestionId,
                    vote_type: voteType
                });
            
            await updateQuestionVoteCount(voteType);
        }
        
        await checkUserVote(currentQuestionId, 'question');
        
    } catch (error) {
        console.error('Error voting:', error);
        showToast('Error voting', 'error');
    }
}

async function updateQuestionVoteCount(change) {
    const { data: question } = await supabase
        .from('questions')
        .select('votes')
        .eq('id', currentQuestionId)
        .single();
    
    const newVotes = (question?.votes || 0) + change;
    
    await supabase
        .from('questions')
        .update({ votes: newVotes })
        .eq('id', currentQuestionId);
    
    document.getElementById('questionVotes').textContent = newVotes;
}

async function voteAnswer(answerId, voteType) {
    if (!await requireAuth()) return;
    
    try {
        const user = await getCurrentUser();
        
        const { data: existingVote } = await supabase
            .from('answer_votes')
            .select('*')
            .eq('user_id', user.id)
            .eq('answer_id', answerId)
            .single();
        
        if (existingVote) {
            if (existingVote.vote_type === voteType) {
                await supabase
                    .from('answer_votes')
                    .delete()
                    .eq('user_id', user.id)
                    .eq('answer_id', answerId);
                
                await updateAnswerVoteCount(answerId, -voteType);
            } else {
                await supabase
                    .from('answer_votes')
                    .update({ vote_type: voteType })
                    .eq('user_id', user.id)
                    .eq('answer_id', answerId);
                
                await updateAnswerVoteCount(answerId, voteType * 2);
            }
        } else {
            await supabase
                .from('answer_votes')
                .insert({
                    user_id: user.id,
                    answer_id: answerId,
                    vote_type: voteType
                });
            
            await updateAnswerVoteCount(answerId, voteType);
        }
        
        await checkUserVote(answerId, 'answer');
        
    } catch (error) {
        console.error('Error voting:', error);
        showToast('Error voting', 'error');
    }
}

async function updateAnswerVoteCount(answerId, change) {
    const { data: answer } = await supabase
        .from('answers')
        .select('votes')
        .eq('id', answerId)
        .single();
    
    const newVotes = (answer?.votes || 0) + change;
    
    await supabase
        .from('answers')
        .update({ votes: newVotes })
        .eq('id', answerId);
    
    document.getElementById(`answerVotes_${answerId}`).textContent = newVotes;
}

async function checkUserVote(itemId, itemType) {
    const user = await getCurrentUser();
    if (!user) return;
    
    const table = itemType === 'question' ? 'question_votes' : 'answer_votes';
    const column = itemType === 'question' ? 'question_id' : 'answer_id';
    
    const { data: vote } = await supabase
        .from(table)
        .select('vote_type')
        .eq('user_id', user.id)
        .eq(column, itemId)
        .single();
    
    const prefix = itemType === 'question' ? 'Question' : `Answer_${itemId}`;
    const upvoteBtn = document.getElementById(`upvote${prefix}`);
    const downvoteBtn = document.getElementById(`downvote${prefix}`);
    
    if (upvoteBtn && downvoteBtn) {
        upvoteBtn.querySelector('svg').classList.remove('text-orange-500');
        downvoteBtn.querySelector('svg').classList.remove('text-orange-500');
        
        if (vote) {
            if (vote.vote_type === 1) {
                upvoteBtn.querySelector('svg').classList.add('text-orange-500');
            } else {
                downvoteBtn.querySelector('svg').classList.add('text-orange-500');
            }
        }
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    loadQuestionDetail();
});
