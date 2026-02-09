// Authentication Logic
let currentUser = null;

async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    await ensureUserProfile(session.user);
    updateAuthUI(true);
  } else {
    updateAuthUI(false);
  }

  // Listen for auth changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      currentUser = session.user;
      await ensureUserProfile(session.user);
      updateAuthUI(true);
    } else {
      currentUser = null;
      updateAuthUI(false);
    }
  });
}

async function ensureUserProfile(user) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error && error.code === 'PGRST116') {
    // Profile doesn't exist, create it
    const username = user.email.split('@')[0] + '_' + user.id.substring(0, 4);
    await supabase.from('profiles').insert({
      id: user.id,
      username: username,
      full_name: user.user_metadata.full_name || user.email,
      avatar_url: user.user_metadata.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=random`,
      reputation: 0
    });
  }
}

async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
  if (error) console.error('Error signing in:', error);
}

async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('Error signing out:', error);
  window.location.href = '/';
}

function updateAuthUI(isLoggedIn) {
  const authBtn = document.getElementById('auth-btn');
  const userMenu = document.getElementById('user-menu');
  const askBtn = document.getElementById('ask-question-btn');

  if (isLoggedIn && currentUser) {
    if (authBtn) authBtn.style.display = 'none';
    if (userMenu) {
      userMenu.style.display = 'flex';
      const avatarImg = userMenu.querySelector('img');
      const usernameSpan = userMenu.querySelector('.username');
      
      supabase.from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single()
        .then(({ data }) => {
          if (data) {
            if (avatarImg) avatarImg.src = data.avatar_url;
            if (usernameSpan) usernameSpan.textContent = data.username;
          }
        });
    }
    if (askBtn) askBtn.style.display = 'inline-flex';
  } else {
    if (authBtn) authBtn.style.display = 'inline-flex';
    if (userMenu) userMenu.style.display = 'none';
    if (askBtn) askBtn.style.display = 'none';
  }
}

// Initialize auth when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuth);
} else {
  initAuth();
}
