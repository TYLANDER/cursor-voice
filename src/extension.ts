import * as vscode from 'vscode';
import * as path from 'path';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Message types for webview communication
interface WebviewMessage {
  type: 'transcript' | 'ai-request' | 'error' | 'status' | 'settings-get' | 'settings-save' | 'context-get' | 
        'conversation-save' | 'conversation-load' | 'conversation-list' | 'conversation-delete' | 'conversation-new' |
        'keyboard-shortcut';
  data: any;
}

interface TranscriptMessage {
  type: 'transcript';
  data: {
    finalTranscript: string;
    interimTranscript: string;
    isListening: boolean;
  };
}

interface AIRequestMessage {
  type: 'ai-request';
  data: {
    prompt: string;
    context?: string;
    includeContext?: boolean;
  };
}

interface SettingsMessage {
  type: 'settings-save';
  data: {
    aiProvider: string;
    openaiApiKey: string;
    claudeApiKey: string;
    openaiModel: string;
    claudeModel: string;
  };
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

// AI provider instances
let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

// Extension context for persistent storage
let extensionContext: vscode.ExtensionContext;

// Global webview panel reference for keyboard shortcuts
let globalWebviewPanel: vscode.WebviewPanel | null = null;

export function activate(context: vscode.ExtensionContext) {
  // Store extension context for persistent storage
  extensionContext = context;
  
  // Initialize AI clients
  initializeAIClients();

  const disposable = vscode.commands.registerCommand('cursor-voice.open', () => {
    const panel = vscode.window.createWebviewPanel(
      'cursorVoice',                         // internal view type
      'CursorVoice',                         // panel title
      vscode.ViewColumn.One,                 // show in first column
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'dist')
        ]
      }
    );

    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview.js')
    );

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => {
        switch (message.type) {
          case 'transcript':
            handleTranscriptMessage(message.data, panel);
            break;
          case 'ai-request':
            handleAIRequest(message.data, panel);
            break;
          case 'error':
            handleError(message.data, panel);
            break;
          case 'status':
            handleStatus(message.data, panel);
            break;
          case 'settings-get':
            handleSettingsGet(panel);
            break;
          case 'settings-save':
            handleSettingsSave(message.data, panel);
            break;
          case 'context-get':
            handleContextGet(panel);
            break;
          case 'conversation-save':
            handleConversationSave(message.data, panel);
            break;
          case 'conversation-load':
            handleConversationLoad(message.data, panel);
            break;
          case 'conversation-list':
            handleConversationList(panel);
            break;
          case 'conversation-delete':
            handleConversationDelete(message.data, panel);
            break;
          case 'conversation-new':
            handleConversationNew(panel);
            break;
          case 'keyboard-shortcut':
            // Keyboard shortcuts are handled by sending messages to webview
            // No special handling needed in extension
            break;
        }
      },
      undefined,
      context.subscriptions
    );

    panel.webview.html = `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1.0">
      <title>CursorVoice</title>
    </head>
    <body>
      <div id="root"></div>
      <script src="${scriptUri}"></script>
    </body>
    </html>`;

    // Send initial message to webview
    const config = vscode.workspace.getConfiguration('cursorVoice');
    const aiProvider = config.get<string>('aiProvider', 'openai');
    const hasApiKey = getApiKey(aiProvider) !== '';
    
    panel.webview.postMessage({
      type: 'init',
      data: { 
        status: 'Extension ready',
        capabilities: ['speech-recognition', 'ai-processing', 'context-awareness', 'conversation-history'],
        aiProvider: aiProvider,
        hasApiKey: hasApiKey
      }
    });

    // Store panel reference for keyboard shortcuts
    globalWebviewPanel = panel;

    // Handle panel disposal
    panel.onDidDispose(() => {
      globalWebviewPanel = null;
    }, null, context.subscriptions);
  });

  // Register keyboard shortcut commands
  const toggleListeningDisposable = vscode.commands.registerCommand('cursor-voice.toggleListening', () => {
    if (globalWebviewPanel) {
      globalWebviewPanel.webview.postMessage({
        type: 'keyboard-shortcut',
        data: { action: 'toggle-listening' }
      });
    } else {
      vscode.window.showWarningMessage('CursorVoice panel is not open. Open it first with Ctrl+Shift+P > "Open CursorVoice"');
    }
  });

  const sendToAIDisposable = vscode.commands.registerCommand('cursor-voice.sendToAI', () => {
    if (globalWebviewPanel) {
      globalWebviewPanel.webview.postMessage({
        type: 'keyboard-shortcut',
        data: { action: 'send-to-ai' }
      });
    } else {
      vscode.window.showWarningMessage('CursorVoice panel is not open. Open it first with Ctrl+Shift+P > "Open CursorVoice"');
    }
  });

  const clearTranscriptDisposable = vscode.commands.registerCommand('cursor-voice.clearTranscript', () => {
    if (globalWebviewPanel) {
      globalWebviewPanel.webview.postMessage({
        type: 'keyboard-shortcut',
        data: { action: 'clear-transcript' }
      });
    } else {
      vscode.window.showWarningMessage('CursorVoice panel is not open. Open it first with Ctrl+Shift+P > "Open CursorVoice"');
    }
  });

  const openSettingsDisposable = vscode.commands.registerCommand('cursor-voice.openSettings', () => {
    if (globalWebviewPanel) {
      globalWebviewPanel.webview.postMessage({
        type: 'keyboard-shortcut',
        data: { action: 'open-settings' }
      });
    } else {
      vscode.window.showWarningMessage('CursorVoice panel is not open. Open it first with Ctrl+Shift+P > "Open CursorVoice"');
    }
  });

  const openHistoryDisposable = vscode.commands.registerCommand('cursor-voice.openHistory', () => {
    if (globalWebviewPanel) {
      globalWebviewPanel.webview.postMessage({
        type: 'keyboard-shortcut',
        data: { action: 'open-history' }
      });
    } else {
      vscode.window.showWarningMessage('CursorVoice panel is not open. Open it first with Ctrl+Shift+P > "Open CursorVoice"');
    }
  });

  const saveConversationDisposable = vscode.commands.registerCommand('cursor-voice.saveConversation', () => {
    if (globalWebviewPanel) {
      globalWebviewPanel.webview.postMessage({
        type: 'keyboard-shortcut',
        data: { action: 'save-conversation' }
      });
    } else {
      vscode.window.showWarningMessage('CursorVoice panel is not open. Open it first with Ctrl+Shift+P > "Open CursorVoice"');
    }
  });

  // Listen for configuration changes
  const configDisposable = vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('cursorVoice')) {
      initializeAIClients();
    }
  });

  context.subscriptions.push(
    disposable, 
    toggleListeningDisposable,
    sendToAIDisposable,
    clearTranscriptDisposable,
    openSettingsDisposable,
    openHistoryDisposable,
    saveConversationDisposable,
    configDisposable
  );
}

