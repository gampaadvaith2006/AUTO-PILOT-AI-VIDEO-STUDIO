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

    const ws = new WebSocket(page.webSocketDebuggerUrl);

    const timeout = setTimeout(() => {
        console.error("TEST ERROR: Timed out.");
        process.exit(1);
    }, 10000);

    ws.onopen = () => {
        console.log("2. Connected.");

        const expression = `
            JSON.stringify({
                videoName:
                    [...document.querySelectorAll("*")]
                    .find(el =>
                        (el.innerText || "").trim() === "full-ai-video.mp4"
                    )?.innerText || null,

                buttons:
                    [...document.querySelectorAll("button")]
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
                    .filter(item =>
                        item.text.includes("Continue") ||
                        item.text.includes("Back")
                    )
            })
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
            const data = JSON.parse(
                message.result.result.value
            );

            console.log("");
            console.log("VIDEO:", data.videoName);

            console.log("");
            console.log("NAVIGATION BUTTONS:");

            data.buttons.forEach(button => {
                console.log(
                    `${button.text} | disabled: ${button.disabled}`
                );
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