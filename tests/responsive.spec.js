const { test, expect } = require("@playwright/test");

const root = "http://127.0.0.1:5173/src";
const pages = ["landing-page", "dashboard", "ai-tour-planner", "ai-tour-guide", "trip-planner"];
const widths = [280, 320, 360, 375, 390, 414, 430, 480, 600, 768, 1024, 1440];

for (const width of widths) {
    test("trip inputs stay inside the card at " + width + "px", async ({ page }) => {
        await page.setViewportSize({ width, height: 870 });
        await page.goto(root + "/trip-planner/index.html", { waitUntil: "domcontentloaded" });

        const result = await page.evaluate(() => {
            const panel = document.querySelector(".journey-panel");
            const fields = ["departureDate", "returnDate", "travelers", "days"].map(id => {
                const rect = document.getElementById(id).getBoundingClientRect();
                return { id, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
            });
            const card = panel.getBoundingClientRect();
            return {
                documentWidth: document.documentElement.scrollWidth,
                viewportWidth: window.innerWidth,
                card: { left: card.left, right: card.right },
                fields
            };
        });

        expect(result.documentWidth).toBeLessThanOrEqual(result.viewportWidth + 1);
        for (const field of result.fields) {
            expect(field.left).toBeGreaterThanOrEqual(result.card.left - 1);
            expect(field.right).toBeLessThanOrEqual(result.card.right + 1);
        }
        if (width <= 480) {
            expect(result.fields[1].top).toBeGreaterThan(result.fields[0].bottom);
        }
    });
}

for (const width of [320, 375, 414, 768, 1024]) {
    test("primary pages avoid horizontal overflow at " + width + "px", async ({ page }) => {
        await page.setViewportSize({ width, height: 870 });
        for (const folder of pages) {
            await page.goto(root + "/" + folder + "/index.html", { waitUntil: "domcontentloaded" });
            const bounds = await page.evaluate(() => ({
                width: document.documentElement.scrollWidth,
                viewport: window.innerWidth
            }));
            expect(bounds.width, folder + " at " + width + "px").toBeLessThanOrEqual(bounds.viewport + 1);
        }
    });
}
