const { chromium } = require("playwright");

(async () => {
    try {
        console.log("Connecting to Chrome...");

        const browser = await chromium.connectOverCDP(
            "http://127.0.0.1:9222"
        );

        const contexts = browser.contexts();

        if (!contexts.length) {
            throw new Error("No Chrome context found.");
        }

        const context = contexts[0];

        const pages = context.pages();

        if (!pages.length) {
            throw new Error("No Chrome pages found.");
        }

        let page = pages[0];

        for (const currentPage of pages) {
            if (
                currentPage.url()
                    .toLowerCase()
                    .includes("atoplay")
            ) {
                page = currentPage;
                break;
            }
        }

        console.log("URL:", page.url());

        console.log(
            "TITLE:",
            await page.title().catch(() => "ERROR")
        );

        await page.screenshot({
            path: "atoplay-debug.png",
            fullPage: false
        });

        console.log(
            "Screenshot saved: atoplay-debug.png"
        );

        console.log("Connected successfully.");

    } catch (error) {
        console.error("DEBUG ERROR:");
        console.error(error.message);
    }
})();