function initializeAIClients() {
  const config = vscode.workspace.getConfiguration('cursorVoice');
  
  // Initialize OpenAI client
  const openaiApiKey = config.get<string>('openaiApiKey', '');
  if (openaiApiKey) {
    openaiClient = new OpenAI({ apiKey: openaiApiKey });
  } else {
    openaiClient = null;
  }

  // Initialize Anthropic client
  const claudeApiKey = config.get<string>('claudeApiKey', '');
  if (claudeApiKey) {
    anthropicClient = new Anthropic({ apiKey: claudeApiKey });
  } else {
    anthropicClient = null;
  }
}

function getApiKey(provider: string): string {
  const config = vscode.workspace.getConfiguration('cursorVoice');
  switch (provider) {
    case 'openai':
      return config.get<string>('openaiApiKey', '');
    case 'claude':
      return config.get<string>('claudeApiKey', '');
    default:
      return '';
  }
}

// Conversation management functions
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getConversations(): Conversation[] {
  return extensionContext.globalState.get('cursorVoice.conversations', []);
}

function saveConversations(conversations: Conversation[]): void {
  extensionContext.globalState.update('cursorVoice.conversations', conversations);
}

function handleConversationSave(data: any, panel: vscode.WebviewPanel) {
  try {
    const conversations = getConversations();
    
    if (data.conversationId) {
      // Update existing conversation
      const index = conversations.findIndex(c => c.id === data.conversationId);
      if (index !== -1) {
        conversations[index] = {
          ...conversations[index],
          title: data.title,
          updatedAt: new Date().toISOString(),
          messages: data.messages
        };
      }
    } else {
      // Create new conversation
      const newConversation: Conversation = {
        id: generateId(),
        title: data.title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: data.messages
      };
      conversations.unshift(newConversation); // Add to beginning
    }
    
    saveConversations(conversations);
    
    panel.webview.postMessage({
      type: 'conversation-saved',
      data: { 
        success: true,
        conversationId: data.conversationId || conversations[0].id,
        message: 'Conversation saved successfully!'
      }
    });
    
    // Send updated conversation list
    handleConversationList(panel);
    
  } catch (error) {
    panel.webview.postMessage({
      type: 'conversation-saved',
      data: { 
        success: false,
        message: `Failed to save conversation: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    });
  }
}

function handleConversationLoad(data: any, panel: vscode.WebviewPanel) {
  try {
    const conversations = getConversations();
    const conversation = conversations.find(c => c.id === data.conversationId);
    
    if (conversation) {
      panel.webview.postMessage({
        type: 'conversation-loaded',
        data: conversation
      });
    } else {
      panel.webview.postMessage({
        type: 'conversation-loaded',
        data: { 
          error: 'Conversation not found'
        }
      });
    }
  } catch (error) {
    panel.webview.postMessage({
      type: 'conversation-loaded',
      data: { 
        error: `Failed to load conversation: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    });
  }
}

function handleConversationList(panel: vscode.WebviewPanel) {
  try {
    const conversations = getConversations();
    
    panel.webview.postMessage({
      type: 'conversation-list',
      data: conversations.map(c => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        messageCount: c.messages.length
      }))
    });
  } catch (error) {
    panel.webview.postMessage({
      type: 'conversation-list',
      data: { 
        error: `Failed to load conversations: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    });
  }
}

function handleConversationDelete(data: any, panel: vscode.WebviewPanel) {
  try {
    const conversations = getConversations();
    const filteredConversations = conversations.filter(c => c.id !== data.conversationId);
    
    if (filteredConversations.length < conversations.length) {
      saveConversations(filteredConversations);
      panel.webview.postMessage({
        type: 'conversation-deleted',
        data: { 
          success: true,
          message: 'Conversation deleted successfully!'
        }
      });
      
      // Send updated conversation list
      handleConversationList(panel);
    } else {
      panel.webview.postMessage({
        type: 'conversation-deleted',
        data: { 
          success: false,
          message: 'Conversation not found'
        }
      });
    }
  } catch (error) {
    panel.webview.postMessage({
      type: 'conversation-deleted',
      data: { 
        success: false,
        message: `Failed to delete conversation: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    });
  }
}

