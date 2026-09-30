const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

require("dotenv").config();


// ============================================================
// PATHS
// ============================================================

const PROJECT_DIR = __dirname;

const OUTPUT_DIR =
    path.join(
        PROJECT_DIR,
        "assets",
        "output"
    );

const SCENES_DIR =
    path.join(
        PROJECT_DIR,
        "assets",
        "scenes"
    );

const SCRIPT_FILE =
    path.join(
        PROJECT_DIR,
        "generated-script.txt"
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

const METADATA_FILE =
    path.join(
        PROJECT_DIR,
        "video-metadata.json"
    );

const VOICE_FILE =
    path.join(
        PROJECT_DIR,
        "voice.wav"
    );

const TEMP_VOICE_FILE =
    path.join(
        PROJECT_DIR,
        "voice-temp.wav"
    );

const SUBTITLE_FILE =
    path.join(
        OUTPUT_DIR,
        "subtitles.srt"
    );

const ASSEMBLED_VIDEO =
    path.join(
        OUTPUT_DIR,
        "assembled-video.mp4"
    );

const FINAL_VIDEO =
    path.join(
        OUTPUT_DIR,
        "full-ai-video.mp4"
    );

const PIPER_MODEL =
    path.join(
        PROJECT_DIR,
        "en_US-lessac-medium.onnx"
    );


// ============================================================
// SETTINGS
// ============================================================

const TARGET_DURATION = 70;

const MINIMUM_DURATION = 65;

const MODEL =
    process.env.OPENROUTER_MODEL ||
    "inclusionai/ling-3.0-flash-fin:free";

const VIDEO_TOPIC =
    process.env.VIDEO_TOPIC ||
    "Why is gold price rising in 2026?";


// ============================================================
// API KEYS
// ============================================================

const OPENROUTER_API_KEY =
    process.env.OPENROUTER_API_KEY;

const PEXELS_API_KEY =
    process.env.PEXELS_API_KEY;


if (!OPENROUTER_API_KEY) {

    throw new Error(
        "OPENROUTER_API_KEY is missing from .env"
    );
}

if (!PEXELS_API_KEY) {

    throw new Error(
        "PEXELS_API_KEY is missing from .env"
    );
}


// ============================================================
// DIRECTORIES
// ============================================================

fs.mkdirSync(
    OUTPUT_DIR,
    {
        recursive: true
    }
);


// ============================================================
// SLEEP
// ============================================================

function sleep(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );
}


// ============================================================
// FIND COMMAND
// ============================================================

function findCommand(
    commandName
) {

    return new Promise(
        resolve => {

            const child =
                spawn(
                    "where.exe",
                    [commandName],
                    {
                        windowsHide: true
                    }
                );


            let output = "";


            if (child.stdout) {

                child.stdout.on(
                    "data",
                    data => {

                        output +=
                            data.toString();
                    }
                );
            }


            child.on(
                "close",
                code => {

                    if (
                        code === 0 &&
                        output.trim()
                    ) {

                        resolve(
                            output
                                .split(/\r?\n/)
                                .map(
                                    x =>
                                        x.trim()
                                )
                                .filter(Boolean)[0]
                        );

                    } else {

                        resolve(null);
                    }
                }
            );


            child.on(
                "error",
                () => {

                    resolve(null);
                }
            );
        }
    );
}


// ============================================================
// RUN COMMAND
// ============================================================

function runCommand(
    command,
    args,
    inputText = null
) {

    return new Promise(
        (resolve, reject) => {

            console.log("");
            console.log(
                "RUNNING:",
                command
            );

            console.log(
                args.join(" ")
            );

            console.log("");


            const child =
                spawn(
                    command,
                    args,
                    {
                        cwd:
                            PROJECT_DIR,

                        shell:
                            false,

                        windowsHide:
                            false
                    }
                );


            let stdout = "";
            let stderr = "";


            if (child.stdout) {

                child.stdout.on(
                    "data",
                    data => {

                        const text =
                            data.toString();

                        stdout +=
                            text;

                        process.stdout.write(
                            text
                        );
                    }
                );
            }


            if (child.stderr) {

                child.stderr.on(
                    "data",
                    data => {

                        const text =
                            data.toString();

                        stderr +=
                            text;

                        process.stderr.write(
                            text
                        );
                    }
                );
            }


            child.on(
                "error",
                error => {

                    reject(
                        new Error(
                            `${command} could not start: ${error.message}`
                        )
                    );
                }
            );


            child.on(
                "close",
                code => {

                    if (
                        code !== 0
                    ) {

                        reject(
                            new Error(
                                `${command} failed with exit code ${code}\n${stderr || stdout}`
                            )
                        );

                        return;
                    }


                    resolve({
                        stdout,
                        stderr
                    });
                }
            );


            if (
                inputText !== null
            ) {

                child.stdin.write(
                    inputText
                );

                child.stdin.end();
            }
        }
    );
}


