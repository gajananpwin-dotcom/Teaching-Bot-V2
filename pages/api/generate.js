import OpenAI from "openai";

const hasKey = !!process.env.OPENAI_API_KEY;
const openai = hasKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { subject = "", syllabus = "", language = "en" } = req.body || {};

  // Fallback so you still see something even without a key
  if (!hasKey) {
    return res.status(200).json({
      output:
        `⚠️ OPENAI_API_KEY not set on server.\n\n` +
        `Demo output for "${subject}":\n` +
        `• Notes: Key ideas from the syllabus.\n` +
        `• Numericals: 3 small examples (if applicable).\n` +
        `• Slides: 3-slide outline.\n\n` +
        `Add OPENAI_API_KEY in Vercel → Project → Settings → Environment Variables, then redeploy.`,
      debug: { hasKey: false }
    });
  }

  try {
    // Use a broadly available model
    const prompt = `
Language: ${language}
Subject: ${subject}

Syllabus:
${syllabus}

Create a compact "course pack":
1) Short notes (bulleted, clear).
2) 3 numericals with solutions if the subject suits; else 3 practice Q&A.
3) A 3-slide outline (each slide: title + 4–6 bullets).
Return plain text.
`;

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      messages: [
        { role: "system", content: "You are a helpful teaching assistant who only talks about the given subject." },
        { role: "user", content: prompt }
      ]
    });

    const text =
      resp?.choices?.[0]?.message?.content?.trim() ||
      "No content returned from the model.";

    return res.status(200).json({ output: text, debug: { hasKey: true } });
  } catch (err) {
    console.error("Generate error:", err);
    return res.status(500).json({
      error: "Generation failed.",
      hint:
        "Verify OPENAI_API_KEY is set in Vercel env vars and you selected a valid model.",
      detail: String(err?.message || err)
    });
  }
}
