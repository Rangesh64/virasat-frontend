const api = window.VirasatAPI;
const $ = id => document.getElementById(id);
const monumentId = new URLSearchParams(window.location.search).get("id");
const storyButton = $("generateStoryBtn");
const audioButton = $("generateAudioBtn");
const authButton = $("authPromptBtn");
const startButton = $("startTourBtn");
const askButton = $("askQuestionBtn");
const questionForm = $("questionForm");
const questionInput = $("questionText");
const questionHistory = $("questionHistory");
const questionError = $("questionError");
const questionProgress = $("questionProgress");
const audioError = $("audioError");
const audioPlayer = $("nativeAudioPlayer");
const sessionKey = "virasat_tour_session_" + monumentId;
let audioUrl = null;
let tourSession = null;
let busy = false;
let asking = false;

function element(tag, className, value) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (value !== undefined && value !== null) item.textContent = String(value);
    return item;
}

function safeUrl(value) {
    if (typeof value !== "string") return null;
    try {
        const url = new URL(value);
        if (url.protocol === "https:" || url.protocol === "http:") return url.href;
    } catch {}
    return null;
}

function setStatus(message, ready = false) {
    $("statusText").textContent = message;
    $("statusDot").classList.toggle("is-ready", ready);
}

function requireAuth() {
    authButton.hidden = false;
    setStatus("Sign in needed");
}

function showError(error, area = audioError) {
    const status = error?.status || 0;
    area.hidden = false;
    if (status === 401) {
        area.textContent = "Please sign in to create a tour or ask questions.";
        requireAuth();
    } else if (status === 404 && area === questionError) {
        area.textContent = "Tour questions aren't available from this server yet. Check that the updated backend is deployed.";
    } else if (status === 502 || status === 503 || status === 504) {
        area.textContent = "The AI service is unavailable right now. Please try again later.";
    } else {
        area.textContent = error?.message || "Something went wrong. Please try again.";
    }
    if (status !== 401) setStatus("Please try again");
}

function setLoader(active, label) {
    busy = active;
    $("loadingOverlay").hidden = !active;
    if (label) $("loadingText").textContent = label;
    storyButton.disabled = active || !monumentId;
    audioButton.disabled = active || !monumentId;
    startButton.disabled = active || !monumentId;
}

function setQuestionBusy(active, label) {
    asking = active;
    questionProgress.hidden = !active;
    if (label) $("questionProgressText").textContent = label;
    askButton.disabled = active;
    questionInput.disabled = active;
    startButton.disabled = active;
}

function renderParagraphs(target, text) {
    target.replaceChildren();
    String(text || "").split(/\n\s*\n|\n/).filter(Boolean).forEach(line => {
        target.appendChild(element("p", "", line));
    });
    if (!target.childNodes.length) target.textContent = "No story text was returned.";
}

function renderStory(data) {
    $("emptyState").hidden = true;
    $("storyContainer").hidden = false;
    renderParagraphs($("storyContent"), data.story);
    const sources = $("sourcesList");
    if (Array.isArray(data.sources)) {
        sources.replaceChildren();
        data.sources.forEach(source => {
            const item = element("li");
            const label = typeof source === "string" ? source : source?.title || source?.text || "Research source";
            item.textContent = label;
            const url = safeUrl(source?.url);
            if (url) {
                const link = element("a", "", " · Open source ↗");
                link.href = url;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                item.appendChild(link);
            }
            sources.appendChild(item);
        });
    }
    if (!sources.childNodes.length) sources.appendChild(element("li", "", "Sources will appear with supporting answers when available."));
    $("researchStatus").textContent = data.research_status || "See sources for details";
    setStatus("Story ready", true);
}

async function generateStory() {
    if (busy || !monumentId) return false;
    audioError.hidden = true;
    setLoader(true, "Finding the story behind this place…");
    try {
        const data = await api.story(monumentId);
        renderStory(data);
        return true;
    } catch (error) {
        showError(error);
        return false;
    } finally {
        setLoader(false);
    }
}

async function generateAudio() {
    if (busy || !monumentId) return;
    audioError.hidden = true;
    setLoader(true, "Preparing your audio guide…");
    try {
        let response;
        try {
            response = await api.audio(monumentId);
        } catch (error) {
            if (error.status !== 404) throw error;
            setLoader(true, "Preparing the story before audio…");
            const story = await api.story(monumentId);
            renderStory(story);
            setLoader(true, "Turning your story into audio…");
            response = await api.audio(monumentId);
        }
        const type = response.headers.get("content-type") || "";
        if (!type.includes("audio/") && !type.includes("octet-stream")) throw new Error("The audio service didn't return an MP3.");
        const blob = await response.blob();
        if (!blob.size) throw new Error("The audio file was empty.");
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        audioUrl = URL.createObjectURL(blob);
        audioPlayer.src = audioUrl;
        $("downloadAudioBtn").href = audioUrl;
        $("audioPlayerContainer").hidden = false;
        $("emptyState").hidden = true;
        setStatus("Audio ready", true);
        audioPlayer.play().catch(() => {});
    } catch (error) {
        showError(error);
    } finally {
        setLoader(false);
    }
}

