// ১. ক্যাটাগরি এবং ট্যাগ ডাটা
const categoryTags = {
    "গতি ও গতিবিদ্যা": ["গতি", "বেগ", "ত্বরণ", "দূরত্ব", "স্থানান্তর", "ভেক্টর", "বৃত্তীয় গতি", "সরল ছন্দিত গতি", "দোলন"],
    "বলবিদ্যা": ["নিউটনের সূত্র", "জড়তা", "বল", "ভরবেগ", "সংঘর্ষ", "ঘর্ষণ", "কাজ", "শক্তি", "ক্ষমতা", "মহাকর্ষ", "কেপলারের সূত্র", "কেন্দ্রভর", "রিজিড বডি", "নন-ইনারশিয়াল ফ্রেম", "ল্যাগ্রাঞ্জিয়ান", "হ্যামিল্টোনিয়ান"],
    "পদার্থের ধর্ম": ["স্থিতিস্থাপকতা", "পৃষ্ঠটান", "সান্দ্রতা", "তরল বলবিদ্যা", "চাপ", "ঘনত্ব"]
};

const mathShortcuts = [
    { label: 'π', cmd: '\\pi' }, { label: 'θ', cmd: '\\theta' }, { label: '√', cmd: '\\sqrt{x}' },
    { label: 'Δ', cmd: '\\Delta' }, { label: '∫', cmd: '\\int' }, { label: 'Σ', cmd: '\\sum' },
    { label: '∞', cmd: '\\infty' }, { label: 'λ', cmd: '\\lambda' }
];

let selectedTags = [];
let quill;

// ২. এডিটর ইনিশিয়ালাইজেশন
function initEditor() {
    // Image Resize রেজিস্টার করার নিরাপদ উপায়
    if (typeof ImageResize !== 'undefined') {
        Quill.register('modules/imageResize', ImageResize);
    }

    quill = new Quill('#editor', {
        theme: 'snow',
        modules: {
            // যদি ImageResize কাজ না করে তবে এই লাইনটি কমেন্ট আউট করে দেখতে পারো
            imageResize: { displaySize: true }, 
            toolbar: [
                ['bold', 'blockquote', 'italic', 'underline', 'strike'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                ['code-block', 'formula', 'image', 'video'],
                ['clean']
            ]
        },
        placeholder: 'বিস্তারিত লিখুন...'
    });

    // ড্রাফট রিকভারি
    const saved = localStorage.getItem('ask_draft');
    if (saved) quill.root.innerHTML = saved;

    quill.on('text-change', () => {
        localStorage.setItem('ask_draft', quill.root.innerHTML);
    });

    renderMathShortcuts();
}

// ৩. ম্যাথ শর্টকাট রেন্ডার
function renderMathShortcuts() {
    const container = document.getElementById('editor-container');
    const div = document.createElement('div');
    div.className = "mt-2 p-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-md flex flex-wrap gap-2 items-center";
    div.innerHTML = `<span class="text-[10px] font-bold text-gray-400 mr-2 uppercase">Quick Symbols:</span>`;

    mathShortcuts.forEach(sym => {
        const btn = document.createElement('button');
        btn.type = "button";
        btn.className = "px-2 py-1 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-brand-500 hover:text-white transition";
        btn.textContent = sym.label;
        btn.onclick = () => {
            navigator.clipboard.writeText(sym.cmd);
            alert(`কপি হয়েছে: ${sym.cmd}\nএখন টুলবারের f(x) বাটনে ক্লিক করে পেস্ট করো।`);
        };
        div.appendChild(btn);
    });
    container.appendChild(div);
}

// ৪. প্রিভিউ ফাংশন (উইন্ডো অবজেক্টে রাখা হয়েছে যাতে HTML থেকে কাজ করে)
window.showPreview = function() {
    const previewArea = document.getElementById('preview-area');
    const title = document.getElementById('title').value || "শিরোনামহীন প্রশ্ন";
    const content = quill.root.innerHTML;

    previewArea.innerHTML = `
        <div class="mt-8 p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
            <h2 class="text-xs font-bold text-brand-500 uppercase mb-2">Live Preview</h2>
            <h1 class="text-xl font-bold mb-4">${title}</h1>
            <div class="ql-editor prose dark:prose-invert max-w-none">${content}</div>
        </div>
    `;
    
    // KaTeX রেন্ডার (যদি লাইব্রেরি লোড থাকে)
    if (window.renderMathInElement) {
        window.renderMathInElement(previewArea);
    }
    previewArea.scrollIntoView({ behavior: 'smooth' });
};

// ৫. ইভেন্ট লিসেনারস
document.addEventListener('DOMContentLoaded', () => {
    initEditor();

    const categorySelect = document.getElementById('category');
    const tagDisplay = document.getElementById('tag-display');
    const askForm = document.getElementById('ask-form');

    // ট্যাগ লজিক
    categorySelect.addEventListener('change', function() {
        const category = this.value;
        tagDisplay.innerHTML = "";
        selectedTags = [];

        if (category && categoryTags[category]) {
            categoryTags[category].forEach(tag => {
                const btn = document.createElement('button');
                btn.type = "button";
                btn.textContent = tag;
                btn.className = "px-3 py-1.5 text-[11px] rounded-full border border-gray-300 dark:border-gray-700 hover:border-brand-500 transition-all dark:text-gray-300";
                
                btn.onclick = () => {
                    if (selectedTags.includes(tag)) {
                        selectedTags = selectedTags.filter(t => t !== tag);
                        btn.classList.remove('bg-brand-500', 'text-white', 'border-brand-500');
                    } else if (selectedTags.length < 3) {
                        selectedTags.push(tag);
                        btn.classList.add('bg-brand-500', 'text-white', 'border-brand-500');
                    } else {
                        alert("সর্বোচ্চ ৩টি ট্যাগ সম্ভব।");
                    }
                };
                tagDisplay.appendChild(btn);
            });
        }
    });

    // ফর্ম সাবমিট
    askForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('title').value.trim();
        if (!title || quill.getText().trim().length < 10 || selectedTags.length === 0) {
            alert("সব ঘর সঠিকভাবে পূরণ করো!");
            return;
        }
        alert("প্রশ্ন জমা হয়েছে! কনসোল চেক করো।");
        console.log({ title, body: quill.root.innerHTML, tags: selectedTags });
        localStorage.removeItem('ask_draft');
    });
});
