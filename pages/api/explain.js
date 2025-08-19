import OpenAI from "openai";

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { subject = "", syllabus = "", language = "en" } = req.body || {};

  if (!client) {
    // fallback script
    return res.json({
      script: [
        `Let's explore ${subject}.`,
        `First, the core ideas from your syllabus.`,
        `This is a demo because OPENAI_API_KEY is missing in the server env.`
      ]
    });
  }

  try {
    const prompt = `
Language: ${language}
Subject: ${subject}
Syllabus:
${syllabus}

Create a VOICE LECTURE SCRIPT in 15–25 short chunks (1–2 sentences each), simple phrasing for TTS.
Return JSON: { "script": string[] } only. 
Keep each chunk < 160 characters for natural speech. No extra commentary.
`;

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      messages: [
        { role: "system", content: "You produce concise, voice-friendly teaching scripts only about the given syllabus." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    });

    const raw = resp.choices?.[0]?.message?.content || "{}";
    let data = {}; try { data = JSON.parse(raw); } catch {}
    const script = Array.isArray(data.script) ? data.script : [];
    return res.json({ script });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Explain failed", detail: String(e?.message || e) });
  }
}
