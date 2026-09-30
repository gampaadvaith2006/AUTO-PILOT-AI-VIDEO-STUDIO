async function main() {
    console.log("1. Getting AtoPlay page...");

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

    let step = 1;

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

        if (message.id === 1) {
            clearTimeout(timeout);

            console.log(
                "5. Result:",
                message.result?.result?.value
            );

            console.log(
                "6. Waiting for Step 3..."
            );

            setTimeout(() => {
                send(2, `
                    JSON.stringify({
                        text: document.body?.innerText || "",

                        inputs: [
                            ...document.querySelectorAll("input")
                        ].map((el, index) => ({
                            index,
                            type: el.type,
                            name: el.name,
                            placeholder: el.placeholder,
                            value: el.value,
                            required: el.required,
                            disabled: el.disabled
                        })),

                        textareas: [
                            ...document.querySelectorAll("textarea")
                        ].map((el, index) => ({
                            index,
                            name: el.name,
                            placeholder: el.placeholder,
                            value: el.value,
                            required: el.required,
                            disabled: el.disabled
                        })),

                        selects: [
                            ...document.querySelectorAll("select")
                        ].map((el, index) => ({
                            index,
                            name: el.name,
                            value: el.value,
                            options: [
                                ...el.options
                            ].map(option => ({
                                text: option.text,
                                value: option.value
                            }))
                        }))
                    })
                `);
            }, 2500);

            return;
        }

        if (message.id === 2) {
            const data = JSON.parse(
                message.result?.result?.value || "{}"
            );

            console.log("");
            console.log("===== STEP 3 PAGE =====");
            console.log(data.text);

            console.log("");
            console.log("===== INPUTS =====");
            console.log(data.inputs);

            console.log("");
            console.log("===== TEXTAREAS =====");
            console.log(data.textareas);

            console.log("");
            console.log("===== SELECTS =====");
            console.log(data.selects);

            ws.close();
        }
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