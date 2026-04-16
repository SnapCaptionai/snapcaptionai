export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, engine } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    const isLongForm = prompt.includes('30-minute') || prompt.includes('20-minute');
    const maxTokens = isLongForm ? 16000 : 8000;

    const isOverloadError = (status, message = '') =>
      status === 503 || status === 429 ||
      message.toLowerCase().includes('high demand') ||
      message.toLowerCase().includes('overloaded') ||
      message.toLowerCase().includes('capacity') ||
      message.toLowerCase().includes('rate limit');

    // ═══ 1. GEMINI — Primary ═══
    if (geminiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { maxOutputTokens: maxTokens }
            })
          }
        );
        const data = await response.json();
        const errorMsg = data?.error?.message || '';
        if (isOverloadError(response.status, errorMsg)) {
          console.log('Gemini overloaded — trying OpenAI');
        } else if (!response.ok) {
          return res.status(response.status).json({ error: errorMsg || 'Gemini error' });
        } else {
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (text) return res.status(200).json({ text, engine: 'gemini' });
        }
      } catch (e) {
        console.log('Gemini failed:', e.message);
      }
    }

    // ═══ 2. OPENAI — First Fallback ═══
    if (openaiKey) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }]
          })
        });
        const data = await response.json();
        const errorMsg = data?.error?.message || '';
        if (isOverloadError(response.status, errorMsg)) {
          console.log('OpenAI overloaded — trying Anthropic');
        } else if (!response.ok) {
          return res.status(response.status).json({ error: errorMsg || 'OpenAI error' });
        } else {
          const text = data?.choices?.[0]?.message?.content || '';
          if (text) return res.status(200).json({ text, engine: 'openai' });
        }
      } catch (e) {
        console.log('OpenAI failed:', e.message);
      }
    }

    // ═══ 3. ANTHROPIC CLAUDE — Final Fallback ═══
    if (anthropicKey) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }]
          })
        });
        const data = await response.json();
        const errorMsg = data?.error?.message || '';
        if (isOverloadError(response.status, errorMsg)) {
          console.log('Anthropic also overloaded');
        } else if (!response.ok) {
          return res.status(response.status).json({ error: errorMsg || 'Anthropic error' });
        } else {
          const text = data?.content?.[0]?.text || '';
          if (text) return res.status(200).json({ text, engine: 'claude' });
        }
      } catch (e) {
        console.log('Anthropic failed:', e.message);
      }
    }

    // All three failed
    return res.status(503).json({
      error: 'AI services are currently busy. Please try again in a moment.'
    });

  } catch (err) {
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
}
