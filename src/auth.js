(function () {
    const local = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const fallback = local ? "http://127.0.0.1:8000" : "https://virasatguide-backend-epsu.vercel.app";
    const apiBase = (window.VIRASAT_API_BASE_URL || window.API_BASE_URL || fallback).replace(/\/$/, "");

    function tokenHeaders(extra = {}) {
        const token = window.localStorage?.getItem("virasat_token");
        return { ...(token ? { Authorization: "Bearer " + token } : {}), ...extra };
    }

    async function request(path, options = {}) {
        let response;
        try {
            response = await fetch(apiBase + path, {
                ...options,
                headers: tokenHeaders(options.headers),
                credentials: "include",
                cache: "no-store"
            });
        } catch {
            throw new Error("We couldn't connect to your account. Please try again.");
        }
        if (response.status === 401) return null;
        if (!response.ok) {
            let message;
            try {
                const payload = await response.json();
                message = typeof payload.detail === "string" ? payload.detail : null;
            } catch {}
            throw new Error(message || "We could not reach your account. Please try again.");
        }
        return response.json();
    }

    async function googleReady() {
        let status;
        try {
            status = await request("/auth/google/status");
        } catch {
            throw new Error("Cannot connect to Google sign-in. Check that the backend is running and try again.");
        }
        if (!status || !status.configured) throw new Error(status?.message || "Google sign-in is not configured yet.");
    }

    window.VirasatAuth = {
        async continueGoogle() {
            await googleReady();
            let unified = false;
            try {
                const response = await fetch(apiBase + "/api/v1/travel/capabilities", { credentials: "include", cache: "no-store" });
                if (response.ok) {
                    const capabilities = await response.json();
                    unified = capabilities.profile_onboarding === true;
                }
            } catch {}
            window.localStorage?.removeItem("virasat_token");
            window.location.assign(apiBase + (unified ? "/auth/google/continue" : "/auth/google/login"));
        },
        async setCredentials(username, password) {
            const response = await fetch(apiBase + "/auth/credentials", {
                method: "PUT",
                credentials: "include",
                cache: "no-store",
                headers: tokenHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ username, password })
            });
            if (!response.ok) {
                let message = response.status === 409
                    ? "This username is already taken, or login credentials are already set for this account."
                    : response.status === 401
                        ? "Your session has expired. Sign in with Google again."
                        : "Couldn't save your sign-in details. Please try again.";
                try {
                    const details = await response.json();
                    if (typeof details.detail === "string" && details.detail.trim()) message = details.detail;
                } catch {}
                const error = new Error(message);
                error.status = response.status;
                throw error;
            }
            return response.json();
        },
        async updateProfile(data) {
            const response = await fetch(apiBase + "/auth/profile", {
                method: "PUT",
                credentials: "include",
                cache: "no-store",
                headers: tokenHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                let message = "We couldn\'t save your profile. Please try again.";
                try {
                    const details = await response.json();
                    if (typeof details.detail === "string") message = details.detail;
                } catch {}
                const error = new Error(message);
                error.status = response.status;
                throw error;
            }
            return response.json();
        },
        async signIn() {
            await googleReady();
            window.localStorage?.removeItem("virasat_token");
            window.location.assign(apiBase + "/auth/google/login");
        },
        async signUp() {
            await googleReady();
            window.localStorage?.removeItem("virasat_token");
            window.location.assign(apiBase + "/auth/google/signup");
        },
        async login(username, password) {
            const body = new URLSearchParams({ username, password }).toString();
            const response = await request("/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body
            });
            if (!response?.access_token) throw new Error("Incorrect username or password.");
            window.localStorage.setItem("virasat_token", response.access_token);
            return response;
        },
        async register(username, password) {
            return request("/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });
        },
        currentUser() {
            return request("/auth/me");
        },
        async logout() {
            const result = await request("/auth/logout", { method: "POST" });
            window.localStorage?.removeItem("virasat_token");
            return result;
        }
    };
})();
