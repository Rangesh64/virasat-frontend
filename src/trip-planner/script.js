const api = window.VirasatAPI;
const $ = id => document.getElementById(id);
const form = $("tripForm");
const errorBox = $("planError");
const progress = $("planProgress");
const generateButton = $("generatePlanBtn");
const pdfButton = $("downloadPdfBtn");
const signInLink = $("planSignInBtn");
const savedKey = "virasat_last_plan_id";
let currentPlan = null;
let busy = false;

function node(tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value !== undefined && value !== null) element.textContent = String(value);
    return element;
}

function safeUrl(value) {
    if (typeof value !== "string") return null;
    try {
        const result = new URL(value);
        if (result.protocol === "https:" || result.protocol === "http:") return result.href;
    } catch {}
    return null;
}

function money(value, currency = "INR") {
    try {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency,
            maximumFractionDigits: 0
        }).format(Number(value) || 0);
    } catch {
        return currency + " " + (Number(value) || 0).toLocaleString("en-IN");
    }
}

function setError(message, status) {
    errorBox.textContent = message;
    errorBox.hidden = false;
    signInLink.hidden = status !== 401;
}

function clearError() {
    errorBox.hidden = true;
    signInLink.hidden = true;
}

function setBusy(active, message) {
    busy = active;
    generateButton.disabled = active;
    pdfButton.disabled = active;
    $("openRecentPlanBtn").disabled = active;
    progress.hidden = !active;
    form.setAttribute("aria-busy", String(active));
    if (message) progress.querySelector("strong").textContent = message;
}

function errorMessage(error, fallback) {
    if (error.status === 401) return "Please sign in to make or open a private trip plan.";
    if (error.status === 404) return "This plan isn't available for your account, or the travel API hasn't been deployed yet.";
    if (error.status === 502 || error.status === 503 || error.status === 504) return "Trip planning isn't available right now. The AI service may still be starting up. Please try again later.";
    return error.message || fallback;
}

function planInput() {
    const destination = $("destination").value.trim();
    const days = Number($("days").value);
    const travelers = Number($("travelers").value);
    const budgetText = $("budget").value.trim();
    const city = $("city").value.trim();
    const area = $("area").value.trim();
    const interests = $("interests").value.split(",").map(value => value.trim()).filter(Boolean);
    const latitudeText = $("latitude").value.trim();
    const longitudeText = $("longitude").value.trim();

    if (!destination || destination.length > 120) throw new Error("Add a destination of up to 120 characters.");
    if (!Number.isInteger(days) || days < 1 || days > 7) throw new Error("Choose between 1 and 7 days.");
    if (!Number.isInteger(travelers) || travelers < 1 || travelers > 20) throw new Error("Choose between 1 and 20 travelers.");
    if (city.length > 120 || area.length > 120) throw new Error("City and area names must be under 120 characters.");
    if (interests.length > 8 || interests.some(value => value.length > 80)) throw new Error("Add up to 8 interests, each under 80 characters.");
    if (budgetText && (!/^\d+$/.test(budgetText) || Number(budgetText) > 100000000)) throw new Error("Enter a total budget between ₹0 and ₹100,000,000.");
    if (Boolean(latitudeText) !== Boolean(longitudeText)) throw new Error("Enter both coordinates, or leave both blank.");

    const request = { destination, days, travelers, currency: "INR", interests };
    if (city) request.city = city;
    if (area) request.area = area;
    if (budgetText) request.budget = Number(budgetText);
    if (latitudeText && longitudeText) {
        const latitude = Number(latitudeText);
        const longitude = Number(longitudeText);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            throw new Error("Check the coordinates. Latitude must be −90 to 90 and longitude −180 to 180.");
        }
        request.location = { latitude, longitude };
    }
    return request;
}

function addLine(parent, className, text) {
    const item = node("p", className, text);
    parent.appendChild(item);
    return item;
}

function renderBudget(plan) {
    const holder = $("planBudget");
    holder.replaceChildren();
    const request = plan.request || {};
    const total = node("div", "budget-total");
    total.append(node("span", "kicker", "ESTIMATED TRIP COST"), node("strong", "", money(plan.estimated_total, request.currency)));
    holder.appendChild(total);
    const trip = node("div", "budget-stat");
    trip.append(node("span", "kicker", "TRIP LENGTH"), node("strong", "", (request.days || plan.days.length) + " days · " + (request.travelers || 1) + " travelers"));
    holder.appendChild(trip);
    const state = node("div", "budget-stat");
    const budget = request.budget;
    state.appendChild(node("span", "kicker", "YOUR BUDGET"));
    if (budget === null || budget === undefined) {
        state.appendChild(node("strong", "", "Not set"));
    } else {
        state.appendChild(node("strong", "", money(budget, request.currency)));
        const label = plan.budget_status === "over_budget" ? "Over budget" : plan.budget_status === "within_budget" ? "Within budget" : "Budget not checked";
        const pill = node("span", "budget-status " + (plan.budget_status === "over_budget" ? "is-over" : "is-under"), label);
        state.appendChild(pill);
    }
    holder.appendChild(state);
}

