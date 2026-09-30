async function main() {
    console.log("1. Getting Chrome tabs...");

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
        throw new Error("No AtoPlay page found.");
    }

    console.log("2. Found AtoPlay page:");
    console.log(page.url);

    console.log("3. Connecting directly to page...");

    const ws = new WebSocket(
        page.webSocketDebuggerUrl
    );

    const timeout = setTimeout(() => {
        console.error(
            "TEST ERROR: Page WebSocket timed out."
        );
        process.exit(1);
    }, 10000);

    ws.onopen = () => {
        console.log("4. Page WebSocket connected!");

        ws.send(
            JSON.stringify({
                id: 1,
                method: "Runtime.evaluate",
                params: {
                    expression: `
                        JSON.stringify({
                            title: document.title,
                            url: location.href,
                            text: document.body
                                ? document.body.innerText
                                : ""
                        })
                    `,
                    returnByValue: true
                }
            })
        );
    };

    ws.onmessage = event => {
        const message = JSON.parse(event.data);

        if (message.id !== 1) {
            return;
        }

        clearTimeout(timeout);

        if (message.error) {
            console.error("CDP ERROR:");
            console.error(message.error);
        } else {
            console.log("5. AtoPlay replied:");

            const data =
                JSON.parse(
                    message.result.result.value
                );

            console.log("");
            console.log("TITLE:", data.title);
            console.log("URL:", data.url);
            console.log("");
            console.log("PAGE TEXT:");
            console.log(
                data.text.substring(0, 3000)
            );
        }

        ws.close();
    };

    ws.onerror = error => {
        clearTimeout(timeout);

        console.error(
            "TEST ERROR: Page WebSocket failed."
        );

        console.error(error);
    };
}

main().catch(error => {
    console.error("");
    console.error("TEST ERROR:");
    console.error(error.message);
});