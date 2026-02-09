// Authentication Logic

// Google Sign In
async function signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin
        }
    });
    
    if (error) {
        console.error('Error signing in:', error);
        showToast('Error signing in with Google', 'error');
    }
}

// Sign Out
async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Error signing out:', error);
        showToast('Error signing out', 'error');
    } else {
        showToast('Signed out successfully', 'success');
        window.location.href = '/index.html';
    }
}

// Check authentication status and update UI
async function updateAuthUI() {
    const user = await getCurrentUser();
    const authButtons = document.getElementById('authButtons');
    const userMenu = document.getElementById('userMenu');
    
    if (!authButtons || !userMenu) return;
    
    if (user) {
        // User is signed in
        authButtons.classList.add('hidden');
        userMenu.classList.remove('hidden');
        
        // Get user profile
        const profile = await getUserProfile(user.id);
        if (profile) {
            const userAvatar = document.getElementById('userAvatar');
            const userName = document.getElementById('userName');
            const userReputation = document.getElementById('userReputation');
            
            if (userAvatar) {
                userAvatar.src = profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name || profile.username)}&background=random`;
            }
            if (userName) userName.textContent = profile.username;
            if (userReputation) userReputation.textContent = profile.reputation || 0;
        }
    } else {
        // User is signed out
        authButtons.classList.remove('hidden');
        userMenu.classList.add('hidden');
    }
}

// Handle OAuth callback
async function handleOAuthCallback() {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
        console.error('Error handling OAuth callback:', error);
        return;
    }
    
    if (session) {
        // Check if profile exists, if not create one
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
        
        if (!profile) {
            // Create profile
            const username = session.user.email.split('@')[0] + '_' + Math.random().toString(36).substr(2, 5);
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: session.user.id,
                    username: username,
                    full_name: session.user.user_metadata.full_name || session.user.email,
                    avatar_url: session.user.user_metadata.avatar_url,
                    bio: ''
                });
            
            if (profileError) {
                console.error('Error creating profile:', profileError);
            }
        }
    }
}

// Initialize auth
document.addEventListener('DOMContentLoaded', async () => {
    await handleOAuthCallback();
    await updateAuthUI();
    
    // Listen for auth changes
    supabase.auth.onAuthStateChange((event, session) => {
        updateAuthUI();
    });
});

// Check if user is authenticated before allowing actions
async function requireAuth() {
    const user = await getCurrentUser();
    if (!user) {
        showToast('Please sign in to continue', 'error');
        return false;
    }
    return true;
}
