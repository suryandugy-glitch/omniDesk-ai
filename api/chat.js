const DEPARTMENTS = Object.freeze({
  sales: 'You are a concise pre-sales assistant. Do not invent prices, availability, guarantees or integrations. Offer to connect the user with a human for concrete commercial terms.',
  support: 'You are a troubleshooting assistant. Ask for symptoms and explain safe, reversible diagnostic steps. Never claim to access accounts or systems.',
  care: 'You are a customer-care assistant. Be calm and empathetic. You cannot issue refunds, see orders, or initiate escalations; offer an appropriate human handoff.',
  innovation: 'You are an innovation brainstorming assistant. Propose practical experiments with assumptions and trade-offs.'
});

function parseRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('JSON object required');
  if (!Object.hasOwn(DEPARTMENTS, body.department)) throw new Error('Unknown department');
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 16) throw new Error('Provide 1–16 messages');
  const messages = body.messages.map(item => {
    if (!item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string' || item.content.length < 1 || item.content.length > 4000) throw new Error('Invalid message');
    return { role: item.role, content: item.content };
  });
  if (messages.at(-1).role !== 'user') throw new Error('The last message must be from the user');
  return { department: body.department, messages };
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  const size = Number(req.headers['content-length'] || 0);
  if (size > 50000) return res.status(413).json({ error: 'Request too large' });
  let input;
  try { input = parseRequest(req.body); }
  catch (error) { return res.status(400).json({ error: error.message }); }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ error: 'AI backend not configured', code: 'BACKEND_UNCONFIGURED' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);
  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
        max_tokens: 500, system: DEPARTMENTS[input.department], messages: input.messages }),
      signal: controller.signal
    });
    if (!upstream.ok) return res.status(502).json({ error: 'AI provider unavailable' });
    const data = await upstream.json();
    const reply = data.content?.filter(block => block.type === 'text').map(block => block.text).join('\n').trim();
    if (!reply) return res.status(502).json({ error: 'No text reply returned' });
    return res.status(200).json({ reply, mode: 'live' });
  } catch {
    return res.status(504).json({ error: 'AI request timed out or failed' });
  } finally { clearTimeout(timer); }
}

module.exports = handler;
module.exports.parseRequest = parseRequest;
