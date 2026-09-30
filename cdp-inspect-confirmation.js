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

    const ws = new WebSocket(page.webSocketDebuggerUrl);

    const timeout = setTimeout(() => {
        console.error("TEST ERROR: Timed out.");
        process.exit(1);
    }, 10000);

    ws.onopen = () => {
        console.log("2. Connected.");

        ws.send(JSON.stringify({
            id: 1,
            method: "Runtime.evaluate",
            params: {
                expression: `({
                    checkboxes: Array.from(
                        document.querySelectorAll(
                            'input[type="checkbox"]'
                        )
                    ).map((el, index) => ({
                        index,
                        checked: el.checked,
                        disabled: el.disabled,
                        name: el.name,
                        value: el.value,
                        outerHTML: el.outerHTML
                    })),

                    publishButton: Array.from(
                        document.querySelectorAll("button")
                    ).find(el =>
                        (el.innerText || "").trim() === "Publish video"
                    )
                    ? {
                        disabled: Array.from(
                            document.querySelectorAll("button")
                        ).find(el =>
                            (el.innerText || "").trim() === "Publish video"
                        ).disabled
                    }
                    : null
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
        console.log("===== CHECKBOXES =====");

        if (data?.checkboxes) {
            data.checkboxes.forEach(box => {
                console.log("");
                console.log("CHECKBOX", box.index);
                console.log("Checked:", box.checked);
                console.log("Disabled:", box.disabled);
                console.log("Name:", box.name);
                console.log("Value:", box.value);
                console.log("HTML:", box.outerHTML);
            });
        }

        console.log("");
        console.log("===== PUBLISH BUTTON =====");
        console.log(data?.publishButton);

        ws.close();
    };

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