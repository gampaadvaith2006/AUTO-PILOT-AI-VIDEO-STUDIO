require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { OAuth2Client } = require("google-auth-library");

const {
  connectAtoPlayAccount,
  getAtoPlayStatusForUser,
  getAtoPlayChannelsForUser,
  closeAtoPlaySession,
  getAtoPlayCdpPort
} = require("./atoplay-session");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const PROJECT_DIR = __dirname;

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID;

const SESSION_SECRET =
  process.env.SESSION_SECRET;

const VIDEO_SCRIPT =
  path.join(
    PROJECT_DIR,
    "full-video-test.js"
  );

const ATOPLAY_SCRIPT =
  path.join(
    PROJECT_DIR,
    "atoplay-upload.js"
  );

const FINAL_VIDEO =
  path.join(
    PROJECT_DIR,
    "assets",
    "output",
    "full-ai-video.mp4"
  );

const TITLE_FILE =
  path.join(
    PROJECT_DIR,
    "generated-title.txt"
  );

const DESCRIPTION_FILE =
  path.join(
    PROJECT_DIR,
    "generated-description.txt"
  );

const ATOPLAY_BINDINGS_FILE =
  path.join(
    PROJECT_DIR,
    "atoplay-bindings.json"
  );

const MIN_VIDEO_DURATION = 65;


/*
========================================================
STARTUP
========================================================
*/

function failStartup(message) {
  console.error("");
  console.error("STARTUP ERROR");
  console.error(message);
  console.error("");
  process.exit(1);
}

if (!GOOGLE_CLIENT_ID) {
  failStartup(
    "GOOGLE_CLIENT_ID is missing in .env"
  );
}

if (!SESSION_SECRET) {
  failStartup(
    "SESSION_SECRET is missing in .env"
  );
}

if (!fs.existsSync(VIDEO_SCRIPT)) {
  failStartup(
    `Missing file: ${VIDEO_SCRIPT}`
  );
}

if (!fs.existsSync(ATOPLAY_SCRIPT)) {
  failStartup(
    `Missing file: ${ATOPLAY_SCRIPT}`
  );
}

const googleClient =
  new OAuth2Client(
    GOOGLE_CLIENT_ID
  );


/*
========================================================
MIDDLEWARE
========================================================
*/

app.use(
  express.json({
    limit: "1mb"
  })
);

app.use(
  session({
    secret:
      SESSION_SECRET,

    resave:
      false,

    saveUninitialized:
      false,

    cookie: {
      httpOnly:
        true,

      secure:
        false,

      sameSite:
        "lax",

      maxAge:
        24 * 60 * 60 * 1000
    }
  })
);

app.use(
  express.static(
    PROJECT_DIR
  )
);


/*
========================================================
ATOPLAY BINDINGS
========================================================

Only non-sensitive binding information is stored here.

We DO NOT store:

- AtoPlay password
- Google password
- AtoPlay access token
- AtoPlay ID token
- cookies
- browser credentials

The actual authenticated browser session stays
inside the user's dedicated Chrome profile.
========================================================
*/

function loadAtoPlayBindings() {
  try {
    if (
      !fs.existsSync(
        ATOPLAY_BINDINGS_FILE
      )
    ) {
      return {};
    }

    const data =
      fs.readFileSync(
        ATOPLAY_BINDINGS_FILE,
        "utf8"
      );

    const parsed =
      JSON.parse(data);

    if (
      parsed &&
      typeof parsed === "object"
    ) {
      return parsed;
    }

    return {};
  } catch (error) {
    console.error(
      "Could not load AtoPlay bindings:",
      error.message
    );

    return {};
  }
}


function saveAtoPlayBindings(bindings) {
  const tempFile =
    `${ATOPLAY_BINDINGS_FILE}.tmp`;

  fs.writeFileSync(
    tempFile,
    JSON.stringify(
      bindings,
      null,
      2
    ),
    "utf8"
  );

  fs.renameSync(
    tempFile,
    ATOPLAY_BINDINGS_FILE
  );
}


function getUserBindingKey(userId) {
  return crypto
    .createHash("sha256")
    .update(
      String(userId)
    )
    .digest("hex");
}


function getAtoPlayBinding(userId) {
  const bindings =
    loadAtoPlayBindings();

  return (
    bindings[
      getUserBindingKey(userId)
    ] ||
    null
  );
}


