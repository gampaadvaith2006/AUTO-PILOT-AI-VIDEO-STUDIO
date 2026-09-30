const fs = require("fs");
const path = require("path");
const { execFileSync, execFile } = require("child_process");

const videoPath = path.join(
    __dirname,
    "assets",
    "output",
    "multi-scene-video.mp4"
);

const scriptPath = path.join(
    __dirname,
    "generated-script.txt"
);

const srtPath = path.join(
    __dirname,
    "assets",
    "output",
    "subtitles.srt"
);

const outputPath = path.join(
    __dirname,
    "assets",
    "output",
    "video-with-subtitles.mp4"
);

// Check required files
if (!fs.existsSync(videoPath)) {
    console.error("Video not found:");
    console.error(videoPath);
    process.exit(1);
}

if (!fs.existsSync(scriptPath)) {
    console.error("Script not found:");
    console.error(scriptPath);
    process.exit(1);
}

console.log("Reading script...");

const script = fs.readFileSync(
    scriptPath,
    "utf8"
).trim();

const words = script
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean);

console.log(`Script contains ${words.length} words.`);

console.log("Checking video duration...");

const duration = parseFloat(
    execFileSync(
        "ffprobe",
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
            encoding: "utf8"
        }
    ).trim()
);

console.log(
    `Video duration: ${duration.toFixed(2)} seconds`
);

// Subtitle settings
const wordsPerSubtitle = 7;

const totalBlocks = Math.ceil(
    words.length / wordsPerSubtitle
);

const secondsPerBlock =
    duration / totalBlocks;

// Convert seconds to SRT timestamp
function formatTime(seconds) {

    const hours = Math.floor(seconds / 3600);

    const minutes = Math.floor(
        (seconds % 3600) / 60
    );

    const secs = Math.floor(
        seconds % 60
    );

    const millis = Math.floor(
        (seconds % 1) * 1000
    );

    return (
        String(hours).padStart(2, "0") +
        ":" +
        String(minutes).padStart(2, "0") +
        ":" +
        String(secs).padStart(2, "0") +
        "," +
        String(millis).padStart(3, "0")
    );
}

// Create SRT subtitles
let srt = "";

for (let i = 0; i < totalBlocks; i++) {

    const start =
        i * secondsPerBlock;

    const end =
        Math.min(
            (i + 1) * secondsPerBlock,
            duration
        );

    const startWord =
        i * wordsPerSubtitle;

    const endWord =
        Math.min(
            startWord + wordsPerSubtitle,
            words.length
        );

    const subtitleText =
        words
            .slice(startWord, endWord)
            .join(" ");

    srt += `${i + 1}\n`;
    srt += `${formatTime(start)} --> ${formatTime(end)}\n`;
    srt += `${subtitleText}\n\n`;
}

fs.writeFileSync(
    srtPath,
    srt,
    "utf8"
);

console.log("Subtitle file created.");

console.log("Burning subtitles into video...");

// Use a relative subtitle path to avoid Windows
// backslash parsing problems inside FFmpeg.
const subtitleFilter =
    "subtitles=assets/output/subtitles.srt:" +
    "force_style='FontName=Arial,FontSize=18," +
    "Alignment=2,MarginV=80'";

execFile(
    "ffmpeg",
    [
        "-y",

        "-i",
        videoPath,

        "-vf",
        subtitleFilter,

        "-c:v",
        "libx264",

        "-preset",
        "veryfast",

        "-crf",
        "23",

        "-c:a",
        "copy",

        outputPath

    ],
    (error, stdout, stderr) => {

        if (error) {

            console.error("");
            console.error("FFmpeg ERROR:");
            console.error(stderr);

            return;
        }

        console.log("");
        console.log(
            "SUBTITLES ADDED SUCCESSFULLY!"
        );

        console.log("");
        console.log("Saved to:");

        console.log(
            outputPath
        );
    }
);