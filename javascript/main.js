import { supabase } from './supabase-config.js';

const questionsList = document.getElementById('questions-list');
const questionCount = document.getElementById('question-count');

// প্রশ্নগুলো দেখানোর ফাংশন
async function fetchQuestions() {
    const { data: questions, error } = await supabase
        .from('questions')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching questions:', error);
        return;
    }

    renderQuestions(questions);
}

function renderQuestions(questions) {
    questionsList.innerHTML = '';
    questionCount.innerText = `${questions.length} questions`;

    questions.forEach(q => {
        const questionHtml = `
            <div class="p-4 flex items-start space-x-4 hover:bg-[#f8f9f9] dark:hover:bg-[#323232] transition-colors">
                <div class="flex flex-col items-end space-y-2 text-xs-stack text-gray-600 dark:text-gray-400 min-w-[60px]">
                    <div class="font-medium text-black dark:text-gray-200">0 votes</div>
                    <div class="border border-[#5eba7d] text-[#5eba7d] px-1 rounded">0 answers</div>
                    <div class="text-gray-500">0 views</div>
                </div>

                <div class="flex-1">
                    <h3 class="text-[#0074cc] dark:text-[#4da9ff] text-title-stack hover:text-[#0a95ff] cursor-pointer mb-1 leading-tight">
                        ${q.title}
                    </h3>
                    <p class="text-gray-700 dark:text-gray-300 line-clamp-2 mb-2 text-xs-stack">
                        ${q.content.substring(0, 200)}...
                    </p>
                    
                    <div class="flex justify-between items-center">
                        <div class="flex space-x-1">
                            ${q.tags ? q.tags.map(tag => `
                                <span class="bg-[#e1ecf4] dark:bg-[#3d4952] text-[#39739d] dark:text-[#9cc3db] px-1.5 py-0.5 rounded text-[11px] hover:bg-[#d0e3f1] cursor-pointer">
                                    ${tag}
                                </span>
                            `).join('') : ''}
                        </div>
                        
                        <div class="flex items-center space-x-1 text-[12px] text-gray-500">
                            <span class="text-[#0074cc] dark:text-[#4da9ff]">${q.author_name || 'Anonymous'}</span>
                            <span>asked ${new Date(q.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        questionsList.insertAdjacentHTML('beforeend', questionHtml);
    });
}

// ইনিশিয়াল কল
fetchQuestions();