function handleConversationNew(panel: vscode.WebviewPanel) {
  panel.webview.postMessage({
    type: 'conversation-new',
    data: { success: true }
  });
}

function gatherCodeContext(): CodeContext {
  const activeEditor = vscode.window.activeTextEditor;
  const context: CodeContext = {};

  if (activeEditor) {
    const document = activeEditor.document;
    
    // Basic file information
    context.fileName = path.basename(document.fileName);
    context.language = document.languageId;
    context.relativePath = vscode.workspace.asRelativePath(document.fileName);
    
    // Cursor position
    const position = activeEditor.selection.active;
    context.cursorPosition = {
      line: position.line + 1, // Convert to 1-based indexing
      character: position.character + 1
    };

    // Selected text
    const selection = activeEditor.selection;
    if (!selection.isEmpty) {
      context.selectedText = document.getText(selection);
    }

    // File content (limit to reasonable size)
    const fullContent = document.getText();
    if (fullContent.length <= 10000) {
      // Include full content for smaller files
      context.fileContent = fullContent;
    } else {
      // For larger files, include content around cursor position
      const startLine = Math.max(0, position.line - 50);
      const endLine = Math.min(document.lineCount - 1, position.line + 50);
      const range = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
      context.fileContent = `... (showing lines ${startLine + 1}-${endLine + 1} around cursor) ...\n` + 
                           document.getText(range);
    }
  }

  // Workspace information
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (workspaceFolder) {
    context.workspaceName = workspaceFolder.name;
  }

  return context;
}

