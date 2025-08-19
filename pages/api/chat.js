import OpenAI from "openai";
import { containsBadLanguage, extractKeywords, isOnSubject, languageHeader } from "@/lib/guard";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
let syllabusKeywords = [];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { message, syllabus, language } = req.body;

  if (syllabus && !syllabusKeywords.length) {
    syllabusKeywords = extractKeywords(syllabus);
  }

  if (containsBadLanguage(message)) {
    return res.json({ output: "Please use respectful language 🙏" });
  }
  if (!isOnSubject(message, syllabusKeywords)) {
    return res.json({ output: "⚠️ Let’s stay on the subject." });
  }

  const response = await client.responses.create({
    model: "gpt-5-mini",
    input: `${languageHeader(language)}\nSyllabus keywords: ${syllabusKeywords.join(", ")}\nStudent: ${message}\nAnswer clearly:`,
  });

  res.json({ output: response.output_text });
}
