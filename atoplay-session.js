const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const http = require("http");
const { spawn } = require("child_process");

const PROJECT_DIR = __dirname;

const SESSION_ROOT = path.join(
  PROJECT_DIR,
  "atoplay-user-sessions"
);

const PORT_REGISTRY_FILE = path.join(
  SESSION_ROOT,
  "port-registry.json"
);

const CHROME_PATH =
  process.env.CHROME_PATH ||
  String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;

const BASE_PORT = 9400;
const PORT_COUNT = 5000;

const chromeProcesses = new Map();

fs.mkdirSync(
  SESSION_ROOT,
  {
    recursive: true
  }
);


/*
========================================================
USER HELPERS
========================================================
*/

function normalizeUserId(userId) {
  return String(
    userId || "unknown"
  ).trim();
}


function hashUserId(userId) {
  return crypto
    .createHash("sha256")
    .update(
      normalizeUserId(userId)
    )
    .digest("hex");
}


function sanitizeUserId(userId) {
  return hashUserId(userId)
    .slice(0, 16);
}


/*
========================================================
PORT REGISTRY
========================================================
*/

function loadPortRegistry() {
  try {
    if (
      !fs.existsSync(
        PORT_REGISTRY_FILE
      )
    ) {
      return {};
    }

    const raw =
      fs.readFileSync(
        PORT_REGISTRY_FILE,
        "utf8"
      );

    const data =
      JSON.parse(raw);

    if (
      data &&
      typeof data === "object"
    ) {
      return data;
    }

    return {};
  } catch (error) {
    console.warn(
      "Could not load port registry:",
      error.message
    );

    return {};
  }
}


function savePortRegistry(registry) {
  const tempFile =
    `${PORT_REGISTRY_FILE}.tmp`;

  fs.writeFileSync(
    tempFile,
    JSON.stringify(
      registry,
      null,
      2
    ),
    "utf8"
  );

  fs.renameSync(
    tempFile,
    PORT_REGISTRY_FILE
  );
}


function getAtoPlayCdpPort(userId) {
  const registry =
    loadPortRegistry();

  const key =
    hashUserId(userId);

  if (
    Number.isInteger(
      registry[key]
    )
  ) {
    return registry[key];
  }

  const digest =
    crypto
      .createHash("sha256")
      .update(
        normalizeUserId(userId)
      )
      .digest();

  const number =
    (
      (digest[0] << 24) |
      (digest[1] << 16) |
      (digest[2] << 8) |
      digest[3]
    ) >>> 0;

  const usedPorts =
    new Set(
      Object.values(
        registry
      )
      .map(Number)
      .filter(
        Number.isInteger
      )
    );

  let port =
    BASE_PORT +
    (
      number %
      PORT_COUNT
    );

  for (
    let i = 0;
    i < PORT_COUNT;
    i++
  ) {
    if (
      !usedPorts.has(
        port
      )
    ) {
      break;
    }

    port =
      BASE_PORT +
      (
        (
          port -
          BASE_PORT +
          1
        ) %
        PORT_COUNT
      );
  }

  registry[key] =
    port;

  savePortRegistry(
    registry
  );

  return port;
}


function getProfileDir(userId) {
  return path.join(
    SESSION_ROOT,
    `user-${sanitizeUserId(userId)}`
  );
}


/*
========================================================
CHROME HTTP
========================================================
*/

function getJson(
  port,
  endpoint
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {

      const request =
        http.get(
          {
            hostname:
              "127.0.0.1",

            port,

            path:
              endpoint,

            timeout:
              5000
          },

          response => {

            let body = "";

            response.on(
              "data",
              chunk => {
                body +=
                  chunk.toString();
              }
            );

            response.on(
              "end",
              () => {

                try {

                  resolve(
                    JSON.parse(
                      body
                    )
                  );

                } catch {

                  reject(
                    new Error(
                      `Invalid Chrome response from ${endpoint}`
                    )
                  );

                }

              }
            );

          }
        );

      request.on(
        "timeout",
        () => {

          request.destroy(
            new Error(
              "Chrome DevTools request timed out."
            )
          );

        }
      );

      request.on(
        "error",
        reject
      );

    }
  );
}


async function isChromeReady(
  port
) {
  try {

    await getJson(
      port,
      "/json/version"
    );

    return true;

  } catch {

    return false;

  }
}


