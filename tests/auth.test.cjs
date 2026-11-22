const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.join(__dirname, "..");

function harness(handler) {
    const calls = [];
    const storage = new Map();
    const window = {
        VIRASAT_API_BASE_URL: "http://127.0.0.1:8000/",
        localStorage: {
            getItem(key) { return storage.get(key) || null; },
            setItem(key, value) { storage.set(key, value); },
            removeItem(key) { storage.delete(key); }
        },
        location: { assign(url) { calls.push(url); } }
    };
    const fetch = async (url, options) => {
        calls.push({ url, options });
        return handler(url, options);
    };
    vm.runInNewContext(fs.readFileSync(path.join(root, "src/auth.js"), "utf8"), {
        window, fetch, URLSearchParams, JSON
    });
    return { auth: window.VirasatAuth, calls, storage };
}

const ok = data => ({ ok: true, status: 200, json: async () => data });
const fail = status => ({ ok: false, status, json: async () => ({}) });

test("legacy Google sign-in remains available to existing users", async () => {
    const { auth, calls } = harness(() => ok({ configured: true }));
    await auth.signIn();
    assert.equal(calls[0].url, "http://127.0.0.1:8000/auth/google/status");
    assert.equal(calls[1], "http://127.0.0.1:8000/auth/google/login");
});

test("unified Google sign-in uses continue without a travel capability gate", async () => {
    const { auth, calls } = harness(() => ok({ configured: true }));
    await auth.continueGoogle();
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, "http://127.0.0.1:8000/auth/google/status");
    assert.equal(calls[1], "http://127.0.0.1:8000/auth/google/continue");
});

test("unified Google sign-in preserves backend setup failure without redirect", async () => {
    const { auth, calls } = harness(() => ok({ configured: false, message: "Google is not configured." }));
    await assert.rejects(auth.continueGoogle(), /not configured/);
    assert.equal(calls.length, 1);
});

test("auth requests send credentials and bypass browser caches", async () => {
    const { auth, calls } = harness(() => ok({ name: "Traveler" }));
    assert.equal((await auth.currentUser()).name, "Traveler");
    await auth.logout();
    assert.equal(calls[0].options.credentials, "include");
    assert.equal(calls[0].options.cache, "no-store");
    assert.equal(calls[1].options.method, "POST");
    assert.equal(calls[1].options.credentials, "include");
});

test("password sign-in stores bearer token and sends form fields", async () => {
    const { auth, calls, storage } = harness(() => ok({ access_token: "token", token_type: "bearer" }));
    await auth.login("traveler", "password123");
    assert.equal(storage.get("virasat_token"), "token");
    assert.match(calls[0].options.body, /username=traveler/);
    assert.match(calls[0].options.body, /password=password123/);
    assert.equal(calls[0].options.headers["Content-Type"], "application/x-www-form-urlencoded");
});

test("profile updates require authenticated request and send only supplied fields", async () => {
    const { auth, calls, storage } = harness(() => ok({ full_name: "Traveler", onboarding_completed: true }));
    storage.set("virasat_token", "token");
    const result = await auth.updateProfile({ full_name: "Traveler", gender: "prefer_not_to_say" });
    assert.equal(result.onboarding_completed, true);
    assert.equal(calls[0].options.method, "PUT");
    assert.equal(calls[0].options.headers.Authorization, "Bearer token");
    assert.equal(JSON.parse(calls[0].options.body).gender, "prefer_not_to_say");
});

test("expired sessions return guest state", async () => {
    const { auth } = harness(() => fail(401));
    assert.equal(await auth.currentUser(), null);
});

test("network and service failures provide usable messages", async () => {
    const { auth } = harness(() => fail(503));
    await assert.rejects(auth.currentUser(), /could not reach/);
});

test("Google login will not redirect when setup is missing", async () => {
    const { auth, calls } = harness(() => ok({ configured: false, message: "Google sign-in is not configured." }));
    await assert.rejects(auth.signIn(), /not configured/);
    assert.equal(calls.length, 1);
});

test("Google network failure explains that backend sign-in is unavailable", async () => {
    const { auth } = harness(() => fail(503));
    await assert.rejects(auth.signIn(), /backend is running/);
});

