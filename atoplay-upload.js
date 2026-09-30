const fs = require("fs");
const path = require("path");


/*
========================================================
CONFIGURATION
========================================================
*/

/*
The server will provide these values for the
currently logged-in website user.

ATOPLAY_CDP_PORT
    -> that user's dedicated Chrome/CDP port

ATOPLAY_CHANNEL_ID
    -> the channel selected by that user

ATOPLAY_TITLE
ATOPLAY_DESCRIPTION
    -> optional metadata from the website
*/

const VIDEO_PATH = path.resolve(
    process.env.VIDEO_PATH ||
    "assets/output/full-ai-video.mp4"
);


const SCRIPT_PATH = path.resolve(
    process.env.SCRIPT_PATH ||
    "generated-script.txt"
);


const CHANNEL_ID =
    String(
        process.env.ATOPLAY_CHANNEL_ID ||
        ""
    ).trim();


const CDP_PORT =
    Number(
        process.env.ATOPLAY_CDP_PORT ||
        0
    );


const CDP_URL =
    `http://127.0.0.1:${CDP_PORT}`;


/*
========================================================
VALIDATION
========================================================
*/

if (!CDP_PORT) {

    throw new Error(
        "ATOPLAY_CDP_PORT is missing."
    );

}


if (!CHANNEL_ID) {

    throw new Error(
        "ATOPLAY_CHANNEL_ID is missing."
    );

}


/*
========================================================
TITLE
========================================================
*/

function makeTitle(script) {

    /*
    If server supplied a title, use it.
    */

    const supplied =
        String(
            process.env.ATOPLAY_TITLE ||
            ""
        ).trim();


    if (supplied) {

        return supplied.length <= 70
            ? supplied
            : supplied.substring(0, 67).trim() + "...";

    }


    /*
    Otherwise create title from script.
    */

    let title =
        script
            .replace(/\s+/g, " ")
            .trim()
            .split(/[.!?]/)[0]
            .trim();


    if (!title) {

        title =
            "AI Generated Video";

    }


    if (title.length > 70) {

        title =
            title.substring(0, 67).trim() +
            "...";

    }


    return title;

}


/*
========================================================
DESCRIPTION
========================================================
*/

function makeDescription(
    script,
    title
) {

    /*
    If server supplied a description,
    use it.
    */

    const supplied =
        String(
            process.env.ATOPLAY_DESCRIPTION ||
            ""
        ).trim();


    if (supplied) {

        return supplied.length <= 400
            ? supplied
            : supplied.substring(0, 397).trim() + "...";

    }


    /*
    Otherwise create description from script.
    */

    let description =
        script
            .replace(/\s+/g, " ")
            .trim();


    if (
        title &&
        description
            .toLowerCase()
            .startsWith(
                title.toLowerCase()
            )
    ) {

        description =
            description
                .substring(
                    title.length
                )
                .trim();

    }


    description =
        description
            .replace(
                /^[?.!,;:\s]+/,
                ""
            )
            .trim();


    if (
        description.length > 400
    ) {

        description =
            description
                .substring(0, 397)
                .trim() +
            "...";

    }


    return description;

}


/*
========================================================
GET ATOPLAY PAGE
========================================================
*/

async function getAtoPlayPage() {

    const response =
        await fetch(
            `${CDP_URL}/json/list`
        );


    if (!response.ok) {

        throw new Error(
            `Could not connect to Chrome CDP on port ${CDP_PORT}.`
        );

    }


    const targets =
        await response.json();


    const page =
        targets.find(
            target =>
                target.type === "page" &&
                String(
                    target.url || ""
                ).includes(
                    "atoplay.com"
                )
        );


    if (!page) {

        throw new Error(
            "No AtoPlay page found for this user."
        );

    }


    return page;

}


/*
========================================================
WEBSOCKET
========================================================
*/

function connectWebSocket(url) {

    return new Promise(
        (resolve, reject) => {

            const ws =
                new WebSocket(
                    url
                );


            const timer =
                setTimeout(
                    () => {

                        try {
                            ws.close();
                        } catch {}

                        reject(
                            new Error(
                                "CDP connection timed out."
                            )
                        );

                    },
                    10000
                );


            ws.onopen =
                () => {

                    clearTimeout(
                        timer
                    );

                    resolve(ws);

                };


            ws.onerror =
                error => {

                    clearTimeout(
                        timer
                    );

                    reject(
                        error
                    );

                };

        }
    );

}


/*
========================================================
CDP COMMAND
========================================================
*/

