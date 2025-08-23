// pages/api/generate.js
import OpenAI from "openai";
import { languageHeader } from "@/lib/guard";

const hasKey = !!process.env.OPENAI_API_KEY;
const openai = hasKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { subject = "", syllabus = "", language = "en", slidesOnly = false } = req.body || {};
  const langName = languageHeader(language);

  if (!hasKey) {
    if (slidesOnly) {
      return res.json({ slides: [
        { title: `${subject}: Overview`, bullets: ["Why it matters","Key terms","Outcomes"] },
        { title: "Core Concepts", bullets: ["Concept A","Concept B","Concept C"] },
        { title: "Applications", bullets: ["Industry 1","Industry 2","Tools"] }
      ]});
    }
    return res.json({
      output: `Demo (no OPENAI_API_KEY). Subject: ${subject}\n\nNotes in ${langName}…`
    });
  }

  try {
    if (slidesOnly) {
      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.5,
        messages: [
          { role: "system", content: `You generate concise slide bullet plans from syllabi. Write all content in ${langName}.` },
          { role: "user", content:
`Subject: ${subject}
Syllabus:
${syllabus}

Make 8–12 slides. Each slide: { title, bullets[4-6] }.
Keep titles short; bullets crisp; use ${langName}.
Return JSON { "slides": Slide[] } only.` }
        ],
        response_format: { type: "json_object" }
      });
      const raw = resp.choices?.[0]?.message?.content || "{}";
      let data = {}; try { data = JSON.parse(raw); } catch {}
      const slides = Array.isArray(data.slides) ? data.slides : [];
      return res.json({ slides });
    }

    const prompt = `
You are a helpful Indian teacher (around 30 years old). Answer in **${langName}** only.

Subject: ${subject}
Syllabus:
${syllabus}

Create a compact "course pack":
1) Short notes.
2) 3 numericals + solutions (if relevant) OR 3 practice Q&A.
3) A short recap.

Keep it focused and classroom-friendly.`;

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      messages: [
        { role: "system", content: `You only talk about the given subject and syllabus. Use ${langName}.` },
        { role: "user", content: prompt }
      ]
    });
    const text = resp?.choices?.[0]?.message?.content?.trim() || "No content returned.";
    return res.json({ output: text });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Generation failed", detail: String(e?.message || e) });
  }
}