function formatContextForAI(context: CodeContext): string {
  let contextString = "## Current Context\n\n";
  
  if (context.workspaceName) {
    contextString += `**Workspace:** ${context.workspaceName}\n`;
  }
  
  if (context.fileName) {
    contextString += `**File:** ${context.relativePath || context.fileName}\n`;
    contextString += `**Language:** ${context.language}\n`;
    
    if (context.cursorPosition) {
      contextString += `**Cursor Position:** Line ${context.cursorPosition.line}, Column ${context.cursorPosition.character}\n`;
    }
  }

  if (context.selectedText) {
    contextString += `\n**Selected Text:**\n\`\`\`${context.language || ''}\n${context.selectedText}\n\`\`\`\n`;
  }

  if (context.fileContent) {
    contextString += `\n**Current File Content:**\n\`\`\`${context.language || ''}\n${context.fileContent}\n\`\`\`\n`;
  }

  contextString += "\n---\n\n";
  
  return contextString;
}

function handleContextGet(panel: vscode.WebviewPanel) {
  const context = gatherCodeContext();
  
  panel.webview.postMessage({
    type: 'context-data',
    data: context
  });
}

function handleSettingsGet(panel: vscode.WebviewPanel) {
  const config = vscode.workspace.getConfiguration('cursorVoice');
  
  const settings = {
    aiProvider: config.get<string>('aiProvider', 'openai'),
    openaiApiKey: config.get<string>('openaiApiKey', ''),
    claudeApiKey: config.get<string>('claudeApiKey', ''),
    openaiModel: config.get<string>('openaiModel', 'gpt-4'),
    claudeModel: config.get<string>('claudeModel', 'claude-3-sonnet-20240229')
  };

  panel.webview.postMessage({
    type: 'settings-data',
    data: settings
  });
}

