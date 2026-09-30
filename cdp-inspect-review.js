async function main() {
    console.log("1. Finding AtoPlay page...");

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

    console.log("2. Page:", page.url);
    console.log("3. Connecting...");

    const ws = new WebSocket(page.webSocketDebuggerUrl);

    const timeout = setTimeout(() => {
        console.error("TEST ERROR: Timed out.");
        process.exit(1);
    }, 15000);

    ws.onopen = () => {
        console.log("4. Connected.");

        ws.send(JSON.stringify({
            id: 1,
            method: "Runtime.evaluate",
            params: {
                expression: `({
                    text: document.body
                        ? document.body.innerText
                        : "",

                    buttons: Array.from(
                        document.querySelectorAll("button")
                    )
                    .filter(el => {
                        const r =
                            el.getBoundingClientRect();

                        return (
                            r.width > 0 &&
                            r.height > 0 &&
                            getComputedStyle(el)
                                .visibility !== "hidden"
                        );
                    })
                    .map((el, index) => ({
                        index,
                        text: (el.innerText || "").trim(),
                        disabled: el.disabled
                    }))
                })`,
                returnByValue: true
            }
        }));
    };

    ws.onmessage = event => {
        const message = JSON.parse(event.data);

        if (message.id !== 1) {
            return;
        }

        clearTimeout(timeout);

        if (message.error) {
            console.error("");
            console.error("CDP ERROR:");
            console.error(message.error);
            ws.close();
            return;
        }

        const remoteObject =
            message.result?.result;

        if (!remoteObject) {
            console.error("No Runtime result returned.");
            ws.close();
            return;
        }

        if (remoteObject.type === "undefined") {
            console.error(
                "AtoPlay returned undefined."
            );
            ws.close();
            return;
        }

        if (!remoteObject.value) {
            console.error(
                "No page data was returned."
            );
            console.error(remoteObject);
            ws.close();
            return;
        }

        const data = remoteObject.value;

        console.log("");
        console.log("===== PAGE TEXT =====");
        console.log(data.text);

        console.log("");
        console.log("===== BUTTONS =====");

        data.buttons.forEach(button => {
            console.log(
                `${button.index}. "${button.text}" | disabled: ${button.disabled}`
            );
        });

        ws.close();
    };

    ws.onerror = error => {
        clearTimeout(timeout);
        console.error("");
        console.error("WebSocket error:");
        console.error(error);
    };
}

main().catch(error => {
    console.error("");
    console.error("REVIEW ERROR:");
    console.error(error.message);
});