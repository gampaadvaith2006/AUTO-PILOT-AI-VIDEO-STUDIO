require("dotenv").config();

const API_KEY =
    process.env.OPENROUTER_API_KEY;

const MODEL =
    process.env.OPENROUTER_MODEL ||
    "nvidia/nemotron-3-super-120b-a12b:free";

const TOPIC =
    "Why is gold price rising in 2026?";


if (!API_KEY) {
    throw new Error(
        "OPENROUTER_API_KEY is missing."
    );
}


console.log("");
console.log("======================================");
console.log("AI CONTENT TEST");
console.log("======================================");
console.log("");

console.log(
    "MODEL:",
    MODEL
);

console.log(
    "TOPIC:",
    TOPIC
);

console.log("");


// ============================================================
// PROMPT
// ============================================================

const prompt = `
You are creating content for a short vertical social-media video.

Topic:
"${TOPIC}"

Return ONLY ONE JSON OBJECT.

Do not write explanations.
Do not write reasoning.
Do not use markdown.
Do not use code fences.

Required JSON:

{
  "title": "short title under 70 characters",
  "description": "description under 400 characters",
  "script": "natural English narration between 100 and 150 words",
  "scenes": [
    {
      "search": "Pexels visual search phrase"
    },
    {
      "search": "Pexels visual search phrase"
    },
    {
      "search": "Pexels visual search phrase"
    },
    {
      "search": "Pexels visual search phrase"
    },
    {
      "search": "Pexels visual search phrase"
    }
  ]
}

Rules:

- Exactly 5 scene objects.
- English only.
- Script must be between 100 and 150 words.
- Start with a strong hook.
- Use simple natural spoken English.
- Scene searches must describe stock footage that could exist on Pexels.
- Return the JSON object immediately.
`;


// ============================================================
// OPENROUTER
// ============================================================

async function callOpenRouter() {

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

        const response =
            await fetch(
                "https://openrouter.ai/api/v1/chat/completions",
                {

                    method: "POST",

                    headers: {

                        "Authorization":
                            `Bearer ${API_KEY}`,

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
                                    role: "system",

                                    content:
                                        "Return only valid JSON. Do not provide reasoning, explanations, markdown, or code fences."
                                },

                                {
                                    role: "user",

                                    content:
                                        prompt
                                }
                            ],


                            // Current OpenRouter API
                            // reasoning controls.

                            reasoning: {

                                effort:
                                    "none",

                                exclude:
                                    true
                            },


                            temperature:
                                0.2,


                            max_tokens:
                                1400

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

        console.log("");


        if (!response.ok) {

            console.log(
                "OPENROUTER ERROR:"
            );

            console.log(
                raw
            );

            return null;
        }


        let data;


        try {

            data =
                JSON.parse(
                    raw
                );

        } catch {

            console.log(
                "API returned invalid JSON:"
            );

            console.log(
                raw
            );

            return null;
        }


        // Print useful information.

        console.log(
            "MODEL USED:",
            data.model || MODEL
        );

        console.log("");


        // ------------------------------------------------------
        // Normal response
        // ------------------------------------------------------

        const content =
            data
                ?.choices?.[0]
                ?.message
                ?.content;


        if (
            typeof content ===
            "string" &&
            content.trim()
        ) {

            return content.trim();
        }


        // ------------------------------------------------------
        // Some providers may return content in a different
        // shape. Print the complete response for debugging.
        // ------------------------------------------------------

        console.log(
            "CONTENT WAS EMPTY."
        );

        console.log("");

        console.log(
            "FULL API RESPONSE:"
        );

        console.log(
            JSON.stringify(
                data,
                null,
                2
            )
        );


        return null;


    } catch (error) {

        clearTimeout(
            timeout
        );


        console.log("");

        if (
            error.name ===
            "AbortError"
        ) {

            console.log(
                "REQUEST TIMED OUT AFTER 60 SECONDS."
            );

        } else {

            console.log(
                "REQUEST ERROR:"
            );

            console.log(
                error.message
            );
        }


        return null;
    }
}


// ============================================================
// EXTRACT JSON
// ============================================================

function extractJson(
    text
) {

    if (
        !text ||
        typeof text !==
        "string"
    ) {

        return null;
    }


    let cleaned =
        text.trim();


    // Remove markdown fences if present.

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


    cleaned =
        cleaned.trim();


    // Find first { and last }.

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

        return null;
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

        return null;
    }
}


// ============================================================
// VALIDATE
// ============================================================

function validate(
    data
) {

    if (
        !data ||
        typeof data !==
        "object"
    ) {

        throw new Error(
            "AI result is not an object."
        );
    }


    if (
        typeof data.title !==
        "string"
    ) {

        throw new Error(
            "Missing title."
        );
    }


    if (
        typeof data.description !==
        "string"
    ) {

        throw new Error(
            "Missing description."
        );
    }


    if (
        typeof data.script !==
        "string"
    ) {

        throw new Error(
            "Missing script."
        );
    }


    if (
        !Array.isArray(
            data.scenes
        )
    ) {

        throw new Error(
            "Missing scenes array."
        );
    }


    if (
        data.scenes.length !== 5
    ) {

        throw new Error(
            `Expected 5 scenes, got ${data.scenes.length}.`
        );
    }


    data.title =
        data.title
            .trim()
            .slice(0, 70);


    data.description =
        data.description
            .trim()
            .slice(0, 400);


    data.script =
        data.script
            .trim();


    data.scenes =
        data.scenes.map(
            (scene, index) => {

                if (
                    !scene ||
                    typeof scene.search !==
                    "string" ||
                    !scene.search.trim()
                ) {

                    throw new Error(
                        `Scene ${index + 1} is missing its search phrase.`
                    );
                }


                return {
                    search:
                        scene.search.trim()
                };
            }
        );


    return data;
}


// ============================================================
// MAIN
// ============================================================

async function main() {

    console.log(
        "Sending request to OpenRouter..."
    );

    console.log("");


    const content =
        await callOpenRouter();


    if (!content) {

        console.log("");

        console.log(
            "NO USABLE AI CONTENT WAS RETURNED."
        );

        return;
    }


    console.log(
        "AI CONTENT:"
    );

    console.log(
        content
    );

    console.log("");


    const parsed =
        extractJson(
            content
        );


    if (!parsed) {

        console.log(
            "MODEL CONTENT WAS NOT VALID JSON."
        );

        console.log("");

        console.log(
            "The raw response above shows exactly what the model returned."
        );

        return;
    }


    try {

        const valid =
            validate(
                parsed
            );


        console.log(
            "======================================"
        );

        console.log(
            "JSON TEST SUCCESS"
        );

        console.log(
            "======================================"
        );

        console.log("");

        console.log(
            "TITLE:"
        );

        console.log(
            valid.title
        );

        console.log("");

        console.log(
            "DESCRIPTION:"
        );

        console.log(
            valid.description
        );

        console.log("");

        console.log(
            "SCRIPT:"
        );

        console.log(
            valid.script
        );

        console.log("");

        console.log(
            "SCENES:"
        );


        valid.scenes.forEach(
            (scene, index) => {

                console.log(
                    `${index + 1}. ${scene.search}`
                );
            }
        );


        console.log("");

        console.log(
            "AI CONTENT GENERATION TEST PASSED."
        );


    } catch (error) {

        console.log(
            "VALIDATION FAILED:"
        );

        console.log(
            error.message
        );
    }
}


main();