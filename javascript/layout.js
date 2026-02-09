import { createClient } from '@supabase/supabase-api-js'

// 1. Supabase Configuration
const supabaseUrl = 'https://hmzcipbchhsdycgozhzd.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtemNpcGJjaGhzZHljZ296aHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1ODIzNDksImV4cCI6MjA4NjE1ODM0OX0.5rMQnPHo6haSnJwdagPOt9c4MnLWJWKx5gk8eKRO66A'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 2. Google Login Function
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
  })
  if (error) console.error('Error logging in:', error.message)
}

// 3. Logout Function
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) console.error('Error logging out:', error.message)
}

// 4. Auth State UI Update (Profile Pic & Name)
export function setupAuthUI(onUserUpdate) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      const user = session.user;
      const userData = {
        name: user.user_metadata.full_name,
        avatar: user.user_metadata.avatar_url
      };
      onUserUpdate(userData);
    } else {
      onUserUpdate(null);
    }
  });
}

// 5. Day-Night Mode Logic
export function initTheme() {
  const html = document.documentElement;
  const savedTheme = localStorage.getItem('theme');

  // ইউজার আগে থেকে কোনো থিম সেট করে রাখলে সেটা অ্যাপ্লাই করবে
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
}

export function toggleTheme() {
  const html = document.documentElement;
  if (html.classList.contains('dark')) {
    html.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  } else {
    html.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  }
}
