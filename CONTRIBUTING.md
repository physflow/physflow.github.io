# Contributing to PhysFlow

PhysFlow প্রজেক্টে আপনার contribution স্বাগতম! এই guide আপনাকে contribute করতে সাহায্য করবে।

## 🚀 কিভাবে Contribute করবেন

### 1. Repository Fork করুন

1. GitHub এ এই repository তে যান
2. উপরে ডানদিকে "Fork" button ক্লিক করুন
3. আপনার account এ fork হবে

### 2. Local Setup

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/physflow-supabase.git
cd physflow-supabase

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL-OWNER/physflow-supabase.git
```

### 3. Branch তৈরি করুন

```bash
# Create a new branch for your feature
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### 4. Changes করুন

- Code লিখুন
- Test করুন locally
- Comments যোগ করুন
- Code formatting maintain করুন

### 5. Commit করুন

```bash
git add .
git commit -m "feat: Add your feature description"

# Or for bug fixes
git commit -m "fix: Fix bug description"
```

**Commit Message Format:**
- `feat:` - নতুন feature
- `fix:` - bug fix
- `docs:` - documentation changes
- `style:` - formatting changes
- `refactor:` - code refactoring
- `test:` - test additions
- `chore:` - maintenance tasks

### 6. Push করুন

```bash
git push origin feature/your-feature-name
```

### 7. Pull Request তৈরি করুন

1. আপনার GitHub fork এ যান
2. "Pull Request" button ক্লিক করুন
3. Title এবং description লিখুন
4. Submit করুন

## 📋 Development Guidelines

### Code Style

1. **JavaScript:**
   - Use `async/await` instead of promises chains
   - Use meaningful variable names
   - Add comments for complex logic
   - Follow existing code structure

2. **HTML:**
   - Use semantic HTML5 tags
   - Maintain accessibility (ARIA labels)
   - Keep consistent structure

3. **CSS (Tailwind):**
   - Use Tailwind utility classes
   - Avoid custom CSS when possible
   - Follow dark mode patterns

### File Structure

```
physflow-supabase/
├── javascript/           # JavaScript modules
│   ├── supabase-config.js
│   ├── auth.js
│   ├── layout.js
│   ├── main.js
│   ├── question.js
│   ├── ask.js
│   ├── tags.js
│   ├── users.js
│   └── profile.js
├── *.html               # Page templates
└── README.md
```

### Testing

Local testing এর জন্য:

```bash
# Python server
python -m http.server 8000

# Or Node.js
npx http-server

# Visit http://localhost:8000
```

Test checklist:
- [ ] All pages load correctly
- [ ] Authentication works
- [ ] CRUD operations work
- [ ] Voting system works
- [ ] Dark mode toggles properly
- [ ] Responsive on mobile
- [ ] No console errors

## 🐛 Bug Reports

Bug report করার সময়:

1. Issue title স্পষ্ট রাখুন
2. Steps to reproduce যোগ করুন
3. Expected vs actual behavior বর্ণনা করুন
4. Screenshots যোগ করুন (যদি সম্ভব হয়)
5. Browser/OS information দিন

**Template:**

```markdown
## Bug Description
[Clear description]

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Screenshots
[If applicable]

## Environment
- Browser: Chrome 120
- OS: Windows 11
- Device: Desktop
```

## 💡 Feature Requests

Feature request করার সময়:

1. Problem statement স্পষ্ট করুন
2. Proposed solution বর্ণনা করুন
3. Alternative solutions mention করুন
4. Use cases explain করুন

**Template:**

```markdown
## Problem
[Describe the problem]

## Proposed Solution
[How to solve it]

## Alternatives
[Other ways to solve]

## Use Cases
[When this would be useful]
```

## 📝 Documentation

Documentation contribution:

- README updates
- Code comments
- API documentation
- Tutorial creation
- Translation (বাংলা/English)

## 🎯 Priority Areas

নিচের areas এ contribution especially welcome:

- [ ] Real-time updates (WebSocket/Realtime)
- [ ] Image upload (Supabase Storage)
- [ ] Full-text search
- [ ] Email notifications
- [ ] Markdown editor
- [ ] Comment system
- [ ] Badge system
- [ ] Accessibility improvements
- [ ] Performance optimizations
- [ ] Mobile responsiveness
- [ ] i18n (Internationalization)

## 🔧 Advanced Features

NextJS migration এর জন্য preparation:

- Component-based structure
- API routes planning
- SSR/SSG strategy
- Performance optimization
- SEO improvements

## ✅ Pull Request Checklist

PR submit করার আগে check করুন:

- [ ] Code locally test করেছি
- [ ] Console এ কোন error নেই
- [ ] Existing features break করিনি
- [ ] Comments যোগ করেছি
- [ ] README update করেছি (যদি দরকার হয়)
- [ ] Commit messages meaningful
- [ ] Branch up-to-date with main

## 🤝 Code of Conduct

- সবার সাথে সম্মানজনক আচরণ করুন
- Constructive feedback দিন
- অন্যদের ideas স্বাগত জানান
- Inclusive language ব্যবহার করুন

## 📞 Need Help?

- GitHub Discussions ব্যবহার করুন
- Discord community join করুন
- Issues এ question করুন
- Email করুন: support@physflow.com

## 🏆 Contributors

সব contributors এর list [CONTRIBUTORS.md](CONTRIBUTORS.md) এ পাবেন।

---

**ধন্যবাদ PhysFlow কে better করার জন্য!** 🎉