function cdpCommand(
    ws,
    id,
    method,
    params = {}
) {

    return new Promise(
        (resolve, reject) => {

            const timer =
                setTimeout(
                    () => {

                        reject(
                            new Error(
                                `${method} timed out.`
                            )
                        );

                    },
                    15000
                );


            const handler =
                event => {

                    try {

                        const message =
                            JSON.parse(
                                event.data
                            );


                        if (
                            message.id !== id
                        ) {

                            return;

                        }


                        clearTimeout(
                            timer
                        );


                        ws.removeEventListener(
                            "message",
                            handler
                        );


                        if (
                            message.error
                        ) {

                            reject(
                                new Error(
                                    JSON.stringify(
                                        message.error
                                    )
                                )
                            );

                        } else {

                            resolve(
                                message.result
                            );

                        }

                    } catch (error) {

                        clearTimeout(
                            timer
                        );

                        ws.removeEventListener(
                            "message",
                            handler
                        );

                        reject(
                            error
                        );

                    }

                };


            ws.addEventListener(
                "message",
                handler
            );


            ws.send(
                JSON.stringify(
                    {
                        id,
                        method,
                        params
                    }
                )
            );

        }
    );

}


let nextId = 1;


/*
========================================================
EVALUATE
========================================================
*/

async function evaluate(
    ws,
    expression
) {

    const result =
        await cdpCommand(
            ws,
            nextId++,
            "Runtime.evaluate",
            {
                expression,
                returnByValue:
                    true,
                awaitPromise:
                    true
            }
        );


    return result?.result?.value;

}


/*
========================================================
WAIT FOR PAGE TEXT
========================================================
*/

async function waitForText(
    ws,
    text,
    timeout = 15000
) {

    const start =
        Date.now();


    while (
        Date.now() - start <
        timeout
    ) {

        const pageText =
            await evaluate(
                ws,
                `document.body?.innerText || ""`
            );


        if (
            typeof pageText === "string" &&
            pageText.includes(text)
        ) {

            return true;

        }


        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    500
                )
        );

    }


    return false;

}


/*
========================================================
MAIN UPLOAD
========================================================
*/

