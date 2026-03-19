/**
 * AI Chat Backend - MiniMax API (Vercel Serverless)
 * ВАЖНО: задайте переменную окружения `MINIMAX_API_KEY` в Vercel.
 *
 * Endpoint: POST /api/chat
 * Body: { "message": "..." }
 * Response: { "response": "..." }
 */

const KNOWLEDGE = require("../knowledge.json");

const API_URL = "https://api.minimax.io/anthropic/v1/messages";

function buildSystemPrompt(knowledge) {
  const contact = knowledge?.contact;
  const services = knowledge?.services || [];
  const additional = knowledge?.additionalOptions || [];
  const hourly = knowledge?.updatesAndHourly || [];
  const pricingNote = knowledge?.pricingNote || "";

  // Подставляем знания в system-подсказку, чтобы модель НЕ выдумывала цены/услуги.
  return `Ты консультант по услугам веб-разработки.

ПРАВИЛА:
1. Отвечай ТОЛЬКО на основе данных ниже.
2. Не выдумывай цены, сроки и набор услуг. Если информации нет — скажи "Не знаю".
3. Если пользователь спрашивает как связаться — предложи Telegram: ${contact?.telegramUrl || ""} (handle: ${contact?.telegramHandle || ""}).
4. Отвечай кратко, по делу, структурируй списками.

Ориентир по ценам:
${pricingNote}

Данные:
${JSON.stringify({ services, additionalOptions: additional, updatesAndHourly: hourly, contact }, null, 2)}`;
}

async function callMiniMax(apiKey, userMessage, systemPrompt) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "MiniMax-M2.5",
      messages: [{ role: "user", content: userMessage }],
      max_tokens: 900,
      temperature: 0.4,
      system: systemPrompt
    })
  });

  const data = await response.json();
  const content = data?.content?.[0]?.text;
  if (!content) throw new Error("MiniMax: пустой ответ");
  return content;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error:
          "Не задано окружение MINIMAX_API_KEY в Vercel. Добавьте ключ в Project Settings -> Environment Variables."
      });
    }

    const body = req.body || {};
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) return res.status(400).json({ error: "Нет сообщения" });

    const systemPrompt = buildSystemPrompt(KNOWLEDGE);
    const responseText = await callMiniMax(apiKey, message, systemPrompt);
    return res.status(200).json({ response: responseText });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Ошибка" });
  }
};

