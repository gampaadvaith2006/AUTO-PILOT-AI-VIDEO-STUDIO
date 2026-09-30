const { execFile } = require("child_process");
const path = require("path");

const scenes = [
    path.join(__dirname, "assets", "scenes", "scene-1.mp4"),
    path.join(__dirname, "assets", "scenes", "scene-2.mp4"),
    path.join(__dirname, "assets", "scenes", "scene-3.mp4"),
    path.join(__dirname, "assets", "scenes", "scene-4.mp4"),
    path.join(__dirname, "assets", "scenes", "scene-5.mp4")
];

const voicePath = path.join(__dirname, "voice.wav");

const outputPath = path.join(
    __dirname,
    "assets",
    "output",
    "multi-scene-video.mp4"
);

console.log("Starting multi-scene video creation...");

const args = [
    "-y"
];

// Add the 5 scene videos
for (const scene of scenes) {
    args.push("-i", scene);
}

// Add AI voice
args.push("-i", voicePath);

// Build video filters
const filters = scenes.map((_, i) => {
    return `[${i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1[v${i}]`;
});

const videoInputs = scenes
    .map((_, i) => `[v${i}]`)
    .join("");

filters.push(
    `${videoInputs}concat=n=${scenes.length}:v=1:a=0[video]`
);

args.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[video]",
    "-map",
    `${scenes.length}:a:0`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-shortest",
    outputPath
);

execFile(
    "ffmpeg",
    args,
    (error, stdout, stderr) => {

        if (error) {
            console.error("FFmpeg ERROR:");
            console.error(stderr);
            return;
        }

        console.log("\nVIDEO CREATED SUCCESSFULLY!");
        console.log("Saved to:");
        console.log(outputPath);
    }
);