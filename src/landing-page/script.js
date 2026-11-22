const authModal = document.getElementById("authModal");
const openAuthBtn = document.getElementById("openAuthBtn");
const closeAuthBtn = document.getElementById("closeAuthBtn");
const backdrop = document.getElementById("authBackdrop");
const googleBtn = document.getElementById("googleSignInBtn");
const authError = document.getElementById("googleAuthError");
const emailForm = document.getElementById("emailAuthForm");
const emailButton = document.getElementById("emailAuthBtn");
const loginTab = document.getElementById("emailLoginTab");
const signupTab = document.getElementById("emailSignupTab");
const usernameInput = document.getElementById("authUsername");
const passwordInput = document.getElementById("authPassword");
let signupMode = false;

function toggleAuth(open) {
    authModal.classList.toggle("is-open", open);
    authModal.setAttribute("aria-hidden", String(!open));
    document.body.style.overflow = open ? "hidden" : "";
    if (open) closeAuthBtn.focus();
    else openAuthBtn.focus();
}

function setAuthError(message) {
    authError.textContent = message || "";
    authError.hidden = !message;
}

function authMode(signup) {
    signupMode = signup;
    loginTab.classList.toggle("is-active", !signup);
    signupTab.classList.toggle("is-active", signup);
    loginTab.setAttribute("aria-pressed", String(!signup));
    signupTab.setAttribute("aria-pressed", String(signup));
    emailButton.textContent = signup ? "Create account ↗" : "Sign in ↗";
    passwordInput.autocomplete = signup ? "new-password" : "current-password";
    document.getElementById("passwordHint").hidden = !signup;
    setAuthError("");
}

async function startGoogle() {
    setAuthError("");
    googleBtn.disabled = true;
    googleBtn.textContent = "Opening Google…";
    try {
        await window.VirasatAuth.continueGoogle();
    } catch (error) {
        setAuthError(error.message);
        googleBtn.disabled = false;
        googleBtn.textContent = "Continue with Google ↗";
    }
}

emailForm.addEventListener("submit", async event => {
    event.preventDefault();
    setAuthError("");
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (!username || /\s/.test(username)) {
        setAuthError("Use a username without spaces.");
        return;
    }
    if (signupMode && password.length < 8) {
        setAuthError("Choose a password of at least 8 characters.");
        return;
    }
    emailButton.disabled = true;
    emailButton.textContent = signupMode ? "Creating your account…" : "Signing in…";
    try {
        if (signupMode) await window.VirasatAuth.register(username, password);
        await window.VirasatAuth.login(username, password);
        window.location.assign("../dashboard/index.html");
    } catch (error) {
        setAuthError(error.message || "We couldn't sign you in. Please try again.");
        emailButton.disabled = false;
        emailButton.textContent = signupMode ? "Create account ↗" : "Sign in ↗";
    }
});

openAuthBtn.addEventListener("click", () => toggleAuth(true));
closeAuthBtn.addEventListener("click", () => toggleAuth(false));
backdrop.addEventListener("click", () => toggleAuth(false));
document.getElementById("browseGuestBtn").addEventListener("click", () => toggleAuth(false));
loginTab.addEventListener("click", () => authMode(false));
signupTab.addEventListener("click", () => authMode(true));
googleBtn.addEventListener("click", startGoogle);
window.addEventListener("keydown", event => {
    if (event.key === "Escape" && authModal.classList.contains("is-open")) toggleAuth(false);
});
const query = new URLSearchParams(window.location.search);
if (query.has("auth_error") || query.has("auth")) toggleAuth(true);
if (query.get("auth_error") === "invalid") setAuthError("Your session has expired. Please sign in again.");
window.addEventListener("pageshow", event => {
    if (event.persisted) {
        googleBtn.disabled = false;
        googleBtn.textContent = "Continue with Google ↗";
    }
});

async function loadFeaturedMonument() {
    try {
        const items = await window.VirasatAPI.monuments();
        const place = items.find(item => item && item.name && typeof item.image_url === "string" && item.image_url.startsWith("https://"));
        if (!place) return;
        const hero = document.getElementById("heroImage");
        hero.src = place.image_url;
        hero.alt = place.name;
        document.getElementById("heroPlaceName").textContent = place.name;
        document.getElementById("heroLocation").textContent = [place.city, place.location_tag].filter(Boolean).join(" · ").toUpperCase();
    } catch {}
}
loadFeaturedMonument();
