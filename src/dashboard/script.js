const statusText = document.getElementById('authStatus');
const welcome = document.getElementById('welcome');
const logoutBtn = document.getElementById('logoutBtn');
const signInBtn = document.getElementById('googleSignInBtn');
const retryBtn = document.getElementById('retryBtn');
const authError = new URLSearchParams(window.location.search).get('auth_error');
const authMessages = {
    cancelled: 'Google sign-in was cancelled. You can try again whenever you are ready.',
    invalid: 'Your Google sign-in expired or could not be verified. Please start again.',
    unavailable: 'Google sign-in is temporarily unavailable. Please try again.',
    unverified: 'Please use a Google account with a verified email address.',
    conflict: 'This Google account conflicts with an existing account. Please contact support.',
};

async function loadAccount() {
    retryBtn.hidden = true;
    statusText.textContent = 'Checking your account…';
    try {
        const user = await window.VirasatAuth.currentUser();
        logoutBtn.hidden = !user;
        signInBtn.hidden = Boolean(user);
        welcome.textContent = user ? `Namaste, ${user.name || 'Traveler'}` : 'Welcome to Virasat';
        statusText.textContent = user
            ? `You are signed in${user.email ? ' as ' + user.email : ''}. Your next adventure awaits.`
            : (authMessages[authError] || 'Explore as a guest, or sign in with Google to access your account.');
    } catch (error) {
        statusText.textContent = 'Unable to connect. Check that the backend is running, then try again.';
        retryBtn.hidden = false;
    }
}
signInBtn.addEventListener('click', async () => {
    signInBtn.disabled = true;
    try {
        await window.VirasatAuth.signIn();
    } catch (error) {
        statusText.textContent = error.message;
        signInBtn.disabled = false;
    }
});
retryBtn.addEventListener('click', loadAccount);
logoutBtn.addEventListener('click', async () => {
    logoutBtn.disabled = true;
    try {
        await window.VirasatAuth.logout();
        window.location.assign('../landing-page/index.html');
    } catch (error) {
        statusText.textContent = 'Sign out failed. Please try again.';
        logoutBtn.disabled = false;
    }
});
loadAccount();
