export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, engine } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    let response;
    let data;
    let text = '';

    if (engine === 'gemini') {
      const geminiKey = process.env.GEMINI_API_KEY || process.env.OWNER_KEY;

      if (!geminiKey) {
        return res.status(500).json({ error: 'Missing Gemini key in Vercel' });
      }

      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }]
              }
            ]
          })
        }
      );

      data = await response.json();
      text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (engine === 'openai') {
      const openaiKey = process.env.OPENAI_API_KEY || process.env.OWNER_KEY;

      if (!openaiKey) {
        return res.status(500).json({ error: 'Missing OpenAI key in Vercel' });
      }

      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens: 2000,
          messages: [
            { role: 'user', content: prompt }
          ]
        })
      });

      data = await response.json();
      text = data?.choices?.[0]?.message?.content || '';
    } else {
      return res.status(400).json({ error: 'Unsupported engine' });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'API request failed',
        raw: data
      });
    }

    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({
      error: 'Server failed',
      details: err.message
    });
  }
}
