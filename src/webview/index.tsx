import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

const App = () => {
  const [listening, setListening] = useState(false);

  return (
    <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      <h2>CursorVoice</h2>
      <button
        onClick={() => setListening(!listening)}
        style={{ fontSize: '1.2rem', padding: '0.5rem 1rem' }}
      >
        {listening ? '🛑 Stop Listening' : '🎤 Start Listening'}
      </button>
      <div id="waveform" style={{ marginTop: '1rem' }}>
        [waveform placeholder]
      </div>
      <div
        id="transcript"
        style={{
          marginTop: '1rem',
          padding: '0.5rem',
          border: '1px solid #ccc',
          borderRadius: '4px',
          minHeight: '3rem'
        }}
      >
        [transcript will appear here]
      </div>
    </div>
  );
};

const container = document.getElementById('root')!;
createRoot(container).render(<App />); 