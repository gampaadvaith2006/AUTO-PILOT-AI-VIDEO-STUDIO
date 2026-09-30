const { execFile } = require("child_process");
const path = require("path");

const videoPath = path.join(__dirname, "assets", "scenes", "test-clip.mp4");
const voicePath = path.join(__dirname, "voice.wav");
const outputPath = path.join(__dirname, "assets", "output", "test-output.mp4");

console.log("Starting video creation...");

execFile(
    "ffmpeg",
    [
        "-y",
        "-i", videoPath,
        "-i", voicePath,
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-c:a", "aac",
        "-shortest",
        outputPath
    ],
    (error, stdout, stderr) => {
        if (error) {
            console.error("FFmpeg ERROR:");
            console.error(stderr);
            return;
        }

        console.log("Video created successfully!");
        console.log("Saved to:");
        console.log(outputPath);
    }
);node