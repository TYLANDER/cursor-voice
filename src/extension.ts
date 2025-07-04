import * as vscode from 'vscode';
import * as path from 'path';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Message types for webview communication
interface WebviewMessage {
  type: 'transcript' | 'ai-request' | 'error' | 'status' | 'settings-get' | 'settings-save';
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

// AI provider instances
let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

export function activate(context: vscode.ExtensionContext) {
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
        capabilities: ['speech-recognition', 'ai-processing'],
        aiProvider: aiProvider,
        hasApiKey: hasApiKey
      }
    });
  });

  // Listen for configuration changes
  const configDisposable = vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('cursorVoice')) {
      initializeAIClients();
    }
  });

  context.subscriptions.push(disposable, configDisposable);
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
        capabilities: ['speech-recognition', 'ai-processing'],
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
    let response: string;
    
    if (aiProvider === 'openai') {
      response = await handleOpenAIRequest(data.prompt, config);
    } else if (aiProvider === 'claude') {
      response = await handleClaudeRequest(data.prompt, config);
    } else {
      throw new Error(`Unsupported AI provider: ${aiProvider}`);
    }
    
    panel.webview.postMessage({
      type: 'ai-response',
      data: {
        response: response,
        status: 'success',
        provider: aiProvider
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
        content: 'You are a helpful AI assistant integrated into VS Code. You help developers with coding questions, explanations, and general programming tasks. Keep responses concise and practical.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 1000,
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
    max_tokens: 1000,
    temperature: 0.7,
    system: 'You are a helpful AI assistant integrated into VS Code. You help developers with coding questions, explanations, and general programming tasks. Keep responses concise and practical.',
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