function setAtoPlayBinding(
  userId,
  binding
) {
  const bindings =
    loadAtoPlayBindings();

  bindings[
    getUserBindingKey(userId)
  ] = {
    channelId:
      binding.channelId,

    channelName:
      binding.channelName,

    updatedAt:
      new Date().toISOString()
  };

  saveAtoPlayBindings(
    bindings
  );

  return bindings[
    getUserBindingKey(userId)
  ];
}


/*
========================================================
TEXT HELPERS
========================================================
*/

function readText(
  filePath,
  fallback
) {
  try {
    if (
      !fs.existsSync(
        filePath
      )
    ) {
      return fallback;
    }

    const value =
      fs.readFileSync(
        filePath,
        "utf8"
      ).trim();

    return (
      value ||
      fallback
    );
  } catch (error) {
    console.error(
      `Could not read ${filePath}:`,
      error.message
    );

    return fallback;
  }
}


/*
========================================================
RUN NODE SCRIPT
========================================================
*/

function runNodeScript(
  scriptPath,
  environment = {}
) {
  return new Promise(
    (resolve, reject) => {

      console.log("");
      console.log(
        "======================================"
      );
      console.log(
        "RUNNING SCRIPT"
      );
      console.log(
        path.basename(scriptPath)
      );
      console.log(
        "======================================"
      );

      const child =
        spawn(
          process.execPath,
          [scriptPath],
          {
            cwd:
              PROJECT_DIR,

            env: {
              ...process.env,
              ...environment
            },

            stdio: [
              "ignore",
              "pipe",
              "pipe"
            ],

            windowsHide:
              false
          }
        );

      let stdout = "";
      let stderr = "";

      child.stdout.on(
        "data",
        data => {
          const text =
            data.toString();

          stdout += text;

          process.stdout.write(
            text
          );
        }
      );

      child.stderr.on(
        "data",
        data => {
          const text =
            data.toString();

          stderr += text;

          process.stderr.write(
            text
          );
        }
      );

      child.on(
        "error",
        error => {
          reject(error);
        }
      );

      child.on(
        "close",
        (code, signal) => {

          console.log(
            `${path.basename(scriptPath)} finished | code=${code} | signal=${signal || "none"}`
          );

          if (code === 0) {
            resolve({
              stdout,
              stderr
            });

            return;
          }

          reject(
            new Error(
              `${path.basename(scriptPath)} failed with exit code ${code}` +
              (
                signal
                  ? ` and signal ${signal}`
                  : ""
              ) +
              `\n${stderr.slice(-5000)}`
            )
          );
        }
      );
    }
  );
}


/*
========================================================
FFPROBE
========================================================
*/

function findFFprobe() {

  if (
    process.env.FFPROBE_PATH
  ) {
    return process.env.FFPROBE_PATH;
  }

  const knownPath =
    String.raw`C:\Users\advaith\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffprobe.exe`;

  if (
    fs.existsSync(
      knownPath
    )
  ) {
    return knownPath;
  }

  return "ffprobe";
}


function getVideoDuration(
  videoPath
) {
  return new Promise(
    (resolve, reject) => {

      const child =
        spawn(
          findFFprobe(),
          [
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            videoPath
          ],
          {
            cwd:
              PROJECT_DIR,

            windowsHide:
              true,

            stdio: [
              "ignore",
              "pipe",
              "pipe"
            ]
          }
        );

      let stdout = "";
      let stderr = "";

      child.stdout.on(
        "data",
        data => {
          stdout +=
            data.toString();
        }
      );

      child.stderr.on(
        "data",
        data => {
          stderr +=
            data.toString();
        }
      );

      child.on(
        "error",
        reject
      );

      child.on(
        "close",
        code => {

          if (code !== 0) {
            reject(
              new Error(
                `ffprobe failed with code ${code}\n${stderr.trim()}`
              )
            );

            return;
          }

          const duration =
            Number(
              stdout.trim()
            );

          if (
            !Number.isFinite(
              duration
            )
          ) {
            reject(
              new Error(
                `Could not read video duration. ffprobe returned: ${stdout.trim()}`
              )
            );

            return;
          }

          resolve(
            duration
          );
        }
      );
    }
  );
}


/*
========================================================
GOOGLE LOGIN
========================================================
*/

