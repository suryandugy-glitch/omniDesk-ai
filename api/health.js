module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
  return res.status(200).json({ status: 'ok', aiConfigured: Boolean(process.env.ANTHROPIC_API_KEY) });
};
