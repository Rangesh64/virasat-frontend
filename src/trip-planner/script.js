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
let capabilities = { transport_search: false, hotel_search: false, extended_planning: false };
let selectedTransportId = null;
let selectedHotelId = null;
let transportBusy = false;
let hotelBusy = false;

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
    const origin = $("origin").value.trim();
    const stops = [...$("routeStops").querySelectorAll("input")].map(input => input.value.trim()).filter(Boolean);
    const departure = $("departureDate").value;
    const returnDate = $("returnDate").value;
    if (origin.length > 120) throw new Error("Keep your starting location under 120 characters.");
    if (stops.length > 6 || stops.some(value => value.length > 120)) throw new Error("Add up to 6 stops, with a short location name for each.");
    if (returnDate && !departure) throw new Error("Add a departure date before choosing your return.");
    if (returnDate && returnDate < departure) throw new Error("Your return date must be on or after departure.");
    if (capabilities.extended_planning === true) {
        if (origin) request.origin = { label: origin };
        if (stops.length) request.stops = stops.map(label => ({ label }));
        if (departure) request.departure_date = departure;
        if (returnDate) request.return_date = returnDate;
        request.travel_mode = document.querySelector('input[name="travel_mode"]:checked').value;
        request.hotel_preferences = {
            star_ratings: selectedStars(),
            rooms: Number($("rooms").value) || 1
        };
        if (selectedTransportId) request.selected_transport_id = selectedTransportId;
        if (selectedHotelId) request.selected_hotel_id = selectedHotelId;
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
    if (!capabilities.extended_planning) $("planCapabilityNote").textContent = "Your itinerary will use the destination, interests, number of days and budget. The new route, date and hotel preferences will be included after the updated backend is connected.";
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



function selectedStars() {
    return [...document.querySelectorAll('input[name="star_rating"]:checked')].map(item => Number(item.value));
}

function routeStops() {
    return [...$("routeStops").querySelectorAll("input")].map(input => input.value.trim()).filter(Boolean);
}

function addStop(value = "") {
    const holder = $("routeStops");
    if (holder.children.length >= 6) return;
    const row = node("div", "route-stop-row");
    const input = node("input", "route-stop-input");
    input.type = "text";
    input.maxLength = 120;
    input.placeholder = "Add a place along the way";
    input.value = value;
    input.setAttribute("aria-label", "Intermediate destination " + (holder.children.length + 1));
    const actions = node("div", "route-stop-actions");
    for (const [label, symbol, delta] of [["Move up", "↑", -1], ["Move down", "↓", 1]]) {
        const button = node("button", "", symbol);
        button.type = "button";
        button.setAttribute("aria-label", label + " stop");
        button.addEventListener("click", () => {
            const position = [...holder.children].indexOf(row);
            const target = holder.children[position + delta];
            if (!target) return;
            if (delta < 0) holder.insertBefore(row, target);
            else holder.insertBefore(target, row);
            updateStops();
            input.focus();
        });
        actions.appendChild(button);
    }
    const remove = node("button", "stop-remove", "×");
    remove.type = "button";
    remove.setAttribute("aria-label", "Remove this stop");
    remove.addEventListener("click", () => { row.remove(); updateStops(); });
    actions.appendChild(remove);
    row.append(input, actions);
    holder.appendChild(row);
    wireLocationInput(input);
    updateStops();
    input.focus();
}

function updateStops() {
    const children = [...$("routeStops").children];
    children.forEach((row, i) => row.querySelector("input").setAttribute("aria-label", "Intermediate destination " + (i + 1)));
    const button = $("addStopBtn");
    button.disabled = children.length >= 6;
    button.querySelector(".journey-add-note").textContent = children.length + " / 6 added";
}

function routeInput(requireDates) {
    const origin = $("origin").value.trim();
    const destination = $("destination").value.trim();
    const departure = $("departureDate").value;
    const returnDate = $("returnDate").value;
    const travelers = Number($("travelers").value);
    if (!origin || !destination) throw new Error("Add where you're leaving from and where you're going.");
    if (origin.length > 120 || destination.length > 120) throw new Error("Keep each location under 120 characters.");
    if (!Number.isInteger(travelers) || travelers < 1 || travelers > 20) throw new Error("Choose between 1 and 20 travelers.");
    if (requireDates && !departure) throw new Error("Choose a departure date to search for travel options.");
    if (returnDate && !departure) throw new Error("Choose a departure date before adding a return.");
    if (returnDate && returnDate < departure) throw new Error("Your return date cannot be earlier than your departure.");
    return {
        origin: { label: origin },
        destination: { label: destination },
        stops: routeStops().map(label => ({ label })),
        departure_date: departure,
        return_date: returnDate || null,
        travelers,
        modes: $("compareAllModes").checked ? ["car", "train", "flight", "bus"] : [document.querySelector('input[name="travel_mode"]:checked').value],
        currency: "INR"
    };
}

function priceLabel(value) {
    if (!value || value.amount === null || value.amount === undefined) return "Price unavailable";
    return money(value.amount, value.currency || "INR");
}

function fareDetail(value) {
    if (!value || value.amount === null || value.amount === undefined) return "Check with provider";
    return value.type === "live" ? "Provider price at search time" : "Estimated price, not a confirmed fare";
}

function displayDate(value) {
    if (!value) return "Time not listed";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Time not listed" : date.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function offerRow(option, type) {
    const card = node("article", "travel-offer");
    const main = node("div", "travel-offer-main");
    const label = type === "hotel" ? (option.hotel_name || "Hotel option") : (option.service_name || option.mode || "Travel option");
    const origin = type === "hotel" ? option.location : option.provider;
    main.append(node("div", "journey-result-label", type === "hotel" ? (option.star_rating ? option.star_rating + " STAR STAY" : "ACCOMMODATION") : String(option.mode || "TRAVEL").toUpperCase()), node("h4", "", label));
    if (origin) main.appendChild(node("p", "", origin));
    if (type === "transport") {
        const times = [displayDate(option.departure_at), displayDate(option.arrival_at)].filter(Boolean).join(" · ");
        main.appendChild(node("p", "", times));
    }
    const price = type === "hotel" ? option.total_price || option.nightly_price : option.price;
    const aside = node("div", "travel-offer-aside");
    aside.append(node("strong", "", priceLabel(price)), node("span", "", fareDetail(price)));
    const link = safeUrl(option.booking_url);
    if (link) {
        const open = node("a", "travel-offer-link", "See provider ↗");
        open.href = link;
        open.target = "_blank";
        open.rel = "noopener noreferrer";
        aside.appendChild(open);
    }
    if (option.id) {
        const chosen = type === "hotel" ? selectedHotelId === option.id : selectedTransportId === option.id;
        const pick = node("button", "travel-offer-pick" + (chosen ? " is-chosen" : ""), chosen ? "✓ Selected" : "Use in my plan");
        pick.type = "button";
        pick.addEventListener("click", () => {
            if (type === "hotel") selectedHotelId = option.id;
            else selectedTransportId = option.id;
            document.querySelectorAll(type === "hotel" ? '#hotelResultsList .travel-offer-pick' : '#transportResultsList .travel-offer-pick').forEach(button => {
                button.textContent = "Use in my plan";
                button.classList.remove("is-chosen");
            });
            pick.textContent = "✓ Selected";
            pick.classList.add("is-chosen");
        });
        aside.appendChild(pick);
    }
    card.append(main, aside);
    return card;
}

function renderOffers(data, type) {
    const isHotel = type === "hotel";
    const section = $(isHotel ? "hotelResults" : "transportResults");
    const list = $(isHotel ? "hotelResultsList" : "transportResultsList");
    const count = $(isHotel ? "hotelResultCount" : "transportResultCount");
    const warnings = $(isHotel ? "hotelWarnings" : "transportWarnings");
    section.hidden = false;
    list.replaceChildren();
    const offers = Array.isArray(data.results) ? data.results.slice() : [];
    offers.sort((a, b) => {
        const priceA = isHotel ? a.total_price || a.nightly_price : a.price;
        const priceB = isHotel ? b.total_price || b.nightly_price : b.price;
        const get = p => p?.type === "live" && Number.isFinite(Number(p.amount)) ? Number(p.amount) : Infinity;
        return get(priceA) - get(priceB);
    });
    count.textContent = offers.length + (offers.length === 1 ? " OPTION" : " OPTIONS");
    if (!offers.length) list.appendChild(node("p", "journey-no-results", "No confirmed provider offers yet. You can still build an itinerary around your destination."));
    offers.forEach(option => list.appendChild(offerRow(option, type)));
    const notes = Array.isArray(data.warnings) ? data.warnings : [];
    const unavailable = Array.isArray(data.unavailable_modes) ? data.unavailable_modes.map(mode => "No availability for " + mode + ".") : [];
    warnings.textContent = [...notes, ...unavailable].join(" ");
}

async function loadCapabilities() {
    try {
        capabilities = await api.capabilities();
        const note = $("transportStatus");
        note.textContent = capabilities.transport_search
            ? "Compare actual provider offers. Prices may change."
            : "Live fares will appear when travel providers are connected.";
        $("planCapabilityNote").textContent = capabilities.extended_planning
            ? "We'll use your route, travel dates and accommodation choices to shape your trip."
            : "Your itinerary works today using destination, days, interests and budget. Detailed transport and hotel planning is being connected.";
    } catch {
        $("transportStatus").textContent = "Can't check travel providers right now. Itinerary planning is still available.";
    }
}

$("addStopBtn").addEventListener("click", () => addStop());
$("swapRouteBtn").addEventListener("click", () => {
    const first = $("origin").value;
    $("origin").value = $("destination").value;
    $("destination").value = first;
});
$("departureDate").addEventListener("change", () => {
    $("returnDate").min = $("departureDate").value;
    if ($("returnDate").value && $("returnDate").value < $("departureDate").value) $("returnDate").value = "";
    updateStayDates();
});
$("returnDate").addEventListener("change", updateStayDates);

function updateStayDates() {
    const depart = $("departureDate").value;
    const back = $("returnDate").value;
    $("stayDatesLabel").textContent = depart && back ? depart + " to " + back : "Select departure and return";
}

$("transportSearchBtn").addEventListener("click", async () => {
    const area = $("transportError");
    area.hidden = true;
    if (transportBusy || busy) return;
    let request;
    try { request = routeInput(true); } catch (error) { area.textContent = error.message; area.hidden = false; return; }
    if (!capabilities.transport_search) {
        area.textContent = "Live travel comparisons aren't connected to this backend yet. Your route is ready, and you can still build an itinerary below.";
        area.hidden = false;
        return;
    }
    transportBusy = true;
    const button = $("transportSearchBtn");
    button.disabled = true;
    button.textContent = "Finding available journeys…";
    $("transportResults").hidden = true;
    try {
        selectedTransportId = null;
        const response = await api.transportSearch(request);
        renderOffers(response, "transport");
    } catch (error) {
        area.textContent = error.status === 404 ? "The transport search API isn't deployed yet." : error.message;
        area.hidden = false;
    } finally {
        transportBusy = false;
        button.disabled = false;
        button.textContent = "Find travel options ↗";
    }
});

$("hotelSearchBtn").addEventListener("click", async () => {
    const area = $("hotelError");
    area.hidden = true;
    if (hotelBusy || busy) return;
    const destination = $("destination").value.trim();
    const checkIn = $("departureDate").value;
    const checkOut = $("returnDate").value;
    const travelers = Number($("travelers").value);
    const rooms = Number($("rooms").value);
    if (!destination || !checkIn || !checkOut || checkOut <= checkIn) {
        area.textContent = "Add your destination and dates to find stays. The check-out date must be after check-in.";
        area.hidden = false;
        return;
    }
    if (!Number.isInteger(rooms) || rooms < 1 || rooms > 20 || !Number.isInteger(travelers) || travelers < 1 || travelers > 20) {
        area.textContent = "Choose a valid number of rooms and travelers.";
        area.hidden = false;
        return;
    }
    if (!capabilities.hotel_search) {
        area.textContent = "Live hotel comparisons aren't connected yet. Your stay preferences will be ready when the provider API goes live.";
        area.hidden = false;
        return;
    }
    hotelBusy = true;
    const button = $("hotelSearchBtn");
    button.disabled = true;
    button.textContent = "Finding places to stay…";
    $("hotelResults").hidden = true;
    try {
        selectedHotelId = null;
        const response = await api.hotelSearch({
            destination, check_in: checkIn, check_out: checkOut,
            travelers, rooms, star_ratings: selectedStars(), currency: "INR"
        });
        renderOffers(response, "hotel");
    } catch (error) {
        area.textContent = error.status === 404 ? "Hotel search hasn't been deployed yet." : error.message;
        area.hidden = false;
    } finally {
        hotelBusy = false;
        button.disabled = false;
        button.textContent = "Find places to stay ↗";
    }
});

const today = new Date();
$("departureDate").min = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
$("returnDate").min = $("departureDate").min;
updateStops();
loadCapabilities();


let suggestUnavailable = false;
let suggestionTimer = null;
let activeSuggestionList = null;

function closeSuggestions() {
    if (activeSuggestionList) activeSuggestionList.remove();
    activeSuggestionList = null;
    document.querySelectorAll(".journey-route-field input, .route-stop-input").forEach(input => {
        input.setAttribute("aria-expanded", "false");
    });
}

function wireLocationInput(input) {
    input.autocomplete = "off";
    input.setAttribute("aria-autocomplete", "list");
    input.addEventListener("input", () => {
        window.clearTimeout(suggestionTimer);
        closeSuggestions();
        const query = input.value.trim();
        if (suggestUnavailable || query.length < 3) return;
        suggestionTimer = window.setTimeout(async () => {
            let suggestions;
            try {
                const response = await api.suggestPlaces(query);
                suggestions = Array.isArray(response) ? response : response.items || response.results || [];
            } catch (error) {
                if (error.status === 404) suggestUnavailable = true;
                return;
            }
            if (input.value.trim() !== query || !suggestions.length || document.activeElement !== input) return;
            const parent = input.closest(".journey-route-field, .route-stop-row");
            if (!parent) return;
            closeSuggestions();
            const list = node("div", "journey-suggestions");
            list.setAttribute("role", "listbox");
            list.id = "suggest-" + Math.random().toString(36).slice(2, 9);
            input.setAttribute("aria-controls", list.id);
            input.setAttribute("aria-expanded", "true");
            suggestions.slice(0, 6).forEach(result => {
                const value = typeof result === "string" ? result : result.label || result.display_name || result.name;
                if (!value) return;
                const choice = node("button", "journey-suggestion", value);
                choice.type = "button";
                choice.setAttribute("role", "option");
                choice.addEventListener("pointerdown", event => event.preventDefault());
                choice.addEventListener("click", event => {
                    event.preventDefault();
                    input.value = value;
                    input.dispatchEvent(new Event("change", { bubbles: true }));
                    closeSuggestions();
                    input.focus();
                });
                list.appendChild(choice);
            });
            if (!list.childNodes.length) return;
            parent.appendChild(list);
            activeSuggestionList = list;
        }, 320);
    });
    input.addEventListener("keydown", event => {
        if (event.key === "Escape") closeSuggestions();
        if (event.key === "ArrowDown" && activeSuggestionList) {
            event.preventDefault();
            activeSuggestionList.querySelector("button")?.focus();
        }
    });
}

document.addEventListener("click", event => {
    if (!event.target.closest(".journey-route-field, .route-stop-row")) closeSuggestions();
});
document.addEventListener("focusout", event => {
    if (event.target.matches(".journey-route-field input, .route-stop-input")) {
        window.setTimeout(() => {
            if (!document.activeElement?.closest(".journey-suggestions")) closeSuggestions();
        }, 180);
    }
});
wireLocationInput($("origin"));
wireLocationInput($("destination"));
