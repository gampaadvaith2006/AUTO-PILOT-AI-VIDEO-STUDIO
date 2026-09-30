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
    }, 10000);

    ws.onopen = () => {
        console.log("3. Connected.");

        const expression = `
            (() => {
                const radio = document.querySelector(
                    'input[name="channelId"][value="3b5c045c-d940-4d20-b612-9d557006d0d3"]'
                );

                if (!radio) {
                    return JSON.stringify({
                        success: false,
                        error: "TradeWithAdvaith channel radio not found"
                    });
                }

                radio.click();

                return JSON.stringify({
                    success: true,
                    checked: radio.checked
                });
            })()
        `;

        ws.send(JSON.stringify({
            id: 1,
            method: "Runtime.evaluate",
            params: {
                expression,
                returnByValue: true,
                awaitPromise: true
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

        const result = JSON.parse(
            message.result.result.value
        );

        console.log("4. Channel selection result:", result);

        setTimeout(() => {
            ws.send(JSON.stringify({
                id: 2,
                method: "Runtime.evaluate",
                params: {
                    expression: `
                        JSON.stringify({
                            selectedChannels: [
                                ...document.querySelectorAll(
                                    'input[name="channelId"]'
                                )
                            ].map(input => ({
                                value: input.value,
                                checked: input.checked
                            })),

                            continueButton: [...document.querySelectorAll(
                                'button'
                            )].find(button =>
                                (button.innerText || "")
                                    .trim()
                                    .includes("Continue")
                            ) ? {
                                disabled: [...document.querySelectorAll(
                                    'button'
                                )].find(button =>
                                    (button.innerText || "")
                                        .trim()
                                        .includes("Continue")
                                ).disabled,
                                text: [...document.querySelectorAll(
                                    'button'
                                )].find(button =>
                                    (button.innerText || "")
                                        .trim()
                                        .includes("Continue")
                                ).innerText.trim()
                            } : null
                        })
                    `,
                    returnByValue: true
                }
            }));
        }, 500);
    };

    ws.addEventListener("message", event => {
        const message = JSON.parse(event.data);

        if (message.id !== 2) return;

        const result = JSON.parse(
            message.result.result.value
        );

        console.log("");
        console.log("5. Current channel state:");
        console.log(result);

        ws.close();
    });

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