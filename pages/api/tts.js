// pages/api/tts.js
// ElevenLabs high-quality TTS. Request body: { text, language: 'en'|'hi'|'mixed', speed? }
// Returns audio/mpeg.

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

const MODEL_ID = "eleven_multilingual_v2"; // Great for Hindi/English/Hinglish

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { text = "", language = "en" } = req.body || {};
  const apiKey  = process.env.ELEVENLABS_API_KEY;
  const voiceEN = process.env.ELEVENLABS_VOICE_EN;
  const voiceHI = process.env.ELEVENLABS_VOICE_HI || voiceEN;

  if (!apiKey || !voiceEN) {
    return res.status(400).json({
      error: "ElevenLabs not configured",
      hint: "Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_EN in Vercel env vars."
    });
  }

  const lang = (language || "en").toLowerCase();
  const voiceId = lang === "hi" ? voiceHI : voiceEN; // 'mixed' -> Indian English voice

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: {
          stability: 0.45,        // slightly expressive teacher tone
          similarity_boost: 0.8,
          style: 0.6,
          use_speaker_boost: true
          // speaking_rate: <not required; we control playback speed on the client>
        }
      })
    });

    if (!r.ok) {
      const detail = await r.text();
      return res.status(500).json({ error: "TTS request failed", detail });
    }

    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.send(buf);
  } catch (e) {
    res.status(500).json({ error: "TTS error", detail: String(e?.message || e) });
  }
}
