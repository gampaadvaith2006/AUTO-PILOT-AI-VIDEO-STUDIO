const { chromium } = require("playwright");

(async () => {
    try {
        console.log("Connecting to Chrome...");

        const browser = await chromium.connectOverCDP(
            "http://127.0.0.1:9222"
        );

        const context = browser.contexts()[0];

        if (!context) {
            throw new Error("No Chrome context found.");
        }

        let pages = context.pages();

        let page = pages.find(p =>
            p.url().toLowerCase().includes("atoplay")
        );

        if (!page) {
            page = await context.newPage();
        }

        console.log("Current page:");
        console.log(page.url());

        console.log("");
        console.log("Opening AtoPlay Home...");

        await page.goto(
            "https://atoplay.com/",
            {
                waitUntil: "domcontentloaded",
                timeout: 30000
            }
        );

        await page.waitForTimeout(5000);

        console.log("");
        console.log("AtoPlay Home opened.");

        console.log("Current URL:");
        console.log(page.url());

        console.log("");
        console.log("Page title:");

        console.log(
            await page.title().catch(() => "ERROR")
        );

        console.log("");
        console.log("Now attempting to open the upload page...");

        await page.goto(
            "https://atoplay.com/video-upload",
            {
                waitUntil: "domcontentloaded",
                timeout: 30000
            }
        );

        await page.waitForTimeout(8000);

        console.log("");
        console.log("Upload page navigation completed.");

        console.log("Current URL:");
        console.log(page.url());

        console.log("");
        console.log("Page title:");

        console.log(
            await page.title().catch(() => "ERROR")
        );

        console.log("");
        console.log("Visible text:");

        const bodyText =
            await page.locator("body")
                .innerText()
                .catch(() => "");

        console.log(
            bodyText.substring(0, 3000)
        );

        console.log("");
        console.log("File inputs:");

        console.log(
            await page.locator(
                'input[type="file"]'
            ).count()
        );

        console.log("");
        console.log("Buttons:");

        console.log(
            await page.locator(
                "button:visible"
            ).count()
        );

        console.log("");
        console.log("Done.");

    } catch (error) {

        console.error("");
        console.error("ERROR:");
        console.error(error.message);

    }
})();