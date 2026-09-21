const fetch = require('node-fetch');
const express = require('express');

const VOLCENGINE_API_URL =
  process.env.VOLCENGINE_API_URL ||
  'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const VOLCENGINE_MODEL_ID = process.env.VOLCENGINE_MODEL_ID || '';
const VOLCENGINE_API_KEY = process.env.VOLCENGINE_API_KEY || '';

function createAiEvalRouter() {
  const router = express.Router();

  router.post('/ai-eval', async (req, res) => {
    const prompt = req.body && req.body.prompt;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: '需要 body.prompt' });
    }
    if (!VOLCENGINE_MODEL_ID || !VOLCENGINE_API_KEY) {
      return res.status(500).json({ error: '请配置 VOLCENGINE_MODEL_ID 和 VOLCENGINE_API_KEY' });
    }

    try {
      const response = await fetch(VOLCENGINE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${VOLCENGINE_API_KEY}`
        },
        body: JSON.stringify({
          model: VOLCENGINE_MODEL_ID,
          messages: [
            {
              role: 'system',
              content:
                '你是一位擅长帮助技术型 CEO 进行每日复盘的教练。回答要清晰、结构化、直接，有可执行建议。'
            },
            { role: 'user', content: prompt }
          ]
        })
      });

      const data = await response.json();
      const choice = data.choices && data.choices[0];
      let text = '';
      if (choice && choice.message && typeof choice.message.content === 'string') {
        text = choice.message.content.trim();
      } else if (choice && typeof choice.text === 'string') {
        text = choice.text.trim();
      } else {
        text = JSON.stringify(data, null, 2);
      }
      res.json({ text });
    } catch (e) {
      console.error(e);
      res.status(502).json({ error: e.message || '请求火山引擎失败' });
    }
  });

  return router;
}

module.exports = { createAiEvalRouter };
