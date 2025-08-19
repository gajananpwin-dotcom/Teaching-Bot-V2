import { useEffect, useRef, useState } from "react";

const hasSpeech = typeof window !== "undefined" && ("speechSynthesis" in window);
const getRecog = () => {
  if (typeof window === "undefined") return null;
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  return R ? new R() : null;
};

export default function Home() {
  const [subject, setSubject] = useState("");
  const [syllabus, setSyllabus] = useState("");
  const [language, setLanguage] = useState("en");
  const [out, setOut] = useState("");            // text output pane
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Voice lecture state
  const [speaking, setSpeaking] = useState(false);
  const [script, setScript] = useState([]);      // array of short chunks to speak
  const speakIdx = useRef(0);
  const resumeQueue = useRef([]);                // pending chunks after QA
  const recRef = useRef(null);                   // STT instance
  const interrupted = useRef(false);

  // feed TTS a short chunk
  const say = (txt) => new Promise((resolve) => {
    if (!hasSpeech) return resolve();
    const u = new SpeechSynthesisUtterance(txt);
    u.rate = 1.02; u.pitch = 1.0;
    u.onend = resolve;
    window.speechSynthesis.speak(u);
  });

  // parse upload (.txt)
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/text\/plain|\.txt$/i.test(f.type) && !/\.txt$/i.test(f.name)) {
      alert("For now, upload .txt files.");
      return;
    }
    const text = await f.text();
    setSyllabus(text);
  };

  // Generate course pack (still text output)
  const generatePack = async () => {
    setBusy(true); setErr(""); setOut("");
    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, syllabus, language }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Failed to generate.");
      setOut(data.output || "(no output)");
    } catch (e) { setErr(e.message || "Network error"); }
    finally { setBusy(false); }
  };

  // Ask a voice (or typed) question while speaking
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
      setOut(v => v + `\n\nYou: ${q}\nTeacher: ${reply}`);
      // speak answer then resume lecture
      if (hasSpeech) {
        await say(reply);
      }
    } catch (e) {
      setErr(e.message || "Chat failed");
    } finally { setBusy(false); }
  };

  // Start voice lesson: get a lecture script and speak it chunk-by-chunk
  const startVoiceLesson = async () => {
    if (!hasSpeech) { alert("Speech not supported in this browser."); return; }
    if (!subject || !syllabus) { alert("Add subject & syllabus first."); return; }
    if (speaking) return;

    setBusy(true); setErr(""); setOut(v => v + "\n\n▶ Starting voice lesson…");
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
      setSpeaking(true);
      interrupted.current = false;

      // speak sequentially; if user interrupts, break
      for (; speakIdx.current < chunks.length; speakIdx.current++) {
        if (interrupted.current) break;
        await say(chunks[speakIdx.current]);
      }
      setSpeaking(false);
      setOut(v => v + "\n\n⏹ Voice lesson ended.");
    } catch (e) {
      setErr(e.message || "Voice lesson failed.");
      setSpeaking(false);
    } finally { setBusy(false); }
  };

  const stopVoice = () => {
    if (hasSpeech) window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  // Interrupt → capture voice question → bot answers → resume remaining chunks
  const holdToAsk = () => {
    if (!speaking) return;               // only when lecture is on
    interrupted.current = true;
    if (hasSpeech) window.speechSynthesis.cancel();
    setSpeaking(false);

    if (!recRef.current) recRef.current = getRecog();
    const rec = recRef.current;
    if (!rec) { alert("Browser STT not available. Type your question instead."); return; }

    rec.lang = language === "hi" ? "hi-IN" : "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = async (ev) => {
      const text = ev.results?.[0]?.[0]?.transcript || "";
      if (text) {
        // save remaining chunks for resume
        const remaining = script.slice(speakIdx.current);
        resumeQueue.current = remaining;
        setOut(v => v + `\n\n🛑 Interrupted. You asked: "${text}"`);
        await ask(text);
        // resume
        await resumeLecture();
      }
    };
    rec.onerror = () => { setErr("Mic error."); };
    rec.start();
  };

  const resumeLecture = async () => {
    if (!hasSpeech) return;
    setSpeaking(true);
    interrupted.current = false;
    const rest = resumeQueue.current || [];
    resumeQueue.current = [];
    for (let i = 0; i < rest.length; i++) {
      if (interrupted.current) break;
      await say(rest[i]);
    }
    setSpeaking(false);
    setOut(v => v + "\n\n⏯ Lecture resumed & completed.");
  };

  // PPT only when asked: request slides, then download ppt
  const generatePPT = async () => {
    if (!subject || !syllabus) { alert("Add subject & syllabus first."); return; }
    setBusy(true);
    try {
      // Ask LLM for slide bullets
      const r = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject, syllabus, language,
          slidesOnly: true
        })
      });
      const data = await r.json();
      const slides = data.slides || []; // generate.js will provide slides if slidesOnly=true
      if (!slides.length) { alert("Model did not return slide bullets."); return; }

      // Build PPT
      const pr = await fetch("/api/ppt", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slides, fileName: `${subject.replace(/\W+/g,'_')}-TBV2` })
      });
      if (!pr.ok) { alert("PPT build failed"); return; }
      const blob = await pr.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${subject.replace(/\W+/g,'_')}-TBV2.pptx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { setErr(e.message || "PPT failed"); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    setOut("Welcome to Teaching Bot V2 · voice enabled.\nTip: Hold the “Interrupt & Ask” button during a lecture.");
  }, []);

  return (
    <div className="container">
      <h1 className="hero">Teaching Bot V2</h1>
      <div className="sub">Voice teacher • Upload syllabus • Interrupt anytime • Slides on demand</div>

      <div className="grid grid-2">
        <div className="card">
          <div className="row" style={{justifyContent:"space-between", alignItems:"center"}}>
            <span className="badge">🎙 Voice ready {hasSpeech ? "✓" : "✕"}</span>
            <span className="badge">Language: {language}</span>
          </div>

          <div style={{marginTop:12}}>
            <label>Subject</label>
            <input className="input" placeholder="e.g., Data Visualization" value={subject} onChange={e=>setSubject(e.target.value)} />
          </div>

          <div className="row" style={{marginTop:10}}>
            <div style={{flex:1}}>
              <label>Syllabus (paste)</label>
              <textarea className="textarea" value={syllabus} onChange={e=>setSyllabus(e.target.value)} />
            </div>
            <div style={{width:280}}>
              <label>Upload .txt</label>
              <input className="input" type="file" accept=".txt,text/plain" onChange={onFile} />
              <label style={{marginTop:10}}>Language</label>
              <select className="select" value={language} onChange={e=>setLanguage(e.target.value)}>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="mixed">Hinglish</option>
              </select>
            </div>
          </div>

          <div className="row" style={{marginTop:12}}>
            <button className="btn" onClick={startVoiceLesson} disabled={busy || speaking}>▶ Start Voice Lesson</button>
            <button className="btn secondary" onClick={stopVoice} disabled={!speaking}>⏹ Stop</button>
            <button className="btn warn" onMouseDown={holdToAsk} onTouchStart={holdToAsk} disabled={!speaking}>
              🛑 Hold to Interrupt & Ask
            </button>
          </div>

          <div className="row" style={{marginTop:12}}>
            <button className="btn" onClick={generatePack} disabled={busy}>📝 Generate Course Pack (text)</button>
            <button className="btn secondary" onClick={generatePPT} disabled={busy}>📑 Generate PPT on demand</button>
          </div>
        </div>

        <div className="card">
          <label>Console</label>
          <div className="log">{out}</div>
          {err && <div className="log" style={{borderColor:"#ff8080", color:"#ffdede", background:"#2a0b0b"}}>Error: {err}</div>}
          {busy && <div className="badge" style={{marginTop:8}}>Working…</div>}
        </div>
      </div>
    </div>
  );
}
