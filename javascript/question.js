import { supabase } from './javascript/supabase-config.js'

const urlParams = new URLSearchParams(window.location.search)
const questionId = urlParams.get("id")

const titleEl = document.getElementById("question-title")
const bodyEl = document.getElementById("question-body")
const answerList = document.getElementById("answer-list")
const answerCountEl = document.getElementById("answer-count")
const submitBtn = document.getElementById("submit-answer")
const answerInput = document.getElementById("answer-input")

async function loadQuestion() {

    if (!questionId) {
        titleEl.textContent = "প্রশ্ন পাওয়া যায়নি"
        return
    }

    const { data, error } = await supabase
        .from("question")
        .select("*")
        .eq("id", questionId)
        .single()

    if (error) {
        titleEl.textContent = "লোড করতে সমস্যা হয়েছে"
        return
    }

    titleEl.textContent = data.title
    bodyEl.textContent = data.body
}

async function loadAnswers() {

    const { data, error } = await supabase
        .from("answer")
        .select("*")
        .eq("question_id", questionId)
        .order("created_at", { ascending: true })

    if (error) return

    answerList.innerHTML = ""
    answerCountEl.textContent = `${data.length} মন্তব্য`

    data.forEach(answer => {

        const div = document.createElement("div")
        div.className = "bg-white dark:bg-[#1a1a1b] border border-gray-200 dark:border-gray-700 rounded-lg p-4"

        div.innerHTML = `
            <div class="text-gray-700 dark:text-gray-300 text-sm mb-2">
                ${answer.content}
            </div>
            <div class="text-xs text-gray-500">
                ${new Date(answer.created_at).toLocaleString()}
            </div>
        `

        answerList.appendChild(div)
    })
}

submitBtn?.addEventListener("click", async () => {

    const content = answerInput.value.trim()
    if (!content) return

    await supabase
        .from("answer")
        .insert([
            {
                question_id: questionId,
                content: content
            }
        ])

    answerInput.value = ""
    loadAnswers()
})

loadQuestion()
loadAnswers()