import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { subject, syllabus, language } = req.body;

  const response = await client.responses.create({
    model: "gpt-5",
    input: `
      Language: ${language}
      Subject: ${subject}
      Syllabus: ${syllabus}

      Generate:
      1. Short notes
      2. 3 numerical examples if applicable
      3. A mini PPT outline (3 slides)
    `,
  });

  res.json({ output: response.output_text });
}