app.post(
  "/auth/google",
  async (req, res) => {

    try {

      const credential =
        req.body &&
        req.body.credential;

      if (!credential) {

        return res.status(400).json({
          success:
            false,

          error:
            "Google credential is missing."
        });

      }

      const ticket =
        await googleClient.verifyIdToken({
          idToken:
            credential,

          audience:
            GOOGLE_CLIENT_ID
        });

      const payload =
        ticket.getPayload();

      if (
        !payload ||
        !payload.sub
      ) {

        return res.status(401).json({
          success:
            false,

          error:
            "Invalid Google login."
        });

      }

      req.session.user = {
        googleId:
          payload.sub,

        name:
          payload.name ||
          "Google User",

        email:
          payload.email ||
          "",

        picture:
          payload.picture ||
          ""
      };

      console.log("");
      console.log(
        "======================================"
      );
      console.log(
        "GOOGLE LOGIN SUCCESS"
      );
      console.log(
        `Name: ${req.session.user.name}`
      );
      console.log(
        `Email: ${req.session.user.email}`
      );
      console.log(
        "======================================"
      );

      return res.json({
        success:
          true,

        user:
          req.session.user
      });

    } catch (error) {

      console.error(
        "Google login failed:",
        error.message
      );

      return res.status(401).json({
        success:
          false,

        error:
          "Google authentication failed."
      });
    }
  }
);


/*
========================================================
CURRENT USER
========================================================
*/

app.get(
  "/auth/me",
  (req, res) => {

    if (
      !req.session.user
    ) {

      return res.json({
        loggedIn:
          false
      });

    }

    return res.json({
      loggedIn:
        true,

      user:
        req.session.user
    });
  }
);


/*
========================================================
LOGOUT
========================================================
*/

app.post(
  "/auth/logout",
  (req, res) => {

    const userId =
      req.session.user?.googleId;

    req.session.destroy(
      error => {

        if (error) {

          console.error(
            "Logout failed:",
            error.message
          );

          return res.status(500).json({
            success:
              false,

            error:
              "Logout failed."
          });

        }

        res.clearCookie(
          "connect.sid"
        );

        /*
        IMPORTANT:
        We do NOT delete the AtoPlay browser profile.
        That lets the user's AtoPlay session remain
        available for their next login.

        The user can explicitly disconnect later.
        */

        console.log(
          `Website logout completed for user ${userId || "unknown"}`
        );

        return res.json({
          success:
            true
        });

      }
    );
  }
);


/*
========================================================
LOGIN PROTECTION
========================================================
*/

function requireLogin(
  req,
  res,
  next
) {

  if (
    !req.session.user
  ) {

    return res.status(401).json({
      success:
        false,

      error:
        "Please sign in with Google first."
    });

  }

  next();
}


/*
========================================================
ATOPLAY CONNECT
========================================================

Starts the dedicated Chrome profile for this
website user.

The user completes the AtoPlay login manually
inside that dedicated Chrome window.
========================================================
*/

app.post(
  "/atoplay/connect",
  requireLogin,
  async (req, res) => {

    try {

      const userId =
        req.session.user.googleId;

      const result =
        await connectAtoPlayAccount(
          userId,
          req.session.user.email
        );

      return res.json({
        success:
          true,

        connected:
          result.connected,

        needsManualLogin:
          result.needsManualLogin,

        message:
          result.message,

        cdpPort:
          result.cdpPort
      });

    } catch (error) {

      console.error(
        "AtoPlay connect failed:",
        error.message
      );

      return res.status(500).json({
        success:
          false,

        error:
          error.message ||
          "Could not start AtoPlay connection."
      });
    }
  }
);


/*
========================================================
ATOPLAY STATUS
========================================================
*/

app.get(
  "/atoplay/status",
  requireLogin,
  async (req, res) => {

    try {

      const userId =
        req.session.user.googleId;

      const status =
        await getAtoPlayStatusForUser(
          userId
        );

      const binding =
        getAtoPlayBinding(
          userId
        );

      return res.json({

        success:
          true,

        connected:
          !!status.connected,

        email:
          status.email ||
          "",

        cdpPort:
          status.cdpPort ||
          getAtoPlayCdpPort(
            userId
          ),

        selectedChannel:
          binding
            ? {
                id:
                  binding.channelId,

                name:
                  binding.channelName
              }
            : null

      });

    } catch (error) {

      console.error(
        "AtoPlay status failed:",
        error.message
      );

      return res.status(500).json({
        success:
          false,

        connected:
          false,

        error:
          error.message ||
          "Could not check AtoPlay status."
      });
    }
  }
);