function renderDays(plan) {
    const container = $("planDays");
    container.replaceChildren();
    const sourceMap = new Map((plan.sources || []).map(source => [source.id, source]));
    const currency = plan.request?.currency || "INR";
    (plan.days || []).forEach(day => {
        const section = node("section", "day-section");
        const header = node("div", "day-head");
        const count = node("div", "day-count", "DAY " + String(day.day).padStart(2, "0"));
        const title = node("h3", "", day.title);
        header.append(count, title);
        section.appendChild(header);
        const stops = node("div", "day-stops");
        (day.stops || []).forEach((stop, index) => {
            const card = node("article", "stop-card");
            const top = node("div", "stop-top");
            top.append(node("span", "kicker", (stop.time_of_day || "").toUpperCase()), node("span", "mono stop-number", String(index + 1).padStart(2, "0")));
            card.appendChild(top);
            const name = node("h4", "", stop.place_name);
            card.appendChild(name);
            if (stop.area) addLine(card, "stop-area", stop.area);
            addLine(card, "stop-description", stop.description);
            const bottom = node("div", "stop-bottom");
            bottom.append(node("span", "", (stop.duration_minutes || 0) + " min"), node("strong", "", money(stop.estimated_cost, currency)));
            card.appendChild(bottom);
            const refs = Array.isArray(stop.evidence_ids) ? stop.evidence_ids : [];
            if (refs.length) {
                const citations = node("div", "stop-citations");
                refs.forEach(id => {
                    const ref = sourceMap.get(id);
                    citations.appendChild(node("span", "", ref ? ref.title : id));
                });
                card.appendChild(citations);
            }
            stops.appendChild(card);
        });
        section.appendChild(stops);
        const costs = node("div", "day-costs");
        costs.append(
            node("span", "", "Travel " + money(day.transport_cost, currency)),
            node("span", "", "Stay " + money(day.accommodation_cost, currency)),
            node("strong", "", "Day total " + money(day.estimated_total, currency))
        );
        section.appendChild(costs);
        container.appendChild(section);
    });
}

function renderNotes(targetId, values) {
    const box = $(targetId);
    const label = box.querySelector(".kicker");
    box.replaceChildren(label);
    box.hidden = !Array.isArray(values) || values.length === 0;
    if (box.hidden) return;
    const list = node("ul", "notes-list");
    values.forEach(value => list.appendChild(node("li", "", value)));
    box.appendChild(list);
}

function renderSources(sources) {
    const box = $("planSources");
    const list = $("planSourcesList");
    list.replaceChildren();
    box.hidden = !Array.isArray(sources) || !sources.length;
    if (box.hidden) return;
    sources.forEach(source => {
        const card = node("div", "source-card");
        card.appendChild(node("span", "mono source-id", source.id));
        card.appendChild(node("strong", "", source.title));
        if (source.text) addLine(card, "", source.text);
        const url = safeUrl(source.url);
        if (url) {
            const link = node("a", "", "View source ↗");
            link.href = url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            card.appendChild(link);
        }
        list.appendChild(card);
    });
}

function renderPlan(plan, scroll = true) {
    if (!plan || !Array.isArray(plan.days) || !plan.plan_id) throw new Error("This saved plan could not be displayed.");
    currentPlan = plan;
    $("planResults").hidden = false;
    $("planTitle").textContent = plan.title || "Your trip, your way";
    $("planSummary").textContent = plan.summary || "";
    const date = new Date(plan.created_at);
    $("planCreated").textContent = Number.isNaN(date.getTime()) ? "SAVED PLAN" : "CREATED " + date.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
    renderBudget(plan);
    renderDays(plan);
    renderNotes("planTips", plan.tips);
    renderNotes("planWarnings", plan.warnings);
    renderSources(plan.sources);
    window.localStorage.setItem(savedKey, plan.plan_id);
    $("recentPlanPanel").hidden = false;
    const url = new URL(window.location.href);
    url.searchParams.set("plan", plan.plan_id);
    window.history.replaceState({}, "", url.pathname + url.search);
    if (scroll) $("planResults").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function openPlan(id, scroll = true) {
    if (busy || !id) return;
    setBusy(true, "Opening your saved trip…");
    clearError();
    try {
        const plan = await api.getPlan(id);
        renderPlan(plan, scroll);
    } catch (error) {
        if (error.status === 404 && window.localStorage.getItem(savedKey) === id) {
            window.localStorage.removeItem(savedKey);
            $("recentPlanPanel").hidden = true;
        }
        setError(errorMessage(error, "We couldn't open this plan."), error.status);
    } finally {
        setBusy(false);
    }
}

form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    clearError();
    let input;
    try {
        input = planInput();
    } catch (error) {
        setError(error.message);
        return;
    }
    setBusy(true, "Finding places and putting your days together…");
    try {
        const plan = await api.createPlan(input);
        renderPlan(plan);
    } catch (error) {
        setError(errorMessage(error, "We couldn't make your itinerary."), error.status);
    } finally {
        setBusy(false);
    }
});

pdfButton.addEventListener("click", async () => {
    if (busy || !currentPlan) return;
    setBusy(true, "Preparing the PDF from your saved itinerary…");
    clearError();
    try {
        const blob = await api.pdf(currentPlan.plan_id);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "virasat-trip-" + currentPlan.plan_id + ".pdf";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
        setError(errorMessage(error, "We couldn't download your itinerary."), error.status);
    } finally {
        setBusy(false);
    }
});

$("openRecentPlanBtn").addEventListener("click", () => openPlan(window.localStorage.getItem(savedKey)));
const previousId = window.localStorage.getItem(savedKey);
$("recentPlanPanel").hidden = !previousId;
const directId = new URLSearchParams(window.location.search).get("plan");
if (directId && /^[0-9a-f-]{36}$/i.test(directId)) openPlan(directId, false);
