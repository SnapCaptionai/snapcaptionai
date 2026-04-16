// SnapCaption AI — Vercel Backend
// Place this file at: /api/generate.js in your GitHub repo
//
// Set these in Vercel Dashboard → Settings → Environment Variables:
//   GEMINI_API_KEY  = your Google Gemini key (AIzaSy...)
//   OPENAI_API_KEY  = your OpenAI key (sk-...) [optional]
//   CREATOR_CODE    = your private creator code hash (optional)

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, engine } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const activeEngine = engine || 'gemini';
    let text = '';

    // ═══ GEMINI ═══
    if (activeEngine === 'gemini') {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        return res.status(500).json({
          error: 'Gemini API key not configured. Add GEMINI_API_KEY to Vercel environment variables.'
        });
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 2000 }
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          error: data?.error?.message || 'Gemini API error'
        });
      }

      text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // ═══ OPENAI ═══
    } else if (activeEngine === 'openai') {
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        return res.status(500).json({
          error: 'OpenAI API key not configured. Add OPENAI_API_KEY to Vercel environment variables.'
        });
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 8000,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          error: data?.error?.message || 'OpenAI API error'
        });
      }

      text = data?.choices?.[0]?.message?.content || '';

    } else {
      return res.status(400).json({ error: 'Unsupported engine. Use gemini or openai.' });
    }

    if (!text) {
      return res.status(500).json({ error: 'AI returned empty response' });
    }

    return res.status(200).json({ text });

  } catch (err) {
    console.error('SnapCaption API error:', err);
    return res.status(500).json({
      error: 'Server error',
      details: err.message
    });
  }
}
