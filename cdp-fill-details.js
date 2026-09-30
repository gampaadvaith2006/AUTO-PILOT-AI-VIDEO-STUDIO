const fs = require("fs");

const SCRIPT_PATH = "./generated-script.txt";

function createTitle(script) {
    const cleaned = script
        .replace(/\s+/g, " ")
        .trim();

    // Use the first sentence as the title.
    let title = cleaned.split(/[.!?]\s/)[0];

    if (!title) {
        title = "AI Generated Video";
    }

    // AtoPlay title limit = 70 characters.
    if (title.length > 70) {
        title = title.substring(0, 67).trim() + "...";
    }

    return title;
}

function createDescription(script, title) {
    let description = script
        .replace(/\s+/g, " ")
        .trim();

    // Remove title from beginning if it is duplicated.
    if (
        title &&
        description.toLowerCase().startsWith(
            title.toLowerCase()
        )
    ) {
        description = description
            .substring(title.length)
            .trim();
    }

    // Keep within AtoPlay's 400-character limit.
    if (description.length > 400) {
        description =
            description.substring(0, 397).trim() + "...";
    }

    return description;
}

async function main() {
    console.log("1. Reading generated script...");

    if (!fs.existsSync(SCRIPT_PATH)) {
        throw new Error(
            `Script not found: ${SCRIPT_PATH}`
        );
    }

    const script = fs.readFileSync(
        SCRIPT_PATH,
        "utf8"
    ).trim();

    if (!script) {
        throw new Error(
            "generated-script.txt is empty."
        );
    }

    const title = createTitle(script);
    const description = createDescription(
        script,
        title
    );

    console.log("Title:", title);
    console.log(
        "Title length:",
        title.length
    );

    console.log("Description:", description);
    console.log(
        "Description length:",
        description.length
    );

    console.log("");
    console.log("2. Getting AtoPlay page...");

    const response = await fetch(
        "http://127.0.0.1:9222/json/list"
    );

    const targets = await response.json();

    const page = targets.find(
        target =>
            target.type === "page" &&
            target.url ===
                "https://atoplay.com/video-upload"
    );

    if (!page) {
        throw new Error(
            "AtoPlay upload page not found."
        );
    }

    console.log("3. Page found.");

    const ws = new WebSocket(
        page.webSocketDebuggerUrl
    );

    const timeout = setTimeout(() => {
        console.error(
            "TEST ERROR: Timed out."
        );
        process.exit(1);
    }, 15000);

    function send(id, expression) {
        ws.send(
            JSON.stringify({
                id,
                method: "Runtime.evaluate",
                params: {
                    expression,
                    returnByValue: true,
                    awaitPromise: true
                }
            })
        );
    }

    ws.onopen = () => {
        console.log("4. Connected.");

        const expression = `
            (() => {
                const titleInput =
                    document.querySelector(
                        'input[name="title"]'
                    );

                const descriptionInput =
                    document.querySelector(
                        'textarea[name="description"]'
                    );

                if (!titleInput) {
                    return JSON.stringify({
                        success: false,
                        error: "Title input not found"
                    });
                }

                if (!descriptionInput) {
                    return JSON.stringify({
                        success: false,
                        error:
                            "Description textarea not found"
                    });
                }

                const setReactValue = (
                    element,
                    value
                ) => {
                    const prototype =
                        element instanceof HTMLTextAreaElement
                            ? HTMLTextAreaElement.prototype
                            : HTMLInputElement.prototype;

                    const setter =
                        Object.getOwnPropertyDescriptor(
                            prototype,
                            "value"
                        ).set;

                    setter.call(element, value);

                    element.dispatchEvent(
                        new Event("input", {
                            bubbles: true
                        })
                    );

                    element.dispatchEvent(
                        new Event("change", {
                            bubbles: true
                        })
                    );
                };

                setReactValue(
                    titleInput,
                    ${JSON.stringify(title)}
                );

                setReactValue(
                    descriptionInput,
                    ${JSON.stringify(description)}
                );

                return JSON.stringify({
                    success: true,
                    title: titleInput.value,
                    description:
                        descriptionInput.value,
                    titleLength:
                        titleInput.value.length,
                    descriptionLength:
                        descriptionInput.value.length
                });
            })()
        `;

        send(1, expression);
    };

    ws.onmessage = event => {
        const message = JSON.parse(event.data);

        if (message.id !== 1) {
            return;
        }

        clearTimeout(timeout);

        if (message.error) {
            console.error(
                "CDP ERROR:",
                message.error
            );
            ws.close();
            return;
        }

        const result = JSON.parse(
            message.result.result.value
        );

        console.log("");
        console.log(
            "5. Details result:",
            result
        );

        if (!result.success) {
            ws.close();
            return;
        }

        // Give React time to update the form state.
        setTimeout(() => {
            send(
                2,
                `
                    JSON.stringify({
                        title:
                            document.querySelector(
                                'input[name="title"]'
                            )?.value || "",

                        description:
                            document.querySelector(
                                'textarea[name="description"]'
                            )?.value || "",

                        continueButton:
                            [...document.querySelectorAll(
                                "button"
                            )].find(button =>
                                (button.innerText || "")
                                    .trim() ===
                                "Continue →"
                            )
                            ? {
                                disabled:
                                    [...document.querySelectorAll(
                                        "button"
                                    )].find(button =>
                                        (button.innerText || "")
                                            .trim() ===
                                        "Continue →"
                                    ).disabled,
                                text:
                                    [...document.querySelectorAll(
                                        "button"
                                    )].find(button =>
                                        (button.innerText || "")
                                            .trim() ===
                                        "Continue →"
                                    ).innerText.trim()
                            }
                            : null
                    })
                `
            );
        }, 1000);
    };

    ws.addEventListener(
        "message",
        event => {
            const message = JSON.parse(
                event.data
            );

            if (message.id !== 2) {
                return;
            }

            const data = JSON.parse(
                message.result.result.value
            );

            console.log("");
            console.log("===== VERIFIED DETAILS =====");
            console.log(
                "TITLE:",
                data.title
            );
            console.log(
                "DESCRIPTION:",
                data.description
            );
            console.log("");
            console.log(
                "CONTINUE:",
                data.continueButton
            );

            ws.close();
        }
    );

    ws.onerror = error => {
        clearTimeout(timeout);

        console.error(
            "WebSocket error:",
            error
        );
    };
}

main().catch(error => {
    console.error("");
    console.error("DETAILS ERROR:");
    console.error(error.message);
});