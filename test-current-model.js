const fs = require("fs");
require("dotenv").config();

const apiKey = process.env.OPENROUTER_API_KEY;
const model = process.env.OPENROUTER_MODEL;

if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is missing.");
}

if (!model) {
    throw new Error("OPENROUTER_MODEL is missing.");
}

console.log("Model:", model);
console.log("Testing OpenRouter...");

async function main() {
    const controller = new AbortController();

    const timer = setTimeout(() => {
        controller.abort();
    }, 30000);

    try {
        const response = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                method: "POST",

                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:3000",
                    "X-Title": "AI Video Autopilot"
                },

                body: JSON.stringify({
                    model: model,

                    messages: [
                        {
                            role: "user",
                            content:
                                "Return ONLY this JSON object: {\"status\":\"ok\",\"message\":\"model works\"}"
                        }
                    ],

                    temperature: 0,

                    response_format: {
                        type: "json_object"
                    }
                }),

                signal: controller.signal
            }
        );

        clearTimeout(timer);

        const text = await response.text();

        console.log("");
        console.log("HTTP STATUS:", response.status);
        console.log("");
        console.log("RESPONSE:");
        console.log(text);

    } catch (error) {

        clearTimeout(timer);

        console.log("");
        console.log("TEST FAILED:");
        console.log(error.name);
        console.log(error.message);
    }
}

main();