// ============================================================
// WORD COUNT
// ============================================================

function wordCount(text) {

    return String(
        text || ""
    )
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .length;
}


// ============================================================
// OPENROUTER
// ============================================================

async function askAI(
    prompt,
    maxTokens = 900
) {

    let lastError = null;


    for (
        let attempt = 1;
        attempt <= 4;
        attempt++
    ) {

        const controller =
            new AbortController();


        const timeout =
            setTimeout(
                () => {

                    controller.abort();

                },
                60000
            );


        try {

            console.log("");
            console.log(
                `OpenRouter attempt ${attempt}/4`
            );

            console.log(
                "Model:",
                MODEL
            );


            const response =
                await fetch(
                    "https://openrouter.ai/api/v1/chat/completions",
                    {

                        method:
                            "POST",

                        headers: {

                            Authorization:
                                `Bearer ${OPENROUTER_API_KEY}`,

                            "Content-Type":
                                "application/json",

                            "HTTP-Referer":
                                "http://localhost:3000",

                            "X-Title":
                                "AI Video Autopilot"
                        },

                        body:
                            JSON.stringify({

                                model:
                                    MODEL,

                                messages: [

                                    {
                                        role:
                                            "system",

                                        content:
                                            "Return only the requested answer. Do not provide reasoning, commentary, markdown, or code fences."
                                    },

                                    {
                                        role:
                                            "user",

                                        content:
                                            prompt
                                    }
                                ],

                                // IMPORTANT:
                                // Same reasoning configuration
                                // that worked in the successful
                                // Ling test.

                                reasoning: {

                                    effort:
                                        "none",

                                    exclude:
                                        true
                                },

                                temperature:
                                    0.2,

                                max_tokens:
                                    maxTokens
                            }),

                        signal:
                            controller.signal
                    }
                );


            clearTimeout(
                timeout
            );


            const raw =
                await response.text();


            console.log(
                "HTTP STATUS:",
                response.status
            );


            if (
                !response.ok
            ) {

                throw new Error(
                    `OpenRouter HTTP ${response.status}\n${raw}`
                );
            }


            let data;

            try {

                data =
                    JSON.parse(
                        raw
                    );

            } catch {

                throw new Error(
                    "OpenRouter returned invalid API JSON."
                );
            }


            if (
                data.error
            ) {

                throw new Error(
                    JSON.stringify(
                        data.error,
                        null,
                        2
                    )
                );
            }


            const content =
                data
                    ?.choices?.[0]
                    ?.message
                    ?.content;


            if (
                typeof content !== "string" ||
                !content.trim()
            ) {

                throw new Error(
                    "OpenRouter returned empty content."
                );
            }


            console.log(
                "AI response received."
            );


            return content.trim();


        } catch (error) {

            clearTimeout(
                timeout
            );


            lastError =
                error;


            console.log("");
            console.log(
                "AI request failed:"
            );

            console.log(
                error.message
            );


            if (
                attempt < 4
            ) {

                console.log(
                    "Waiting 5 seconds before retry..."
                );

                await sleep(
                    5000
                );
            }
        }
    }


    throw new Error(
        `OpenRouter failed after 4 attempts.\n\n${lastError?.message || "Unknown error"}`
    );
}


// ============================================================
// EXTRACT JSON
// ============================================================

