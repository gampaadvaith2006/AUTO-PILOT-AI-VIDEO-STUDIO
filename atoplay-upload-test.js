// atoplay-upload.js
//
// AtoPlay automatic uploader.
// The selected channel is supplied by server.js through:
// ATOPLAY_CHANNEL_ID
//
// This file does NOT store an AtoPlay password.

const fs = require("fs");
const path = require("path");

const CHROME_CDP_URL =
  "http://127.0.0.1:9222";

const ATOPLAY_UPLOAD_URL =
  "https://atoplay.com/video-upload";

const PROJECT_DIR = __dirname;

const VIDEO_FILE = path.join(
  PROJECT_DIR,
  "assets",
  "output",
  "full-ai-video.mp4"
);

const TITLE_FILE = path.join(
  PROJECT_DIR,
  "generated-title.txt"
);

const DESCRIPTION_FILE = path.join(
  PROJECT_DIR,
  "generated-description.txt"
);

const SELECTED_CHANNEL_ID = String(
  process.env.ATOPLAY_CHANNEL_ID || ""
).trim();

function sleep(ms) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

function readText(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }

    const value = fs
      .readFileSync(filePath, "utf8")
      .trim();

    return value || fallback;
  } catch {
    return fallback;
  }
}

function findThumbnail() {
  const candidates = [
    path.join(
      PROJECT_DIR,
      "assets",
      "output",
      "thumbnail.jpg"
    ),

    path.join(
      PROJECT_DIR,
      "assets",
      "output",
      "thumbnail.jpeg"
    ),

    path.join(
      PROJECT_DIR,
      "assets",
      "output",
      "thumbnail.png"
    ),

    path.join(
      PROJECT_DIR,
      "thumbnail.jpg"
    ),

    path.join(
      PROJECT_DIR,
      "thumbnail.jpeg"
    ),

    path.join(
      PROJECT_DIR,
      "thumbnail.png"
    )
  ];

  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
}

async function getChromePages() {
  const response = await fetch(
    `${CHROME_CDP_URL}/json/list`
  );

  if (!response.ok) {
    throw new Error(
      `Chrome CDP returned HTTP ${response.status}.`
    );
  }

  return await response.json();
}

function connectCDP(webSocketUrl) {
  return new Promise(
    (resolve, reject) => {
      const socket =
        new WebSocket(webSocketUrl);

      let nextId = 1;

      const pending =
        new Map();

      const cleanup = () => {
        for (
          const item of pending.values()
        ) {
          item.reject(
            new Error(
              "Chrome CDP connection closed."
            )
          );
        }

        pending.clear();
      };

      socket.addEventListener(
        "open",
        () => {
          const send =
            (method, params = {}) => {
              return new Promise(
                (
                  resolveCommand,
                  rejectCommand
                ) => {
                  const id =
                    nextId++;

                  pending.set(id, {
                    resolve:
                      resolveCommand,
                    reject:
                      rejectCommand
                  });

                  socket.send(
                    JSON.stringify({
                      id,
                      method,
                      params
                    })
                  );
                }
              );
            };

          socket.addEventListener(
            "message",
            (event) => {
              try {
                const message =
                  JSON.parse(
                    event.data
                  );

                if (!message.id) {
                  return;
                }

                const item =
                  pending.get(
                    message.id
                  );

                if (!item) {
                  return;
                }

                pending.delete(
                  message.id
                );

                if (message.error) {
                  item.reject(
                    new Error(
                      message.error
                        .message ||
                        "CDP command failed."
                    )
                  );

                  return;
                }

                item.resolve(
                  message.result || {}
                );
              } catch (error) {
                console.error(
                  "CDP message error:",
                  error.message
                );
              }
            }
          );

          socket.addEventListener(
            "close",
            cleanup
          );

          socket.addEventListener(
            "error",
            cleanup
          );

          resolve({
            send,

            close() {
              try {
                socket.close();
              } catch {
                // Ignore.
              }
            }
          });
        }
      );

      socket.addEventListener(
        "error",
        () => {
          reject(
            new Error(
              "Could not connect to Chrome CDP."
            )
          );
        }
      );
    }
  );
}

async function findAtoPlayPage() {
  const pages =
    await getChromePages();

  const page =
    pages.find(
      (item) =>
        item.type === "page" &&
        typeof item.url === "string" &&
        item.url.includes(
          "atoplay.com"
        ) &&
        item.webSocketDebuggerUrl
    );

  if (!page) {
    throw new Error(
      "No AtoPlay Chrome tab found. Start start-chrome.bat first."
    );
  }

  return page;
}

