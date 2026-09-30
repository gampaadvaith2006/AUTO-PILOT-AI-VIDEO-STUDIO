async function main() {
    console.log("1. Getting AtoPlay upload page...");

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
        throw new Error("AtoPlay upload page not found.");
    }

    console.log("2. Page found.");

    const ws = new WebSocket(page.webSocketDebuggerUrl);

    const timeout = setTimeout(() => {
        console.error("TEST ERROR: Timed out.");
        process.exit(1);
    }, 15000);

    ws.onopen = () => {
        console.log("3. Connected.");

        const expression = `
            (() => {
                const button = [...document.querySelectorAll("button")]
                    .find(el =>
                        (el.innerText || "").trim() === "Continue →"
                    );

                if (!button) {
                    return JSON.stringify({
                        success: false,
                        error: "Continue button not found"
                    });
                }

                if (button.disabled) {
                    return JSON.stringify({
                        success: false,
                        error: "Continue button is disabled"
                    });
                }

                button.click();

                return JSON.stringify({
                    success: true,
                    message: "Continue clicked"
                });
            })()
        `;

        ws.send(JSON.stringify({
            id: 1,
            method: "Runtime.evaluate",
            params: {
                expression,
                returnByValue: true
            }
        }));
    };

    ws.onmessage = async event => {
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
            "4. Result:",
            message.result.result.value
        );

        console.log("5. Waiting for Step 2...");

        setTimeout(async () => {
            try {
                const r = await fetch(
                    "http://127.0.0.1:9222/json/list"
                );

                const updatedTargets = await r.json();

                const uploadPage = updatedTargets.find(
                    target =>
                        target.type === "page" &&
                        target.url.includes(
                            "atoplay.com/video-upload"
                        )
                );

                if (!uploadPage) {
                    throw new Error(
                        "Upload page not found."
                    );
                }

                console.log(
                    "6. Current page:",
                    uploadPage.url
                );

                const pageWs = new WebSocket(
                    uploadPage.webSocketDebuggerUrl
                );

                pageWs.onopen = () => {
                    pageWs.send(JSON.stringify({
                        id: 2,
                        method: "Runtime.evaluate",
                        params: {
                            expression: `
                                JSON.stringify({
                                    text: document.body?.innerText || "",
                                    fileInputs: [
                                        ...document.querySelectorAll(
                                            'input[type="file"]'
                                        )
                                    ].map((input, index) => ({
                                        index,
                                        accept: input.accept,
                                        multiple: input.multiple,
                                        disabled: input.disabled,
                                        outerHTML:
                                            input.outerHTML.substring(0, 1000)
                                    }))
                                })
                            `,
                            returnByValue: true
                        }
                    }));
                };

                pageWs.onmessage = event2 => {
                    const msg = JSON.parse(event2.data);

                    if (msg.id !== 2) return;

                    const data = JSON.parse(
                        msg.result.result.value
                    );

                    console.log("");
                    console.log("===== STEP 2 PAGE =====");
                    console.log(data.text);

                    console.log("");
                    console.log("===== FILE INPUTS =====");

                    data.fileInputs.forEach(input => {
                        console.log("");
                        console.log(
                            "FILE INPUT",
                            input.index
                        );
                        console.log(input);
                    });

                    pageWs.close();
                };

                pageWs.onerror = error => {
                    console.error(
                        "Page WebSocket error:",
                        error
                    );
                };

            } catch (error) {
                console.error(
                    "Check error:",
                    error.message
                );
            }

        }, 2000);
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