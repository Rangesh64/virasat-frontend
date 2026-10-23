/* Shared cookie-based authentication. No tokens are stored in JavaScript. */
(function () {
    const apiBase = (window.VIRASAT_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
    async function request(path, options = {}) {
        const response = await fetch(apiBase + path, { ...options, credentials: "include", cache: "no-store" });
        if (response.status === 401) return null;
        if (!response.ok) throw new Error("We could not reach your account. Please try again.");
        return response.json();
    }
    window.VirasatAuth = {
        async signIn() {
            let status;
            try {
                status = await request("/auth/google/status");
            } catch (error) {
                throw new Error("Cannot connect to Google sign-in. Check that the backend is running and try again.");
            }
            if (!status || !status.configured) {
                throw new Error(status?.message || "Google sign-in is not configured yet.");
            }
            window.location.assign(apiBase + "/auth/google/login");
        },
        currentUser() { return request("/auth/me"); },
        logout() { return request("/auth/logout", { method: "POST" }); },
    };
})();