/*
========================================================
ATOPLAY CHANNELS
========================================================
*/

app.get(
  "/atoplay/channels",
  requireLogin,
  async (req, res) => {

    try {

      const userId =
        req.session.user.googleId;

      const status =
        await getAtoPlayStatusForUser(
          userId
        );

      if (
        !status.connected
      ) {

        return res.status(401).json({
          success:
            false,

          connected:
            false,

          channels:
            [],

          error:
            "Please complete your AtoPlay login first."
        });

      }

      const channels =
        await getAtoPlayChannelsForUser(
          userId
        );

      const binding =
        getAtoPlayBinding(
          userId
        );

      return res.json({

        success:
          true,

        connected:
          true,

        channels:
          Array.isArray(channels)
            ? channels
            : [],

        selectedChannel:
          binding
            ? {
                id:
                  binding.channelId,

                name:
                  binding.channelName
              }
            : null

      });

    } catch (error) {

      console.error(
        "AtoPlay channels failed:",
        error.message
      );

      return res.status(500).json({
        success:
          false,

        channels:
          [],

        error:
          error.message ||
          "Could not load AtoPlay channels."
      });
    }
  }
);


/*
========================================================
SELECT / BIND CHANNEL
========================================================

The channel must first exist in the user's
actual AtoPlay account.

We verify it before saving the binding.
========================================================
*/

app.post(
  "/atoplay/channel",
  requireLogin,
  async (req, res) => {

    try {

      const userId =
        req.session.user.googleId;

      const channelId =
        String(
          req.body?.channelId ||
          ""
        ).trim();

      if (!channelId) {

        return res.status(400).json({
          success:
            false,

          error:
            "Channel ID is required."
        });

      }

      const status =
        await getAtoPlayStatusForUser(
          userId
        );

      if (
        !status.connected
      ) {

        return res.status(401).json({
          success:
            false,

          error:
            "Please connect your AtoPlay account first."
        });

      }

      const channels =
        await getAtoPlayChannelsForUser(
          userId
        );

      const selected =
        channels.find(
          channel =>
            String(
              channel.id ||
              channel.channelId ||
              ""
            ) ===
            channelId
        );

      if (!selected) {

        return res.status(400).json({
          success:
            false,

          error:
            "That channel does not belong to the connected AtoPlay account."
        });

      }

      const channelName =
        String(
          selected.name ||
          selected.label ||
          selected.title ||
          "AtoPlay Channel"
        ).trim();

      const binding =
        setAtoPlayBinding(
          userId,
          {
            channelId,
            channelName
          }
        );

      console.log("");
      console.log(
        "======================================"
      );
      console.log(
        "ATOPLAY CHANNEL BOUND"
      );
      console.log(
        `Website user: ${req.session.user.email}`
      );
      console.log(
        `Channel: ${channelName}`
      );
      console.log(
        "======================================"
      );

      return res.json({
        success:
          true,

        channel: {
          id:
            binding.channelId,

          name:
            binding.channelName
        }
      });

    } catch (error) {

      console.error(
        "AtoPlay channel bind failed:",
        error.message
      );

      return res.status(500).json({
        success:
          false,

        error:
          error.message ||
          "Could not bind AtoPlay channel."
      });
    }
  }
);


/*
========================================================
ATOPLAY DISCONNECT
========================================================
*/

app.post(
  "/atoplay/disconnect",
  requireLogin,
  async (req, res) => {

    try {

      const userId =
        req.session.user.googleId;

      const bindings =
        loadAtoPlayBindings();

      delete bindings[
        getUserBindingKey(userId)
      ];

      saveAtoPlayBindings(
        bindings
      );

      await closeAtoPlaySession(
        userId
      );

      return res.json({
        success:
          true
      });

    } catch (error) {

      console.error(
        "AtoPlay disconnect failed:",
        error.message
      );

      return res.status(500).json({
        success:
          false,

        error:
          error.message ||
          "Could not disconnect AtoPlay."
      });
    }
  }
);


