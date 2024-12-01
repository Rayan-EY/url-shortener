const express = require("express");
const cors = require("cors");
const redis = require("redis");

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// Initialize Redis client
const client = redis.createClient();

client.on("error", (err) => console.error("Redis error:", err));
client.on("connect", () => console.log("Connected to Redis"));

(async () => {
    try {
        await client.connect();
        console.log("Redis client connected");
    } catch (error) {
        console.error("Failed to connect to Redis:", error);
        process.exit(1);
    }
})();

// Endpoint: Shorten URL
app.post("/shorten", async (req, res) => {
    const { originalUrl } = req.body;
    if (!originalUrl) {
        return res.status(400).json({ error: "Invalid input. 'originalUrl' is required." });
    }

    const shortCode = Math.random().toString(36).substr(2, 8);
    try {
        await client.set(shortCode, originalUrl);
        res.json({ shortUrl: `http://localhost:3000/${shortCode}` });
    } catch (error) {
        console.error("Redis Error:", error);
        res.status(500).json({ error: "Failed to shorten URL" });
    }
});

// Endpoint: Redirect to Original URL
app.get("/:shortCode", async (req, res) => {
    const { shortCode } = req.params;
    try {
        const originalUrl = await client.get(shortCode);
        if (originalUrl) {
            // Increment the click count
            const clicksKey = `${shortCode}:clicks`;
            await client.incr(clicksKey);

            return res.redirect(originalUrl);
        }
        res.status(404).json({ error: "URL not found" });
    } catch (error) {
        console.error("Redis Error:", error);
        res.status(500).json({ error: "Failed to resolve URL" });
    }
});

// Endpoint: Fetch Stats
app.get("/:shortCode/stats", async (req, res) => {
    const { shortCode } = req.params;
    try {
        const clicks = (await client.get(`${shortCode}:clicks`)) || 0;
        res.json({ shortCode, clicks });
    } catch (error) {
        console.error("Redis Error:", error);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

// Graceful shutdown
process.on("SIGINT", async () => {
    console.log("Closing Redis client...");
    await client.quit();
    console.log("Redis client closed.");
    process.exit(0);
});

// Start server
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
