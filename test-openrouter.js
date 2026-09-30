require("dotenv").config();

async function testOpenRouter() {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        console.log("ERROR: OPENROUTER_API_KEY is missing");
        return;
    }

    console.log("API key found.");

    try {
        const response = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "openrouter/free",
                    messages: [
                        {
                            role: "user",
                            content: "Write one sentence saying hello."
                        }
                    ]
                })
            }
        );

        const data = await response.json();

        console.log("Status:", response.status);
        console.log("Result:", JSON.stringify(data, null, 2));

    } catch (error) {
        console.log("ERROR:", error.message);
    }
}

testOpenRouter();