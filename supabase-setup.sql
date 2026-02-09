-- ===============================================
-- PhysFlow Database Setup for Supabase
-- ===============================================

-- =========================
-- TABLES
-- =========================

-- Profiles Table
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text,
  avatar_url text,
  bio text,
  reputation int default 0,
  created_at timestamptz default now()
);

-- Questions Table
create table if not exists questions (
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

-- Answers Table
create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references questions(id) on delete cascade,
  body text not null,
  author_id uuid references profiles(id) on delete cascade,
  votes int default 0,
  is_accepted boolean default false,
  created_at timestamptz default now()
);

-- Tags Table
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  slug text unique not null
);

-- Question Tags Junction Table
create table if not exists question_tags (
  question_id uuid references questions(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (question_id, tag_id)
);

-- Question Votes Table
create table if not exists question_votes (
  user_id uuid references profiles(id) on delete cascade,
  question_id uuid references questions(id) on delete cascade,
  vote_type int check (vote_type in (1, -1)),
  primary key (user_id, question_id)
);

-- Answer Votes Table
create table if not exists answer_votes (
  user_id uuid references profiles(id) on delete cascade,
  answer_id uuid references answers(id) on delete cascade,
  vote_type int check (vote_type in (1, -1)),
  primary key (user_id, answer_id)
);

-- =========================
-- INDEXES for Performance
-- =========================

create index if not exists idx_questions_author on questions(author_id);
create index if not exists idx_questions_created on questions(created_at desc);
create index if not exists idx_questions_votes on questions(votes desc);
create index if not exists idx_answers_question on answers(question_id);
create index if not exists idx_answers_author on answers(author_id);
create index if not exists idx_question_tags_question on question_tags(question_id);
create index if not exists idx_question_tags_tag on question_tags(tag_id);

-- =========================
-- ROW LEVEL SECURITY (RLS)
-- =========================

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table questions enable row level security;
alter table answers enable row level security;
alter table tags enable row level security;
alter table question_tags enable row level security;
alter table question_votes enable row level security;
alter table answer_votes enable row level security;

-- Profiles Policies
create policy "Public profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Questions Policies
create policy "Questions are viewable by everyone"
  on questions for select using (true);

create policy "Authenticated users can create questions"
  on questions for insert with check (auth.role() = 'authenticated');

create policy "Users can update own questions"
  on questions for update using (auth.uid() = author_id);

create policy "Users can delete own questions"
  on questions for delete using (auth.uid() = author_id);

-- Answers Policies
create policy "Answers are viewable by everyone"
  on answers for select using (true);

create policy "Authenticated users can create answers"
  on answers for insert with check (auth.role() = 'authenticated');

create policy "Users can update own answers"
  on answers for update using (auth.uid() = author_id);

create policy "Users can delete own answers"
  on answers for delete using (auth.uid() = author_id);

-- Tags Policies
create policy "Tags are viewable by everyone"
  on tags for select using (true);

create policy "Authenticated users can create tags"
  on tags for insert with check (auth.role() = 'authenticated');

-- Question Tags Policies
create policy "Question tags are viewable by everyone"
  on question_tags for select using (true);

create policy "Authenticated users can create question tags"
  on question_tags for insert with check (auth.role() = 'authenticated');

-- Question Votes Policies
create policy "Question votes are viewable by everyone"
  on question_votes for select using (true);

create policy "Authenticated users can manage their votes"
  on question_votes for all using (auth.uid() = user_id);

-- Answer Votes Policies
create policy "Answer votes are viewable by everyone"
  on answer_votes for select using (true);

create policy "Authenticated users can manage their answer votes"
  on answer_votes for all using (auth.uid() = user_id);

-- =========================
-- FUNCTIONS
-- =========================

-- Function to handle new user creation
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'preferred_username',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on user signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =========================
-- SAMPLE DATA (Optional)
-- =========================

-- Insert some sample tags
insert into tags (name, slug) values
  ('physics', 'physics'),
  ('quantum-mechanics', 'quantum-mechanics'),
  ('thermodynamics', 'thermodynamics'),
  ('electromagnetism', 'electromagnetism'),
  ('astrophysics', 'astrophysics'),
  ('mathematics', 'mathematics'),
  ('calculus', 'calculus'),
  ('linear-algebra', 'linear-algebra'),
  ('chemistry', 'chemistry'),
  ('biology', 'biology')
on conflict (slug) do nothing;

-- Success message
do $$
begin
  raise notice 'Database setup completed successfully!';
end $$;
