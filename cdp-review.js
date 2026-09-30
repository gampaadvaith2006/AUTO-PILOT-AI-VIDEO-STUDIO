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
    console.log("3. Connecting...");

    const ws = new WebSocket(page.webSocketDebuggerUrl);

    const timeout = setTimeout(() => {
        console.error("TEST ERROR: Timed out.");
        process.exit(1);
    }, 15000);

    function send(id, expression) {
        ws.send(JSON.stringify({
            id,
            method: "Runtime.evaluate",
            params: {
                expression,
                returnByValue: true,
                awaitPromise: true
            }
        }));
    }

    ws.onopen = () => {
        console.log("4. Connected.");

        send(1, `
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
        `);
    };

    ws.onmessage = event => {
        const message = JSON.parse(event.data);

        if (message.id !== 1) return;

        clearTimeout(timeout);

        console.log(
            "5. Result:",
            message.result?.result?.value
        );

        console.log("6. Waiting for Review & Publish...");

        setTimeout(() => {
            send(2, `
                JSON.stringify({
                    text: document.body?.innerText || "",

                    buttons: [...document.querySelectorAll("button")]
                        .filter(el => {
                            const r = el.getBoundingClientRect();
                            return r.width > 0 &&
                                   r.height > 0 &&
                                   getComputedStyle(el).visibility !== "hidden";
                        })
                        .map((el, index) => ({
                            index,
                            text: (el.innerText || "").trim(),
                            disabled: el.disabled
                        }))
                })
            `);
        }, 2500);
    };

    ws.addEventListener("message", event => {
        const message = JSON.parse(event.data);

        if (message.id !== 2) return;

        const data = JSON.parse(
            message.result.result.value
        );

        console.log("");
        console.log("===== REVIEW PAGE =====");
        console.log(data.text);

        console.log("");
        console.log("===== BUTTONS =====");

        data.buttons.forEach(button => {
            console.log(
                `${button.index}. "${button.text}" | disabled: ${button.disabled}`
            );
        });

        ws.close();
    });

    ws.onerror = error => {
        clearTimeout(timeout);
        console.error("WebSocket error:", error);
    };
}

main().catch(error => {
    console.error("");
    console.error("REVIEW ERROR:");
    console.error(error.message);
});