import { useState } from "react";

export default function Home() {
  const [subject, setSubject] = useState("");
  const [syllabus, setSyllabus] = useState("");
  const [language, setLanguage] = useState("en");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setResponse("");

    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, syllabus, language })
      });

      const data = await r.json();

      if (!r.ok) {
        setError(data?.error || "Failed to generate.");
        return;
      }
      setResponse(data?.output || "(No output)");
    } catch (e) {
      setError(e?.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      <h1>Teaching Bot V2</h1>

      <input
        placeholder="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        style={{ display: "block", width: "100%", marginBottom: 10 }}
      />

      <textarea
        placeholder="Paste syllabus here..."
        value={syllabus}
        onChange={(e) => setSyllabus(e.target.value)}
        rows={6}
        style={{ width: "100%", marginBottom: 10 }}
      />

      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        style={{ marginBottom: 10 }}
      >
        <option value="en">English</option>
        <option value="hi">Hindi</option>
        <option value="mixed">Hinglish</option>
      </select>

      <br />
      <button onClick={handleGenerate} disabled={loading}>
        {loading ? "Generating…" : "Generate Course Pack"}
      </button>

      {error && (
        <div style={{ color: "white", background: "#ef4444", padding: 10, marginTop: 12 }}>
          <b>Error:</b> {error}
        </div>
      )}

      {response && (
        <div style={{ marginTop: 20, whiteSpace: "pre-wrap", background: "#f1f5f9", padding: 12, borderRadius: 8 }}>
          <h2>Output</h2>
          <p>{response}</p>
        </div>
      )}
    </div>
  );
}