function evidenceList(holder, evidence) {
    if (!Array.isArray(evidence) || !evidence.length) return;
    const panel = element("div", "answer-evidence");
    panel.appendChild(element("div", "kicker", "PASSAGES USED"));
    evidence.forEach(source => {
        const item = element("div", "evidence-item");
        item.appendChild(element("strong", "", source.title || "Reference"));
        if (source.text) item.appendChild(element("p", "", source.text));
        const url = safeUrl(source.url);
        if (url) {
            const anchor = element("a", "", "Read source ↗");
            anchor.href = url;
            anchor.target = "_blank";
            anchor.rel = "noopener noreferrer";
            item.appendChild(anchor);
        }
        panel.appendChild(item);
    });
    holder.appendChild(panel);
}

function renderHistory(history) {
    questionHistory.replaceChildren();
    const items = Array.isArray(history) ? history.slice(-3) : [];
    if (!items.length) {
        questionHistory.appendChild(element("p", "question-welcome", "No questions yet. Ask whatever comes to mind about this place."));
        return;
    }
    items.forEach(answer => {
        const exchange = element("article", "question-exchange");
        exchange.appendChild(element("div", "question-you", answer.question));
        const response = element("div", "question-answer");
        response.appendChild(element("div", "kicker", answer.supported === false ? "NOT ENOUGH INFORMATION" : "FROM YOUR GUIDE"));
        response.appendChild(element("p", "", answer.answer || "No answer returned."));
        if (answer.supported !== false) evidenceList(response, answer.evidence);
        exchange.appendChild(response);
        questionHistory.appendChild(exchange);
    });
}

function renderSession(session) {
    if (!session || !session.session_id) throw new Error("This tour couldn't be opened.");
    tourSession = session;
    localStorage.setItem(sessionKey, session.session_id);
    if (session.story) renderStory({ story: session.story });
    startButton.hidden = true;
    $("questionArea").hidden = false;
    renderHistory(session.history);
    questionInput.focus();
}

async function startSession() {
    if (busy || asking || !monumentId) return;
    questionError.hidden = true;
    setQuestionBusy(true, "Opening your tour questions…");
    try {
        const savedId = localStorage.getItem(sessionKey);
        let session;
        if (savedId) {
            try {
                session = await api.getSession(savedId);
            } catch (error) {
                if (error.status !== 404) throw error;
                localStorage.removeItem(sessionKey);
            }
        }
        if (!session) {
            $("questionProgressText").textContent = "Setting up the story and references…";
            session = await api.createSession(Number(monumentId));
        }
        renderSession(session);
    } catch (error) {
        showError(error, questionError);
    } finally {
        setQuestionBusy(false);
    }
}

async function askQuestion(event) {
    event.preventDefault();
    const question = questionInput.value.trim();
    if (!question || question.length > 1200 || asking || !tourSession) return;
    questionError.hidden = true;
    const requestId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : undefined;
    setQuestionBusy(true, "Looking for an answer in the available history…");
    try {
        let answer;
        try {
            answer = await api.askQuestion(tourSession.session_id, question, requestId);
        } catch (error) {
            if (error.status !== 409) throw error;
            const refreshed = await api.getSession(tourSession.session_id);
            tourSession.history = refreshed.history;
            answer = await api.askQuestion(tourSession.session_id, question, requestId);
        }
        tourSession.history = [...(tourSession.history || []), answer].slice(-3);
        questionInput.value = "";
        renderHistory(tourSession.history);
        questionHistory.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (error) {
        showError(error, questionError);
    } finally {
        setQuestionBusy(false);
    }
}

async function loadMonument() {
    if (!monumentId || !/^[1-9]\d*$/.test(monumentId)) {
        setStatus("Choose a monument to begin");
        setLoader(false);
        return;
    }
    $("displayId").textContent = "PLACE " + monumentId;
    setLoader(false);
    try {
        const place = await api.monument(monumentId);
        $("monumentTitle").textContent = place.name || "Your audio guide";
        $("monumentIntro").textContent = [place.city, place.location_tag].filter(Boolean).join(" · ") || "Take a closer look at this place.";
        const photo = safeUrl(place.cover_image);
        if (photo) $("monumentPhoto").src = photo;
        $("monumentPhoto").alt = place.name || "Monument";
        $("audioPhotoLabel").textContent = String(place.city || "INDIA").toUpperCase();
    } catch (error) {
        if (error.status === 404) showError(error);
    }
    if (localStorage.getItem(sessionKey)) startButton.textContent = "Continue your questions ↗";
}

storyButton.addEventListener("click", generateStory);
audioButton.addEventListener("click", generateAudio);
startButton.addEventListener("click", startSession);
questionForm.addEventListener("submit", askQuestion);
authButton.addEventListener("click", () => {
    window.location.assign("../landing-page/index.html?auth=1");
});
window.addEventListener("beforeunload", () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
});
loadMonument();
