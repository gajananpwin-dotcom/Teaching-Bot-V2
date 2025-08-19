import { useState } from 'react';

export default function Home() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: input })
    });

    const data = await res.json();
    setMessages([...messages, { role: 'user', content: input }, { role: 'bot', content: data.reply }]);
    setInput('');
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>📚 Teaching Bot V2</h1>
      <div>
        {messages.map((m, i) => (
          <p key={i}><b>{m.role}:</b> {m.content}</p>
        ))}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask about your syllabus..."
        style={{ width: '70%', marginRight: '1rem' }}
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}
