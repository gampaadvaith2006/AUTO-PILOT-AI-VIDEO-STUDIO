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
        console.error("TEST ERROR: Timed out.");
        process.exit(1);
    }, 10000);

    ws.onopen = () => {
        console.log("4. Connected.");

        ws.send(JSON.stringify({
            id: 1,
            method: "Runtime.evaluate",
            params: {
                expression: `
                    (() => {
                        const checkbox =
                            document.querySelector(
                                'input[name="agreeToCopyright"]'
                            );

                        if (!checkbox) {
                            return {
                                success: false,
                                error:
                                    "Copyright checkbox not found"
                            };
                        }

                        if (!checkbox.checked) {
                            checkbox.click();
                        }

                        return {
                            success: true,
                            checked: checkbox.checked
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
            "5. Checkbox result:",
            message.result?.result?.value
        );

        // Give React time to update the form state.
        setTimeout(() => {
            ws.send(JSON.stringify({
                id: 2,
                method: "Runtime.evaluate",
                params: {
                    expression: `
                        ({
                            copyrightChecked:
                                document.querySelector(
                                    'input[name="agreeToCopyright"]'
                                )?.checked || false,

                            publishDisabled:
                                [...document.querySelectorAll("button")]
                                .find(button =>
                                    (button.innerText || "")
                                        .trim() ===
                                    "Publish video"
                                )?.disabled ?? null
                        })
                    `,
                    returnByValue: true
                }
            }));
        }, 1000);
    };

    ws.addEventListener("message", event => {
        const message = JSON.parse(event.data);

        if (message.id !== 2) return;

        console.log("");
        console.log("===== VERIFIED =====");

        console.log(
            "Copyright checkbox:",
            message.result?.result?.value
                ?.copyrightChecked
        );

        console.log(
            "Publish button disabled:",
            message.result?.result?.value
                ?.publishDisabled
        );

        ws.close();
    });

    ws.onerror = error => {
        clearTimeout(timeout);
        console.error("WebSocket error:", error);
    };
}

main().catch(error => {
    console.error("");
    console.error("ERROR:");
    console.error(error.message);
});