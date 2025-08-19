import { useState } from "react";

export default function Home() {
  const [subject, setSubject] = useState("");
  const [syllabus, setSyllabus] = useState("");
  const [language, setLanguage] = useState("en");
  const [response, setResponse] = useState("");

  const handleGenerate = async () => {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, syllabus, language }),
    });
    const data = await res.json();
    setResponse(data.output || "No response");
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Teaching Bot V2</h1>
      <input
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />
      <textarea
        placeholder="Paste syllabus here..."
        value={syllabus}
        onChange={(e) => setSyllabus(e.target.value)}
        rows={6}
        style={{ width: "100%" }}
      />
      <select value={language} onChange={(e) => setLanguage(e.target.value)}>
        <option value="en">English</option>
        <option value="hi">Hindi</option>
        <option value="mixed">Hinglish</option>
      </select>
      <button onClick={handleGenerate}>Generate Course Pack</button>

      {response && (
        <div style={{ marginTop: 20, whiteSpace: "pre-wrap" }}>
          <h2>Output</h2>
          <p>{response}</p>
        </div>
      )}
    </div>
  );
}
