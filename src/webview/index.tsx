import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

// Extend the Window interface for webview API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    acquireVsCodeApi: () => any;
  }
}

// VS Code webview API
const vscode = window.acquireVsCodeApi();

// Message types for extension communication
interface ExtensionMessage {
  type: 'init' | 'transcript-ack' | 'ai-response' | 'error';
  data: any;
}

const App = () => {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [extensionStatus, setExtensionStatus] = useState('Connecting...');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProvider, setAiProvider] = useState('openai');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [aiResponseProvider, setAiResponseProvider] = useState('');
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Listen for messages from the extension
    const messageHandler = (event: MessageEvent) => {
      const message: ExtensionMessage = event.data;
      
      switch (message.type) {
        case 'init':
          setExtensionStatus('Extension ready');
          setAiProvider(message.data.aiProvider || 'openai');
          setHasApiKey(message.data.hasApiKey || false);
          console.log('Extension capabilities:', message.data.capabilities);
          break;
        case 'transcript-ack':
          console.log('Transcript acknowledged:', message.data.timestamp);
          break;
        case 'ai-response':
          setAiResponse(message.data.response);
          setAiResponseProvider(message.data.provider || '');
          setAiLoading(false);
          if (message.data.status === 'error') {
            setError(message.data.response);
          } else {
            setError(null);
          }
          break;
        case 'error':
          setError(message.data.message);
          setAiLoading(false);
          break;
      }
    };

    window.addEventListener('message', messageHandler);
    
    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, []);

  useEffect(() => {
    // Check if Speech Recognition is supported
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setIsSupported(true);
      
      // Initialize speech recognition
      recognitionRef.current = new SpeechRecognition();
      const recognition = recognitionRef.current;
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => {
        setError(null);
        setListening(true);
        
        // Send status update to extension
        vscode.postMessage({
          type: 'status',
          data: { listening: true }
        });
      };
      
      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscriptLocal = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPart = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscriptLocal += transcriptPart;
          } else {
            interimTranscript += transcriptPart;
          }
        }
        
        setTranscript(interimTranscript);
        if (finalTranscriptLocal) {
          setFinalTranscript(prev => {
            const newFinalTranscript = prev + finalTranscriptLocal;
            
            // Send transcript data to extension
            vscode.postMessage({
              type: 'transcript',
              data: {
                finalTranscript: newFinalTranscript,
                interimTranscript: interimTranscript,
                isListening: true
              }
            });
            
            return newFinalTranscript;
          });
        }
      };
      
      recognition.onerror = (event: any) => {
        const errorMessage = `Speech recognition error: ${event.error}`;
        setError(errorMessage);
        setListening(false);
        
        // Send error to extension
        vscode.postMessage({
          type: 'error',
          data: { message: errorMessage }
        });
      };
      
      recognition.onend = () => {
        setListening(false);
        
        // Send status update to extension
        vscode.postMessage({
          type: 'status',
          data: { listening: false }
        });
      };
    } else {
      setIsSupported(false);
      setError('Speech recognition not supported in this browser');
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleListening = () => {
    if (!isSupported) return;
    
    if (listening) {
      recognitionRef.current.stop();
    } else {
      setTranscript('');
      setError(null);
      recognitionRef.current.start();
    }
  };

  const clearTranscript = () => {
    setTranscript('');
    setFinalTranscript('');
    setAiResponse('');
    setAiResponseProvider('');
  };

  const sendToAI = () => {
    if (!finalTranscript.trim()) {
      setError('No transcript to send to AI');
      return;
    }
    
    if (!hasApiKey) {
      setError(`No API key configured for ${aiProvider}. Please set your API key in VS Code settings.`);
      return;
    }
    
    setAiLoading(true);
    setError(null);
    
    // Send AI request to extension
    vscode.postMessage({
      type: 'ai-request',
      data: {
        prompt: finalTranscript,
        context: 'Voice transcription for AI processing'
      }
    });
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'openai': return '🤖';
      case 'claude': return '🧠';
      default: return '🤖';
    }
  };

  const getProviderName = (provider: string) => {
    switch (provider) {
      case 'openai': return 'OpenAI';
      case 'claude': return 'Claude';
      default: return 'AI';
    }
  };

  return (
    <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      <h2>CursorVoice</h2>
      
      <div style={{ 
        marginBottom: '1rem', 
        padding: '0.5rem', 
        backgroundColor: '#e8f5e8', 
        borderRadius: '4px',
        fontSize: '0.9rem'
      }}>
        <strong>Extension Status:</strong> {extensionStatus}
      </div>
      
      <div style={{ 
        marginBottom: '1rem', 
        padding: '0.5rem', 
        backgroundColor: hasApiKey ? '#e3f2fd' : '#fff3e0', 
        borderRadius: '4px',
        fontSize: '0.9rem'
      }}>
        <strong>AI Provider:</strong> {getProviderIcon(aiProvider)} {getProviderName(aiProvider)}
        {!hasApiKey && (
          <span style={{ color: '#f57c00', marginLeft: '0.5rem' }}>
            (⚠️ API key not configured)
          </span>
        )}
      </div>
      
      {!isSupported && (
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#ffebee', 
          color: '#c62828', 
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.
        </div>
      )}
      
      {error && (
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#ffebee', 
          color: '#c62828', 
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          {error}
        </div>
      )}
      
      <div style={{ marginBottom: '1rem' }}>
        <button
          onClick={toggleListening}
          disabled={!isSupported}
          style={{ 
            fontSize: '1.2rem', 
            padding: '0.5rem 1rem',
            marginRight: '0.5rem',
            backgroundColor: listening ? '#f44336' : '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isSupported ? 'pointer' : 'not-allowed'
          }}
        >
          {listening ? '🛑 Stop Listening' : '🎤 Start Listening'}
        </button>
        
        <button
          onClick={clearTranscript}
          style={{ 
            fontSize: '1rem', 
            padding: '0.5rem 1rem',
            marginRight: '0.5rem',
            backgroundColor: '#ff9800',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Clear
        </button>
        
        <button
          onClick={sendToAI}
          disabled={!finalTranscript.trim() || aiLoading || !hasApiKey}
          style={{ 
            fontSize: '1rem', 
            padding: '0.5rem 1rem',
            backgroundColor: (!finalTranscript.trim() || aiLoading || !hasApiKey) ? '#999' : '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: (!finalTranscript.trim() || aiLoading || !hasApiKey) ? 'not-allowed' : 'pointer'
          }}
        >
          {aiLoading ? '🤖 Processing...' : `${getProviderIcon(aiProvider)} Send to ${getProviderName(aiProvider)}`}
        </button>
      </div>
      
      <div style={{ marginBottom: '1rem' }}>
        <strong>Status:</strong> {listening ? 
          <span style={{ color: '#4caf50' }}>🎤 Listening...</span> : 
          <span style={{ color: '#757575' }}>💤 Not listening</span>
        }
      </div>
      
      <div id="waveform" style={{ marginTop: '1rem' }}>
        {listening && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '2px',
            height: '40px'
          }}>
            {/* Simple animated waveform */}
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                style={{
                  width: '3px',
                  height: Math.random() * 30 + 10 + 'px',
                  backgroundColor: '#4caf50',
                  animation: `waveform 0.5s ease-in-out infinite`,
                  animationDelay: `${i * 0.05}s`
                }}
              />
            ))}
          </div>
        )}
      </div>
      
      <div
        id="transcript"
        style={{
          marginTop: '1rem',
          padding: '1rem',
          border: '1px solid #ccc',
          borderRadius: '4px',
          minHeight: '4rem',
          backgroundColor: '#f5f5f5'
        }}
      >
        <div style={{ marginBottom: '0.5rem' }}>
          <strong>Final Transcript:</strong>
        </div>
        <div style={{ color: '#333', marginBottom: '1rem' }}>
          {finalTranscript || 'No final text yet...'}
        </div>
        
        <div style={{ marginBottom: '0.5rem' }}>
          <strong>Live Transcript:</strong>
        </div>
        <div style={{ color: '#666', fontStyle: 'italic' }}>
          {transcript || 'Speak to see live transcription...'}
        </div>
      </div>
      
      {aiResponse && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            border: '1px solid #2196f3',
            borderRadius: '4px',
            backgroundColor: '#e3f2fd'
          }}
        >
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>{getProviderIcon(aiResponseProvider)} {getProviderName(aiResponseProvider)} Response:</strong>
          </div>
          <div style={{ color: '#333', whiteSpace: 'pre-wrap' }}>
            {aiResponse}
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes waveform {
          0%, 100% { height: 10px; }
          50% { height: 30px; }
        }
      `}</style>
    </div>
  );
};

const container = document.getElementById('root')!;
createRoot(container).render(<App />); 