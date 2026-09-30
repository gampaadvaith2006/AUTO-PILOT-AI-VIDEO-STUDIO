require("dotenv").config();

const fs = require("fs");

async function downloadPexelsVideo() {
    const apiKey = process.env.PEXELS_API_KEY;

    if (!apiKey) {
        console.log("ERROR: PEXELS_API_KEY is missing.");
        return;
    }

    console.log("Searching Pexels...");

    try {
        const searchResponse = await fetch(
            "https://api.pexels.com/v1/videos/search?query=gold&orientation=portrait&per_page=3",
            {
                headers: {
                    Authorization: apiKey
                }
            }
        );

        const searchData = await searchResponse.json();

        if (!searchResponse.ok) {
            console.log("Pexels search error:", searchData);
            return;
        }

        if (!searchData.videos || searchData.videos.length === 0) {
            console.log("No videos found.");
            return;
        }

        const video = searchData.videos[0];

        console.log("Found Pexels video:", video.id);

        // Find a portrait MP4 file
        const videoFile =
            video.video_files
                .filter(file =>
                    file.file_type === "video/mp4" &&
                    file.height > file.width
                )
                .sort((a, b) => b.height - a.height)[0];

        if (!videoFile) {
            console.log("No suitable portrait MP4 found.");
            return;
        }

        console.log("Downloading video...");
        console.log("Resolution:", videoFile.width, "x", videoFile.height);

        const videoResponse =
            await fetch(videoFile.link);

        if (!videoResponse.ok) {
            console.log(
                "Video download failed:",
                videoResponse.status
            );
            return;
        }

        const buffer =
            Buffer.from(await videoResponse.arrayBuffer());

        fs.writeFileSync(
            "assets/scenes/test-clip.mp4",
            buffer
        );

        console.log(
            "Video downloaded successfully!"
        );

        console.log(
            "Saved to: assets/scenes/test-clip.mp4"
        );

    } catch (error) {
        console.log(
            "ERROR:",
            error.message
        );
    }
}

downloadPexelsVideo();