/*
========================================================
VIDEO JOB QUEUE
========================================================

Jobs are processed one at a time.

This is important because the existing video
pipeline uses shared output filenames such as:

assets/output/full-ai-video.mp4
generated-script.txt
generated-title.txt
generated-description.txt

Therefore two generations must not run at
the same time.
========================================================
*/

let queuedJobChain =
  Promise.resolve();


function enqueueVideoJob(
  task
) {

  const job =
    queuedJobChain.then(
      task,
      task
    );

  queuedJobChain =
    job.catch(
      () => {}
    );

  return job;
}


/*
========================================================
CREATE VIDEO
========================================================
*/

app.post(
  "/create-video",
  requireLogin,
  async (req, res) => {

    const topic =
      String(
        req.body?.topic ||
        ""
      ).trim();

    if (!topic) {

      return res.status(400).json({
        success:
          false,

        error:
          "Please enter a video topic."
      });

    }

    if (
      topic.length > 500
    ) {

      return res.status(400).json({
        success:
          false,

        error:
          "Topic must be 500 characters or less."
      });

    }


    const userId =
      req.session.user.googleId;


    const binding =
      getAtoPlayBinding(
        userId
      );


    if (!binding) {

      return res.status(400).json({
        success:
          false,

        error:
          "Please connect AtoPlay and select a channel first."
      });

    }


    /*
    If the UI sends a channelId,
    it must match the user's saved channel.
    */

    const requestedChannelId =
      String(
        req.body?.channelId ||
        ""
      ).trim();

    if (
      requestedChannelId &&
      requestedChannelId !==
        binding.channelId
    ) {

      return res.status(400).json({
        success:
          false,

        error:
          "The selected channel is not your currently bound AtoPlay channel."
      });

    }


    const language =
      String(
        req.body?.language ||
        ""
      ).trim();

    const duration =
      String(
        req.body?.duration ||
        ""
      ).trim();

    const voice =
      String(
        req.body?.voice ||
        ""
      ).trim();

    const style =
      String(
        req.body?.style ||
        ""
      ).trim();

    const music =
      String(
        req.body?.music ||
        ""
      ).trim();

    const musicVolume =
      Number(
        req.body?.musicVolume
      );


    /*
    Capture current user's information now.
    */

    console.log("");
    console.log(
      "======================================"
    );
    console.log(
      "VIDEO REQUEST ADDED TO QUEUE"
    );
    console.log(
      `User: ${req.session.user.email}`
    );
    console.log(
      `Topic: ${topic}`
    );
    console.log(
      `AtoPlay channel: ${binding.channelName}`
    );
    console.log(
      "======================================"
    );


    try {

      const result =
        await enqueueVideoJob(
          async () => {

            console.log("");
            console.log(
              "======================================"
            );
            console.log(
              "STARTING QUEUED VIDEO JOB"
            );
            console.log(
              `User: ${req.session.user.email}`
            );
            console.log(
              `Topic: ${topic}`
            );
            console.log(
              `Channel: ${binding.channelName}`
            );
            console.log(
              "======================================"
            );


            /*
            Remove previous shared output.
            */

            const oldFiles = [
              FINAL_VIDEO,
              TITLE_FILE,
              DESCRIPTION_FILE
            ];


            for (
              const filePath
              of oldFiles
            ) {

              try {

                if (
                  fs.existsSync(
                    filePath
                  )
                ) {

                  fs.unlinkSync(
                    filePath
                  );

                }

              } catch (error) {

                console.warn(
                  `Could not remove ${filePath}: ${error.message}`
                );

              }

            }


            /*
            Generate video.
            */

            await runNodeScript(
              VIDEO_SCRIPT,
              {
                VIDEO_TOPIC:
                  topic,

                VIDEO_LANGUAGE:
                  language,

                VIDEO_DURATION:
                  duration,

                VIDEO_VOICE:
                  voice,

                VIDEO_STYLE:
                  style,

                VIDEO_MUSIC:
                  music,

                VIDEO_MUSIC_VOLUME:
                  Number.isFinite(
                    musicVolume
                  )
                    ? String(
                        musicVolume
                      )
                    : ""
              }
            );


            /*
            Verify final MP4.
            */

            if (
              !fs.existsSync(
                FINAL_VIDEO
              )
            ) {

              throw new Error(
                "Video generation completed without creating full-ai-video.mp4."
              );

            }


            const stats =
              fs.statSync(
                FINAL_VIDEO
              );


            if (
              stats.size < 100000
            ) {

              throw new Error(
                `Final MP4 is too small: ${stats.size} bytes.`
              );

            }


            const videoDuration =
              await getVideoDuration(
                FINAL_VIDEO
              );


            console.log(
              `Verified video duration: ${videoDuration.toFixed(2)} seconds`
            );


            if (
              videoDuration <
              MIN_VIDEO_DURATION
            ) {

              throw new Error(
                `Video is only ${videoDuration.toFixed(2)} seconds. Minimum is ${MIN_VIDEO_DURATION} seconds.`
              );

            }


            console.log(
              "Duration check: PASSED"
            );


            /*
            Check the user's AtoPlay session again
            immediately before upload.
            */

            const atoplayStatus =
              await getAtoPlayStatusForUser(
                userId
              );


            if (
              !atoplayStatus.connected
            ) {

              throw new Error(
                "Your AtoPlay session is not connected. Please connect AtoPlay again."
              );

            }


            /*
            Upload through the USER'S dedicated
            Chrome profile and USER'S channel.
            */

            await runNodeScript(
              ATOPLAY_SCRIPT,
              {
                ATOPLAY_CDP_PORT:
                  String(
                    getAtoPlayCdpPort(
                      userId
                    )
                  ),

                ATOPLAY_CHANNEL_ID:
                  binding.channelId

              }
            );


            /*
            Read generated metadata.
            */

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


            console.log("");
            console.log(
              "======================================"
            );
            console.log(
              "VIDEO JOB COMPLETE"
            );
            console.log(
              "======================================"
            );
            console.log(
              `Title: ${title}`
            );
            console.log(
              `Duration: ${videoDuration.toFixed(2)} seconds`
            );
            console.log(
              `User: ${req.session.user.email}`
            );
            console.log(
              `AtoPlay channel: ${binding.channelName}`
            );
            console.log(
              "AtoPlay upload: COMPLETED"
            );
            console.log(
              "======================================"
            );


            return {

              topic,

              title,

              description,

              duration:
                Number(
                  videoDuration.toFixed(
                    2
                  )
                ),

              video:
                "/assets/output/full-ai-video.mp4",

              voice:
                "/voice.wav",

              channelId:
                binding.channelId,

              channelName:
                binding.channelName,

              language,

              atoplay: {

                success:
                  true,

                status:
                  "Upload accepted by AtoPlay."

              }

            };

          }
        );


      return res.json({
        success:
          true,

        ...result
      });


    } catch (error) {

      console.error("");
      console.error(
        "======================================"
      );
      console.error(
        "VIDEO JOB FAILED"
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


      return res.status(500).json({

        success:
          false,

        error:
          error.message ||
          "Video generation failed."

      });

    }

  }
);


/*
========================================================
HEALTH
========================================================
*/

app.get(
  "/health",
  (req, res) => {

    return res.json({

      success:
        true,

      server:
        "AI Video Autopilot",

      status:
        "online",

      googleLogin:
        true,

      videoAutomation:
        true,

      atoplayAutomation:
        true,

      multiUserAtoPlay:
        true

    });

  }
);


/*
========================================================
START SERVER
========================================================
*/

const server =
  app.listen(
    PORT,
    "127.0.0.1",
    () => {

      console.log("");
      console.log(
        "======================================"
      );
      console.log(
        "       AI VIDEO AUTOPILOT"
      );
      console.log(
        "======================================"
      );
      console.log(
        `Server running at: http://localhost:${PORT}`
      );
      console.log(
        "Google login: READY"
      );
      console.log(
        "AI video generation: READY"
      );
      console.log(
        "AtoPlay multi-user sessions: READY"
      );
      console.log(
        "AtoPlay channel binding: READY"
      );
      console.log(
        "Video queue: READY"
      );
      console.log(
        "======================================"
      );
      console.log("");

    }
  );


server.on(
  "error",
  error => {

    console.error(
      "SERVER ERROR:",
      error.message
    );

  }
);


/*
========================================================
SHUTDOWN
========================================================
*/

function shutdown() {

  console.log("");
  console.log(
    "Stopping AI Video Autopilot..."
  );

  server.close(
    () => {
      process.exit(0);
    }
  );

}


process.on(
  "SIGINT",
  shutdown
);

process.on(
  "SIGTERM",
  shutdown
);