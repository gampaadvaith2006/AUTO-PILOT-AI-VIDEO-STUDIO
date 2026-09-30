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

    console.log("2. Page found:", page.url);

    const ws = new WebSocket(page.webSocketDebuggerUrl);

    const timeout = setTimeout(() => {
        console.error("TEST ERROR: Timed out.");
        process.exit(1);
    }, 10000);

    ws.onopen = () => {
        console.log("3. Connected.");

        const expression = `
            JSON.stringify({
                bodyText: document.body?.innerText || "",

                inputs: [...document.querySelectorAll("input")].map(
                    (el, index) => ({
                        index,
                        type: el.type,
                        name: el.name,
                        value: el.value,
                        checked: el.checked,
                        disabled: el.disabled,
                        ariaLabel: el.getAttribute("aria-label"),
                        placeholder: el.placeholder,
                        outerHTML: el.outerHTML.substring(0, 600)
                    })
                ),

                buttons: [...document.querySelectorAll(
                    "button,[role='button'],a"
                )]
                .filter(el => {
                    const r = el.getBoundingClientRect();
                    return r.width > 0 &&
                           r.height > 0 &&
                           getComputedStyle(el).visibility !== "hidden";
                })
                .map((el, index) => ({
                    index,
                    tag: el.tagName,
                    text: (el.innerText || "").trim(),
                    href: el.href || null,
                    role: el.getAttribute("role"),
                    outerHTML: el.outerHTML.substring(0, 700)
                }))
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
            ws.close();
            return;
        }

        const data = JSON.parse(
            message.result.result.value
        );

        console.log("");
        console.log("===== PAGE TEXT =====");
        console.log(data.bodyText);

        console.log("");
        console.log("===== INPUTS =====");

        data.inputs.forEach(input => {
            console.log("");
            console.log("INPUT", input.index);
            console.log(input);
        });

        console.log("");
        console.log("===== VISIBLE CONTROLS =====");

        data.buttons.forEach(button => {
            console.log("");
            console.log("CONTROL", button.index);
            console.log("TAG:", button.tag);
            console.log("TEXT:", button.text);
            console.log("HREF:", button.href);
            console.log("ROLE:", button.role);
            console.log("HTML:", button.outerHTML);
        });

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