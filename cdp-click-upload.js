async function main() {
    console.log("1. Getting AtoPlay page...");

    const response = await fetch(
        "http://127.0.0.1:9222/json/list"
    );

    const targets = await response.json();

    const page = targets.find(
        target =>
            target.type === "page" &&
            target.url.includes("atoplay.com")
    );

    if (!page) {
        throw new Error("AtoPlay page not found.");
    }

    console.log("2. Page:", page.url);

    const ws = new WebSocket(page.webSocketDebuggerUrl);

    const timeout = setTimeout(() => {
        console.error("TEST ERROR: Timed out.");
        process.exit(1);
    }, 15000);

    ws.onopen = () => {
        console.log("3. Connected.");

        ws.send(JSON.stringify({
            id: 1,
            method: "Runtime.evaluate",
            params: {
                expression: `
                    (() => {
                        const link = [...document.querySelectorAll('a')]
                            .find(el =>
                                el.getAttribute('href') === '/video-upload' &&
                                (el.innerText || '').trim() === 'Upload'
                            );

                        if (!link) {
                            return 'Upload link not found';
                        }

                        link.click();
                        return 'Upload link clicked';
                    })()
                `,
                returnByValue: true
            }
        }));
    };

    ws.onmessage = async event => {
        const message = JSON.parse(event.data);

        if (message.id !== 1) return;

        clearTimeout(timeout);

        console.log(
            "4. Result:",
            message.result?.result?.value
        );

        console.log("5. Waiting for AtoPlay upload page...");

        setTimeout(async () => {
            try {
                const checkResponse = await fetch(
                    "http://127.0.0.1:9222/json/list"
                );

                const updatedTargets =
                    await checkResponse.json();

                const pages = updatedTargets.filter(
                    target =>
                        target.type === "page" &&
                        target.url.includes("atoplay.com")
                );

                console.log("");
                console.log("AtoPlay pages:");

                pages.forEach((item, index) => {
                    console.log(
                        `${index + 1}. ${item.url}`
                    );
                });

                ws.close();
            } catch (error) {
                console.error(
                    "Check error:",
                    error.message
                );
                ws.close();
            }
        }, 3000);
    };

    ws.onerror = error => {
        clearTimeout(timeout);
        console.error("WebSocket error:", error);
    };
}

main().catch(error => {
    console.error("");
    console.error("TEST ERROR:");
    console.error(error.message);
});