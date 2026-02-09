# PhysFlow - Quick Start Guide

## 🚀 5 মিনিটে Deploy করুন!

### Step 1: Supabase Setup (2 মিনিট)

1. **Supabase Project তৈরি করুন:**
   - [supabase.com](https://supabase.com) এ যান
   - "New Project" ক্লিক করুন
   - Project name: `physflow`
   - Database password সেট করুন

2. **Database Setup:**
   - SQL Editor খুলুন
   - `supabase-setup.sql` ফাইলের সব content copy করে paste করুন
   - "Run" ক্লিক করুন
   - ✅ "Database setup completed successfully!" message দেখুন

3. **Google Auth Enable:**
   - Authentication > Providers > Google > Enable
   - Google Cloud Console এ যান
   - OAuth credentials তৈরি করুন
   - Redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
   - Client ID & Secret copy করে Supabase এ paste করুন

4. **API Keys Copy করুন:**
   - Settings > API
   - Project URL copy করুন
   - `anon` public key copy করুন

### Step 2: Code Update (1 মিনিট)

`javascript/supabase-config.js` ফাইল edit করুন:

```javascript
const SUPABASE_URL = 'YOUR-PROJECT-URL-HERE';
const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY-HERE';
```

### Step 3: GitHub এ Push (1 মিনিট)

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR-USERNAME/physflow.git
git push -u origin main
```

### Step 4: Deploy (1 মিনিট)

#### Option A: GitHub Pages
1. Repository > Settings > Pages
2. Source: main branch, folder: / (root)
3. Save
4. ✅ Live at: `https://YOUR-USERNAME.github.io/physflow/`

#### Option B: Cloudflare Pages
1. [pages.cloudflare.com](https://pages.cloudflare.com)
2. Connect to Git
3. Select repository
4. Deploy
5. ✅ Live in 1 minute!

### Step 5: Final Configuration (30 seconds)

Supabase Dashboard:
- Authentication > URL Configuration
- Site URL: `https://YOUR-DEPLOYED-URL.com`
- Redirect URLs: `https://YOUR-DEPLOYED-URL.com/**`

---

## ✅ সম্পূর্ণ! আপনার সাইট live!

এখন test করুন:
1. সাইট visit করুন
2. Google দিয়ে sign in করুন
3. একটি question post করুন
4. Answer দিন
5. Vote করুন

---

## 🐛 সমস্যা হলে?

### Google Sign In কাজ করছে না?
```
✓ Supabase redirect URL check করুন
✓ Google Console redirect URI check করুন
✓ Browser console errors দেখুন
```

### Database errors?
```
✓ supabase-setup.sql আবার run করুন
✓ RLS policies enabled আছে কিনা check করুন
```

### 404 Errors?
```
✓ File paths সব lowercase
✓ /javascript/ folder সঠিক জায়গায় আছে
✓ HTML files root directory তে আছে
```

---

## 📚 পরবর্তী পদক্ষেপ

- [ ] Custom domain add করুন
- [ ] Google Analytics setup করুন
- [ ] Email notifications add করুন
- [ ] Image upload feature যোগ করুন
- [ ] NextJS এ migrate করুন

---

## 🎯 Important URLs

- **Supabase Dashboard:** https://app.supabase.com
- **Google Cloud Console:** https://console.cloud.google.com
- **GitHub Pages:** https://pages.github.com
- **Cloudflare Pages:** https://pages.cloudflare.com

---

**Need help?** Open an issue on GitHub!
