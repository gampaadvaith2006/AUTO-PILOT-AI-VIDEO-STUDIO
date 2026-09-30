const { chromium } = require("playwright");

(async () => {
    try {

        console.log("Connecting to Chrome...");

        const browser =
            await chromium.connectOverCDP(
                "http://127.0.0.1:9222",
                {
                    timeout: 15000
                }
            );

        console.log(
            "CONNECTED TO CHROME SUCCESSFULLY!"
        );

        const contexts =
            browser.contexts();

        console.log(
            `Browser contexts: ${contexts.length}`
        );

        if (!contexts.length) {
            throw new Error(
                "No Chrome context found."
            );
        }

        const context =
            contexts[0];

        const pages =
            context.pages();

        console.log(
            `Chrome tabs: ${pages.length}`
        );

        for (
            let i = 0;
            i < pages.length;
            i++
        ) {

            const page =
                pages[i];

            const url =
                page.url();

            const title =
                await page
                    .title()
                    .catch(() => "");

            console.log("");
            console.log(
                `TAB ${i + 1}`
            );
            console.log(
                "URL:",
                url
            );
            console.log(
                "TITLE:",
                title
            );
        }

        console.log("");
        console.log(
            "Looking for AtoPlay..."
        );

        let atoplayPage = null;

        for (const page of pages) {

            const url =
                page.url()
                    .toLowerCase();

            if (
                !url.includes(
                    "atoplay.com"
                )
            ) {
                continue;
            }

            const text =
                await page
                    .locator("body")
                    .innerText()
                    .catch(() => "");

            if (
                text &&
                !text.includes(
                    "ERR_BLOCKED_BY_RESPONSE"
                )
            ) {

                atoplayPage = page;
                break;
            }
        }

        if (!atoplayPage) {

            console.log("");
            console.log(
                "No rendered AtoPlay tab found."
            );

            console.log(
                "Open AtoPlay manually in the special Chrome."
            );

            return;
        }

        await atoplayPage.bringToFront();

        console.log("");
        console.log(
            "AtoPlay tab found:"
        );

        console.log(
            atoplayPage.url()
        );

        console.log("");
        console.log(
            "Page text:"
        );

        const bodyText =
            await atoplayPage
                .locator("body")
                .innerText()
                .catch(() => "");

        console.log(
            bodyText.substring(
                0,
                3000
            )
        );

        console.log("");
        console.log(
            "Chrome + Playwright connection is working."
        );

    } catch (error) {

        console.error("");
        console.error(
            "CONNECTION ERROR:"
        );

        console.error(
            error.message
        );
    }

})();x