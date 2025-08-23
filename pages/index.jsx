import { useEffect, useRef, useState } from "react";

/**
 * Teaching Bot V2 — Voice-enabled classroom
 * - Start Voice Lesson (from syllabus) -> speaks short chunks
 * - Interrupt & Ask (press & hold) -> teacher answers, then resumes
 * - Generate Course Pack (text) + PPT on demand
 * - Languages: English (en), Hindi (hi), Hinglish (mixed)
 * - Voice speed control (0.75x – 1.50x)
 */

export default function Home() {
  // --- UI state ---
  const [subject, setSubject] = useState("");
  const [syllabus, setSyllabus] = useState("");
  const [language, setLanguage] = useState("en"); // "en" | "hi" | "mixed"
  const [out, setOut] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // --- Voice speed ---
  // Applies to both ElevenLabs (audio playbackRate) and browser TTS fallback
  const [voiceRate, setVoiceRate] = useState(1.0); // 0.75 .. 1.50

  // --- Voice/lesson state ---
  const [speaking, setSpeaking] = useState(false);
  const [script, setScript] = useState([]); // chunks to speak
  const speakIdx = useRef(0);
  const interrupted = useRef(false);
  const resumeQueue = useRef([]); // chunks remaining after interruption

  // --- Audio / TTS helpers (ElevenLabs first, browser TTS fallback) ---
  const audioRef = useRef(null);
  const abortSpeak = useRef(null);

  async function playBlob(url) {
    return new Promise((resolve, reject) => {
      const a = audioRef.current || new Audio();
      audioRef.current = a;
      a.src = url;

      // Apply voice speed and preserve pitch if supported
      a.playbackRate = voiceRate;
      try {
        if ("preservesPitch" in a) a.preservesPitch = true;
        if ("mozPreservesPitch" in a) a.mozPreservesPitch = true;
        if ("webkitPreservesPitch" in a) a.webkitPreservesPitch = true;
      } catch {}

      a.onended = () => resolve();
      a.onerror = (e) => reject(e);
      a.play().catch(reject);
    });
  }

  async function stopSpeaking() {
    if (abortSpeak.current) {
      try { abortSpeak.current.abort(); } catch {}
      abortSpeak.current = null;
    }
    if (audioRef.current) {
      try { audioRef.current.pause(); audioRef.current.currentTime = 0; } catch {}
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
  }

  async function speakChunk(text, lang) {
    // Try ElevenLabs via our API
    await stopSpeaking();
    try {
      const ac = new AbortController();
      abortSpeak.current = ac;
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // We pass speed; backend currently ignores (not needed for playbackRate),
        // but sending it makes future server-side speed handling trivial.
        body: JSON.stringify({ text, language: lang, speed: voiceRate }),
        signal: ac.signal,
      });
      if (r.ok) {
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        await playBlob(url);
        URL.revokeObjectURL(url);
        return;
      }
    } catch {
      // fall through to browser speech
    }

    // Fallback: browser speech synthesis (robotic but works)
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      await new Promise((resolve) => {
        const u = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const pick = (q) => voices.find((v) => q.every((s) => v.name.toLowerCase().includes(s)));
        u.voice =
          (lang === "hi" && (pick(["hindi"]) || pick(["india", "female"]))) ||
          pick(["en", "india", "female"]) ||
          pick(["english", "female"]) ||
          voices[0];
        u.lang = lang === "hi" ? "hi-IN" : "en-IN";
        u.rate = Math.min(2, Math.max(0.5, voiceRate)); // map slider to speech rate
        u.pitch = 1.0;
        u.onend = resolve;
        window.speechSynthesis.speak(u);
      });
    }
  }

  // --- File upload (.txt) ---
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/text\/plain|\.txt$/i.test(f.type) && !/\.txt$/i.test(f.name)) {
      alert("Please upload a .txt file for now.");
      return;
    }
    const text = await f.text();
    setSyllabus(text);
  };

  // --- Text course pack generator ---
  const generatePack = async () => {
    setBusy(true);
    setErr("");
    setOut((v) => v + "\n\n📝 Generating course pack…");
    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, syllabus, language }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Generation failed.");
      setOut((v) => v + "\n\n" + (data.output || "(no output)"));
    } catch (e) {
      setErr(e.message || "Network error");
    } finally {
      setBusy(false);
    }
  };

  // --- Q&A while speaking (interrupt flow) ---
  const ask = async (q) => {
    setBusy(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, syllabus, language }),
      });
      const data = await r.json();
      const reply = data.output || "(no reply)";
      setOut((v) => v + `\n\nYou: ${q}\nTeacher: ${reply}`);
      await speakChunk(reply, language);
    } catch (e) {
      setErr(e.message || "Chat failed");
    } finally {
      setBusy(false);
    }
  };

  // --- Start a voice lesson from /api/explain (returns small chunks) ---
  const startVoiceLesson = async () => {
    if (!subject || !syllabus) {
      alert("Please enter Subject and Syllabus (paste or upload).");
      return;
    }
    if (speaking) return;
    setBusy(true);
    setErr("");
    setOut((v) => v + "\n\n▶ Starting voice lesson…");
    try {
      const r = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, syllabus, language }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Could not create lecture script.");
      const chunks = (data.script || []).filter(Boolean);
      setScript(chunks);
      speakIdx.current = 0;
      interrupted.current = false;
      setSpeaking(true);

      for (; speakIdx.current < chunks.length; speakIdx.current++) {
        if (interrupted.current) break;
        await speakChunk(chunks[speakIdx.current], language);
      }
      setSpeaking(false);
      setOut((v) => v + "\n\n⏹ Voice lesson ended.");
    } catch (e) {
      setErr(e.message || "Voice lesson failed");
      setSpeaking(false);
    } finally {
      setBusy(false);
    }
  };

  const stopVoice = async () => {
    await stopSpeaking();
    setSpeaking(false);
    interrupted.current = true;
  };

  // --- Interrupt & Ask (press/hold to speak) ---

  const recRef = useRef(null);
  const [listening, setListening] = useState(false);
  const transcriptRef = useRef("");
  const listenTimeoutRef = useRef(null);

  function getRecognizer(langCode) {
    const SR =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) return null;
    const rec = new SR();
    rec.lang = langCode;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    return rec;
  }

  // start listening on press
  const startInterrupt = async () => {
    if (!speaking || listening) return;

    interrupted.current = true;
    await stopSpeaking();
    setSpeaking(false);

    const langCode = language === "hi" ? "hi-IN" : "en-IN"; // 'mixed' -> en-IN
    const rec = recRef.current || getRecognizer(langCode);
    if (!rec) {
      const q = prompt("Mic not available. Type your question:");
      if (q) {
        const remaining = script.slice(speakIdx.current);
        resumeQueue.current = remaining;
        setOut((v) => v + `\n\n🛑 Interrupted. You asked: "${q}"`);
        ask(q).then(resumeLecture);
      }
      return;
    }

    recRef.current = rec;
    transcriptRef.current = "";
    setListening(true);

    rec.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) {
          transcriptRef.current += (r[0]?.transcript || "") + " ";
        }
      }
    };

    rec.onerror = () => {
      setListening(false);
      try { rec.stop(); } catch {}
      const remaining = script.slice(speakIdx.current);
      resumeQueue.current = remaining;
      setOut((v) => v + "\n\n(⚠️ Mic error. Resuming lecture.)");
      resumeLecture();
    };

    rec.onend = async () => {
      setListening(false);
      clearTimeout(listenTimeoutRef.current);

      const q = (transcriptRef.current || "").trim();
      const remaining = script.slice(speakIdx.current);
      resumeQueue.current = remaining;

      if (q) {
        setOut((v) => v + `\n\n🛑 Interrupted. You asked: "${q}"`);
        await ask(q);
      } else {
        setOut((v) => v + "\n\n(ℹ️ No speech captured.)");
      }
      await resumeLecture();
    };

    try {
      rec.start();
      // safety timeout: stop automatically so it can't hang
      listenTimeoutRef.current = setTimeout(() => {
        try { rec.stop(); } catch {}
      }, 8000);
    } catch {
      const remaining = script.slice(speakIdx.current);
      resumeQueue.current = remaining;
      setOut((v) => v + "\n\n(⚠️ Could not access mic. Resuming lecture.)");
      resumeLecture();
    }
  };

  // stop listening on release
  const endInterrupt = () => {
    if (!listening) return;
    const rec = recRef.current;
    try { rec && rec.stop(); } catch {}
    clearTimeout(listenTimeoutRef.current);
  };

  const resumeLecture = async () => {
    const rest = resumeQueue.current || [];
    resumeQueue.current = [];
    if (!rest.length) return;
    setSpeaking(true);
    interrupted.current = false;
    for (let i = 0; i < rest.length; i++) {
      if (interrupted.current) break;
      await speakChunk(rest[i], language);
    }
    setSpeaking(false);
    setOut((v) => v + "\n\n⏯ Lecture resumed & completed.");
  };

  // --- PPT on demand ---
  const generatePPT = async () => {
    if (!subject || !syllabus) {
      alert("Please enter Subject and Syllabus first.");
      return;
    }
    setBusy(true);
    try {
      // 1) Ask model for slide bullets
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, syllabus, language, slidesOnly: true }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Slide plan failed.");
      const slides = data.slides || [];
      if (!slides.length) {
        alert("Model did not produce slide bullets.");
        return;
      }

      // 2) Build PPT from bullets
      const pr = await fetch("/api/ppt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slides,
          fileName: `${subject.replace(/\W+/g, "_")}-TBV2`,
        }),
      });
      if (!pr.ok) throw new Error("PPT build failed.");
      const blob = await pr.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${subject.replace(/\W+/g, "_")}-TBV2.pptx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e.message || "PPT failed");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    setOut(
      "Welcome to Teaching Bot V2 · Voice-enabled.\n" +
        "1) Enter subject + syllabus (paste or upload .txt)\n" +
        "2) Click ▶ Start Voice Lesson\n" +
        "3) Hold the red button to interrupt & ask\n" +
        "4) Generate PPT on demand\n" +
        "5) Adjust voice speed with the slider"
    );
  }, []);

  return (
    <div className="container">
      <h1 className="hero">Teaching Bot V2</h1>
      <div className="sub">
        Voice teacher • Upload syllabus • Interrupt anytime • Slides on demand
      </div>

      <div className="grid grid-2">
        {/* Left column: controls */}
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <span className="badge">🎙 Voice ready</span>
            <span className="badge">Language: {language}</span>
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Subject</label>
            <input
              className="input"
              placeholder="e.g., Data Visualization"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="row" style={{ marginTop: 10 }}>
            <div style={{ flex: 1 }}>
              <label>Syllabus (paste)</label>
              <textarea
                className="textarea"
                value={syllabus}
                onChange={(e) => setSyllabus(e.target.value)}
              />
            </div>
            <div style={{ width: 280 }}>
              <label>Upload .txt</label>
              <input className="input" type="file" accept=".txt,text/plain" onChange={onFile} />

              <label style={{ marginTop: 10 }}>Language</label>
              <select
                className="select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="mixed">Hinglish</option>
              </select>

              {/* Voice speed control */}
              <label style={{ marginTop: 10 }}>
                Voice speed: {voiceRate.toFixed(2)}×
              </label>
              <input
                className="input"
                type="range"
                min="0.75"
                max="1.5"
                step="0.05"
                value={voiceRate}
                onChange={(e) => setVoiceRate(parseFloat(e.target.value))}
              />
              <div className="row" style={{ marginTop: 6, gap: 8 }}>
                <button className="btn secondary" onClick={() => setVoiceRate(0.9)}>0.90×</button>
                <button className="btn secondary" onClick={() => setVoiceRate(1.0)}>1.00×</button>
                <button className="btn secondary" onClick={() => setVoiceRate(1.2)}>1.20×</button>
              </div>
            </div>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={startVoiceLesson} disabled={busy || speaking}>
              ▶ Start Voice Lesson
            </button>
            <button className="btn secondary" onClick={stopVoice} disabled={!speaking}>
              ⏹ Stop
            </button>
            <button
              className="btn warn"
              onMouseDown={startInterrupt}
              onTouchStart={startInterrupt}
              onMouseUp={endInterrupt}
              onTouchEnd={endInterrupt}
              disabled={!speaking}
              title="Press & hold to interrupt the teacher and ask a question"
            >
              🛑 Hold to Interrupt & Ask
            </button>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={generatePack} disabled={busy}>
              📝 Generate Course Pack (text)
            </button>
            <button className="btn secondary" onClick={generatePPT} disabled={busy}>
              📑 Generate PPT on demand
            </button>
          </div>
        </div>

        {/* Right column: console */}
        <div className="card">
          <label>Console</label>
          <div className="log">{out}</div>
          {err && (
            <div
              className="log"
              style={{ borderColor: "#ff8080", color: "#ffdede", background: "#2a0b0b" }}
            >
              Error: {err}
            </div>
          )}
          {busy && <div className="badge" style={{ marginTop: 8 }}>Working…</div>}
        </div>
      </div>
    </div>
  );
}
