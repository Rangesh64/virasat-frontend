const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
function harness(fetchResult) {
    const calls = [];
    const window = { VIRASAT_API_BASE_URL: 'http://127.0.0.1:8000/', location: { assign: url => calls.push(url) } };
    const fetch = async (...args) => { calls.push(args); return fetchResult; };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'src/auth.js'), 'utf8'), {window, fetch});
    return {auth: window.VirasatAuth, calls};
}
test('Google sign-in checks readiness then navigates to backend', async () => {
    const {auth, calls} = harness({ok: true, status: 200, json: async () => ({configured: true})});
    await auth.signIn();
    assert.equal(calls[0][0], 'http://127.0.0.1:8000/auth/google/status');
    assert.equal(calls[1], 'http://127.0.0.1:8000/auth/google/login');
});
test('profile and logout send cookies and bypass caches', async () => {
    const {auth, calls} = harness({ok: true, status: 200, json: async () => ({name: 'Alice'})});
    assert.equal((await auth.currentUser()).name, 'Alice');
    await auth.logout();
    assert.equal(calls[0][0], 'http://127.0.0.1:8000/auth/me');
    assert.equal(calls[0][1].credentials, 'include');
    assert.equal(calls[0][1].cache, 'no-store');
    assert.equal(calls[1][0], 'http://127.0.0.1:8000/auth/logout');
    assert.equal(calls[1][1].method, 'POST');
    assert.equal(calls[1][1].credentials, 'include');
});
test('expired sessions become signed-out state', async () => {
    const {auth} = harness({ok: false, status: 401});
    assert.equal(await auth.currentUser(), null);
});
test('server failures are reported', async () => {
    const {auth} = harness({ok: false, status: 503});
    await assert.rejects(auth.currentUser(), /could not reach/);
});
test('landing page loads shared auth before attaching button handler', () => {
    const html = fs.readFileSync(path.join(root, 'src/landing-page/index.html'), 'utf8');
    assert.match(html, /id="googleSignInBtn"/);
    assert.ok(html.indexOf('../config.js') < html.indexOf('../auth.js'));
    assert.ok(html.indexOf('../auth.js') < html.indexOf('src="script.js"'));
});
function dashboardHarness(user, options = {}) {
    const elements = Object.fromEntries(['authStatus', 'welcome', 'logoutBtn', 'googleSignInBtn', 'retryBtn'].map(id => [id, {
        hidden: true, disabled: false, textContent: '', handlers: {},
        addEventListener(type, handler) {this.handlers[type] = handler;},
    }]));
    const calls = [];
    const window = {location: {search: options.search || '', assign: url => calls.push(url)}, VirasatAuth: {
        currentUser: async () => {if(options.offline) throw Error('offline'); return user;},
        logout: async () => {if(options.logoutFails) throw Error('offline'); calls.push('logout');},
        signIn: async () => {if(options.signInFails) throw Error('Google sign-in is not configured yet.'); calls.push('signIn');},
    }};
    vm.runInNewContext(fs.readFileSync(path.join(root, 'src/dashboard/script.js'), 'utf8'), {
        window, URLSearchParams, document: {getElementById: id => elements[id]},
    });
    return {elements, calls};
}
test('dashboard displays signed-in profile and logs out', async () => {
    const {elements, calls} = dashboardHarness({name: 'Alice', email: 'alice@example.com'});
    await new Promise(setImmediate);
    assert.equal(elements.welcome.textContent, 'Namaste, Alice');
    assert.equal(elements.logoutBtn.hidden, false);
    assert.equal(elements.googleSignInBtn.hidden, true);
    await elements.logoutBtn.handlers.click();
    assert.deepEqual(calls, ['logout', '../landing-page/index.html']);
});
test('dashboard supports guests and sign-in', async () => {
    const {elements, calls} = dashboardHarness(null);
    await new Promise(setImmediate);
    assert.equal(elements.logoutBtn.hidden, true);
    assert.equal(elements.googleSignInBtn.hidden, false);
    elements.googleSignInBtn.handlers.click();
    assert.deepEqual(calls, ['signIn']);
});
test('dashboard shows retry for connection failure', async () => {
    const {elements} = dashboardHarness(null, {offline: true});
    await new Promise(setImmediate);
    assert.equal(elements.retryBtn.hidden, false);
    assert.match(elements.authStatus.textContent, /backend is running/);
});
test('dashboard preserves page when logout fails', async () => {
    const {elements, calls} = dashboardHarness({name: 'Alice'}, {logoutFails: true});
    await new Promise(setImmediate);
    await elements.logoutBtn.handlers.click();
    assert.equal(elements.logoutBtn.disabled, false);
    assert.match(elements.authStatus.textContent, /Sign out failed/);
    assert.deepEqual(calls, []);
});

test('missing Google credentials keep the user on the frontend', async () => {
    const {auth, calls} = harness({ok: true, status: 200, json: async () => ({configured: false, message: 'Google sign-in is not configured.'})});
    await assert.rejects(auth.signIn(), /not configured/);
    assert.equal(calls.length, 1);
});
test('sign-in network failure is actionable', async () => {
    const {auth} = harness({ok: false, status: 503});
    await assert.rejects(auth.signIn(), /backend is running/);
});
test('cancelled sign-in displays a retry message', async () => {
    const {elements} = dashboardHarness(null, {search: '?auth_error=cancelled'});
    await new Promise(setImmediate);
    assert.match(elements.authStatus.textContent, /cancelled/);
    assert.equal(elements.googleSignInBtn.hidden, false);
});
test('dashboard restores sign-in button after setup error', async () => {
    const {elements} = dashboardHarness(null, {signInFails: true});
    await new Promise(setImmediate);
    await elements.googleSignInBtn.handlers.click();
    assert.equal(elements.googleSignInBtn.disabled, false);
    assert.match(elements.authStatus.textContent, /not configured/);
});
