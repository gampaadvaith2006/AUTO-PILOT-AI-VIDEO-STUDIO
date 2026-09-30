const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

require("dotenv").config();

const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY
});

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

const scenesFolder = path.join(
    __dirname,
    "assets",
    "scenes"
);

if (!fs.existsSync(scenesFolder)) {
    fs.mkdirSync(scenesFolder, { recursive: true });
}

async function createScenePlan(topic) {

    const response = await client.chat.completions.create({
        model: "openrouter/free",

        messages: [
            {
                role: "user",
                content: `
Create exactly 5 scenes for a short video about:

${topic}

Return ONLY valid JSON in this format:

{
  "scenes": [
    {
      "scene": 1,
      "visual": "short stock video search phrase"
    },
    {
      "scene": 2,
      "visual": "short stock video search phrase"
    },
    {
      "scene": 3,
      "visual": "short stock video search phrase"
    },
    {
      "scene": 4,
      "visual": "short stock video search phrase"
    },
    {
      "scene": 5,
      "visual": "short stock video search phrase"
    }
  ]
}

Rules:
- Use simple English.
- Keep each visual search phrase short.
- Make the phrases suitable for Pexels stock video search.
`
            }
        ]
    });

    const text = response.choices[0].message.content
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

    return JSON.parse(text);
}

async function searchPexels(query) {

    const url =
        "https://api.pexels.com/v1/videos/search?" +
        new URLSearchParams({
            query: query,
            orientation: "portrait",
            size: "medium",
            per_page: "5"
        });

    const response = await fetch(url, {
        headers: {
            Authorization: PEXELS_API_KEY
        }
    });

    if (!response.ok) {
        throw new Error(
            `Pexels error ${response.status}: ${await response.text()}`
        );
    }

    return response.json();
}

function selectVideoFile(video) {

    const mp4Files = video.video_files.filter(
        file => file.file_type === "video/mp4"
    );

    mp4Files.sort((a, b) => {

        const aDistance = Math.abs((a.width || 0) - 1080);
        const bDistance = Math.abs((b.width || 0) - 1080);

        return aDistance - bDistance;
    });

    return mp4Files[0];
}

async function downloadFile(url, outputPath) {

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(
            `Download failed: ${response.status}`
        );
    }

    const buffer = Buffer.from(
        await response.arrayBuffer()
    );

    fs.writeFileSync(outputPath, buffer);
}

async function main() {

    try {

        const topic = "Why gold prices are rising";

        console.log("Creating AI scene plan...\n");

        const scenePlan =
            await createScenePlan(topic);

        console.log("Scene plan created!\n");

        for (const scene of scenePlan.scenes) {

            console.log(
                `Scene ${scene.scene}: ${scene.visual}`
            );

            console.log("Searching Pexels...");

            const result =
                await searchPexels(scene.visual);

            if (!result.videos.length) {
                console.log(
                    "No video found. Skipping scene.\n"
                );
                continue;
            }

            const video = result.videos[0];

            const selectedFile =
                selectVideoFile(video);

            if (!selectedFile) {
                console.log(
                    "No MP4 file found. Skipping scene.\n"
                );
                continue;
            }

            const outputPath =
                path.join(
                    scenesFolder,
                    `scene-${scene.scene}.mp4`
                );

            console.log(
                `Downloading ${selectedFile.width}x${selectedFile.height}...`
            );

            await downloadFile(
                selectedFile.link,
                outputPath
            );

            console.log(
                `Saved: ${outputPath}\n`
            );
        }

        console.log(
            "ALL SCENE VIDEOS DOWNLOADED!"
        );

    } catch (error) {

        console.error(
            "\nERROR:"
        );

        console.error(
            error.message
        );
    }
}

main();