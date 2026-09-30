const { chromium } = require("playwright");

async function main() {

    console.log("Connecting to your existing Chrome...");

    let browser;

    try {

        browser =
            await chromium.connectOverCDP(
                "http://127.0.0.1:9222"
            );

    } catch (error) {

        console.error("");
        console.error(
            "Could not connect to Chrome."
        );

        console.error("");
        console.error(
            "Make sure Chrome was started with:"
        );

        console.error("");
        console.error(
            "--remote-debugging-port=9222"
        );

        console.error("");

        console.error(
            error.message
        );

        return;
    }

    const contexts =
        browser.contexts();

    if (!contexts.length) {

        console.error(
            "No Chrome browser context found."
        );

        return;
    }

    const context =
        contexts[0];

    const pages =
        context.pages();

    let page = pages[0];

    // Find an existing AtoPlay tab
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

    if (!page) {

        page =
            await context.newPage();

        await page.goto(
            "https://atoplay.com/",
            {
                waitUntil:
                    "domcontentloaded"
            }
        );
    }

    console.log("");
    console.log(
        "Connected to Chrome successfully."
    );

    console.log(
        "Current page:"
    );

    console.log(
        await page.title()
    );

    console.log(
        page.url()
    );

    console.log("");

    console.log(
        "AtoPlay session is being checked..."
    );

    await page.waitForTimeout(3000);

    console.log("");
    console.log(
        "Browser is ready for upload automation."
    );

    console.log("");
    console.log(
        "Keep this Chrome window open."
    );

    // Keep Node running while Chrome is open.
    await new Promise(() => {});
}

main().catch(error => {

    console.error("");
    console.error("ERROR:");
    console.error(error);

});