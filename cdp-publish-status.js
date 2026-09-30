async function main() {
    console.log("1. Getting current AtoPlay page...");

    const response = await fetch(
        "http://127.0.0.1:9222/json/list"
    );

    const targets = await response.json();

    const page = targets.find(
        target =>
            target.type === "page" &&
            target.url.includes("atoplay.com/video-upload")
    );

    if (!page) {
        throw new Error("AtoPlay page not found.");
    }

    console.log("2. Page:", page.url);

    const ws = new WebSocket(page.webSocketDebuggerUrl);

    const timeout = setTimeout(() => {
        console.error("STATUS ERROR: Timed out.");
        process.exit(1);
    }, 10000);

    ws.onopen = () => {
        console.log("3. Connected.");

        ws.send(JSON.stringify({
            id: 1,
            method: "Runtime.evaluate",
            params: {
                expression: `({
                    url: location.href,

                    text: document.body
                        ? document.body.innerText
                        : "",

                    publishButton: (() => {
                        const button = [
                            ...document.querySelectorAll("button")
                        ].find(el =>
                            (el.innerText || "")
                                .trim() === "Publish video"
                        );

                        return button
                            ? {
                                disabled: button.disabled,
                                text: button.innerText.trim()
                            }
                            : null;
                    })(),

                    visibleMessages: [
                        ...document.querySelectorAll(
                            '[role="alert"], [aria-live="polite"], [aria-live="assertive"]'
                        )
                    ]
                    .filter(el => {
                        const r = el.getBoundingClientRect();
                        return (
                            r.width > 0 &&
                            r.height > 0 &&
                            getComputedStyle(el).visibility !== "hidden"
                        );
                    })
                    .map(el => ({
                        text: (el.innerText || "").trim(),
                        html: el.outerHTML.substring(0, 1000)
                    })),

                    progressBars: [
                        ...document.querySelectorAll(
                            'progress, [role="progressbar"]'
                        )
                    ]
                    .map(el => ({
                        tag: el.tagName,
                        value: el.value ?? null,
                        max: el.max ?? null,
                        ariaValueNow:
                            el.getAttribute("aria-valuenow"),
                        text: (el.innerText || "").trim()
                    }))
                })`,
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

        const data = message.result?.result?.value;

        console.log("");
        console.log("===== CURRENT PAGE =====");
        console.log("URL:", data?.url);

        console.log("");
        console.log("===== PUBLISH BUTTON =====");
        console.log(data?.publishButton);

        console.log("");
        console.log("===== VISIBLE MESSAGES =====");
        console.log(data?.visibleMessages);

        console.log("");
        console.log("===== PROGRESS =====");
        console.log(data?.progressBars);

        console.log("");
        console.log("===== PAGE TEXT =====");
        console.log((data?.text || "").substring(0, 6000));

        ws.close();
    };

    ws.onerror = error => {
        clearTimeout(timeout);
        console.error("WebSocket error:", error);
    };
}

main().catch(error => {
    console.error("");
    console.error("STATUS ERROR:");
    console.error(error.message);
});