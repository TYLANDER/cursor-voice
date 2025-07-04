import * as vscode from 'vscode';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
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
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
