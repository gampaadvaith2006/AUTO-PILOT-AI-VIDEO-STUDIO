const fs = require("fs");

const VIDEO_PATH = require("path").resolve(
    "assets/output/full-ai-video.mp4"
);

async function main() {
    console.log("1. Checking video file...");

    if (!fs.existsSync(VIDEO_PATH)) {
        throw new Error(
            `Video not found:\n${VIDEO_PATH}`
        );
    }

    const stats = fs.statSync(VIDEO_PATH);

    console.log("Video:", VIDEO_PATH);
    console.log(
        "Size:",
        (stats.size / 1024 / 1024).toFixed(2),
        "MB"
    );

    console.log("2. Getting AtoPlay page...");

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
        throw new Error(
            "AtoPlay upload page not found."
        );
    }

    console.log("3. Page found.");
    console.log("Page:", page.url);

    const ws = new WebSocket(
        page.webSocketDebuggerUrl
    );

    let commandId = 0;

    function send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = ++commandId;

            const timer = setTimeout(() => {
                reject(
                    new Error(
                        `${method} timed out`
                    )
                );
            }, 15000);

            function handler(event) {
                const message = JSON.parse(event.data);

                if (message.id !== id) {
                    return;
                }

                clearTimeout(timer);
                ws.removeEventListener(
                    "message",
                    handler
                );

                if (message.error) {
                    reject(
                        new Error(
                            JSON.stringify(
                                message.error
                            )
                        )
                    );
                    return;
                }

                resolve(message.result);
            }

            ws.addEventListener(
                "message",
                handler
            );

            ws.send(
                JSON.stringify({
                    id,
                    method,
                    params
                })
            );
        });
    }

    await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
    });

    console.log("4. Connected to AtoPlay.");

    console.log("5. Getting DOM...");

    await send("DOM.enable");

    const documentResult =
        await send("DOM.getDocument", {
            depth: -1,
            pierce: true
        });

    const rootNodeId =
        documentResult.root.nodeId;

    const queryResult =
        await send("DOM.querySelector", {
            nodeId: rootNodeId,
            selector:
                'input[type="file"][accept*="video/mp4"]'
        });

    const inputNodeId =
        queryResult.nodeId;

    if (!inputNodeId) {
        throw new Error(
            "Video file input was not found."
        );
    }

    console.log(
        "6. Video input found. Node:",
        inputNodeId
    );

    console.log("7. Setting video file...");

    await send("DOM.setFileInputFiles", {
        nodeId: inputNodeId,
        files: [VIDEO_PATH]
    });

    console.log(
        "8. Video file placed into AtoPlay."
    );

    console.log(
        "9. Waiting for AtoPlay to process it..."
    );

    await new Promise(resolve =>
        setTimeout(resolve, 3000)
    );

    const result =
        await send("Runtime.evaluate", {
            expression: `
                JSON.stringify({
                    text: document.body?.innerText || "",
                    fileInput: (() => {
                        const input =
                            document.querySelector(
                                'input[type="file"][accept*="video/mp4"]'
                            );

                        return input
                            ? {
                                files: [...input.files].map(
                                    file => ({
                                        name: file.name,
                                        size: file.size,
                                        type: file.type
                                    })
                                )
                            }
                            : null;
                    })()
                })
            `,
            returnByValue: true
        });

    const data = JSON.parse(
        result.result.value
    );

    console.log("");
    console.log("===== FILE STATE =====");
    console.log(data.fileInput);

    console.log("");
    console.log("===== CURRENT PAGE =====");
    console.log(
        data.text.substring(0, 5000)
    );

    ws.close();

    console.log("");
    console.log(
        "10. Upload-file test complete."
    );
}

main().catch(error => {
    console.error("");
    console.error("UPLOAD ERROR:");
    console.error(error.message);
});