function extractJson(
    text
) {

    let cleaned =
        String(
            text || ""
        ).trim();


    cleaned =
        cleaned.replace(
            /^```json\s*/i,
            ""
        );


    cleaned =
        cleaned.replace(
            /^```\s*/i,
            ""
        );


    cleaned =
        cleaned.replace(
            /\s*```$/i,
            ""
        );


    const first =
        cleaned.indexOf(
            "{"
        );


    const last =
        cleaned.lastIndexOf(
            "}"
        );


    if (
        first < 0 ||
        last <= first
    ) {

        throw new Error(
            `AI did not return JSON.\n\nRAW RESPONSE:\n${text}`
        );
    }


    cleaned =
        cleaned.slice(
            first,
            last + 1
        );


    try {

        return JSON.parse(
            cleaned
        );

    } catch {

        throw new Error(
            `AI returned invalid JSON.\n\nRAW RESPONSE:\n${text}`
        );
    }
}


// ============================================================
// STEP 1A — BASE CONTENT
// ============================================================

async function generateBaseContent() {

    console.log("");
    console.log(
        "======================================"
    );

    console.log(
        "STEP 1: AI CONTENT"
    );

    console.log(
        "======================================"
    );

    console.log("");
    console.log(
        "Topic:",
        VIDEO_TOPIC
    );


    const prompt = `
Create the opening part of a vertical social-media video.

Topic:
"${VIDEO_TOPIC}"

Return ONLY this JSON structure:

{
  "title": "short title under 70 characters",
  "description": "short description under 400 characters",
  "script": "natural spoken English narration between 115 and 130 words",
  "scenes": [
    {"search": "Pexels visual search phrase"},
    {"search": "Pexels visual search phrase"},
    {"search": "Pexels visual search phrase"},
    {"search": "Pexels visual search phrase"},
    {"search": "Pexels visual search phrase"}
  ]
}

Rules:
- English only.
- Script 115–130 words.
- Strong hook at the beginning.
- Natural spoken narration.
- Exactly 5 scene searches.
- Pexels-friendly visual searches.
- No markdown.
- No emojis.
- No reasoning.
- No explanation.
- Return JSON immediately.
`;


    const raw =
        await askAI(
            prompt,
            1000
        );


    const result =
        extractJson(
            raw
        );


    if (
        !result.title ||
        !result.description ||
        !result.script ||
        !Array.isArray(result.scenes)
    ) {

        throw new Error(
            "AI base content is incomplete."
        );
    }


    if (
        result.scenes.length < 5
    ) {

        throw new Error(
            "AI base content did not contain 5 scenes."
        );
    }


    result.title =
        String(
            result.title
        )
            .trim()
            .slice(0, 70);


    result.description =
        String(
            result.description
        )
            .trim()
            .slice(0, 400);


    result.script =
        String(
            result.script
        )
            .trim();


    result.scenes =
        result.scenes
            .slice(0, 5)
            .map(
                scene => ({

                    search:
                        String(
                            scene?.search || ""
                        ).trim()
                })
            );


    console.log("");
    console.log(
        "Base script words:",
        wordCount(
            result.script
        )
    );


    return result;
}


// ============================================================
// STEP 1B — CONTINUATION
// ============================================================

async function generateContinuation(
    existingScript
) {

    console.log("");
    console.log(
        "Generating narration continuation..."
    );


    const prompt = `
Continue this vertical social-media video narration.

Topic:
"${VIDEO_TOPIC}"

Existing narration:
"${existingScript}"

Write ONLY the next spoken narration.

Requirements:
- 115 to 130 words.
- Natural conversational English.
- Continue the same topic.
- Do not repeat the existing sentences.
- Add useful information.
- Finish with a clear takeaway.
- No title.
- No markdown.
- No emojis.
- No explanation.
- Return only spoken narration.
`;


    const raw =
        await askAI(
            prompt,
            900
        );


    let cleaned =
        raw.trim();


    cleaned =
        cleaned.replace(
            /^```[\s\S]*?\n/,
            ""
        );


    cleaned =
        cleaned.replace(
            /```$/i,
            ""
        );


    cleaned =
        cleaned.trim();


    if (
        wordCount(
            cleaned
        ) < 90
    ) {

        throw new Error(
            `Continuation is too short: ${wordCount(cleaned)} words.`
        );
    }


    console.log(
        "Continuation words:",
        wordCount(
            cleaned
        )
    );


    return cleaned;
}


// ============================================================
// STEP 1C — EXTRA CONTINUATION
// ============================================================

async function generateExtraContinuation(
    existingScript
) {

    console.log("");
    console.log(
        "Generating additional narration..."
    );


    const prompt = `
Extend this spoken social-media narration.

Topic:
"${VIDEO_TOPIC}"

Existing narration:
"${existingScript}"

Write ONLY an additional 80 to 110 words.

Rules:
- Continue naturally.
- Do not repeat earlier sentences.
- Add useful context or examples.
- End naturally.
- English only.
- No markdown.
- No emojis.
- No title.
- No explanation.
- Return only narration.
`;


    const raw =
        await askAI(
            prompt,
            700
        );


    let cleaned =
        raw.trim();


    cleaned =
        cleaned.replace(
            /^```[\s\S]*?\n/,
            ""
        );


    cleaned =
        cleaned.replace(
            /```$/i,
            ""
        );


    cleaned =
        cleaned.trim();


    if (
        wordCount(
            cleaned
        ) < 50
    ) {

        throw new Error(
            `Extra narration is too short: ${wordCount(cleaned)} words.`
        );
    }


    console.log(
        "Extra narration words:",
        wordCount(
            cleaned
        )
    );


    return cleaned;
}


// ============================================================
// STEP 2 — PIPER VOICE
// ============================================================

async function createVoice(
    script
) {

    console.log("");
    console.log(
        "======================================"
    );

    console.log(
        "STEP 2: AI VOICE"
    );

    console.log(
        "======================================"
    );


    const python =
        await findCommand(
            "python"
        );


    if (!python) {

        throw new Error(
            "Python was not found."
        );
    }


    if (
        !fs.existsSync(
            PIPER_MODEL
        )
    ) {

        throw new Error(
            `Piper model not found:\n${PIPER_MODEL}`
        );
    }


    console.log(
        "Python:",
        python
    );


    console.log(
        "Piper model:",
        PIPER_MODEL
    );


    await runCommand(
        python,
        [
            "-m",
            "piper",

            "-m",
            PIPER_MODEL,

            "-f",
            VOICE_FILE
        ],
        script
    );


    if (
        !fs.existsSync(
            VOICE_FILE
        )
    ) {

        throw new Error(
            "voice.wav was not created."
        );
    }


    const size =
        fs.statSync(
            VOICE_FILE
        ).size;


    if (
        size <= 0
    ) {

        throw new Error(
            "voice.wav is empty."
        );
    }


    const duration =
        await getDuration(
            VOICE_FILE
        );


    console.log("");
    console.log(
        "Voice duration:",
        duration.toFixed(2),
        "seconds"
    );


    return duration;
}


// ============================================================
// STEP 2B — BUILD LONG ENOUGH VOICE
// ============================================================

async function buildVoice(
    baseScript
) {

    let script =
        baseScript;


    let duration =
        await createVoice(
            script
        );


    // Add continuation 1 if needed.

    if (
        duration <
        MINIMUM_DURATION
    ) {

        console.log("");
        console.log(
            "Voice is below 65 seconds."
        );


        const continuation =
            await generateContinuation(
                script
            );


        script =
            `${script} ${continuation}`
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();


        fs.writeFileSync(
            SCRIPT_FILE,
            script,
            "utf8"
        );


        duration =
            await createVoice(
                script
            );
    }


    // Add continuation 2 if still needed.

    if (
        duration <
        MINIMUM_DURATION
    ) {

        console.log("");
        console.log(
            "Voice is still below 65 seconds."
        );


        const extra =
            await generateExtraContinuation(
                script
            );


        script =
            `${script} ${extra}`
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();


        fs.writeFileSync(
            SCRIPT_FILE,
            script,
            "utf8"
        );


        duration =
            await createVoice(
                script
            );
    }


    // Final silence safety padding.

    if (
        duration <
        MINIMUM_DURATION
    ) {

        console.log("");
        console.log(
            "Adding final safety silence..."
        );


        const ffmpeg =
            await findCommand(
                "ffmpeg"
            );


        if (!ffmpeg) {

            throw new Error(
                "FFmpeg was not found."
            );
        }


        const extraSeconds =
            TARGET_DURATION -
            duration;


        await runCommand(
            ffmpeg,
            [
                "-y",

                "-i",
                VOICE_FILE,

                "-af",
                `apad=pad_dur=${Math.max(0, extraSeconds).toFixed(3)}`,

                "-t",
                TARGET_DURATION.toFixed(3),

                "-c:a",
                "pcm_s16le",

                TEMP_VOICE_FILE
            ]
        );


        if (
            !fs.existsSync(
                TEMP_VOICE_FILE
            )
        ) {

            throw new Error(
                "voice-temp.wav was not created."
            );
        }


        fs.copyFileSync(
            TEMP_VOICE_FILE,
            VOICE_FILE
        );


        duration =
            await getDuration(
                VOICE_FILE
            );
    }


    fs.writeFileSync(
        SCRIPT_FILE,
        script,
        "utf8"
    );


    console.log("");
    console.log(
        "FINAL SCRIPT WORDS:",
        wordCount(
            script
        )
    );


    console.log(
        "FINAL VOICE DURATION:",
        duration.toFixed(2),
        "seconds"
    );


    if (
        duration <
        MINIMUM_DURATION
    ) {

        throw new Error(
            `Voice is only ${duration.toFixed(2)} seconds. Minimum is ${MINIMUM_DURATION} seconds.`
        );
    }


    console.log("");
    console.log(
        "VOICE STEP SUCCESS"
    );


    return {
        script,
        duration
    };
}


// ============================================================
// STEP 3 — PEXELS
// ============================================================

async function searchPexels(
    query
) {

    const url =
        "https://api.pexels.com/videos/search" +
        `?query=${encodeURIComponent(query)}` +
        "&orientation=portrait" +
        "&size=medium" +
        "&per_page=10";


    const response =
        await fetch(
            url,
            {
                headers: {

                    Authorization:
                        PEXELS_API_KEY
                }
            }
        );


    const raw =
        await response.text();


    if (
        !response.ok
    ) {

        throw new Error(
            `Pexels HTTP ${response.status}\n${raw}`
        );
    }


    const data =
        JSON.parse(
            raw
        );


    if (
        !Array.isArray(
            data.videos
        )
    ) {

        return null;
    }


    const candidates = [];


    for (
        const video of data.videos
    ) {

        if (
            !Array.isArray(
                video.video_files
            )
        ) {

            continue;
        }


        for (
            const file of video.video_files
        ) {

            const width =
                Number(
                    file.width || 0
                );


            const height =
                Number(
                    file.height || 0
                );


            if (
                file.link &&
                height >
                width
            ) {

                candidates.push({

                    link:
                        file.link,

                    width:
                        width,

                    height:
                        height
                });
            }
        }
    }


    if (
        candidates.length === 0
    ) {

        return null;
    }


    candidates.sort(
        (a, b) => {

            return (
                Math.abs(
                    a.width -
                    720
                ) -
                Math.abs(
                    b.width -
                    720
                )
            );
        }
    );


    return candidates[0];
}


// ============================================================
// DOWNLOAD
// ============================================================

async function downloadFile(
    url,
    outputPath
) {

    const response =
        await fetch(
            url
        );


    if (
        !response.ok
    ) {

        throw new Error(
            `Download failed: HTTP ${response.status}`
        );
    }


    const buffer =
        Buffer.from(
            await response.arrayBuffer()
        );


    fs.writeFileSync(
        outputPath,
        buffer
    );


    const size =
        fs.statSync(
            outputPath
        ).size;


    if (
        size <= 0
    ) {

        throw new Error(
            `Downloaded file is empty: ${outputPath}`
        );
    }
}


// ============================================================
// DOWNLOAD SCENES
// ============================================================

async function downloadScenes(
    scenes
) {

    console.log("");
    console.log(
        "======================================"
    );

    console.log(
        "STEP 3: PEXELS VIDEO SCENES"
    );

    console.log(
        "======================================"
    );


    if (
        fs.existsSync(
            SCENES_DIR
        )
    ) {

        fs.rmSync(
            SCENES_DIR,
            {
                recursive:
                    true,

                force:
                    true
            }
        );
    }


    fs.mkdirSync(
        SCENES_DIR,
        {
            recursive:
                true
        }
    );


    const files = [];


    for (
        let i = 0;
        i < 5;
        i++
    ) {

        console.log("");
        console.log(
            `Scene ${i + 1}/5`
        );


        const query =
            scenes[i].search;


        console.log(
            "Search:",
            query
        );


        let result =
            await searchPexels(
                query
            );


        if (!result) {

            result =
                await searchPexels(
                    "business finance"
                );
        }


        if (!result) {

            throw new Error(
                `No portrait Pexels video found for scene ${i + 1}.`
            );
        }


        console.log(
            "Resolution:",
            `${result.width} x ${result.height}`
        );


        const output =
            path.join(
                SCENES_DIR,
                `scene-${i + 1}.mp4`
            );


        console.log(
            "Downloading..."
        );


        await downloadFile(
            result.link,
            output
        );


        console.log(
            "Saved:",
            output
        );


        files.push(
            output
        );
    }


    console.log("");
    console.log(
        "ALL 5 SCENES DOWNLOADED"
    );


    return files;
}


// ============================================================
// DURATION
// ============================================================

async function getDuration(
    filePath
) {

    const ffprobe =
        await findCommand(
            "ffprobe"
        );


    if (!ffprobe) {

        throw new Error(
            "ffprobe was not found."
        );
    }


    const result =
        await runCommand(
            ffprobe,
            [
                "-v",
                "error",

                "-show_entries",
                "format=duration",

                "-of",
                "default=noprint_wrappers=1:nokey=1",

                filePath
            ]
        );


    const duration =
        Number(
            result.stdout.trim()
        );


    if (
        !Number.isFinite(duration) ||
        duration <= 0
    ) {

        throw new Error(
            `Could not determine duration for ${filePath}`
        );
    }


    return duration;
}


// ============================================================
// STEP 4 — ASSEMBLE
// ============================================================

async function assembleVideo(
    sceneFiles,
    duration
) {

    console.log("");
    console.log(
        "======================================"
    );

    console.log(
        "STEP 4: FFMPEG VIDEO ASSEMBLY"
    );

    console.log(
        "======================================"
    );


    const ffmpeg =
        await findCommand(
            "ffmpeg"
        );


    if (!ffmpeg) {

        throw new Error(
            "FFmpeg was not found."
        );
    }


    const sceneDuration =
        duration / 5;


    console.log(
        "Total duration:",
        duration.toFixed(2),
        "seconds"
    );


    console.log(
        "Each scene:",
        sceneDuration.toFixed(2),
        "seconds"
    );


    const normalized = [];


    for (
        let i = 0;
        i < sceneFiles.length;
        i++
    ) {

        const output =
            path.join(
                SCENES_DIR,
                `normalized-${i + 1}.mp4`
            );


        await runCommand(
            ffmpeg,
            [
                "-y",

                "-stream_loop",
                "-1",

                "-i",
                sceneFiles[i],

                "-t",
                sceneDuration.toFixed(3),

                "-vf",
                "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30",

                "-an",

                "-c:v",
                "libx264",

                "-preset",
                "veryfast",

                "-crf",
                "23",

                "-pix_fmt",
                "yuv420p",

                output
            ]
        );


        normalized.push(
            output
        );
    }


    const concatFile =
        path.join(
            SCENES_DIR,
            "concat.txt"
        );


    fs.writeFileSync(
        concatFile,

        normalized
            .map(
                file =>
                    `file '${file
                        .replace(/\\/g, "/")
                        .replace(/'/g, "'\\''")}'`
            )
            .join("\n"),

        "utf8"
    );


    await runCommand(
        ffmpeg,
        [
            "-y",

            "-f",
            "concat",

            "-safe",
            "0",

            "-i",
            concatFile,

            "-c",
            "copy",

            ASSEMBLED_VIDEO
        ]
    );


    if (
        !fs.existsSync(
            ASSEMBLED_VIDEO
        )
    ) {

        throw new Error(
            "assembled-video.mp4 was not created."
        );
    }


    console.log("");
    console.log(
        "SCENE ASSEMBLY SUCCESS"
    );
}