test("landing page has one Google option and shared account UI", () => {
    const html = fs.readFileSync(path.join(root, "src/landing-page/index.html"), "utf8");
    assert.equal((html.match(/id="googleSignInBtn"/g) || []).length, 1);
    assert.doesNotMatch(html, /id="googleSignupBtn"/);
    assert.match(html, /Continue with Google/);
    assert.ok(html.indexOf("../auth.js") < html.indexOf("../session-ui.js"));
});

test("every primary page loads shared account context", () => {
    for (const folder of ["landing-page", "dashboard", "ai-tour-planner", "ai-tour-guide", "trip-planner"]) {
        const html = fs.readFileSync(path.join(root, "src", folder, "index.html"), "utf8");
        assert.ok(html.includes('src="../session-ui.js"'), folder);
        assert.ok(html.includes('src="../auth.js"'), folder);
    }
});

function dashboard(user) {
    const elements = Object.fromEntries(["welcome", "authStatus", "globalSearchForm", "globalSearchInput", "hubPlaceTitle", "hubPlaceMeta", "hubPhoto", "hubPlaceLink"].map(id => [id, {
        textContent: "", value: "", handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; }
    }]));
    const handlers = {};
    const context = {
        document: {
            getElementById(id) { return elements[id]; },
            addEventListener(event, fn) { handlers[event] = fn; }
        },
        window: {
            VirasatAPI: { monuments: async () => [] },
            VirasatSession: { ready: Promise.resolve(user) }
        }
    };
    vm.runInNewContext(fs.readFileSync(path.join(root, "src/dashboard/script.js"), "utf8"), context);
    return { elements, handlers };
}

test("dashboard welcomes logged-in travelers by their first name", async () => {
    const { elements } = dashboard({ full_name: "Rangesh Mishra" });
    await new Promise(setImmediate);
    assert.match(elements.welcome.textContent, /Rangesh/);
});

test("dashboard has a friendly guest state without suggesting a logout", async () => {
    const { elements } = dashboard(null);
    await new Promise(setImmediate);
    assert.match(elements.authStatus.textContent, /sign in/);
});


test("Google credential setup sends bearer or cookie credentials to its own endpoint", async () => {
    const { auth, calls, storage } = harness(() => ok({ login_username: "heritage.traveler", credentials_set: true }));
    storage.set("virasat_token", "existing-token");
    const result = await auth.setCredentials("heritage.traveler", "securepass123");
    assert.equal(result.credentials_set, true);
    assert.equal(result.login_username, "heritage.traveler");
    assert.equal(calls[0].url, "http://127.0.0.1:8000/auth/credentials");
    assert.equal(calls[0].options.method, "PUT");
    assert.equal(calls[0].options.credentials, "include");
    assert.equal(calls[0].options.headers.Authorization, "Bearer existing-token");
    assert.deepEqual(JSON.parse(calls[0].options.body), { username: "heritage.traveler", password: "securepass123" });
});

test("duplicate username or previously set credentials returns actionable 409", async () => {
    const { auth } = harness(() => ({
        ok: false,
        status: 409,
        json: async () => ({ detail: "Username already taken" })
    }));
    await assert.rejects(auth.setCredentials("taken.username", "securepass123"), error => error.status === 409 && /already taken/.test(error.message));
});

test("account onboarding uses login_username and does not block Google credential setup", () => {
    const script = fs.readFileSync(path.join(root, "src/session-ui.js"), "utf8");
    const setup = fs.readFileSync(path.join(root, "src/credential-setup.js"), "utf8");
    assert.match(script, /user\.login_username/);
    assert.match(script, /account\.google_sub && account\.credentials_set === false/);
    assert.match(setup, /auth\.setCredentials\(username, password\)/);
    assert.match(setup, /\^\[A-Za-z0-9\._-\]\{3,32\}\$/);
    assert.match(setup, /password\.length < 8 \|\| password\.length > 128/);
    assert.match(setup, /failure\.status === 409/);
    for (const folder of ["landing-page", "dashboard", "ai-tour-planner", "ai-tour-guide", "trip-planner"]) {
        const html = fs.readFileSync(path.join(root, "src", folder, "index.html"), "utf8");
        assert.match(html, /src="\.\.\/credential-setup\.js"/, folder);
    }
});
