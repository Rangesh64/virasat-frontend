(function () {
    const paths = {
        home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
        explore: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
        plan: '<path d="M3 6h6a3 3 0 0 1 3 3v6a3 3 0 0 0 3 3h6"/><circle cx="3" cy="6" r="2"/><circle cx="21" cy="18" r="2"/>',
        profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
    };
    document.querySelectorAll(".bottom-nav a").forEach(link => {
        const span = link.querySelector(".nav-icon");
        if (!span) return;
        const href = link.getAttribute("href") || "";
        const key = href.includes("landing-page") ? "home" : href.includes("ai-tour-planner") ? "explore" : href.includes("trip-planner") ? "plan" : "profile";
        span.innerHTML = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths[key] + "</svg>";
    });
})();