async function evaluate(
  cdp,
  expression
) {
  const result =
    await cdp.send(
      "Runtime.evaluate",
      {
        expression,
        returnByValue: true,
        awaitPromise: true
      }
    );

  if (
    result?.exceptionDetails
  ) {
    throw new Error(
      result.exceptionDetails
        .exception?.description ||
        "Browser JavaScript evaluation failed."
    );
  }

  return result?.result?.value;
}

async function navigateToUploadPage(cdp) {
  await cdp.send(
    "Page.enable"
  );

  await cdp.send(
    "Page.navigate",
    {
      url: ATOPLAY_UPLOAD_URL
    }
  );

  console.log(
    "Opening AtoPlay video upload page..."
  );

  await sleep(5000);
}

async function waitForElement(
  cdp,
  selector,
  timeout = 15000
) {
  const start =
    Date.now();

  while (
    Date.now() - start <
    timeout
  ) {
    const found =
      await evaluate(
        cdp,
        `
        (() => {
          const element =
            document.querySelector(
              ${JSON.stringify(
                selector
              )}
            );

          return !!element;
        })()
        `
      );

    if (found) {
      return true;
    }

    await sleep(500);
  }

  return false;
}

async function getElementBackendNodeId(
  cdp,
  selector
) {
  await cdp.send(
    "DOM.enable"
  );

  const documentResult =
    await cdp.send(
      "DOM.getDocument",
      {
        depth: -1,
        pierce: true
      }
    );

  const nodeResult =
    await cdp.send(
      "DOM.querySelector",
      {
        nodeId:
          documentResult.root.nodeId,

        selector
      }
    );

  if (
    !nodeResult.nodeId
  ) {
    throw new Error(
      `Could not find element: ${selector}`
    );
  }

  const describeResult =
    await cdp.send(
      "DOM.describeNode",
      {
        nodeId:
          nodeResult.nodeId
      }
    );

  const backendNodeId =
    describeResult?.node
      ?.backendNodeId;

  if (!backendNodeId) {
    throw new Error(
      `Could not get backend node ID for: ${selector}`
    );
  }

  return backendNodeId;
}

async function setFileInput(
  cdp,
  selector,
  filePath
) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `File does not exist: ${filePath}`
    );
  }

  const backendNodeId =
    await getElementBackendNodeId(
      cdp,
      selector
    );

  await cdp.send(
    "DOM.setFileInputFiles",
    {
      backendNodeId,
      files: [filePath]
    }
  );

  await evaluate(
    cdp,
    `
    (() => {
      const input =
        document.querySelector(
          ${JSON.stringify(
            selector
          )}
        );

      if (input) {
        input.dispatchEvent(
          new Event("change", {
            bubbles: true
          })
        );

        input.dispatchEvent(
          new Event("input", {
            bubbles: true
          })
        );
      }

      return true;
    })()
    `
  );
}

async function setInputValue(
  cdp,
  selector,
  value
) {
  const result =
    await evaluate(
      cdp,
      `
      (() => {
        const element =
          document.querySelector(
            ${JSON.stringify(
              selector
            )}
          );

        if (!element) {
          return {
            success: false,
            error:
              "Element not found."
          };
        }

        const prototype =
          Object.getPrototypeOf(
            element
          );

        const descriptor =
          Object.getOwnPropertyDescriptor(
            prototype,
            "value"
          );

        if (
          descriptor &&
          descriptor.set
        ) {
          descriptor.set.call(
            element,
            ${JSON.stringify(
              value
            )}
          );
        } else {
          element.value =
            ${JSON.stringify(
              value
            )};
        }

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

        return {
          success: true,
          value: element.value
        };
      })()
      `
    );

  if (!result?.success) {
    throw new Error(
      `Could not fill ${selector}: ${result?.error || "unknown error"}`
    );
  }

  return result;
}

