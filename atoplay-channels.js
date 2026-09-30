// atoplay-channels.js
// Reads all available AtoPlay channels from the already logged-in Chrome session.
// Does NOT store or request your AtoPlay password.

const CHROME_CDP_URL = "http://127.0.0.1:9222";
const ATOPLAY_UPLOAD_URL = "https://atoplay.com/video-upload";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getChromePages() {
  const response = await fetch(`${CHROME_CDP_URL}/json/list`);

  if (!response.ok) {
    throw new Error(
      `Chrome CDP is not responding. Start Chrome with start-chrome.bat first. HTTP ${response.status}`
    );
  }

  return await response.json();
}

function createCDPClient(webSocketUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketUrl);

    let nextId = 1;
    const pending = new Map();

    const cleanup = () => {
      for (const [, item] of pending) {
        item.reject(new Error("Chrome CDP connection closed."));
      }
      pending.clear();
    };

    socket.addEventListener("open", () => {
      const send = (method, params = {}) => {
        return new Promise((resolveCommand, rejectCommand) => {
          const id = nextId++;

          pending.set(id, {
            resolve: resolveCommand,
            reject: rejectCommand
          });

          socket.send(
            JSON.stringify({
              id,
              method,
              params
            })
          );
        });
      };

      socket.addEventListener("message", event => {
        try {
          const message = JSON.parse(event.data);

          if (!message.id) {
            return;
          }

          const item = pending.get(message.id);

          if (!item) {
            return;
          }

          pending.delete(message.id);

          if (message.error) {
            item.reject(
              new Error(
                `${message.error.message || "CDP command failed"}`
              )
            );
            return;
          }

          item.resolve(message.result || {});
        } catch (error) {
          console.error("CDP message error:", error.message);
        }
      });

      socket.addEventListener("close", cleanup);
      socket.addEventListener("error", cleanup);

      resolve({
        send,

        close() {
          try {
            socket.close();
          } catch {
            // Ignore close errors.
          }
        }
      });
    });

    socket.addEventListener("error", () => {
      reject(
        new Error(
          "Could not connect to Chrome CDP. Make sure start-chrome.bat is running."
        )
      );
    });
  });
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

async function findAtoPlayPage() {
  const pages = await getChromePages();

  const candidates = pages.filter(page => {
    return (
      page.type === "page" &&
      typeof page.webSocketDebuggerUrl === "string"
    );
  });

  const atoplayPage = candidates.find(page =>
    String(page.url || "").includes("atoplay.com")
  );

  if (!atoplayPage) {
    throw new Error(
      "No AtoPlay tab was found in the Chrome started with start-chrome.bat."
    );
  }

  return atoplayPage;
}

async function extractChannels(cdp) {
  const expression = `
    (() => {
      const radios = Array.from(
        document.querySelectorAll('input[name="channelId"]')
      );

      return radios.map((radio, index) => {
        let name = "";

        const label =
          radio.closest("label") ||
          document.querySelector('label[for="' + radio.id + '"]');

        if (label) {
          name = label.innerText || label.textContent || "";
        }

        if (!name) {
          const parent =
            radio.parentElement?.parentElement ||
            radio.parentElement;

          if (parent) {
            name = parent.innerText || parent.textContent || "";
          }
        }

        return {
          index,
          channelId: radio.value || "",
          name: name
            .replace(/\\\\s+/g, " ")
            .trim()
        };
      });
    })()
  `;

  const result = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true
  });

  return result?.result?.value || [];
}

async function getAtoPlayChannels() {
  const page = await findAtoPlayPage();

  console.log("AtoPlay Chrome page found:");
  console.log(page.url);
  console.log("");

  const cdp = await createCDPClient(page.webSocketDebuggerUrl);

  try {
    await cdp.send("Runtime.enable");

    console.log("Opening AtoPlay video upload page...");

    await cdp.send("Page.enable");

    await cdp.send("Page.navigate", {
      url: ATOPLAY_UPLOAD_URL
    });

    await sleep(5000);

    console.log("Checking AtoPlay login/session...");

    const currentPage = await cdp.send("Runtime.evaluate", {
      expression: "location.href",
      returnByValue: true
    });

    console.log("Current page:", currentPage?.result?.value || "unknown");
    console.log("");

    await sleep(3000);

    const channels = await extractChannels(cdp);

    if (!channels.length) {
      const pageInfo = await cdp.send("Runtime.evaluate", {
        expression: `
          (() => ({
            url: location.href,
            title: document.title,
            bodyText: (document.body?.innerText || "").slice(0, 2000)
          }))()
        `,
        returnByValue: true
      });

      const info = pageInfo?.result?.value || {};

      console.log("No channel radio buttons were found.");
      console.log("");
      console.log("Page URL:", info.url || "");
      console.log("Page title:", info.title || "");
      console.log("");
      console.log("Visible page text:");
      console.log(info.bodyText || "(nothing)");
      console.log("");

      throw new Error(
        "AtoPlay channels could not be detected. Make sure you are logged into AtoPlay in this Chrome session."
      );
    }

    const cleanedChannels = channels
      .map(channel => ({
        channelId: cleanText(channel.channelId),
        name: cleanText(channel.name)
      }))
      .filter(channel => channel.channelId);

    // Remove duplicates.
    const uniqueChannels = [];
    const seen = new Set();

    for (const channel of cleanedChannels) {
      if (seen.has(channel.channelId)) {
        continue;
      }

      seen.add(channel.channelId);
      uniqueChannels.push(channel);
    }

    return uniqueChannels;
  } finally {
    cdp.close();
  }
}

async function main() {
  console.log("");
  console.log("========================================");
  console.log("       AtoPlay Channel Discovery");
  console.log("========================================");
  console.log("");

  try {
    const channels = await getAtoPlayChannels();

    console.log("");
    console.log(`Found ${channels.length} AtoPlay channel(s):`);
    console.log("");

    channels.forEach((channel, index) => {
      console.log(`${index + 1}. ${channel.name || "Unnamed Channel"}`);
      console.log(`   Channel ID: ${channel.channelId}`);
      console.log("");
    });

    console.log("Channel discovery successful.");
    console.log("");
  } catch (error) {
    console.error("");
    console.error("CHANNEL DISCOVERY FAILED");
    console.error(error.message);
    console.error("");

    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  getAtoPlayChannels
};