async function waitForChrome(
  port,
  timeoutMs = 15000
) {

  const start =
    Date.now();

  while (
    Date.now() -
      start <
    timeoutMs
  ) {

    if (
      await isChromeReady(
        port
      )
    ) {

      return true;

    }

    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          300
        )
    );

  }

  return false;

}


/*
========================================================
START CHROME FOR ONE WEBSITE USER
========================================================
*/

async function startChromeForUser(
  userId
) {

  const port =
    getAtoPlayCdpPort(
      userId
    );

  const profileDir =
    getProfileDir(
      userId
    );


  if (
    await isChromeReady(
      port
    )
  ) {

    return {

      port,

      profileDir,

      alreadyRunning:
        true

    };

  }


  fs.mkdirSync(
    profileDir,
    {
      recursive:
        true
    }
  );


  console.log("");
  console.log(
    "======================================"
  );
  console.log(
    "STARTING ATOPLAY CHROME"
  );
  console.log(
    "======================================"
  );
  console.log(
    `CDP Port: ${port}`
  );
  console.log(
    `Profile: ${profileDir}`
  );
  console.log(
    "======================================"
  );


  const child =
    spawn(
      CHROME_PATH,
      [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profileDir}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-sync",
        "https://atoplay.com/login"
      ],
      {
        detached:
          true,

        stdio:
          "ignore",

        windowsHide:
          false
      }
    );


  child.unref();


  chromeProcesses.set(
    normalizeUserId(
      userId
    ),
    child
  );


  const ready =
    await waitForChrome(
      port
    );


  if (!ready) {

    throw new Error(
      `Chrome did not start on port ${port}.`
    );

  }


  console.log(
    "AtoPlay Chrome started successfully."
  );


  return {

    port,

    profileDir,

    alreadyRunning:
      false

  };

}


/*
========================================================
CDP
========================================================
*/

function getWebSocketClass() {

  try {

    return require("ws");

  } catch {

    throw new Error(
      "The ws package is missing. Run: npm.cmd install ws"
    );

  }

}


function cdpCommand(
  webSocketUrl,
  method,
  params = {}
) {

  const WebSocket =
    getWebSocketClass();


  return new Promise(
    (
      resolve,
      reject
    ) => {

      const socket =
        new WebSocket(
          webSocketUrl
        );


      const commandId =
        1;


      const timer =
        setTimeout(
          () => {

            try {
              socket.close();
            } catch {}

            reject(
              new Error(
                `CDP timeout: ${method}`
              )
            );

          },
          15000
        );


      socket.on(
        "open",
        () => {

          socket.send(
            JSON.stringify(
              {
                id:
                  commandId,

                method,

                params
              }
            )
          );

        }
      );


      socket.on(
        "message",
        data => {

          try {

            const message =
              JSON.parse(
                data.toString()
              );


            if (
              message.id !==
              commandId
            ) {

              return;

            }


            clearTimeout(
              timer
            );


            try {
              socket.close();
            } catch {}


            if (
              message.error
            ) {

              reject(
                new Error(
                  message.error.message ||
                  `CDP error: ${method}`
                )
              );

              return;

            }


            resolve(
              message.result ||
              {}
            );

          } catch (
            error
          ) {

            clearTimeout(
              timer
            );

            try {
              socket.close();
            } catch {}

            reject(
              error
            );

          }

        }
      );


      socket.on(
        "error",
        error => {

          clearTimeout(
            timer
          );

          try {
            socket.close();
          } catch {}

          reject(
            error
          );

        }
      );

    }
  );

}


async function evaluateTab(
  tab,
  expression
) {

  const result =
    await cdpCommand(
      tab.webSocketDebuggerUrl,
      "Runtime.evaluate",
      {
        expression,

        returnByValue:
          true,

        awaitPromise:
          true
      }
    );


  return (
    result
      ?.result
      ?.value
  );

}


/*
========================================================
CHROME TABS
========================================================
*/

async function getChromeTabs(
  port
) {

  const tabs =
    await getJson(
      port,
      "/json/list"
    );


  if (
    !Array.isArray(
      tabs
    )
  ) {

    return [];

  }


  return tabs.filter(
    tab =>
      tab &&
      tab.type ===
        "page" &&
      tab.webSocketDebuggerUrl
  );

}


