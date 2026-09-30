const wsUrl =
    "ws://127.0.0.1:9222/devtools/browser/0223cb95-bd0f-4141-b720-7f3dce324210";

console.log("1. Opening Chrome WebSocket...");

const ws = new WebSocket(wsUrl);

const timer = setTimeout(() => {
    console.log("TEST ERROR: WebSocket timed out after 10 seconds.");
    process.exit(1);
}, 10000);

ws.onopen = () => {
    console.log("2. WebSocket connected!");

    ws.send(JSON.stringify({
        id: 1,
        method: "Browser.getVersion"
    }));
};

ws.onmessage = (event) => {
    clearTimeout(timer);

    console.log("3. Chrome replied:");
    console.log(event.data);

    ws.close();
};

ws.onerror = (error) => {
    clearTimeout(timer);

    console.log("TEST ERROR: WebSocket connection failed.");
    console.log(error);
};