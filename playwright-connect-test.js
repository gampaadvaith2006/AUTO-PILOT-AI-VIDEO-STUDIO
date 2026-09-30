const { chromium } = require("playwright");

async function main() {
    console.log("1. Starting Playwright...");

    const browser = await Promise.race([
        chromium.connectOverCDP("http://127.0.0.1:9222"),
        new Promise((_, reject) =>
            setTimeout(
                () => reject(
                    new Error("Connection timed out after 20 seconds")
                ),
                20000
            )
        )
    ]);

    console.log("2. Connected!");

    const contexts = browser.contexts();

    console.log("3. Contexts:", contexts.length);

    if (!contexts.length) {
        throw new Error("No browser context found.");
    }

    const pages = contexts[0].pages();

    console.log("4. Tabs:", pages.length);

    for (let i = 0; i < pages.length; i++) {
        console.log(`TAB ${i + 1}:`, pages[i].url());
    }

    console.log("5. Test complete.");

    await browser.close();
}

main().catch(error => {
    console.error("");
    console.error("TEST ERROR:");
    console.error(error.message);
});