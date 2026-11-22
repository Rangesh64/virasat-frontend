(function () {
    const host = window.location.hostname;
    const local = host === "localhost" || host === "127.0.0.1";
    const fallback = local ? "http://127.0.0.1:8000" : "https://virasatguide-backend-epsu.vercel.app";
    const base = (window.VIRASAT_API_BASE_URL || window.API_BASE_URL || fallback).replace(/\/$/, "");

    class ApiError extends Error {
        constructor(status, message) {
            super(message);
            this.name = "ApiError";
            this.status = status;
        }
    }

    function headers(extra = {}) {
        const token = window.localStorage.getItem("virasat_token");
        return { ...(token ? { Authorization: "Bearer " + token } : {}), ...extra };
    }

    async function send(path, options = {}) {
        let response;
        try {
            response = await fetch(base + path, {
                ...options,
                credentials: "include",
                cache: "no-store",
                headers: headers(options.headers || {})
            });
        } catch {
            throw new ApiError(0, "We couldn't connect to Virasat. Check your connection and try again.");
        }
        if (!response.ok) {
            let message = "";
            try {
                const data = await response.json();
                if (typeof data.detail === "string") message = data.detail;
                if (Array.isArray(data.detail)) message = data.detail.map(item => item.msg).filter(Boolean).join(". ");
            } catch {}
            if (!message) {
                if (response.status === 401) message = "Please sign in to continue.";
                else if (response.status === 404) message = "This item couldn't be found, or this feature isn't available on the live server yet.";
                else if (response.status === 409) message = "Something changed while you were saving. Please retry.";
                else if (response.status === 422) message = "Please check the information you entered.";
                else if (response.status === 502 || response.status === 503 || response.status === 504) message = "The service is temporarily unavailable. Please try again later.";
                else message = "Something went wrong. Please try again.";
            }
            throw new ApiError(response.status, message);
        }
        return response;
    }

    async function json(path, options = {}) {
        const response = await send(path, options);
        return response.json();
    }

    function post(path, body) {
        return json(path, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(body)
        });
    }

    function normaliseMonument(item) {
        return {
            ...item,
            image_url: item.cover_image || item.image_url || "",
            cover_image: item.cover_image || item.image_url || ""
        };
    }

    async function monuments(options = {}) {
        const pageSize = 50;
        const first = await json("/api/v1/monuments?" + new URLSearchParams({
            page: "1",
            page_size: String(pageSize),
            ...(options.search ? { search: options.search } : {}),
            ...(options.city ? { city: options.city } : {})
        }));
        if (Array.isArray(first)) return first.map(normaliseMonument);
        const items = first.items || first.monuments;
        if (!Array.isArray(items)) throw new ApiError(502, "The monument list isn't in the expected format.");
        const result = items.slice();
        const total = Number(first.total) || items.length;
        for (let page = 2; result.length < total && page <= Math.ceil(total / pageSize); page++) {
            const next = await json("/api/v1/monuments?" + new URLSearchParams({
                page: String(page),
                page_size: String(pageSize),
                ...(options.search ? { search: options.search } : {}),
                ...(options.city ? { city: options.city } : {})
            }));
            const entries = next.items || next.monuments;
            if (!Array.isArray(entries) || !entries.length) break;
            result.push(...entries);
        }
        return result.map(normaliseMonument);
    }

    async function monument(id) {
        return normaliseMonument(await json("/api/v1/monuments/" + encodeURIComponent(id)));
    }

    async function audio(id) {
        return send("/api/v1/monuments/" + encodeURIComponent(id) + "/audio", {
            method: "POST",
            headers: { Accept: "audio/mpeg" }
        });
    }

    async function story(id) {
        return json("/api/v1/monuments/" + encodeURIComponent(id) + "/story", {
            method: "POST",
            headers: { Accept: "application/json" }
        });
    }

    async function pdf(id) {
        const response = await send("/api/v1/travel/plans/" + encodeURIComponent(id) + "/pdf", {
            headers: { Accept: "application/pdf" }
        });
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/pdf")) {
            throw new ApiError(502, "The download wasn't returned as a PDF.");
        }
        return response.blob();
    }

    window.VirasatAPI = Object.freeze({
        base,
        ApiError,
        monuments,
        monument,
        story,
        audio,
        createSession(monumentId) {
            return post("/api/v1/travel/tour-sessions", { monument_id: Number(monumentId) });
        },
        getSession(id) {
            return json("/api/v1/travel/tour-sessions/" + encodeURIComponent(id));
        },
        askQuestion(id, question, requestId) {
            return post("/api/v1/travel/tour-sessions/" + encodeURIComponent(id) + "/questions", {
                question,
                ...(requestId ? { request_id: requestId } : {})
            });
        },
        async capabilities() {
            try {
                return await json("/api/v1/travel/capabilities");
            } catch (error) {
                if (error.status === 404) return {
                    transport_search: false,
                    hotel_search: false,
                    extended_planning: false,
                    profile_onboarding: false
                };
                throw error;
            }
        },
        transportSearch(input) {
            return post("/api/v1/travel/transport/search", input);
        },
        hotelSearch(input) {
            return post("/api/v1/travel/hotels/search", input);
        },
        async suggestPlaces(query) {
            return json("/api/v1/travel/places/suggest?q=" + encodeURIComponent(query));
        },
        createPlan(input) {
            return post("/api/v1/travel/plans", input);
        },
        getPlan(id) {
            return json("/api/v1/travel/plans/" + encodeURIComponent(id));
        },
        pdf
    });
})();