async function getAtoPlayTab(
  port
) {

  const tabs =
    await getChromeTabs(
      port
    );


  return (
    tabs.find(
      tab =>
        String(
          tab.url ||
          ""
        ).includes(
          "atoplay.com"
        )
    ) ||
    null
  );

}


/*
========================================================
NAVIGATE
========================================================
*/

async function navigateTab(
  tab,
  url
) {

  await cdpCommand(
    tab.webSocketDebuggerUrl,
    "Page.enable"
  );


  await cdpCommand(
    tab.webSocketDebuggerUrl,
    "Page.navigate",
    {
      url
    }
  );

}


/*
========================================================
WAIT FOR CONDITION
========================================================
*/

async function waitForCondition(
  tab,
  expression,
  timeoutMs = 15000
) {

  const start =
    Date.now();


  while (
    Date.now() -
      start <
    timeoutMs
  ) {

    try {

      const result =
        await evaluateTab(
          tab,
          expression
        );


      if (result) {

        return true;

      }

    } catch {}


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
VERIFY ATOPLAY LOGIN
========================================================

We execute the request inside the user's own
AtoPlay browser tab.

The server never receives or stores the token.
========================================================
*/

async function verifyAtoPlayAuthentication(
  tab
) {

  const expression = `
    (async () => {

      function extractUser(data) {

        const user =
          data?.user ||
          data?.data ||
          data;


        if (
          !user ||
          !user.id
        ) {

          return null;

        }


        return {

          id:
            String(
              user.id
            ),

          email:
            String(
              user.email ||
              ""
            ),

          fname:
            String(
              user.fname ||
              ""
            ),

          lname:
            String(
              user.lname ||
              ""
            ),

          role:
            String(
              user.role ||
              ""
            ),

          isSuspended:
            !!user.isSuspended

        };

      }


      /*
      ============================================
      METHOD 1
      Normal browser session
      ============================================
      */

      try {

        const response =
          await fetch(
            "https://api.atoplay.com/api/users/me",
            {
              method:
                "GET",

              credentials:
                "include",

              headers: {
                "Accept":
                  "application/json"
              }
            }
          );


        const text =
          await response.text();


        let data =
          null;


        try {

          data =
            JSON.parse(
              text
            );

        } catch {}


        const user =
          extractUser(
            data
          );


        if (
          response.ok &&
          user
        ) {

          return {

            authenticated:
              true,

            user

          };

        }

      } catch {}


      /*
      ============================================
      METHOD 2
      Find authentication token in browser
      storage and test it directly.

      The token remains inside this page.
      ============================================
      */

      const tokens =
        [];


      function addToken(
        value
      ) {

        if (
          typeof value !==
          "string"
        ) {

          return;

        }


        const token =
          value.trim();


        if (
          token.length <
          20
        ) {

          return;

        }


        if (
          !tokens.includes(
            token
          )
        ) {

          tokens.push(
            token
          );

        }

      }


      function inspectStorage(
        storage
      ) {

        try {

          for (
            let i = 0;
            i < storage.length;
            i++
          ) {

            const key =
              storage.key(i);


            if (!key) {
              continue;
            }


            const value =
              storage.getItem(
                key
              );


            if (!value) {
              continue;
            }


            const keyLower =
              String(
                key
              ).toLowerCase();


            if (
              /token|auth|access|jwt|session|credential|bearer/
                .test(
                  keyLower
                )
            ) {

              if (
                value.length >=
                20
              ) {

                addToken(
                  value
                );

              }

            }


            /*
            Some apps store auth data
            inside JSON.
            */

            if (
              value.startsWith(
                "{"
              )
            ) {

              try {

                const parsed =
                  JSON.parse(
                    value
                  );


                function walk(
                  node,
                  keyName
                ) {

                  if (
                    typeof node ===
                    "string"
                  ) {

                    if (
                      /token|auth|access|jwt|session|credential|bearer/
                        .test(
                          String(
                            keyName ||
                            ""
                          ).toLowerCase()
                        )
                    ) {

                      addToken(
                        node
                      );

                    }


                    return;

                  }


                  if (
                    Array.isArray(
                      node
                    )
                  ) {

                    for (
                      const item
                      of node
                    ) {

                      walk(
                        item,
                        keyName
                      );

                    }


                    return;

                  }


                  if (
                    node &&
                    typeof node ===
                      "object"
                  ) {

                    for (
                      const [
                        childKey,
                        childValue
                      ]
                      of Object.entries(
                        node
                      )
                    ) {

                      walk(
                        childValue,
                        childKey
                      );

                    }

                  }

                }


                walk(
                  parsed,
                  ""
                );

              } catch {}

            }

          }

        } catch {}

      }


      inspectStorage(
        window.localStorage
      );


      inspectStorage(
        window.sessionStorage
      );


      /*
      ============================================
      Try token as Bearer
      ============================================
      */

      for (
        const token
        of tokens
      ) {

        try {

          const response =
            await fetch(
              "https://api.atoplay.com/api/users/me",
              {
                method:
                  "GET",

                credentials:
                  "include",

                headers: {

                  "Accept":
                    "application/json",

                  "Authorization":
                    "Bearer " +
                    token

                }

              }
            );


          const text =
            await response.text();


          let data =
            null;


          try {

            data =
              JSON.parse(
                text
              );

          } catch {}


          const user =
            extractUser(
              data
            );


          if (
            response.ok &&
            user
          ) {

            return {

              authenticated:
                true,

              user

            };

          }

        } catch {}

      }


      /*
      ============================================
      Try raw authorization value
      ============================================
      */

      for (
        const token
        of tokens
      ) {

        try {

          const response =
            await fetch(
              "https://api.atoplay.com/api/users/me",
              {
                method:
                  "GET",

                credentials:
                  "include",

                headers: {

                  "Accept":
                    "application/json",

                  "Authorization":
                    token

                }

              }
            );


          const text =
            await response.text();


          let data =
            null;


          try {

            data =
              JSON.parse(
                text
              );

          } catch {}


          const user =
            extractUser(
              data
            );


          if (
            response.ok &&
            user
          ) {

            return {

              authenticated:
                true,

              user

            };

          }

        } catch {}

      }


      return {

        authenticated:
          false

      };

    })()
  `;


  return await evaluateTab(
    tab,
    expression
  );

}


/*
========================================================
CONNECT ATOPLAY
========================================================
*/

async function connectAtoPlayAccount(
  userId,
  email = ""
) {

  const browser =
    await startChromeForUser(
      userId
    );


  console.log("");
  console.log(
    "======================================"
  );
  console.log(
    "ATOPLAY LOGIN REQUIRED"
  );
  console.log(
    "======================================"
  );
  console.log(
    "Complete the AtoPlay login in the opened Chrome window."
  );
  console.log(
    "Then return to the website and click Check Connection."
  );
  console.log(
    "======================================"
  );


  return {

    success:
      true,

    connected:
      false,

    needsManualLogin:
      true,

    email:
      email || "",

    cdpPort:
      browser.port,

    profileDir:
      browser.profileDir,

    message:
      "AtoPlay Chrome opened. Complete the login there, then click Check Connection."

  };

}


/*
========================================================
STATUS
========================================================
*/

async function getAtoPlayStatusForUser(
  userId
) {

  const port =
    getAtoPlayCdpPort(
      userId
    );


  if (
    !(await isChromeReady(
      port
    ))
  ) {

    return {

      connected:
        false,

      email:
        "",

      cdpPort:
        port,

      account:
        null

    };

  }


  const tab =
    await getAtoPlayTab(
      port
    );


  if (!tab) {

    return {

      connected:
        false,

      email:
        "",

      cdpPort:
        port,

      account:
        null

    };

  }


  const url =
    String(
      tab.url ||
      ""
    );


  if (
    url.includes(
      "/login"
    )
  ) {

    return {

      connected:
        false,

      email:
        "",

      cdpPort:
        port,

      url,

      account:
        null

    };

  }


  const auth =
    await verifyAtoPlayAuthentication(
      tab
    );


  if (
    !auth?.authenticated ||
    !auth.user
  ) {

    return {

      connected:
        false,

      email:
        "",

      cdpPort:
        port,

      url,

      account:
        null

    };

  }


  return {

    connected:
      true,

    email:
      auth.user.email ||
      "",

    cdpPort:
      port,

    url,

    account:
      auth.user

  };

}


/*
========================================================
CHANNEL DISCOVERY
========================================================
*/

async function getAtoPlayChannelsForUser(
  userId
) {

  const status =
    await getAtoPlayStatusForUser(
      userId
    );


  if (
    !status.connected
  ) {

    throw new Error(
      "AtoPlay is not connected. Complete the AtoPlay login first."
    );

  }


  const port =
    getAtoPlayCdpPort(
      userId
    );


  let tab =
    await getAtoPlayTab(
      port
    );


  if (!tab) {

    throw new Error(
      "AtoPlay browser tab was not found."
    );

  }


  await navigateTab(
    tab,
    "https://atoplay.com/video-upload"
  );


  await new Promise(
    resolve =>
      setTimeout(
        resolve,
        2500
      )
  );


  tab =
    await getAtoPlayTab(
      port
    );


  if (!tab) {

    throw new Error(
      "AtoPlay upload page was not found."
    );

  }


  const currentUrl =
    String(
      tab.url ||
      ""
    );


  if (
    currentUrl.includes(
      "/login"
    )
  ) {

    throw new Error(
      "AtoPlay login session is no longer active."
    );

  }


  await waitForCondition(
    tab,
    `
      document.querySelectorAll(
        'input[name="channelId"]'
      ).length > 0
    `,
    15000
  );


  tab =
    await getAtoPlayTab(
      port
    );


  if (!tab) {

    throw new Error(
      "Could not find the AtoPlay upload page."
    );

  }


  const channels =
    await evaluateTab(
      tab,
      `
        (() => {

          const inputs = [
            ...document.querySelectorAll(
              'input[name="channelId"]'
            )
          ];


          return inputs
            .map(
              input => {

                const id =
                  String(
                    input.value ||
                    ""
                  ).trim();


                if (!id) {

                  return null;

                }


                const label =
                  input.closest(
                    "label"
                  ) ||
                  input.parentElement?.closest(
                    "label"
                  );


                let name =
                  (
                    label?.innerText ||
                    input.parentElement?.innerText ||
                    input.parentElement?.parentElement?.innerText ||
                    ""
                  )
                  .replace(
                    /\\s+/g,
                    " "
                  )
                  .trim();


                if (!name) {

                  name =
                    "AtoPlay Channel";

                }


                return {

                  id,

                  channelId:
                    id,

                  name,

                  label:
                    name,

                  title:
                    name

                };

              }
            )
            .filter(
              Boolean
            );

        })()
      `
    );


  if (
    !Array.isArray(
      channels
    )
  ) {

    return [];

  }


  const unique =
    new Map();


  for (
    const channel
    of channels
  ) {

    if (
      channel?.id
    ) {

      unique.set(
        channel.id,
        channel
      );

    }

  }


  const result =
    [...unique.values()];


  console.log("");
  console.log(
    "======================================"
  );
  console.log(
    "ATOPLAY CHANNELS FOUND"
  );
  console.log(
    "======================================"
  );


  for (
    const channel
    of result
  ) {

    console.log(
      `${channel.name} | ${channel.id}`
    );

  }


  console.log(
    "======================================"
  );


  return result;

}


/*
========================================================
CLOSE SESSION
========================================================
*/

async function closeAtoPlaySession(
  userId
) {

  const userKey =
    normalizeUserId(
      userId
    );


  const port =
    getAtoPlayCdpPort(
      userId
    );


  try {

    if (
      await isChromeReady(
        port
      )
    ) {

      const version =
        await getJson(
          port,
          "/json/version"
        );


      if (
        version?.webSocketDebuggerUrl
      ) {

        await cdpCommand(
          version.webSocketDebuggerUrl,
          "Browser.close"
        );

      }

    }

  } catch (
    error
  ) {

    console.warn(
      "Could not close Chrome through CDP:",
      error.message
    );

  }


  const child =
    chromeProcesses.get(
      userKey
    );


  if (
    child?.pid
  ) {

    try {

      process.kill(
        child.pid
      );

    } catch {}


    chromeProcesses.delete(
      userKey
    );

  }


  return {

    success:
      true

  };

}


/*
========================================================
EXPORTS
========================================================
*/

module.exports = {

  connectAtoPlayAccount,

  getAtoPlayStatusForUser,

  getAtoPlayChannelsForUser,

  closeAtoPlaySession,

  getAtoPlayCdpPort,

  getProfileDir

};