# PhysFlow Deployment Guide

## Step-by-Step Deployment Instructions

### 1. Supabase Setup (প্রথম ধাপ)

#### A. Supabase Project তৈরি করুন
1. [supabase.com](https://supabase.com) এ যান
2. "New Project" ক্লিক করুন
3. Project details পূরণ করুন
4. Database password সেট করুন (এটি মনে রাখুন!)

#### B. Database Tables তৈরি করুন
1. Supabase Dashboard > SQL Editor এ যান
2. `supabase-setup.sql` ফাইলটি খুলুন
3. সম্পূর্ণ SQL কোড copy করুন
4. SQL Editor এ paste করুন এবং "Run" ক্লিক করুন
5. Success message দেখুন

#### C. Google Authentication Enable করুন
1. Supabase Dashboard > Authentication > Providers
2. Google provider খুঁজুন এবং Enable করুন
3. [Google Cloud Console](https://console.cloud.google.com/) এ যান
4. New Project তৈরি করুন (বা existing project select করুন)
5. APIs & Services > Credentials
6. "Create Credentials" > "OAuth client ID"
7. Application type: Web application
8. Authorized redirect URIs এ যোগ করুন:
   ```
   https://hmzcipbchhsdycgozhzd.supabase.co/auth/v1/callback
   ```
9. Client ID এবং Client Secret copy করুন
10. Supabase এ ফিরে যান এবং credentials paste করুন
11. Save করুন

#### D. Project Settings
1. Supabase Dashboard > Settings > API
2. Project URL copy করুন (e.g., `https://hmzcipbchhsdycgozhzd.supabase.co`)
3. `anon` public key copy করুন

### 2. Code Configuration

#### A. Supabase Credentials আপডেট করুন
`javascript/supabase-config.js` file খুলুন এবং আপনার credentials দিয়ে replace করুন:

```javascript
const SUPABASE_URL = 'https://hmzcipbchhsdycgozhzd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

### 3. GitHub এ Push করুন

```bash
# Initialize git repository
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: PhysFlow platform"

# Add remote repository (আপনার GitHub username দিয়ে replace করুন)
git remote add origin https://github.com/your-username/physflow-supabase.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 4. Deployment Options

আপনি তিনটি উপায়ে deploy করতে পারেন:

#### Option A: GitHub Pages (সবচেয়ে সহজ)

1. GitHub repository এ যান
2. Settings > Pages
3. Source: Deploy from a branch
4. Branch: main, folder: / (root)
5. Save ক্লিক করুন
6. কয়েক মিনিট পর আপনার site live হবে
7. URL: `https://your-username.github.io/physflow-supabase/`

#### Option B: Cloudflare Pages (দ্রুততম)

1. [Cloudflare Pages](https://pages.cloudflare.com/) এ যান
2. "Create a project" ক্লিক করুন
3. Connect to Git
4. GitHub repository select করুন
5. Build settings:
   - Framework preset: None
   - Build command: (leave empty)
   - Build output directory: /
6. "Save and Deploy" ক্লিক করুন
7. Deploy হতে 1-2 মিনিট লাগবে
8. Custom domain add করতে পারেন (optional)

#### Option C: Vercel (Alternative)

1. [Vercel](https://vercel.com/) এ যান
2. "New Project" ক্লিক করুন
3. GitHub repository import করুন
4. Framework Preset: Other
5. Deploy ক্লিক করুন

### 5. Post-Deployment Configuration

#### A. Update Redirect URIs
Deployment এর পর, আপনার production URL দিয়ে redirect URIs আপডেট করুন:

1. Supabase Dashboard > Authentication > URL Configuration
2. Site URL: `https://your-domain.com`
3. Redirect URLs এ add করুন:
   ```
   https://your-domain.com
   https://your-domain.com/**
   ```

4. Google Cloud Console > Credentials
5. OAuth client এ যান
6. Authorized redirect URIs এ add করুন:
   ```
   https://hmzcipbchhsdycgozhzd.supabase.co/auth/v1/callback
   ```

### 6. Testing

#### A. পরীক্ষা করুন:
- [ ] Homepage load হচ্ছে কিনা
- [ ] Dark mode কাজ করছে কিনা
- [ ] Google sign in কাজ করছে কিনা
- [ ] Question post করা যাচ্ছে কিনা
- [ ] Answer দেওয়া যাচ্ছে কিনা
- [ ] Voting কাজ করছে কিনা
- [ ] Profile page দেখা যাচ্ছে কিনা
- [ ] Tags page কাজ করছে কিনা
- [ ] Search functionality কাজ করছে কিনা

### 7. Troubleshooting

#### সমস্যা: Google Sign In কাজ করছে না
সমাধান:
1. Supabase এর Redirect URL check করুন
2. Google Cloud Console এর Authorized redirect URIs check করুন
3. Browser console এ error দেখুন

#### সমস্যা: Database queries fail হচ্ছে
সমাধান:
1. Supabase RLS policies সঠিকভাবে সেট আছে কিনা check করুন
2. `supabase-setup.sql` আবার run করুন

#### সমস্যা: Pages load হচ্ছে না
সমাধান:
1. Browser console চেক করুন
2. Network tab এ 404 errors আছে কিনা দেখুন
3. File paths সঠিক আছে কিনা verify করুন

### 8. Custom Domain Setup (Optional)

#### Cloudflare Pages:
1. Cloudflare Pages dashboard > Custom domains
2. আপনার domain add করুন
3. DNS records configure করুন

#### GitHub Pages:
1. Settings > Pages > Custom domain
2. Your domain name enter করুন
3. DNS provider এ CNAME record add করুন:
   ```
   CNAME @ your-username.github.io
   ```

### 9. Monitoring & Analytics

#### Supabase Analytics:
- Database > Statistics দেখুন
- Auth > Users দেখুন
- Usage tracking করুন

#### Google Analytics (Optional):
1. Google Analytics account তৈরি করুন
2. Tracking code copy করুন
3. সব HTML files এর `<head>` section এ add করুন

### 10. Maintenance

#### Regular Tasks:
- [ ] Database backups check করুন
- [ ] User feedback monitor করুন
- [ ] Performance metrics দেখুন
- [ ] Security updates apply করুন

## Support

সমস্যা হলে:
1. GitHub Issues তৈরি করুন
2. Supabase Discord community তে জিজ্ঞাসা করুন
3. Stack Overflow এ প্রশ্ন করুন

## Next Steps

- NextJS এ migrate করার পরিকল্পনা করুন
- Real-time features যোগ করুন
- Image upload functionality add করুন
- Email notifications setup করুন
- Advanced search implement করুন

---

**Congratulations! 🎉** আপনার PhysFlow platform এখন live!
