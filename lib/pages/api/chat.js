import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { message } = req.body;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are Teaching Bot V2 (TBv1 upgraded). 
          Rules:
          1. Only talk about the student’s uploaded syllabus. 
          2. Do not answer unrelated questions. 
          3. Reject and warn if user tries to use bad/rude language. 
          4. Generate notes, explanations, PPT outlines, and numericals.`,
        },
        { role: "user", content: message },
      ],
    });

    const reply = response.choices[0].message.content;
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: "Error generating response" });
  }
}
