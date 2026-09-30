const OpenAI = require("openai");
require("dotenv").config();

const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY
});

async function createScenes() {
    try {
        const topic = "Why gold prices are rising";

        console.log("Creating AI scene plan...");

        const response = await client.chat.completions.create({
            model: "openrouter/free",

            messages: [
                {
                    role: "user",
                    content: `
Create a short-form video scene plan about:

${topic}

Return ONLY valid JSON.

Use this exact format:

{
  "title": "video title",
  "scenes": [
    {
      "scene": 1,
      "narration": "short narration",
      "visual": "what visual should be shown"
    },
    {
      "scene": 2,
      "narration": "short narration",
      "visual": "what visual should be shown"
    },
    {
      "scene": 3,
      "narration": "short narration",
      "visual": "what visual should be shown"
    },
    {
      "scene": 4,
      "narration": "short narration",
      "visual": "what visual should be shown"
    },
    {
      "scene": 5,
      "narration": "short narration",
      "visual": "what visual should be shown"
    }
  ]
}

Rules:
- 5 scenes exactly.
- Simple English.
- Each narration should be 1 to 2 sentences.
- Visual descriptions should be suitable for searching stock videos.
- Do not invent specific facts.
`
                }
            ]
        });

        const text = response.choices[0].message.content;

        console.log("\nAI RESPONSE:\n");
        console.log(text);

        const cleanText = text
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        const data = JSON.parse(cleanText);

        console.log("\nSCENE PLAN CREATED SUCCESSFULLY!\n");

        data.scenes.forEach((scene) => {
            console.log(`Scene ${scene.scene}`);
            console.log(`Narration: ${scene.narration}`);
            console.log(`Visual: ${scene.visual}`);
            console.log("--------------------------------");
        });

    } catch (error) {
        console.error("SCENE ERROR:");
        console.error(error.message);
    }
}

createScenes();