async function main() {

    console.log(
        "================================"
    );

    console.log(
        "     AtoPlay Auto Uploader"
    );

    console.log(
        "================================"
    );

    console.log("");


    console.log(
        `CDP Port: ${CDP_PORT}`
    );

    console.log(
        `Channel ID: ${CHANNEL_ID}`
    );

    console.log("");


    /*
    Check video.
    */

    if (
        !fs.existsSync(
            VIDEO_PATH
        )
    ) {

        throw new Error(
            `Video not found:\n${VIDEO_PATH}`
        );

    }


    /*
    Check script.
    */

    if (
        !fs.existsSync(
            SCRIPT_PATH
        )
    ) {

        throw new Error(
            `Script not found:\n${SCRIPT_PATH}`
        );

    }


    const script =
        fs
            .readFileSync(
                SCRIPT_PATH,
                "utf8"
            )
            .trim();


    if (!script) {

        throw new Error(
            "generated-script.txt is empty."
        );

    }


    const title =
        makeTitle(
            script
        );


    const description =
        makeDescription(
            script,
            title
        );


    console.log(
        "TITLE:"
    );

    console.log(
        title
    );


    console.log("");


    console.log(
        "DESCRIPTION:"
    );

    console.log(
        description
    );


    console.log("");


    console.log(
        "VIDEO:"
    );

    console.log(
        VIDEO_PATH
    );


    /*
    Get this user's Chrome tab.
    */

    const page =
        await getAtoPlayPage();


    console.log("");


    console.log(
        "AtoPlay page:"
    );

    console.log(
        page.url
    );


    /*
    Connect to this user's dedicated
    Chrome session.
    */

    const ws =
        await connectWebSocket(
            page.webSocketDebuggerUrl
        );


    console.log(
        "CDP connected."
    );

    console.log("");


    /*
    ====================================================
    ENSURE UPLOAD PAGE
    ====================================================
    */

    const currentUrl =
        await evaluate(
            ws,
            "location.href"
        );


    if (
        !currentUrl.includes(
            "/video-upload"
        )
    ) {

        console.log(
            "Opening AtoPlay upload page..."
        );


        await evaluate(
            ws,
            `
            (() => {

                const link =
                    [
                        ...document.querySelectorAll("a")
                    ]
                    .find(
                        el =>
                            el.getAttribute("href") ===
                            "/video-upload"
                    );


                if (link) {

                    link.click();

                    return true;

                }


                location.href =
                    "https://atoplay.com/video-upload";

                return true;

            })()
            `
        );


        await waitForText(
            ws,
            "Select Channel",
            15000
        );

    }


    /*
    ====================================================
    STEP 1 - SELECT USER'S CHANNEL
    ====================================================
    */

    console.log(
        "STEP 1: Selecting user's channel..."
    );


    const channelResult =
        await evaluate(
            ws,
            `
            (() => {

                const channelId =
                    ${JSON.stringify(
                        CHANNEL_ID
                    )};


                const radio =
                    document.querySelector(
                        'input[name="channelId"][value="' +
                        channelId +
                        '"]'
                    );


                if (!radio) {

                    return {

                        success:
                            false,

                        error:
                            "Selected AtoPlay channel was not found in this user's account."

                    };

                }


                if (!radio.checked) {

                    radio.click();

                }


                return {

                    success:
                        true,

                    channelId,

                    checked:
                        radio.checked

                };

            })()
            `
        );


    console.log(
        channelResult
    );


    if (
        !channelResult?.success
    ) {

        throw new Error(
            channelResult?.error ||
            "Channel selection failed."
        );

    }


    /*
    Continue.
    */

    await evaluate(
        ws,
        `
        (() => {

            const button =
                [
                    ...document.querySelectorAll(
                        "button"
                    )
                ]
                .find(
                    el =>
                        (
                            el.innerText ||
                            ""
                        )
                        .trim() ===
                        "Continue →"
                );


            if (
                !button ||
                button.disabled
            ) {

                return false;

            }


            button.click();

            return true;

        })()
        `
    );


    await waitForText(
        ws,
        "Video file*",
        15000
    );


    console.log(
        "STEP 1 complete."
    );


    /*
    ====================================================
    STEP 2 - VIDEO
    ====================================================
    */

    console.log("");

    console.log(
        "STEP 2: Uploading video..."
    );


    await cdpCommand(
        ws,
        nextId++,
        "DOM.enable"
    );


    const documentResult =
        await cdpCommand(
            ws,
            nextId++,
            "DOM.getDocument",
            {
                depth:
                    -1,

                pierce:
                    true
            }
        );


    const inputResult =
        await cdpCommand(
            ws,
            nextId++,
            "DOM.querySelector",
            {
                nodeId:
                    documentResult
                        .root
                        .nodeId,

                selector:
                    'input[type="file"][accept*="video/mp4"]'
            }
        );


    if (
        !inputResult.nodeId
    ) {

        throw new Error(
            "Video file input not found."
        );

    }


    await cdpCommand(
        ws,
        nextId++,
        "DOM.setFileInputFiles",
        {
            nodeId:
                inputResult.nodeId,

            files:
                [
                    VIDEO_PATH
                ]
        }
    );


    const filenameReady =
        await waitForText(
            ws,
            "full-ai-video.mp4",
            20000
        );


    if (!filenameReady) {

        throw new Error(
            "AtoPlay did not show the uploaded filename."
        );

    }


    console.log(
        "Video uploaded successfully."
    );


    /*
    Continue.
    */

    await evaluate(
        ws,
        `
        (() => {

            const button =
                [
                    ...document.querySelectorAll(
                        "button"
                    )
                ]
                .find(
                    el =>
                        (
                            el.innerText ||
                            ""
                        )
                        .trim() ===
                        "Continue →"
                );


            if (
                !button ||
                button.disabled
            ) {

                return false;

            }


            button.click();

            return true;

        })()
        `
    );


    await waitForText(
        ws,
        "Tell viewers about your video",
        15000
    );


    console.log(
        "STEP 2 complete."
    );


    /*
    ====================================================
    STEP 3 - TITLE / DESCRIPTION
    ====================================================
    */

    console.log("");

    console.log(
        "STEP 3: Filling title and description..."
    );


    const detailsResult =
        await evaluate(
            ws,
            `
            (() => {

                const titleInput =
                    document.querySelector(
                        'input[name="title"]'
                    );


                const descriptionInput =
                    document.querySelector(
                        'textarea[name="description"]'
                    );


                if (
                    !titleInput ||
                    !descriptionInput
                ) {

                    return {

                        success:
                            false,

                        error:
                            "Title or description field not found."

                    };

                }


                const setValue =
                    (
                        element,
                        value
                    ) => {

                        const prototype =
                            element instanceof
                            HTMLTextAreaElement

                                ? HTMLTextAreaElement.prototype

                                : HTMLInputElement.prototype;


                        const setter =
                            Object
                                .getOwnPropertyDescriptor(
                                    prototype,
                                    "value"
                                )
                                .set;


                        setter.call(
                            element,
                            value
                        );


                        element.dispatchEvent(
                            new Event(
                                "input",
                                {
                                    bubbles:
                                        true
                                }
                            )
                        );


                        element.dispatchEvent(
                            new Event(
                                "change",
                                {
                                    bubbles:
                                        true
                                }
                            )
                        );

                    };


                setValue(
                    titleInput,
                    ${JSON.stringify(
                        title
                    )}
                );


                setValue(
                    descriptionInput,
                    ${JSON.stringify(
                        description
                    )}
                );


                return {

                    success:
                        true,

                    title:
                        titleInput.value,

                    description:
                        descriptionInput.value

                };

            })()
            `
        );


    console.log(
        detailsResult
    );


    if (
        !detailsResult?.success
    ) {

        throw new Error(
            detailsResult?.error ||
            "Details update failed."
        );

    }


    await new Promise(
        resolve =>
            setTimeout(
                resolve,
                1000
            )
    );


    /*
    Continue.
    */

    await evaluate(
        ws,
        `
        (() => {

            const button =
                [
                    ...document.querySelectorAll(
                        "button"
                    )
                ]
                .find(
                    el =>
                        (
                            el.innerText ||
                            ""
                        )
                        .trim() ===
                        "Continue →"
                );


            if (
                !button ||
                button.disabled
            ) {

                return false;

            }


            button.click();

            return true;

        })()
        `
    );


    await waitForText(
        ws,
        "Final settings before publishing",
        15000
    );


    console.log(
        "STEP 3 complete."
    );


    /*
    ====================================================
    STEP 4 - COPYRIGHT
    ====================================================
    */

    console.log("");

    console.log(
        "STEP 4: Confirming copyright..."
    );


    const copyrightResult =
        await evaluate(
            ws,
            `
            (() => {

                const checkbox =
                    document.querySelector(
                        'input[name="agreeToCopyright"]'
                    );


                if (!checkbox) {

                    return {

                        success:
                            false,

                        error:
                            "Copyright checkbox not found."

                    };

                }


                if (
                    !checkbox.checked
                ) {

                    checkbox.click();

                }


                return {

                    success:
                        true,

                    checked:
                        checkbox.checked

                };

            })()
            `
        );


    console.log(
        copyrightResult
    );


    if (
        !copyrightResult?.success ||
        !copyrightResult.checked
    ) {

        throw new Error(
            "Copyright confirmation failed."
        );

    }


    await new Promise(
        resolve =>
            setTimeout(
                resolve,
                1000
            )
    );


    /*
    ====================================================
    CHECK PUBLISH BUTTON
    ====================================================
    */

    const publishReady =
        await evaluate(
            ws,
            `
            (() => {

                const button =
                    [
                        ...document.querySelectorAll(
                            "button"
                        )
                    ]
                    .find(
                        el =>
                            (
                                el.innerText ||
                                ""
                            )
                            .trim() ===
                            "Publish video"
                    );


                return {

                    found:
                        !!button,

                    disabled:
                        button
                            ? button.disabled
                            : true

                };

            })()
            `
        );


    console.log(
        "Publish state:",
        publishReady
    );


    if (
        !publishReady?.found ||
        publishReady.disabled
    ) {

        throw new Error(
            "Publish button is not enabled."
        );

    }


    /*
    ====================================================
    FINAL PUBLISH
    ====================================================
    */

    console.log("");

    console.log(
        "STEP 4: Publishing video..."
    );


    const publishResult =
        await evaluate(
            ws,
            `
            (() => {

                const button =
                    [
                        ...document.querySelectorAll(
                            "button"
                        )
                    ]
                    .find(
                        el =>
                            (
                                el.innerText ||
                                ""
                            )
                            .trim() ===
                            "Publish video"
                    );


                if (
                    !button ||
                    button.disabled
                ) {

                    return false;

                }


                button.click();

                return true;

            })()
            `
        );


    if (!publishResult) {

        throw new Error(
            "Publish button could not be clicked."
        );

    }


    console.log(
        "Publish button clicked."
    );


    console.log(
        "Waiting for AtoPlay confirmation..."
    );


    const success =
        await waitForText(
            ws,
            "Upload Successful!",
            30000
        );


    if (!success) {

        const text =
            await evaluate(
                ws,
                "document.body?.innerText || ''"
            );


        console.log("");

        console.log(
            "Current AtoPlay text:"
        );

        console.log(
            String(text)
                .substring(
                    0,
                    5000
                )
        );


        throw new Error(
            "AtoPlay success message was not detected."
        );

    }


    console.log("");
    console.log(
        "================================"
    );
    console.log(
        "       UPLOAD SUCCESSFUL"
    );
    console.log(
        "================================"
    );
    console.log("");


    console.log(
        "Video:",
        "full-ai-video.mp4"
    );


    console.log(
        "Channel ID:",
        CHANNEL_ID
    );


    console.log("");

    console.log(
        "AtoPlay has accepted the upload."
    );


    try {

        ws.close();

    } catch {}

}


/*
========================================================
START
========================================================
*/

main().catch(
    error => {

        console.error("");

        console.error(
            "================================"
        );

        console.error(
            "          UPLOAD FAILED"
        );

        console.error(
            "================================"
        );

        console.error("");

        console.error(
            error.message
        );

        process.exit(1);

    }
);