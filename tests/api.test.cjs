const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const code = fs.readFileSync(path.join(__dirname, "../src/api.js"), "utf8");

function makeApi(perform, token = null) {
    const requests = [];
    const window = {
        location: { hostname: "virasat-frontend-nu.vercel.app" },
        localStorage: { getItem: () => token }
    };
    vm.runInNewContext(code, {
        window,
        URLSearchParams,
        fetch: async (url, options) => {
            requests.push({ url, options });
            return perform(url, options);
        }
    });
    return { api: window.VirasatAPI, requests };
}

function success(data, contentType = "application/json") {
    return {
        ok: true,
        status: 200,
        json: async () => data,
        blob: async () => new Blob(["test"], { type: contentType }),
        headers: { get: key => key.toLowerCase() === "content-type" ? contentType : null }
    };
}

test("public catalogue uses actual paginated items and cover_image fields", async () => {
    const { api, requests } = makeApi(() => success({
        items: [{ id: 3, name: "A fort", city: "Agra", cover_image: "https://example.com/a.jpg" }],
        total: 1
    }));
    const entries = await api.monuments();
    assert.equal(entries.length, 1);
    assert.equal(entries[0].image_url, "https://example.com/a.jpg");
    assert.match(requests[0].url, /\/api\/v1\/monuments\?page=1&page_size=50/);
    assert.equal(requests[0].options.credentials, "include");
});

test("travel plans are authenticated and match the documented contract", async () => {
    const { api, requests } = makeApi(() => success({ plan_id: "example" }), "my-token");
    const input = { destination: "Agra", days: 2, travelers: 3, currency: "INR", interests: ["history"] };
    const result = await api.createPlan(input);
    assert.equal(result.plan_id, "example");
    assert.match(requests[0].url, /\/api\/v1\/travel\/plans$/);
    assert.equal(requests[0].options.method, "POST");
    assert.equal(requests[0].options.headers.Authorization, "Bearer my-token");
    assert.equal(requests[0].options.credentials, "include");
    assert.deepEqual(JSON.parse(requests[0].options.body), input);
});

test("question requests preserve request IDs for safe retries", async () => {
    const { api, requests } = makeApi(() => success({ answer: "Reference answer" }));
    await api.askQuestion("session-uuid", "Why was it built?", "retry-uuid");
    assert.match(requests[0].url, /\/tour-sessions\/session-uuid\/questions$/);
    assert.equal(JSON.parse(requests[0].options.body).request_id, "retry-uuid");
});

test("PDF is read from saved plan as binary, without AI generation", async () => {
    const { api, requests } = makeApi(() => success(null, "application/pdf"));
    const blob = await api.pdf("saved-plan");
    assert.equal(blob.type, "application/pdf");
    assert.equal(requests[0].options.method, undefined);
    assert.match(requests[0].url, /\/plans\/saved-plan\/pdf$/);
});

test("auth failures return status 401, not successful empty content", async () => {
    const { api } = makeApi(() => ({
        ok: false,
        status: 401,
        json: async () => ({ detail: "Not authenticated" })
    }));
    await assert.rejects(api.createSession(3), error => error.status === 401);
});

test("missing backend endpoints give status 404 without inventing data", async () => {
    const { api } = makeApi(() => ({
        ok: false,
        status: 404,
        json: async () => ({ detail: "Not Found" })
    }));
    await assert.rejects(api.createPlan({ destination: "Agra" }), error => error.status === 404);
});