async function selectChannel(
  cdp
) {
  console.log("");
  console.log(
    "STEP 1: Selecting channel..."
  );

  if (!SELECTED_CHANNEL_ID) {
    throw new Error(
      "ATOPLAY_CHANNEL_ID was not supplied."
    );
  }

  const result =
    await evaluate(
      cdp,
      `
      (() => {
        const channelId =
          ${JSON.stringify(
            SELECTED_CHANNEL_ID
          )};

        const radio =
          document.querySelector(
            'input[name="channelId"][value="' +
              channelId.replace(/"/g, '\\\\\\"') +
              '"]'
          );

        if (!radio) {
          return {
            success: false,
            error:
              "Selected channel was not found on AtoPlay."
          };
        }

        radio.click();

        radio.dispatchEvent(
          new Event("change", {
            bubbles: true
          })
        );

        return {
          success: true,
          checked:
            radio.checked,
          value:
            radio.value
        };
      })()
      `
    );

  console.log(
    result
  );

  if (!result?.success) {
    throw new Error(
      result?.error ||
        "Could not select the AtoPlay channel."
    );
  }

  await sleep(1000);
}

async function uploadVideo(
  cdp
) {
  console.log("");
  console.log(
    "STEP 2: Uploading video..."
  );

  const videoSelector =
    'input[type="file"][accept*="video/mp4"]';

  const found =
    await waitForElement(
      cdp,
      videoSelector,
      10000
    );

  if (!found) {
    throw new Error(
      "AtoPlay video upload input was not found."
    );
  }

  await setFileInput(
    cdp,
    videoSelector,
    VIDEO_FILE
  );

  console.log(
    "Video uploaded successfully."
  );

  await sleep(2000);
}

async function uploadThumbnail(
  cdp
) {
  const thumbnail =
    findThumbnail();

  if (!thumbnail) {
    console.log(
      "Thumbnail: none found, continuing without custom thumbnail."
    );

    return;
  }

  console.log(
    `Thumbnail: ${thumbnail}`
  );

  const selector =
    'input[type="file"][accept*="image/jpeg"]';

  const found =
    await waitForElement(
      cdp,
      selector,
      5000
    );

  if (!found) {
    console.log(
      "Thumbnail input not found. Continuing without thumbnail."
    );

    return;
  }

  try {
    await setFileInput(
      cdp,
      selector,
      thumbnail
    );

    console.log(
      "Thumbnail uploaded successfully."
    );
  } catch (error) {
    console.log(
      "Thumbnail upload skipped:",
      error.message
    );
  }
}

async function fillMetadata(
  cdp,
  title,
  description
) {
  console.log("");
  console.log(
    "STEP 3: Filling title and description..."
  );

  const titleSelector =
    'input[name="title"]';

  const descriptionSelector =
    'textarea[name="description"]';

  const titleFound =
    await waitForElement(
      cdp,
      titleSelector,
      10000
    );

  if (!titleFound) {
    throw new Error(
      "AtoPlay title field was not found."
    );
  }

  const descriptionFound =
    await waitForElement(
      cdp,
      descriptionSelector,
      10000
    );

  if (!descriptionFound) {
    throw new Error(
      "AtoPlay description field was not found."
    );
  }

  const safeTitle =
    title.slice(0, 70);

  const safeDescription =
    description.slice(0, 400);

  const titleResult =
    await setInputValue(
      cdp,
      titleSelector,
      safeTitle
    );

  const descriptionResult =
    await setInputValue(
      cdp,
      descriptionSelector,
      safeDescription
    );

  console.log({
    title: titleResult.value,
    description:
      descriptionResult.value
  });

  await sleep(1000);
}

async function confirmCopyright(
  cdp
) {
  console.log("");
  console.log(
    "STEP 4: Confirming copyright..."
  );

  const result =
    await evaluate(
      cdp,
      `
      (() => {
        const checkbox =
          document.querySelector(
            'input[name="agreeToCopyright"]'
          );

        if (!checkbox) {
          return {
            success: false,
            error:
              "Copyright checkbox not found."
          };
        }

        if (!checkbox.checked) {
          checkbox.click();
        }

        checkbox.dispatchEvent(
          new Event("change", {
            bubbles: true
          })
        );

        return {
          success: true,
          checked:
            checkbox.checked
        };
      })()
      `
    );

  console.log(
    result
  );

  if (!result?.success) {
    throw new Error(
      result?.error ||
        "Could not confirm copyright."
    );
  }

  await sleep(1000);
}

async function getPublishState(
  cdp
) {
  return await evaluate(
    cdp,
    `
    (() => {
      const buttons =
        Array.from(
          document.querySelectorAll(
            "button"
          )
        );

      const publish =
        buttons.find(
          (button) =>
            (button.innerText || "")
              .trim()
              .toLowerCase()
              .includes("publish")
        );

      if (!publish) {
        return {
          found: false,
          disabled: null,
          text: null
        };
      }

      return {
        found: true,
        disabled:
          !!publish.disabled,
        text:
          (publish.innerText || "")
            .trim()
      };
    })()
    `
  );
}

