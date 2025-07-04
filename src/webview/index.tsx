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
  type: 'init' | 'transcript-ack' | 'ai-response' | 'error' | 'settings-data' | 'settings-saved' | 'context-data' |
        'conversation-saved' | 'conversation-loaded' | 'conversation-list' | 'conversation-deleted' | 'conversation-new' |
        'keyboard-shortcut';
  data: any;
}

interface Settings {
  aiProvider: string;
  openaiApiKey: string;
  claudeApiKey: string;
  openaiModel: string;
  claudeModel: string;
}

interface CodeContext {
  fileName?: string;
  language?: string;
  fileContent?: string;
  selectedText?: string;
  cursorPosition?: {
    line: number;
    character: number;
  };
  workspaceName?: string;
  relativePath?: string;
}

interface ConversationMessage {
  id: string;
  timestamp: string;
  type: 'user' | 'assistant';
  content: string;
  provider?: string;
  includedContext?: boolean;
  context?: CodeContext;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
}

interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

const App = () => {
  const [currentView, setCurrentView] = useState<'main' | 'settings' | 'history'>('main');
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
  const [successMessage, setSuccessMessage] = useState('');
  
  // Context awareness state
  const [includeContext, setIncludeContext] = useState(true);
  const [currentContext, setCurrentContext] = useState<CodeContext>({});
  const [showContextPreview, setShowContextPreview] = useState(false);
  const [includedContext, setIncludedContext] = useState(false);
  
  // Settings state
  const [settings, setSettings] = useState<Settings>({
    aiProvider: 'openai',
    openaiApiKey: '',
    claudeApiKey: '',
    openaiModel: 'gpt-4',
    claudeModel: 'claude-3-sonnet-20240229'
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState(false);
  
  // Conversation history state
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [conversationTitle, setConversationTitle] = useState('');
  const [isNewConversation, setIsNewConversation] = useState(true);
  
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
          // Request initial context
          requestContext();
          break;
        case 'transcript-ack':
          console.log('Transcript acknowledged:', message.data.timestamp);
          break;
        case 'ai-response':
          setAiResponse(message.data.response);
          setAiResponseProvider(message.data.provider || '');
          setIncludedContext(message.data.includedContext || false);
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
        case 'settings-data':
          setSettings(message.data);
          setSettingsLoading(false);
          break;
        case 'settings-saved':
          setSettingsLoading(false);
          if (message.data.success) {
            setSuccessMessage(message.data.message);
            setTimeout(() => setSuccessMessage(''), 3000);
          } else {
            setError(message.data.message);
          }
          break;
        case 'context-data':
          setCurrentContext(message.data);
          break;
        case 'conversation-saved':
          if (message.data.success) {
            setSuccessMessage(message.data.message);
            setCurrentConversation(prev => prev ? { ...prev, id: message.data.conversationId } : null);
            setIsNewConversation(false);
            setTimeout(() => setSuccessMessage(''), 3000);
          } else {
            setError(message.data.message);
          }
          break;
        case 'conversation-loaded':
          if (message.data.error) {
            setError(message.data.error);
          } else {
            setCurrentConversation(message.data);
            setConversationMessages(message.data.messages || []);
            setConversationTitle(message.data.title);
            setIsNewConversation(false);
            // Load the last user message and AI response
            const messages = message.data.messages || [];
            const lastUserMessage = messages.filter((m: ConversationMessage) => m.type === 'user').pop();
            const lastAssistantMessage = messages.filter((m: ConversationMessage) => m.type === 'assistant').pop();
            if (lastUserMessage) {
              setFinalTranscript(lastUserMessage.content);
            }
            if (lastAssistantMessage) {
              setAiResponse(lastAssistantMessage.content);
              setAiResponseProvider(lastAssistantMessage.provider || '');
              setIncludedContext(lastAssistantMessage.includedContext || false);
            }
          }
          break;
        case 'conversation-list':
          if (message.data.error) {
            setError(message.data.error);
          } else {
            setConversations(message.data);
          }
          break;
        case 'conversation-deleted':
          if (message.data.success) {
            setSuccessMessage(message.data.message);
            setTimeout(() => setSuccessMessage(''), 3000);
          } else {
            setError(message.data.message);
          }
          break;
        case 'conversation-new':
          startNewConversation();
          break;
        case 'keyboard-shortcut':
          handleKeyboardShortcut(message.data);
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

  const requestContext = () => {
    vscode.postMessage({
      type: 'context-get',
      data: {}
    });
  };

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
    setIncludedContext(false);
  };

  const sendToAI = () => {
    if (!finalTranscript.trim()) {
      setError('No transcript to send to AI');
      return;
    }
    
    if (!hasApiKey) {
      setError(`No API key configured for ${aiProvider}. Please configure it in the Settings.`);
      return;
    }
    
    setAiLoading(true);
    setError(null);
    
    // Send AI request to extension
    vscode.postMessage({
      type: 'ai-request',
      data: {
        prompt: finalTranscript,
        context: 'Voice transcription for AI processing',
        includeContext: includeContext
      }
    });
  };

  const openSettings = () => {
    setCurrentView('settings');
    setSettingsLoading(true);
    setError(null);
    setSuccessMessage('');
    
    // Request current settings from extension
    vscode.postMessage({
      type: 'settings-get',
      data: {}
    });
  };

  const closeSettings = () => {
    setCurrentView('main');
    setError(null);
    setSuccessMessage('');
  };

  const saveSettings = () => {
    setSettingsLoading(true);
    setError(null);
    
    // Send settings to extension
    vscode.postMessage({
      type: 'settings-save',
      data: settings
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

  const maskApiKey = (key: string) => {
    if (!key) return '';
    if (key.length <= 8) return '•'.repeat(key.length);
    return key.substring(0, 4) + '•'.repeat(key.length - 8) + key.substring(key.length - 4);
  };

  const formatContextPreview = (context: CodeContext) => {
    if (!context.fileName) return 'No file open';
    
    let preview = `📁 ${context.workspaceName || 'Unknown workspace'}\n`;
    preview += `📄 ${context.relativePath || context.fileName}\n`;
    preview += `💻 ${context.language || 'unknown'}\n`;
    
    if (context.cursorPosition) {
      preview += `📍 Line ${context.cursorPosition.line}, Col ${context.cursorPosition.character}\n`;
    }
    
    if (context.selectedText) {
      preview += `🎯 ${context.selectedText.length} characters selected\n`;
    }
    
    if (context.fileContent) {
      const lines = context.fileContent.split('\n').length;
      preview += `📝 ${lines} lines of code`;
    }
    
    return preview;
  };

  // Conversation history functions
  const generateMessageId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  const startNewConversation = () => {
    setCurrentConversation(null);
    setConversationMessages([]);
    setConversationTitle('');
    setIsNewConversation(true);
    setFinalTranscript('');
    setAiResponse('');
    setAiResponseProvider('');
    setIncludedContext(false);
    setCurrentView('main');
  };

  const saveCurrentConversation = () => {
    if (!finalTranscript && conversationMessages.length === 0) {
      setError('No conversation to save');
      return;
    }

    const messages = [...conversationMessages];
    
    // Add current user message if there's a transcript
    if (finalTranscript.trim()) {
      const userMessage: ConversationMessage = {
        id: generateMessageId(),
        timestamp: new Date().toISOString(),
        type: 'user',
        content: finalTranscript,
        context: includedContext ? currentContext : undefined,
        includedContext: includedContext
      };
      messages.push(userMessage);
    }

    // Add current AI response if there's one
    if (aiResponse.trim()) {
      const assistantMessage: ConversationMessage = {
        id: generateMessageId(),
        timestamp: new Date().toISOString(),
        type: 'assistant',
        content: aiResponse,
        provider: aiResponseProvider,
        includedContext: includedContext
      };
      messages.push(assistantMessage);
    }

    const title = conversationTitle || finalTranscript.substring(0, 50) + (finalTranscript.length > 50 ? '...' : '');

    vscode.postMessage({
      type: 'conversation-save',
      data: {
        conversationId: currentConversation?.id,
        title: title,
        messages: messages
      }
    });
  };

  const loadConversation = (conversationId: string) => {
    vscode.postMessage({
      type: 'conversation-load',
      data: { conversationId }
    });
  };

  const deleteConversation = (conversationId: string) => {
    if (confirm('Are you sure you want to delete this conversation?')) {
      vscode.postMessage({
        type: 'conversation-delete',
        data: { conversationId }
      });
    }
  };

  const openHistory = () => {
    setCurrentView('history');
    vscode.postMessage({
      type: 'conversation-list',
      data: {}
    });
  };

  const closeHistory = () => {
    setCurrentView('main');
  };

  const handleKeyboardShortcut = (data: any) => {
    switch (data.action) {
      case 'toggle-listening':
        toggleListening();
        break;
      case 'send-to-ai':
        sendToAI();
        break;
      case 'clear-transcript':
        clearTranscript();
        break;
      case 'open-settings':
        openSettings();
        break;
      case 'open-history':
        openHistory();
        break;
      case 'save-conversation':
        saveCurrentConversation();
        break;
      default:
        console.warn('Unknown keyboard shortcut action:', data.action);
    }
  };

  if (currentView === 'settings') {
    return (
      <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
          <button
            onClick={closeSettings}
            style={{
              fontSize: '1.2rem',
              padding: '0.25rem 0.5rem',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              marginRight: '1rem'
            }}
          >
            ← Back
          </button>
          <h2 style={{ margin: 0 }}>⚙️ Settings</h2>
        </div>

        {settingsLoading && (
          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#e3f2fd', 
            borderRadius: '4px',
            marginBottom: '1rem',
            fontSize: '0.9rem'
          }}>
            Loading settings...
          </div>
        )}

        {successMessage && (
          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#e8f5e8', 
            color: '#2e7d32',
            borderRadius: '4px',
            marginBottom: '1rem'
          }}>
            ✅ {successMessage}
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

        <div style={{ marginBottom: '2rem' }}>
          <h3>🤖 AI Provider</h3>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
              <input
                type="radio"
                name="aiProvider"
                value="openai"
                checked={settings.aiProvider === 'openai'}
                onChange={(e) => setSettings({...settings, aiProvider: e.target.value})}
                style={{ marginRight: '0.5rem' }}
              />
              🤖 OpenAI (GPT-4, GPT-3.5)
            </label>
            <label style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="radio"
                name="aiProvider"
                value="claude"
                checked={settings.aiProvider === 'claude'}
                onChange={(e) => setSettings({...settings, aiProvider: e.target.value})}
                style={{ marginRight: '0.5rem' }}
              />
              🧠 Claude (Anthropic)
            </label>
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, marginRight: '1rem' }}>🔑 API Keys</h3>
            <button
              onClick={() => setShowApiKeys(!showApiKeys)}
              style={{
                fontSize: '0.8rem',
                padding: '0.25rem 0.5rem',
                backgroundColor: '#f5f5f5',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {showApiKeys ? '👁️ Hide' : '👁️ Show'}
            </button>
          </div>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              OpenAI API Key:
            </label>
            <input
              type={showApiKeys ? 'text' : 'password'}
              value={settings.openaiApiKey}
              onChange={(e) => setSettings({...settings, openaiApiKey: e.target.value})}
              placeholder="sk-..."
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '0.9rem',
                fontFamily: 'monospace'
              }}
            />
            {!showApiKeys && settings.openaiApiKey && (
              <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                Current: {maskApiKey(settings.openaiApiKey)}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Claude API Key:
            </label>
            <input
              type={showApiKeys ? 'text' : 'password'}
              value={settings.claudeApiKey}
              onChange={(e) => setSettings({...settings, claudeApiKey: e.target.value})}
              placeholder="sk-ant-..."
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '0.9rem',
                fontFamily: 'monospace'
              }}
            />
            {!showApiKeys && settings.claudeApiKey && (
              <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                Current: {maskApiKey(settings.claudeApiKey)}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h3>🎯 Model Selection</h3>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              OpenAI Model:
            </label>
            <select
              value={settings.openaiModel}
              onChange={(e) => setSettings({...settings, openaiModel: e.target.value})}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '0.9rem'
              }}
            >
              <option value="gpt-4">GPT-4 (Most capable)</option>
              <option value="gpt-4-turbo">GPT-4 Turbo (Fast & capable)</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Fast & economical)</option>
            </select>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Claude Model:
            </label>
            <select
              value={settings.claudeModel}
              onChange={(e) => setSettings({...settings, claudeModel: e.target.value})}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '0.9rem'
              }}
            >
              <option value="claude-3-opus-20240229">Claude 3 Opus (Most capable)</option>
              <option value="claude-3-sonnet-20240229">Claude 3 Sonnet (Balanced)</option>
              <option value="claude-3-haiku-20240307">Claude 3 Haiku (Fast)</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={saveSettings}
            disabled={settingsLoading}
            style={{
              flex: 1,
              fontSize: '1.1rem',
              padding: '0.75rem 1.5rem',
              backgroundColor: settingsLoading ? '#999' : '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: settingsLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {settingsLoading ? '💾 Saving...' : '💾 Save Settings'}
          </button>
          
          <button
            onClick={closeSettings}
            style={{
              fontSize: '1rem',
              padding: '0.75rem 1rem',
              backgroundColor: '#f5f5f5',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>

        <div style={{ 
          marginTop: '2rem', 
          padding: '1rem', 
          backgroundColor: '#f9f9f9', 
          borderRadius: '4px',
          fontSize: '0.85rem',
          color: '#666'
        }}>
          <strong>💡 Tips:</strong>
          <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
            <li>Get OpenAI API keys at <code>platform.openai.com</code></li>
            <li>Get Claude API keys at <code>console.anthropic.com</code></li>
            <li>API keys are stored securely in VS Code settings</li>
            <li>You can switch between providers anytime</li>
          </ul>
        </div>
      </div>
    );
  }

  if (currentView === 'history') {
    return (
      <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
          <button
            onClick={closeHistory}
            style={{
              fontSize: '1.2rem',
              padding: '0.25rem 0.5rem',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              marginRight: '1rem'
            }}
          >
            ← Back
          </button>
          <h2 style={{ margin: 0, marginRight: '1rem' }}>📚 Conversation History</h2>
          <button
            onClick={startNewConversation}
            style={{
              fontSize: '1rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ✨ New Conversation
          </button>
        </div>

        {successMessage && (
          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#e8f5e8', 
            color: '#2e7d32',
            borderRadius: '4px',
            marginBottom: '1rem'
          }}>
            ✅ {successMessage}
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
          <h3>💬 Saved Conversations</h3>
          {conversations.length === 0 ? (
            <div style={{ 
              padding: '2rem', 
              textAlign: 'center', 
              color: '#666',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px'
            }}>
              No conversations saved yet. Start a new conversation to save your AI interactions!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {conversations.map((conversation) => (
                <div 
                  key={conversation.id}
                  style={{
                    padding: '1rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    backgroundColor: '#f9f9f9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>
                      {conversation.title}
                    </h4>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>
                      {conversation.messageCount} messages • Created: {new Date(conversation.createdAt).toLocaleDateString()}
                      {conversation.updatedAt !== conversation.createdAt && 
                        ` • Updated: ${new Date(conversation.updatedAt).toLocaleDateString()}`
                      }
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                    <button
                      onClick={() => loadConversation(conversation.id)}
                      style={{
                        fontSize: '0.9rem',
                        padding: '0.5rem 1rem',
                        backgroundColor: '#2196f3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      📂 Load
                    </button>
                    <button
                      onClick={() => deleteConversation(conversation.id)}
                      style={{
                        fontSize: '0.9rem',
                        padding: '0.5rem 1rem',
                        backgroundColor: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ 
          marginTop: '2rem', 
          padding: '1rem', 
          backgroundColor: '#f9f9f9', 
          borderRadius: '4px',
          fontSize: '0.85rem',
          color: '#666'
        }}>
          <strong>💡 About Conversations:</strong>
          <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
            <li>Conversations are automatically saved when you interact with AI</li>
            <li>Each conversation includes your voice transcripts and AI responses</li>
            <li>Context information is preserved with each message</li>
            <li>Load a conversation to continue where you left off</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>CursorVoice</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={openHistory}
            style={{
              fontSize: '1rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#f5f5f5',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            📚 History
          </button>
          <button
            onClick={openSettings}
            style={{
              fontSize: '1rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#f5f5f5',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ⚙️ Settings
          </button>
        </div>
      </div>
      
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

      <div style={{ 
        marginBottom: '1rem', 
        padding: '0.5rem', 
        backgroundColor: isNewConversation ? '#e8f5e8' : '#fff3e0', 
        borderRadius: '4px',
        fontSize: '0.9rem'
      }}>
        <strong>Conversation:</strong> {isNewConversation ? 
          '✨ New conversation' : 
          `💬 ${currentConversation?.title || 'Loaded conversation'}`
        }
      </div>

      {/* Context Awareness Section */}
      <div style={{ 
        marginBottom: '1rem', 
        padding: '0.75rem', 
        backgroundColor: '#f3e5f5', 
        borderRadius: '4px',
        fontSize: '0.9rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <strong>🧠 Context Awareness:</strong>
            <label style={{ display: 'flex', alignItems: 'center', marginLeft: '0.5rem' }}>
              <input
                type="checkbox"
                checked={includeContext}
                onChange={(e) => setIncludeContext(e.target.checked)}
                style={{ marginRight: '0.25rem' }}
              />
              Include current code context
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={requestContext}
              style={{
                fontSize: '0.8rem',
                padding: '0.25rem 0.5rem',
                backgroundColor: '#e1bee7',
                border: '1px solid #ba68c8',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🔄 Refresh
            </button>
            <button
              onClick={() => setShowContextPreview(!showContextPreview)}
              style={{
                fontSize: '0.8rem',
                padding: '0.25rem 0.5rem',
                backgroundColor: '#e1bee7',
                border: '1px solid #ba68c8',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {showContextPreview ? '👁️ Hide' : '👁️ Preview'}
            </button>
          </div>
        </div>
        
        <div style={{ fontSize: '0.8rem', color: '#666' }}>
          {formatContextPreview(currentContext)}
        </div>

        {showContextPreview && currentContext.fileContent && (
          <div style={{
            marginTop: '0.5rem',
            padding: '0.5rem',
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '0.75rem',
            maxHeight: '200px',
            overflow: 'auto',
            fontFamily: 'monospace'
          }}>
            <strong>File Content Preview:</strong>
            <pre style={{ margin: '0.25rem 0 0 0', whiteSpace: 'pre-wrap' }}>
              {currentContext.fileContent.substring(0, 500)}
              {currentContext.fileContent.length > 500 && '...'}
            </pre>
          </div>
        )}
      </div>
      
      {successMessage && (
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#e8f5e8', 
          color: '#2e7d32',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          ✅ {successMessage}
        </div>
      )}
      
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
          {aiLoading ? '🤖 Processing...' : `${getProviderIcon(aiProvider)} Send to ${getProviderName(aiProvider)}${includeContext ? ' (with context)' : ''}`}
        </button>
        
        <button
          onClick={saveCurrentConversation}
          disabled={!finalTranscript.trim() && !aiResponse.trim()}
          style={{ 
            fontSize: '1rem', 
            padding: '0.5rem 1rem',
            backgroundColor: (!finalTranscript.trim() && !aiResponse.trim()) ? '#999' : '#9c27b0',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: (!finalTranscript.trim() && !aiResponse.trim()) ? 'not-allowed' : 'pointer'
          }}
        >
          💾 Save Conversation
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
            <strong>
              {getProviderIcon(aiResponseProvider)} {getProviderName(aiResponseProvider)} Response:
              {includedContext && <span style={{ color: '#666', fontSize: '0.9rem' }}> (with context)</span>}
            </strong>
          </div>
          <div style={{ color: '#333', whiteSpace: 'pre-wrap' }}>
            {aiResponse}
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help */}
      <div style={{ 
        marginTop: '2rem', 
        padding: '1rem', 
        backgroundColor: '#f9f9f9', 
        borderRadius: '4px',
        fontSize: '0.85rem',
        color: '#666'
      }}>
        <strong>⌨️ Keyboard Shortcuts:</strong>
        <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
          <li><kbd>Ctrl+Shift+V</kbd> (Mac: <kbd>Cmd+Shift+V</kbd>) - Toggle voice listening</li>
          <li><kbd>Ctrl+Shift+A</kbd> (Mac: <kbd>Cmd+Shift+A</kbd>) - Send to AI</li>
          <li><kbd>Ctrl+Shift+C</kbd> (Mac: <kbd>Cmd+Shift+C</kbd>) - Clear transcript</li>
          <li><kbd>Ctrl+Shift+,</kbd> (Mac: <kbd>Cmd+Shift+,</kbd>) - Open settings</li>
          <li><kbd>Ctrl+Shift+H</kbd> (Mac: <kbd>Cmd+Shift+H</kbd>) - Open history</li>
          <li><kbd>Ctrl+Shift+S</kbd> (Mac: <kbd>Cmd+Shift+S</kbd>) - Save conversation</li>
        </ul>
        <div style={{ fontSize: '0.8rem', fontStyle: 'italic', marginTop: '0.5rem' }}>
          Note: Shortcuts work when CursorVoice panel is open and editor is focused
        </div>
      </div>
      
      <style>{`
        @keyframes waveform {
          0%, 100% { height: 10px; }
          50% { height: 30px; }
        }
        
        kbd {
          background-color: #f7f7f7;
          border: 1px solid #ccc;
          border-radius: 3px;
          box-shadow: 0 1px 0 rgba(0,0,0,0.2), 0 0 0 2px #fff inset;
          color: #333;
          display: inline-block;
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 0.8em;
          font-weight: bold;
          line-height: 1;
          padding: 2px 4px;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
};

const container = document.getElementById('root')!;
createRoot(container).render(<App />); 