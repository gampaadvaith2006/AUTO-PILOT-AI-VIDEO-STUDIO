async function main() {
    console.log("1. Getting AtoPlay review page...");

    const response = await fetch(
        "http://127.0.0.1:9222/json/list"
    );

    const targets = await response.json();

    const page = targets.find(
        target =>
            target.type === "page" &&
            target.url === "https://atoplay.com/video-upload"
    );

    if (!page) {
        throw new Error("AtoPlay review page not found.");
    }

    console.log("2. Page found.");
    console.log("3. Connecting...");

    const ws = new WebSocket(page.webSocketDebuggerUrl);

    const timeout = setTimeout(() => {
        console.error("PUBLISH ERROR: Timed out.");
        process.exit(1);
    }, 20000);

    ws.onopen = () => {
        console.log("4. Connected.");
        console.log("5. Clicking Publish video...");

        ws.send(JSON.stringify({
            id: 1,
            method: "Runtime.evaluate",
            params: {
                expression: `
                    (() => {
                        const button = [...document.querySelectorAll("button")]
                            .find(el =>
                                (el.innerText || "").trim() === "Publish video"
                            );

                        if (!button) {
                            return {
                                success: false,
                                error: "Publish video button not found"
                            };
                        }

                        if (button.disabled) {
                            return {
                                success: false,
                                error: "Publish video button is disabled"
                            };
                        }

                        button.click();

                        return {
                            success: true,
                            message: "Publish video clicked"
                        };
                    })()
                `,
                returnByValue: true
            }
        }));
    };

    ws.onmessage = event => {
        const message = JSON.parse(event.data);

        if (message.id !== 1) return;

        clearTimeout(timeout);

        if (message.error) {
            console.error("CDP ERROR:");
            console.error(message.error);
            ws.close();
            return;
        }

        console.log(
            "6. Result:",
            message.result?.result?.value
        );

        console.log("7. Waiting for AtoPlay to finish publishing...");

        setTimeout(async () => {
            try {
                const check = await fetch(
                    "http://127.0.0.1:9222/json/list"
                );

                const updatedTargets = await check.json();

                const currentPage = updatedTargets.find(
                    target =>
                        target.type === "page" &&
                        target.url.includes("atoplay.com")
                );

                if (!currentPage) {
                    console.log(
                        "No AtoPlay page currently detected."
                    );
                    ws.close();
                    return;
                }

                console.log("");
                console.log(
                    "8. Current URL:",
                    currentPage.url
                );

                const pageWs = new WebSocket(
                    currentPage.webSocketDebuggerUrl
                );

                const pageTimeout = setTimeout(() => {
                    console.log(
                        "Could not read final page state."
                    );
                    pageWs.close();
                }, 10000);

                pageWs.onopen = () => {
                    pageWs.send(JSON.stringify({
                        id: 2,
                        method: "Runtime.evaluate",
                        params: {
                            expression: `({
                                url: location.href,
                                title: document.title,
                                text: document.body
                                    ? document.body.innerText
                                    : ""
                            })`,
                            returnByValue: true
                        }
                    }));
                };

                pageWs.onmessage = event2 => {
                    const msg = JSON.parse(event2.data);

                    if (msg.id !== 2) return;

                    clearTimeout(pageTimeout);

                    console.log("");
                    console.log("===== FINAL RESULT =====");

                    const data =
                        msg.result?.result?.value;

                    console.log("URL:", data?.url);
                    console.log("TITLE:", data?.title);
                    console.log("");
                    console.log("PAGE TEXT:");
                    console.log(
                        (data?.text || "").substring(0, 5000)
                    );

                    pageWs.close();
                };

                pageWs.onerror = error => {
                    clearTimeout(pageTimeout);
                    console.error(
                        "Final page WebSocket error:",
                        error
                    );
                };

                ws.close();

            } catch (error) {
                console.error(
                    "Final check error:",
                    error.message
                );
                ws.close();
            }
        }, 5000);
    };

    ws.onerror = error => {
        clearTimeout(timeout);
        console.error("WebSocket error:", error);
    };
}

main().catch(error => {
    console.error("");
    console.error("PUBLISH ERROR:");
    console.error(error.message);
});