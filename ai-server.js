/**
 * AI 评估代理：仅提供 /api/ai-eval。
 */

const express = require("express");
const fetch = require("node-fetch");

const app = express();
const PORT = 2233;

const VOLCENGINE_API_URL =
    process.env.VOLCENGINE_API_URL || "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
const VOLCENGINE_MODEL_ID = process.env.VOLCENGINE_MODEL_ID || "";
const VOLCENGINE_API_KEY = process.env.VOLCENGINE_API_KEY || "";

app.use((req, res, next) => {
    const origin = req.headers.origin;
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
});
app.use(express.json());

app.post("/api/ai-eval", async (req, res) => {
    const prompt = req.body && req.body.prompt;
    if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "需要 body.prompt" });
    }
    if (!VOLCENGINE_MODEL_ID || !VOLCENGINE_API_KEY) {
        return res.status(500).json({ error: "请配置 VOLCENGINE_MODEL_ID 和 VOLCENGINE_API_KEY" });
    }

    try {
        const response = await fetch(VOLCENGINE_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${VOLCENGINE_API_KEY}`
            },
            body: JSON.stringify({
                model: VOLCENGINE_MODEL_ID,
                messages: [
                    { role: "system", content: "你是一位擅长帮助技术型 CEO 进行每日复盘的教练。回答要清晰、结构化、直接，有可执行建议。" },
                    { role: "user", content: prompt }
                ]
            })
        });

        const data = await response.json();
        const choice = data.choices && data.choices[0];
        let text = "";
        if (choice && choice.message && typeof choice.message.content === "string") {
            text = choice.message.content.trim();
        } else if (choice && typeof choice.text === "string") {
            text = choice.text.trim();
        } else {
            text = JSON.stringify(data, null, 2);
        }
        res.json({ text });
    } catch (e) {
        console.error(e);
        res.status(502).json({ error: e.message || "请求火山引擎失败" });
    }
});

app.listen(PORT, () => {
    console.log(`AI 评估代理已启动: http://localhost:${PORT}/api/ai-eval`);
});
