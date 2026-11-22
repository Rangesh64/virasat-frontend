const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "../src");
const pages = ["landing-page", "dashboard", "ai-tour-planner", "ai-tour-guide", "trip-planner"];

function source(file) {
    return fs.readFileSync(path.join(root, file), "utf8");
}

test("every primary page has the same palette and matching icon system", () => {
    for (const page of pages) {
        const html = source(page + "/index.html");
        assert.ok(html.includes('href="../virasat.css"'), page + " base stylesheet");
        assert.ok(html.includes('href="../virasat-finish.css"'), page + " unified stylesheet");
        assert.ok(html.includes('src="../iconography.js"'), page + " icon system");
        assert.ok(html.includes('content="#edf0e8"'), page + " mobile theme color");
    }
});

test("desktop headlines use readable word spacing and restrained tracking", () => {
    const theme = source("virasat-finish.css");
    assert.match(theme, /letter-spacing:-\.02[5678]em/);
    assert.match(theme, /word-spacing:\.09em/);
    assert.match(theme, /font-kerning:normal/);
    assert.match(theme, /@media\(min-width:731px\)/);
    assert.match(theme, /@media\(max-width:730px\)/);
});

test("the travel section does not contain decorative stamp slogans", () => {
    const html = source("trip-planner/index.html");
    assert.doesNotMatch(html, /GO FURTHER|STAY CURIOUS|journey-intro-stamp/);
    assert.match(html, /Plan the way/);
    assert.match(html, /Your route/);
});

test("all four transport choices use vector icons instead of text placeholders", () => {
    const html = source("trip-planner/index.html");
    for (const mode of ["car", "train", "flight", "bus"]) {
        assert.match(html, new RegExp('name="travel_mode" value="' + mode + '"'));
    }
    const icons = html.match(/<svg viewBox="0 0 24 24" class="mode-svg"/g) || [];
    assert.equal(icons.length, 4);
    const modeMarkup = html.split('class="travel-modes"')[1].split('</div>')[0];
    for (const placeholder of ["▰", "▤", "═"]) assert.ok(!modeMarkup.includes(placeholder), "remove "+placeholder);
});

test("Google sign-in has a real multicolor G and one button", () => {
    const html = source("landing-page/index.html");
    assert.equal((html.match(/id="googleSignInBtn"/g) || []).length, 1);
    assert.ok(html.includes('class="google-g"'));
    assert.ok(html.includes('fill="#EA4335"'));
    assert.ok(html.includes('fill="#4285F4"'));
    assert.ok(html.includes('fill="#FBBC05"'));
    assert.ok(html.includes('fill="#34A853"'));
    assert.ok(html.includes('class="google-button-label"'));
    assert.doesNotMatch(html, /id="googleSignupBtn"/);
});

test("the home, discovery, and audio guide use distinct editorial structures", () => {
    const home = source("landing-page/index.html");
    const discover = source("ai-tour-planner/index.html");
    const audio = source("ai-tour-guide/index.html");
    assert.match(home, /class="hero-landing"/);
    assert.match(discover, /class="monument-list"/);
    assert.match(audio, /class="audio-layout"/);
    assert.doesNotMatch(discover, /Some places<br>stay with you/);
    assert.doesNotMatch(audio, /Listen\. Wander\. Wonder/);
});

test("signed-in navigation hides redundant My space link", () => {
    const session = source("session-ui.js");
    assert.match(session, /memberLink\.hidden = true/);
    assert.match(session, /memberLink\.hidden = false/);
    const landing = source("landing-page/index.html");
    assert.match(landing, /header-link session-profile-link/);
});