// ============================================================
// STEP 5 — SUBTITLES
// ============================================================

function createSubtitles(
    script,
    duration
) {

    const words =
        script
            .replace(
                /\s+/g,
                " "
            )
            .trim()
            .split(" ")
            .filter(Boolean);


    const wordsPerCaption =
        9;


    const chunks = [];


    for (
        let i = 0;
        i < words.length;
        i += wordsPerCaption
    ) {

        chunks.push(
            words
                .slice(
                    i,
                    i + wordsPerCaption
                )
                .join(" ")
        );
    }


    const captionDuration =
        duration /
        Math.max(
            chunks.length,
            1
        );


    function timeCode(
        seconds
    ) {

        const totalMs =
            Math.round(
                seconds * 1000
            );


        const ms =
            totalMs %
            1000;


        const totalSeconds =
            Math.floor(
                totalMs /
                1000
            );


        const sec =
            totalSeconds %
            60;


        const totalMinutes =
            Math.floor(
                totalSeconds /
                60
            );


        const min =
            totalMinutes %
            60;


        const hour =
            Math.floor(
                totalMinutes /
                60
            );


        return (
            String(hour).padStart(2, "0") +
            ":" +
            String(min).padStart(2, "0") +
            ":" +
            String(sec).padStart(2, "0") +
            "," +
            String(ms).padStart(3, "0")
        );
    }


    let srt = "";


    chunks.forEach(
        (chunk, index) => {

            const start =
                index *
                captionDuration;


            const end =
                Math.min(
                    duration,
                    (index + 1) *
                    captionDuration
                );


            srt +=
                `${index + 1}\n`;


            srt +=
                `${timeCode(start)} --> ${timeCode(end)}\n`;


            srt +=
                `${chunk}\n\n`;
        }
    );


    fs.writeFileSync(
        SUBTITLE_FILE,
        srt,
        "utf8"
    );


    console.log(
        "Subtitles created."
    );
}


