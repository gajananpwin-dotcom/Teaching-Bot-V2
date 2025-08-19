import OpenAI from "openai";

const hasKey = !!process.env.OPENAI_API_KEY;
const openai = hasKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { subject = "", syllabus = "", language = "en", slidesOnly = false } = req.body || {};

  if (!hasKey) {
    if (slidesOnly) {
      return res.json({ slides: [
        { title: `${subject}: Overview`, bullets: ["Why it matters","Key terms","Outcomes"] },
        { title: "Core Concepts", bullets: ["Concept A","Concept B","Concept C"] },
        { title: "Applications", bullets: ["Industry 1","Industry 2","Tools"] }
      ]});
    }
    return res.json({ output: `Demo (no OPENAI_API_KEY). Subject: ${subject}\n\nNotes…\nQuestions…\nSlides on demand only.` });
  }

  try {
    if (slidesOnly) {
      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.5,
        messages: [
          { role: "system", content: "You generate concise slide bullet plans from syllabi." },
          { role: "user", content:
`Language: ${language}
Subject: ${subject}
Syllabus:
${syllabus}

Make 8–12 slides. Each slide: { title, bullets[4-6] }. Return JSON { slides: Slide[] } only.` }
        ],
        response_format: { type: "json_object" }
      });
      const raw = resp.choices?.[0]?.message?.content || "{}";
      let data = {}; try { data = JSON.parse(raw); } catch {}
      const slides = Array.isArray(data.slides) ? data.slides : [];
      return res.json({ slides });
    }

    const prompt = `
Language: ${language}
Subject: ${subject}
Syllabus:
${syllabus}

Create a compact "course pack":
1) Short notes.
2) 3 numericals + solutions (if relevant); else 3 practice Q&A.
3) A short recap.
Plain text.`;
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      messages: [
        { role: "system", content: "You are a helpful teaching assistant who only talks about the given subject." },
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
