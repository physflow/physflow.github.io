# PhysFlow - Q&A and Research Platform

একটি Stack Overflow এর মতো প্রশ্নোত্তর প্ল্যাটফর্ম যা Supabase এর সাথে তৈরি করা হয়েছে।

## Features

- ✅ Google Authentication
- ✅ প্রশ্ন জিজ্ঞাসা করা এবং উত্তর দেওয়া
- ✅ Voting System (Upvote/Downvote)
- ✅ Tags System
- ✅ User Profiles
- ✅ Reputation System
- ✅ Dark Mode
- ✅ Responsive Design (Stack Overflow clone)
- ✅ Real-time Updates

## Technology Stack

- **Frontend**: HTML, Tailwind CSS, Vanilla JavaScript
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Hosting**: Cloudflare Pages / GitHub Pages
- **Authentication**: Google OAuth via Supabase

## Supabase Setup

### 1. Database Tables

আপনার Supabase project এ SQL Editor থেকে নিচের SQL run করুন:

```sql
-- =========================
-- PROFILES
-- =========================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text,
  avatar_url text,
  bio text,
  reputation int default 0,
  created_at timestamptz default now()
);

-- =========================
-- QUESTIONS
-- =========================
create table questions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  body text not null,
  author_id uuid references profiles(id) on delete cascade,
  votes int default 0,
  views int default 0,
  answer_count int default 0,
  is_answered boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =========================
-- ANSWERS
-- =========================
create table answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references questions(id) on delete cascade,
  body text not null,
  author_id uuid references profiles(id) on delete cascade,
  votes int default 0,
  is_accepted boolean default false,
  created_at timestamptz default now()
);

-- =========================
-- TAGS
-- =========================
create table tags (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  slug text unique not null
);

create table question_tags (
  question_id uuid references questions(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (question_id, tag_id)
);

-- =========================
-- VOTES
-- =========================
create table question_votes (
  user_id uuid references profiles(id) on delete cascade,
  question_id uuid references questions(id) on delete cascade,
  vote_type int check (vote_type in (1, -1)),
  primary key (user_id, question_id)
);

create table answer_votes (
  user_id uuid references profiles(id) on delete cascade,
  answer_id uuid references answers(id) on delete cascade,
  vote_type int check (vote_type in (1, -1)),
  primary key (user_id, answer_id)
);
```

### 2. Row Level Security (RLS)

Security এর জন্য RLS policies enable করুন:

```sql
-- Enable RLS
alter table profiles enable row level security;
alter table questions enable row level security;
alter table answers enable row level security;
alter table tags enable row level security;
alter table question_tags enable row level security;
alter table question_votes enable row level security;
alter table answer_votes enable row level security;

-- Profiles policies
create policy "Public profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Questions policies
create policy "Questions are viewable by everyone"
  on questions for select using (true);

create policy "Authenticated users can create questions"
  on questions for insert with check (auth.role() = 'authenticated');

create policy "Users can update own questions"
  on questions for update using (auth.uid() = author_id);

-- Answers policies
create policy "Answers are viewable by everyone"
  on answers for select using (true);

create policy "Authenticated users can create answers"
  on answers for insert with check (auth.role() = 'authenticated');

create policy "Users can update own answers"
  on answers for update using (auth.uid() = author_id);

-- Tags policies
create policy "Tags are viewable by everyone"
  on tags for select using (true);

create policy "Authenticated users can create tags"
  on tags for insert with check (auth.role() = 'authenticated');

-- Question tags policies
create policy "Question tags are viewable by everyone"
  on question_tags for select using (true);

create policy "Authenticated users can create question tags"
  on question_tags for insert with check (auth.role() = 'authenticated');

-- Votes policies
create policy "Votes are viewable by everyone"
  on question_votes for select using (true);

create policy "Authenticated users can vote"
  on question_votes for all using (auth.uid() = user_id);

create policy "Answer votes are viewable by everyone"
  on answer_votes for select using (true);

create policy "Authenticated users can vote on answers"
  on answer_votes for all using (auth.uid() = user_id);
```

### 3. Google Authentication Setup

1. Supabase Dashboard > Authentication > Providers
2. Google enable করুন
3. Google Cloud Console থেকে OAuth credentials নিন
4. Authorized redirect URIs যোগ করুন: `https://your-project.supabase.co/auth/v1/callback`

## Configuration

`javascript/supabase-config.js` file এ আপনার Supabase credentials আপডেট করুন:

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

## Local Development

1. এই repository clone করুন
2. কোনো local server দিয়ে run করুন:

```bash
# Python
python -m http.server 8000

# Node.js (http-server)
npx http-server

# VS Code Live Server extension
```

3. Browser এ `http://localhost:8000` open করুন

## Deployment

### GitHub Pages

1. GitHub এ repository create করুন
2. সব ফাইল push করুন
3. Settings > Pages > Source: main branch
4. আপনার site এ যান: `https://username.github.io/physflow-supabase/`

### Cloudflare Pages

1. Cloudflare Pages এ যান
2. GitHub repository connect করুন
3. Build settings:
   - Build command: (leave empty)
   - Build output directory: `/`
4. Deploy করুন

## Project Structure

```
physflow-supabase/
├── index.html              # Home page (Questions list)
├── ask.html               # Ask question page
├── question.html          # Question detail page
├── tags.html              # Tags page
├── users.html             # Users page
├── profile.html           # User profile page
├── javascript/
│   ├── supabase-config.js # Supabase configuration
│   ├── auth.js            # Authentication logic
│   ├── layout.js          # Header/Footer/Sidebar
│   ├── main.js            # Questions list
│   ├── question.js        # Question detail
│   ├── ask.js             # Ask question
│   ├── tags.js            # Tags page
│   ├── users.js           # Users page
│   └── profile.js         # User profile
└── README.md
```

## Features Roadmap

### Coming Soon
- [ ] Real-time subscriptions (নতুন প্রশ্ন/উত্তর আসলে auto-update)
- [ ] Storage (image upload - প্রশ্নে ছবি যুক্ত করা)
- [ ] Full-text search (PostgreSQL এর powerful search)
- [ ] Email notifications (Supabase Edge Functions দিয়ে)
- [ ] Markdown editor for questions/answers
- [ ] Comments on answers
- [ ] Badges and achievements
- [ ] Question bookmarking
- [ ] User following system

## NextJS Migration Ready

এই প্রজেক্টটি পরবর্তীতে NextJS এ migrate করার জন্য structured করা হয়েছে:

- Component-based structure
- Separate JavaScript files
- Supabase client configuration
- API-ready architecture

## License

MIT License

## Support

সমস্যা হলে GitHub Issues এ জানান।