async function handleSettingsSave(data: any, panel: vscode.WebviewPanel) {
  try {
    const config = vscode.workspace.getConfiguration('cursorVoice');
    
    // Update all settings
    await config.update('aiProvider', data.aiProvider, vscode.ConfigurationTarget.Global);
    await config.update('openaiApiKey', data.openaiApiKey, vscode.ConfigurationTarget.Global);
    await config.update('claudeApiKey', data.claudeApiKey, vscode.ConfigurationTarget.Global);
    await config.update('openaiModel', data.openaiModel, vscode.ConfigurationTarget.Global);
    await config.update('claudeModel', data.claudeModel, vscode.ConfigurationTarget.Global);

    // Reinitialize AI clients with new settings
    initializeAIClients();

    // Send success message
    panel.webview.postMessage({
      type: 'settings-saved',
      data: { 
        success: true,
        message: 'Settings saved successfully!'
      }
    });

    // Send updated init data
    const hasApiKey = getApiKey(data.aiProvider) !== '';
    panel.webview.postMessage({
      type: 'init',
      data: { 
        status: 'Extension ready',
        capabilities: ['speech-recognition', 'ai-processing', 'context-awareness', 'conversation-history'],
        aiProvider: data.aiProvider,
        hasApiKey: hasApiKey
      }
    });

  } catch (error) {
    panel.webview.postMessage({
      type: 'settings-saved',
      data: { 
        success: false,
        message: `Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    });
  }
}

function handleTranscriptMessage(data: any, panel: vscode.WebviewPanel) {
  // Log transcript data for debugging
  console.log('Transcript received:', data);
  
  // Show transcript in VS Code status bar
  if (data.finalTranscript) {
    vscode.window.setStatusBarMessage(
      `CursorVoice: "${data.finalTranscript.substring(0, 50)}${data.finalTranscript.length > 50 ? '...' : ''}"`,
      3000
    );
  }
  
  // Send acknowledgment back to webview
  panel.webview.postMessage({
    type: 'transcript-ack',
    data: { 
      received: true,
      timestamp: new Date().toISOString()
    }
  });
}

async function handleAIRequest(data: any, panel: vscode.WebviewPanel) {
  console.log('AI request received:', data);
  
  const config = vscode.workspace.getConfiguration('cursorVoice');
  const aiProvider = config.get<string>('aiProvider', 'openai');
  const apiKey = getApiKey(aiProvider);
  
  if (!apiKey) {
    panel.webview.postMessage({
      type: 'ai-response',
      data: {
        response: `Error: No API key configured for ${aiProvider}. Please set your API key in the Settings.`,
        status: 'error'
      }
    });
    return;
  }

  try {
    let prompt = data.prompt;
    let currentContext = null;
    
    // Add context if requested
    if (data.includeContext) {
      currentContext = gatherCodeContext();
      const contextString = formatContextForAI(currentContext);
      prompt = contextString + "**User Question:** " + data.prompt;
    }
    
    let response: string;
    
    if (aiProvider === 'openai') {
      response = await handleOpenAIRequest(prompt, config);
    } else if (aiProvider === 'claude') {
      response = await handleClaudeRequest(prompt, config);
    } else {
      throw new Error(`Unsupported AI provider: ${aiProvider}`);
    }
    
    panel.webview.postMessage({
      type: 'ai-response',
      data: {
        response: response,
        status: 'success',
        provider: aiProvider,
        includedContext: data.includeContext || false,
        context: currentContext
      }
    });
    
  } catch (error) {
    console.error('AI request error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    panel.webview.postMessage({
      type: 'ai-response',
      data: {
        response: `Error: ${errorMessage}`,
        status: 'error',
        provider: aiProvider
      }
    });
  }
}

async function handleOpenAIRequest(prompt: string, config: vscode.WorkspaceConfiguration): Promise<string> {
  if (!openaiClient) {
    throw new Error('OpenAI client not initialized');
  }

  const model = config.get<string>('openaiModel', 'gpt-4');
  
  const completion = await openaiClient.chat.completions.create({
    model: model,
    messages: [
      {
        role: 'system',
        content: 'You are a helpful AI assistant integrated into VS Code. You help developers with coding questions, explanations, and general programming tasks. When provided with code context, use it to give more specific and relevant answers. Keep responses concise and practical.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 1500,
    temperature: 0.7
  });

  return completion.choices[0]?.message?.content || 'No response generated';
}

async function handleClaudeRequest(prompt: string, config: vscode.WorkspaceConfiguration): Promise<string> {
  if (!anthropicClient) {
    throw new Error('Claude client not initialized');
  }

  const model = config.get<string>('claudeModel', 'claude-3-sonnet-20240229');
  
  const response = await anthropicClient.messages.create({
    model: model,
    max_tokens: 1500,
    temperature: 0.7,
    system: 'You are a helpful AI assistant integrated into VS Code. You help developers with coding questions, explanations, and general programming tasks. When provided with code context, use it to give more specific and relevant answers. Keep responses concise and practical.',
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  // Extract text content from Claude response
  const textContent = response.content.find((block: any) => block.type === 'text');
  return (textContent as any)?.text || 'No response generated';
}

function handleError(data: any, panel: vscode.WebviewPanel) {
  console.error('Webview error:', data);
  vscode.window.showErrorMessage(`CursorVoice Error: ${data.message || 'Unknown error'}`);
}

function handleStatus(data: any, panel: vscode.WebviewPanel) {
  console.log('Status update:', data);
  
  if (data.listening) {
    vscode.window.setStatusBarMessage('🎤 CursorVoice: Listening...', 0);
  } else {
    vscode.window.setStatusBarMessage('CursorVoice: Ready', 2000);
  }
}

export function deactivate() {}
