# PhysFlow Deployment Checklist

## 📋 Pre-Deployment Checklist

### ✅ Supabase Configuration

- [ ] Supabase project created
- [ ] Database tables created (run `supabase-setup.sql`)
- [ ] RLS policies enabled and working
- [ ] Google OAuth configured
- [ ] Google Cloud Console redirect URIs added
- [ ] Supabase redirect URIs configured
- [ ] API keys copied to `javascript/supabase-config.js`

### ✅ Code Configuration

- [ ] `SUPABASE_URL` updated in config
- [ ] `SUPABASE_ANON_KEY` updated in config
- [ ] All file paths are correct
- [ ] JavaScript files in `/javascript/` folder
- [ ] HTML files in root directory

### ✅ Git & GitHub

- [ ] Repository initialized (`git init`)
- [ ] All files added (`git add .`)
- [ ] Initial commit created
- [ ] GitHub repository created
- [ ] Remote added (`git remote add origin`)
- [ ] Code pushed to GitHub

### ✅ Deployment Platform

- [ ] Platform chosen (GitHub Pages / Cloudflare Pages / Vercel)
- [ ] Repository connected
- [ ] Build settings configured (if needed)
- [ ] Site deployed successfully
- [ ] Custom domain configured (optional)

---

## 🧪 Post-Deployment Testing

### ✅ Basic Functionality

- [ ] Homepage loads without errors
- [ ] All navigation links work
- [ ] Dark mode toggle works
- [ ] Search bar appears
- [ ] Footer displays correctly

### ✅ Authentication

- [ ] "Log in" button visible when signed out
- [ ] Google sign in popup opens
- [ ] Sign in completes successfully
- [ ] User profile created in database
- [ ] User menu appears after sign in
- [ ] Avatar displays correctly
- [ ] Sign out works

### ✅ Questions

- [ ] Questions list loads
- [ ] Filter buttons work (Newest, Active, etc.)
- [ ] Question cards display correctly
- [ ] Click on question opens detail page
- [ ] Vote counts display
- [ ] Tags display and are clickable
- [ ] Author information shows

### ✅ Ask Question

- [ ] "Ask Question" button requires sign in
- [ ] Form loads correctly
- [ ] Title input works
- [ ] Body textarea works
- [ ] Tag input works
- [ ] Tag suggestions appear
- [ ] Tag addition works
- [ ] Tag removal works
- [ ] Character counters work
- [ ] Form validation works
- [ ] Question posts successfully
- [ ] Redirect to question page after posting

### ✅ Question Detail

- [ ] Question detail page loads
- [ ] Voting buttons work
- [ ] Upvote changes vote count
- [ ] Downvote changes vote count
- [ ] Vote state persists (shows selected vote)
- [ ] Answers section loads
- [ ] Answer count displays correctly
- [ ] Answer form works
- [ ] Answer posts successfully
- [ ] New answer appears in list

### ✅ Tags Page

- [ ] Tags page loads
- [ ] All tags display
- [ ] Tag search works
- [ ] Click on tag filters questions
- [ ] Question count per tag is accurate

### ✅ Users Page

- [ ] Users page loads
- [ ] Users grid displays
- [ ] User search works
- [ ] Click on user goes to profile
- [ ] Reputation displays correctly
- [ ] Avatars load

### ✅ Profile Page

- [ ] Profile page loads
- [ ] User information displays
- [ ] Statistics show (reputation, questions, answers)
- [ ] Questions tab works
- [ ] Answers tab works
- [ ] Edit profile button shows for own profile
- [ ] Edit profile modal works
- [ ] Profile updates save correctly

### ✅ Responsive Design

- [ ] Mobile view works (< 768px)
- [ ] Tablet view works (768px - 1024px)
- [ ] Desktop view works (> 1024px)
- [ ] Sidebar collapses on mobile
- [ ] Navigation is usable on all devices

### ✅ Dark Mode

- [ ] Dark mode toggle button works
- [ ] All pages support dark mode
- [ ] Colors are readable in dark mode
- [ ] Dark mode preference persists
- [ ] Images/icons work in dark mode

### ✅ Performance

- [ ] Page load time < 3 seconds
- [ ] No console errors
- [ ] No console warnings (or minimal)
- [ ] Images load properly
- [ ] Fonts load correctly
- [ ] Smooth scrolling works

### ✅ SEO & Meta

- [ ] Page titles are descriptive
- [ ] Meta descriptions present (optional)
- [ ] Open Graph tags (optional)
- [ ] Favicon (optional)

---

## 🔧 Database Verification

### ✅ Tables Check

Run in Supabase SQL Editor:

```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

Expected tables:
- [ ] profiles
- [ ] questions
- [ ] answers
- [ ] tags
- [ ] question_tags
- [ ] question_votes
- [ ] answer_votes

### ✅ RLS Check

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

All tables should have `rowsecurity = true`

### ✅ Sample Data

- [ ] Can create a test question
- [ ] Can add tags to question
- [ ] Can post an answer
- [ ] Can vote on question
- [ ] Can vote on answer
- [ ] All data appears in database

---

## 🐛 Troubleshooting

### Issue: Authentication not working

**Check:**
- [ ] Supabase redirect URL is correct
- [ ] Google Cloud Console redirect URI matches
- [ ] No console errors
- [ ] Cookies enabled in browser

**Fix:**
```
1. Verify redirect URIs match exactly
2. Check browser console for errors
3. Try incognito mode
4. Clear browser cache
```

### Issue: Database queries failing

**Check:**
- [ ] RLS policies are set correctly
- [ ] User is authenticated
- [ ] API keys are correct
- [ ] Network requests succeeding

**Fix:**
```
1. Re-run supabase-setup.sql
2. Check RLS policies in Supabase dashboard
3. Verify API keys in config
4. Check Network tab in DevTools
```

### Issue: 404 Errors

**Check:**
- [ ] File paths are correct
- [ ] JavaScript files in `/javascript/` folder
- [ ] No typos in file names
- [ ] Deployment platform serving files correctly

**Fix:**
```
1. Check file structure matches expected
2. Verify paths in HTML files
3. Check deployment platform settings
4. Clear CDN cache if using one
```

---

## 📊 Success Metrics

After deployment, your site should have:

- [ ] ✅ 100% uptime
- [ ] ✅ < 3s page load time
- [ ] ✅ No JavaScript errors
- [ ] ✅ Working authentication
- [ ] ✅ All CRUD operations functional
- [ ] ✅ Mobile responsive
- [ ] ✅ Dark mode working
- [ ] ✅ SEO friendly URLs

---

## 🎯 Next Steps After Deployment

- [ ] Monitor Supabase usage
- [ ] Check error logs
- [ ] Gather user feedback
- [ ] Plan feature additions
- [ ] Consider NextJS migration
- [ ] Add analytics
- [ ] Optimize performance
- [ ] Implement caching

---

## ✨ Congratulations!

If all items are checked, your PhysFlow platform is successfully deployed! 🎉

**Share your deployment:**
- GitHub: `https://github.com/YOUR-USERNAME/physflow-supabase`
- Live Site: `https://YOUR-DOMAIN.com`

---

**Questions?** Open an issue on GitHub or check the documentation!
