async function main() {
    console.log("1. Getting AtoPlay page...");

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
        throw new Error("AtoPlay page not found.");
    }

    console.log("2. Page:", page.url);

    const ws = new WebSocket(page.webSocketDebuggerUrl);

    const timeout = setTimeout(() => {
        console.error("TEST ERROR: Timed out.");
        process.exit(1);
    }, 10000);

    ws.onopen = () => {
        console.log("3. Connected.");

        const expression = `
            JSON.stringify(
                [...document.querySelectorAll(
                    'a,button,[role="button"]'
                )]
                .filter(el =>
                    (el.innerText || "")
                        .trim()
                        .toLowerCase()
                        .includes("upload")
                )
                .map((el, index) => ({
                    index,
                    tag: el.tagName,
                    text: (el.innerText || "").trim(),
                    href: el.href || null,
                    outerHTML: el.outerHTML.substring(0, 800)
                }))
            )
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

    ws.onmessage = event => {
        const message = JSON.parse(event.data);

        if (message.id !== 1) return;

        clearTimeout(timeout);

        if (message.error) {
            console.error("CDP ERROR:");
            console.error(message.error);
        } else {
            const items =
                JSON.parse(
                    message.result.result.value || "[]"
                );

            console.log("");
            console.log("UPLOAD CONTROLS FOUND:", items.length);
            console.log("");

            items.forEach(item => {
                console.log("INDEX:", item.index);
                console.log("TAG:", item.tag);
                console.log("TEXT:", item.text);
                console.log("HREF:", item.href);
                console.log("HTML:", item.outerHTML);
                console.log("--------------------------------");
            });
        }

        ws.close();
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