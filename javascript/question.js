// Question page
let questionId = null;
let questionData = null;

async function loadQuestion() {
  const urlParams = new URLSearchParams(window.location.search);
  questionId = urlParams.get('id');

  if (!questionId) {
    window.location.href = '/';
    return;
  }

  try {
    // Load question
    const { data: question, error: qError } = await supabase
      .from('questions')
      .select(`
        *,
        profiles:author_id (id, username, avatar_url, reputation),
        question_tags (
          tags (name, slug)
        )
      `)
      .eq('id', questionId)
      .single();

    if (qError) throw qError;
    if (!question) {
      window.location.href = '/';
      return;
    }

    questionData = question;

    // Increment view count
    await supabase
      .from('questions')
      .update({ views: question.views + 1 })
      .eq('id', questionId);

    displayQuestion(question);
    await loadAnswers();
    await loadUserVote();
  } catch (error) {
    console.error('Error loading question:', error);
  }
}

function displayQuestion(question) {
  const container = document.getElementById('question-container');
  if (!container) return;

  container.innerHTML = `
    <div class="mb-6">
      <h1 class="text-2xl font-medium mb-4 text-gray-900 dark:text-gray-100">${escapeHtml(question.title)}</h1>
      
      <div class="flex gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
        <span>জিজ্ঞাসা করা হয়েছে ${timeAgo(question.created_at)}</span>
        <span>দেখা হয়েছে ${formatNumber(question.views)} বার</span>
      </div>

      <div class="flex gap-6">
        <!-- Voting -->
        <div class="flex flex-col items-center gap-2">
          <button onclick="voteQuestion(1)" id="question-upvote" 
                  class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/>
            </svg>
          </button>
          <span id="question-votes" class="text-2xl font-medium ${question.votes > 0 ? 'text-green-600 dark:text-green-500' : question.votes < 0 ? 'text-red-600 dark:text-red-500' : 'text-gray-700 dark:text-gray-300'}">${question.votes}</span>
          <button onclick="voteQuestion(-1)" id="question-downvote"
                  class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1">
          <div class="prose dark:prose-invert max-w-none mb-4">
            ${marked.parse(question.body)}
          </div>

          <!-- Tags -->
          <div class="flex flex-wrap gap-2 mb-4">
            ${question.question_tags.map(qt => `
              <a href="/tags.html?tag=${qt.tags.slug}" 
                 class="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded hover:bg-blue-200 dark:hover:bg-blue-800">
                ${qt.tags.name}
              </a>
            `).join('')}
          </div>

          <!-- Author card -->
          <div class="flex justify-end">
            <div class="bg-blue-50 dark:bg-blue-900/30 rounded p-3 min-w-[200px]">
              <div class="text-xs text-gray-600 dark:text-gray-400 mb-2">প্রশ্ন করেছেন ${timeAgo(question.created_at)}</div>
              <div class="flex items-center gap-2">
                <img src="${question.profiles.avatar_url}" alt="${question.profiles.username}" class="w-10 h-10 rounded">
                <div>
                  <a href="/profile.html?user=${question.profiles.username}" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium">${question.profiles.username}</a>
                  <div class="text-xs text-gray-600 dark:text-gray-400">${formatNumber(question.profiles.reputation)} রেপুটেশন</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function loadAnswers() {
  const { data: answers, error } = await supabase
    .from('answers')
    .select(`
      *,
      profiles:author_id (id, username, avatar_url, reputation)
    `)
    .eq('question_id', questionId)
    .order('is_accepted', { ascending: false })
    .order('votes', { ascending: false });

  if (error) {
    console.error('Error loading answers:', error);
    return;
  }

  displayAnswers(answers);
}

function displayAnswers(answers) {
  const container = document.getElementById('answers-container');
  if (!container) return;

  const count = document.getElementById('answer-count');
  if (count) count.textContent = `${answers.length} উত্তর`;

  if (answers.length === 0) {
    container.innerHTML = '<div class="text-center py-8 text-gray-600 dark:text-gray-400">এখনো কোনো উত্তর দেওয়া হয়নি</div>';
    return;
  }

  container.innerHTML = answers.map(answer => `
    <div class="border-b border-gray-200 dark:border-gray-700 py-6">
      <div class="flex gap-6">
        <!-- Voting -->
        <div class="flex flex-col items-center gap-2">
          <button onclick="voteAnswer('${answer.id}', 1)" id="answer-upvote-${answer.id}"
                  class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/>
            </svg>
          </button>
          <span id="answer-votes-${answer.id}" class="text-2xl font-medium ${answer.votes > 0 ? 'text-green-600 dark:text-green-500' : answer.votes < 0 ? 'text-red-600 dark:text-red-500' : 'text-gray-700 dark:text-gray-300'}">${answer.votes}</span>
          <button onclick="voteAnswer('${answer.id}', -1)" id="answer-downvote-${answer.id}"
                  class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          ${answer.is_accepted ? `
            <div class="mt-2 text-green-600 dark:text-green-500" title="গৃহীত উত্তর">
              <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
            </div>
          ` : ''}
          ${currentUser && questionData && questionData.author_id === currentUser.id && !answer.is_accepted ? `
            <button onclick="acceptAnswer('${answer.id}')" 
                    class="mt-2 p-2 hover:bg-green-100 dark:hover:bg-green-900/30 rounded text-gray-400 hover:text-green-600 dark:hover:text-green-500"
                    title="উত্তরটি গ্রহণ করুন">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </button>
          ` : ''}
        </div>

        <!-- Content -->
        <div class="flex-1">
          <div class="prose dark:prose-invert max-w-none mb-4">
            ${marked.parse(answer.body)}
          </div>

          <!-- Author card -->
          <div class="flex justify-end">
            <div class="bg-gray-50 dark:bg-gray-800 rounded p-3 min-w-[200px]">
              <div class="text-xs text-gray-600 dark:text-gray-400 mb-2">উত্তর দিয়েছেন ${timeAgo(answer.created_at)}</div>
              <div class="flex items-center gap-2">
                <img src="${answer.profiles.avatar_url}" alt="${answer.profiles.username}" class="w-10 h-10 rounded">
                <div>
                  <a href="/profile.html?user=${answer.profiles.username}" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium">${answer.profiles.username}</a>
                  <div class="text-xs text-gray-600 dark:text-gray-400">${formatNumber(answer.profiles.reputation)} রেপুটেশন</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

async function loadUserVote() {
  if (!currentUser) return;

  const { data: qVote } = await supabase
    .from('question_votes')
    .select('vote_type')
    .eq('user_id', currentUser.id)
    .eq('question_id', questionId)
    .single();

  if (qVote) {
    updateVoteUI('question', qVote.vote_type);
  }

  const { data: answers } = await supabase
    .from('answers')
    .select('id')
    .eq('question_id', questionId);

  if (answers) {
    for (const answer of answers) {
      const { data: aVote } = await supabase
        .from('answer_votes')
        .select('vote_type')
        .eq('user_id', currentUser.id)
        .eq('answer_id', answer.id)
        .single();

      if (aVote) {
        updateVoteUI(`answer-${answer.id}`, aVote.vote_type);
      }
    }
  }
}

async function voteQuestion(voteType) {
  if (!currentUser) {
    alert('ভোট দিতে লগইন করুন');
    return;
  }

  try {
    const { data: existing } = await supabase
      .from('question_votes')
      .select('vote_type')
      .eq('user_id', currentUser.id)
      .eq('question_id', questionId)
      .single();

    if (existing) {
      if (existing.vote_type === voteType) {
        // Remove vote
        await supabase
          .from('question_votes')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('question_id', questionId);

        await supabase.rpc('update_question_votes', {
          question_id_param: questionId,
          vote_change: -voteType
        });

        updateVoteUI('question', 0);
      } else {
        // Change vote
        await supabase
          .from('question_votes')
          .update({ vote_type: voteType })
          .eq('user_id', currentUser.id)
          .eq('question_id', questionId);

        await supabase.rpc('update_question_votes', {
          question_id_param: questionId,
          vote_change: voteType * 2
        });

        updateVoteUI('question', voteType);
      }
    } else {
      // New vote
      await supabase
        .from('question_votes')
        .insert({
          user_id: currentUser.id,
          question_id: questionId,
          vote_type: voteType
        });

      await supabase.rpc('update_question_votes', {
        question_id_param: questionId,
        vote_change: voteType
      });

      updateVoteUI('question', voteType);
    }

    await loadQuestion();
  } catch (error) {
    console.error('Error voting:', error);
  }
}

async function voteAnswer(answerId, voteType) {
  if (!currentUser) {
    alert('ভোট দিতে লগইন করুন');
    return;
  }

  try {
    const { data: existing } = await supabase
      .from('answer_votes')
      .select('vote_type')
      .eq('user_id', currentUser.id)
      .eq('answer_id', answerId)
      .single();

    if (existing) {
      if (existing.vote_type === voteType) {
        await supabase
          .from('answer_votes')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('answer_id', answerId);

        await supabase.rpc('update_answer_votes', {
          answer_id_param: answerId,
          vote_change: -voteType
        });

        updateVoteUI(`answer-${answerId}`, 0);
      } else {
        await supabase
          .from('answer_votes')
          .update({ vote_type: voteType })
          .eq('user_id', currentUser.id)
          .eq('answer_id', answerId);

        await supabase.rpc('update_answer_votes', {
          answer_id_param: answerId,
          vote_change: voteType * 2
        });

        updateVoteUI(`answer-${answerId}`, voteType);
      }
    } else {
      await supabase
        .from('answer_votes')
        .insert({
          user_id: currentUser.id,
          answer_id: answerId,
          vote_type: voteType
        });

      await supabase.rpc('update_answer_votes', {
        answer_id_param: answerId,
        vote_change: voteType
      });

      updateVoteUI(`answer-${answerId}`, voteType);
    }

    await loadAnswers();
  } catch (error) {
    console.error('Error voting:', error);
  }
}

function updateVoteUI(prefix, voteType) {
  const upBtn = document.getElementById(`${prefix}-upvote`);
  const downBtn = document.getElementById(`${prefix}-downvote`);

  if (upBtn) {
    if (voteType === 1) {
      upBtn.classList.add('text-orange-600', 'dark:text-orange-500');
    } else {
      upBtn.classList.remove('text-orange-600', 'dark:text-orange-500');
    }
  }

  if (downBtn) {
    if (voteType === -1) {
      downBtn.classList.add('text-orange-600', 'dark:text-orange-500');
    } else {
      downBtn.classList.remove('text-orange-600', 'dark:text-orange-500');
    }
  }
}

async function submitAnswer() {
  if (!currentUser) {
    alert('উত্তর দিতে লগইন করুন');
    return;
  }

  const textarea = document.getElementById('answer-body');
  const body = textarea.value.trim();

  if (!body) {
    alert('উত্তর লিখুন');
    return;
  }

  try {
    const { error } = await supabase
      .from('answers')
      .insert({
        question_id: questionId,
        body: body,
        author_id: currentUser.id
      });

    if (error) throw error;

    await supabase.rpc('increment_answer_count', { question_id_param: questionId });

    textarea.value = '';
    await loadAnswers();
    alert('উত্তর যুক্ত হয়েছে!');
  } catch (error) {
    console.error('Error submitting answer:', error);
    alert('উত্তর জমা দিতে সমস্যা হয়েছে');
  }
}

async function acceptAnswer(answerId) {
  if (!currentUser || !questionData || questionData.author_id !== currentUser.id) {
    return;
  }

  try {
    // Unaccept all answers first
    await supabase
      .from('answers')
      .update({ is_accepted: false })
      .eq('question_id', questionId);

    // Accept this answer
    await supabase
      .from('answers')
      .update({ is_accepted: true })
      .eq('id', answerId);

    // Mark question as answered
    await supabase
      .from('questions')
      .update({ is_answered: true })
      .eq('id', questionId);

    await loadAnswers();
  } catch (error) {
    console.error('Error accepting answer:', error);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadQuestion);
} else {
  loadQuestion();
}