async function publishVideo(
  cdp
) {
  console.log("");
  console.log(
    "STEP 5: Checking Publish button..."
  );

  const start =
    Date.now();

  let publishState;

  while (
    Date.now() - start <
    15000
  ) {
    publishState =
      await getPublishState(
        cdp
      );

    console.log(
      "Publish state:",
      publishState
    );

    if (
      publishState.found &&
      !publishState.disabled
    ) {
      break;
    }

    await sleep(500);
  }

  if (
    !publishState?.found
  ) {
    throw new Error(
      "Publish button was not found."
    );
  }

  if (
    publishState.disabled
  ) {
    throw new Error(
      "Publish button is still disabled."
    );
  }

  console.log(
    "STEP 5: Publishing video..."
  );

  const result =
    await evaluate(
      cdp,
      `
      (() => {
        const buttons =
          Array.from(
            document.querySelectorAll(
              "button"
            )
          );

        const publish =
          buttons.find(
            (button) =>
              (button.innerText || "")
                .trim()
                .toLowerCase()
                .includes("publish")
          );

        if (!publish) {
          return {
            success: false,
            error:
              "Publish button disappeared."
          };
        }

        publish.click();

        return {
          success: true
        };
      })()
      `
    );

  if (!result?.success) {
    throw new Error(
      result?.error ||
        "Could not click Publish."
    );
  }

  await sleep(5000);

  const pageInfo =
    await evaluate(
      cdp,
      `
      (() => ({
        url: location.href,
        text:
          (document.body?.innerText || "")
            .slice(-3000)
      }))()
      `
    );

  return pageInfo;
}

async function main() {
  console.log("");
  console.log(
    "======================================"
  );
  console.log(
    "       AtoPlay Auto Uploader"
  );
  console.log(
    "======================================"
  );
  console.log("");

  if (!SELECTED_CHANNEL_ID) {
    throw new Error(
      "No channel selected. ATOPLAY_CHANNEL_ID is missing."
    );
  }

  if (!fs.existsSync(VIDEO_FILE)) {
    throw new Error(
      `Video file not found: ${VIDEO_FILE}`
    );
  }

  const title =
    readText(
      TITLE_FILE,
      "AI Generated Video"
    );

  const description =
    readText(
      DESCRIPTION_FILE,
      "Generated automatically by AI Video Autopilot."
    );

  console.log(
    `TITLE: ${title}`
  );

  console.log(
    `DESCRIPTION: ${description}`
  );

  console.log(
    `VIDEO: ${VIDEO_FILE}`
  );

  console.log(
    `CHANNEL ID: ${SELECTED_CHANNEL_ID}`
  );

  const page =
    await findAtoPlayPage();

  console.log("");
  console.log(
    "AtoPlay Chrome page found:"
  );
  console.log(
    page.url
  );

  const cdp =
    await connectCDP(
      page.webSocketDebuggerUrl
    );

  try {
    await cdp.send(
      "Runtime.enable"
    );

    await navigateToUploadPage(
      cdp
    );

    await selectChannel(
      cdp
    );

    await uploadVideo(
      cdp
    );

    await uploadThumbnail(
      cdp
    );

    await fillMetadata(
      cdp,
      title,
      description
    );

    await confirmCopyright(
      cdp
    );

    const pageInfo =
      await publishVideo(
        cdp
      );

    console.log("");
    console.log(
      "======================================"
    );
    console.log(
      "UPLOAD SUCCESSFUL"
    );
    console.log(
      "======================================"
    );

    console.log(
      `Channel ID: ${SELECTED_CHANNEL_ID}`
    );

    console.log(
      "AtoPlay has accepted the upload."
    );

    if (pageInfo?.url) {
      console.log(
        `Current page: ${pageInfo.url}`
      );
    }

    console.log(
      "======================================"
    );
    console.log("");
  } finally {
    cdp.close();
  }
}

main().catch((error) => {
  console.error("");
  console.error(
    "======================================"
  );
  console.error(
    "UPLOAD FAILED"
  );
  console.error(
    "======================================"
  );
  console.error(
    error.message
  );
  console.error(
    "======================================"
  );

  process.exitCode = 1;
});