// ============================================================
// STEP 6 — FINAL VIDEO
// ============================================================

async function createFinalVideo(
    script
) {

    console.log("");
    console.log(
        "======================================"
    );

    console.log(
        "STEP 6: FINAL VIDEO"
    );

    console.log(
        "======================================"
    );


    const ffmpeg =
        await findCommand(
            "ffmpeg"
        );


    if (!ffmpeg) {

        throw new Error(
            "FFmpeg was not found."
        );
    }


    const voiceDuration =
        await getDuration(
            VOICE_FILE
        );


    createSubtitles(
        script,
        voiceDuration
    );


    await runCommand(
        ffmpeg,
        [
            "-y",

            "-i",
            ASSEMBLED_VIDEO,

            "-i",
            VOICE_FILE,

            "-map",
            "0:v:0",

            "-map",
            "1:a:0",

            "-vf",
            "subtitles=assets/output/subtitles.srt:force_style='FontName=Arial,FontSize=26,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,MarginV=90'",

            "-c:v",
            "libx264",

            "-preset",
            "medium",

            "-crf",
            "21",

            "-pix_fmt",
            "yuv420p",

            "-c:a",
            "aac",

            "-b:a",
            "128k",

            "-shortest",

            "-movflags",
            "+faststart",

            FINAL_VIDEO
        ]
    );


    if (
        !fs.existsSync(
            FINAL_VIDEO
        )
    ) {

        throw new Error(
            "full-ai-video.mp4 was not created."
        );
    }


    const size =
        fs.statSync(
            FINAL_VIDEO
        ).size;


    const finalDuration =
        await getDuration(
            FINAL_VIDEO
        );


    console.log("");
    console.log(
        "======================================"
    );

    console.log(
        "FINAL VIDEO CHECK"
    );

    console.log(
        "======================================"
    );

    console.log("");


    console.log(
        "Final duration:",
        finalDuration.toFixed(2),
        "seconds"
    );


    console.log(
        "Final size:",
        size,
        "bytes"
    );


    if (
        finalDuration <
        MINIMUM_DURATION
    ) {

        throw new Error(
            `Final video is only ${finalDuration.toFixed(2)} seconds. Minimum is ${MINIMUM_DURATION} seconds.`
        );
    }


    console.log("");
    console.log(
        "VIDEO CREATION SUCCESS"
    );


    return finalDuration;
}


