/**
 * AI 评估代理：仅提供 /api/ai-eval。
 * 路由实现见 ./ai-server/routes/ai-eval.js
 */
const express = require('express');
const { createAiEvalRouter } = require('./ai-server/routes/ai-eval');

const app = express();
const PORT = 2233;

app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json());
app.use('/api', createAiEvalRouter());

app.listen(PORT, () => {
  console.log(`AI 评估代理已启动: http://localhost:${PORT}/api/ai-eval`);
});
