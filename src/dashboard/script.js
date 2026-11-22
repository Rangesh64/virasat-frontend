const welcome = document.getElementById("welcome");
const statusText = document.getElementById("authStatus");
const search = document.getElementById("globalSearchForm");
const searchInput = document.getElementById("globalSearchInput");

function updateGreeting(user) {
    if (!user) {
        welcome.textContent = "Your places, all in one place.";
        statusText.textContent = "Have a look around. Save the best stories for when you sign in.";
        return;
    }
    const fullName = String(user.full_name || user.name || (user.username?.startsWith("google:") ? "" : user.username) || "traveler");
    const firstName = fullName.trim().split(/\\s+/)[0];
    welcome.textContent = "Welcome back, " + firstName + ".";
    statusText.textContent = "Search monuments, play an audio guide, or start planning your next trip.";
}
document.addEventListener("virasat:account", event => updateGreeting(event.detail));
if (window.VirasatSession) window.VirasatSession.ready.then(updateGreeting);
search.addEventListener("submit", event => {
    event.preventDefault();
    const query = searchInput.value.trim();
    window.location.href = "../ai-tour-planner/index.html" + (query ? "?q=" + encodeURIComponent(query) : "");
});
async function fillFeaturedPlace() {
    const title = document.getElementById("hubPlaceTitle");
    const meta = document.getElementById("hubPlaceMeta");
    const image = document.getElementById("hubPhoto");
    const link = document.getElementById("hubPlaceLink");
    try {
        const items = await window.VirasatAPI.monuments();
        const place = items.find(item => item?.name && item?.image_url) || items.find(item => item?.name);
        if (!place) return;
        title.textContent = place.name;
        meta.textContent = [place.city, place.location_tag].filter(Boolean).join(" · ");
        if (typeof place.image_url === "string" && place.image_url.startsWith("https://")) image.src = place.image_url;
        link.textContent = "Hear its story ↗";
        link.href = "../ai-tour-guide/index.html?id=" + encodeURIComponent(place.id);
    } catch {}
}
fillFeaturedPlace();
