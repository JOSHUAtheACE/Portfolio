import 'dotenv/config';
import express from 'express';
import { Groq } from 'groq-sdk';
import { readFileSync, existsSync } from 'node:fs';

// Prefer a committed .env.groq file in dev (never commit the real value).
// If .env.groq exists and GROQ_API_KEY is still unset, load it from there so
// the provided key is used locally without being stored in .env itself.
if (!process.env.GROQ_API_KEY && existsSync('.env.groq')) {
  try {
    for (const line of readFileSync('.env.groq', 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*GROQ_API_KEY\s*=\s*(.+)\s*$/);
      if (m) process.env.GROQ_API_KEY = m[1];
    }
  } catch {
    // ignore
  }
}

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(process.cwd(), { index: false }));

if (!process.env.GROQ_API_KEY) {
  console.warn('WARNING: GROQ_API_KEY is not set. /api/chat will return 500.');
}

const groq = new Groq(process.env.GROQ_API_KEY);
const MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You are Atharva Joshi's personal portfolio assistant.
Be concise, warm, and helpful. Introduce yourself as the assistant for Atharva Joshi's portfolio.
If the user asks about Atharva's skills, projects, or experience, base your answer on the portfolio content.
Always reply in English unless the user clearly writes in another language.`;

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body || {};
    if (typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'A non-empty "message" string is required.' });
    }

    const response = await groq.chat.completions.create(
      {
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message.trim() },
        ],
        max_tokens: 1024,
        temperature: 0.7,
      },
      { headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` } },
    );

    const reply =
      response?.choices?.[0]?.message?.content?.trim() ||
      'Sorry, I could not generate a response right now.';

    return res.json({ reply });
  } catch (err) {
    console.error('/api/chat error:', err?.message || err);
    const status = err?.status || err?.code === 'EINGEST' ? 400 : 500;
    return res.status(status).json({
      error: 'Chat request failed.',
      detail: err?.message || String(err),
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Portfolio backend listening on http://0.0.0.0:${PORT}`);
  console.log(`  POST /api/chat  ( Groq · ${MODEL} )`);
});