// ============================================================
// MAIN
// ============================================================

async function main() {

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

    console.log("");

    console.log(
        "Topic:",
        VIDEO_TOPIC
    );

    console.log(
        "Model:",
        MODEL
    );

    console.log(
        "Target duration:",
        TARGET_DURATION,
        "seconds"
    );

    console.log(
        "Minimum duration:",
        MINIMUM_DURATION,
        "seconds"
    );


    // --------------------------------------------------------
    // Check tools
    // --------------------------------------------------------

    const ffmpeg =
        await findCommand(
            "ffmpeg"
        );


    const ffprobe =
        await findCommand(
            "ffprobe"
        );


    const python =
        await findCommand(
            "python"
        );


    console.log("");
    console.log(
        "FFmpeg:",
        ffmpeg || "NOT FOUND"
    );


    console.log(
        "FFprobe:",
        ffprobe || "NOT FOUND"
    );


    console.log(
        "Python:",
        python || "NOT FOUND"
    );


    if (!ffmpeg) {

        throw new Error(
            "FFmpeg not found."
        );
    }


    if (!ffprobe) {

        throw new Error(
            "FFprobe not found."
        );
    }


    if (!python) {

        throw new Error(
            "Python not found."
        );
    }


    // --------------------------------------------------------
    // STEP 1
    // --------------------------------------------------------

    const content =
        await generateBaseContent();


    // --------------------------------------------------------
    // First continuation + voice
    // --------------------------------------------------------

    const baseContinuation =
        await generateContinuation(
            content.script
        );


    let fullScript =
        `${content.script} ${baseContinuation}`
            .replace(
                /\s+/g,
                " "
            )
            .trim();


    fs.writeFileSync(
        SCRIPT_FILE,
        fullScript,
        "utf8"
    );


    fs.writeFileSync(
        TITLE_FILE,
        content.title,
        "utf8"
    );


    fs.writeFileSync(
        DESCRIPTION_FILE,
        content.description,
        "utf8"
    );


    // --------------------------------------------------------
    // STEP 2
    // --------------------------------------------------------

    const voice =
        await buildVoice(
            fullScript
        );


    fullScript =
        voice.script;


    // --------------------------------------------------------
    // Save metadata
    // --------------------------------------------------------

    fs.writeFileSync(
        METADATA_FILE,

        JSON.stringify(
            {
                title:
                    content.title,

                description:
                    content.description,

                script:
                    fullScript,

                scenes:
                    content.scenes,

                duration:
                    voice.duration
            },

            null,
            2
        ),

        "utf8"
    );


    // --------------------------------------------------------
    // STEP 3
    // --------------------------------------------------------

    const scenes =
        await downloadScenes(
            content.scenes
        );


    // --------------------------------------------------------
    // STEP 4
    // --------------------------------------------------------

    await assembleVideo(
        scenes,
        voice.duration
    );


    // --------------------------------------------------------
    // STEP 6
    // --------------------------------------------------------

    const finalDuration =
        await createFinalVideo(
            fullScript
        );


    console.log("");
    console.log(
        "======================================"
    );

    console.log(
        "ALL VIDEO GENERATION COMPLETED"
    );

    console.log(
        "======================================"
    );

    console.log("");

    console.log(
        "Final MP4:"
    );

    console.log(
        FINAL_VIDEO
    );

    console.log("");

    console.log(
        "Final duration:",
        finalDuration.toFixed(2),
        "seconds"
    );

    console.log("");
}


// ============================================================
// START
// ============================================================

main()
    .catch(
        error => {

            console.error("");
            console.error(
                "======================================"
            );

            console.error(
                "VIDEO GENERATION FAILED"
            );

            console.error(
                "======================================"
            );

            console.error("");

            console.error(
                error.message
            );

            console.error("");

            process.exitCode = 1;
        }
    );