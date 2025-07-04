# 🎤 CursorVoice

**Voice-powered AI chat for Cursor with live transcription.**

CursorVoice is a VS Code extension that brings voice interaction to your coding workflow. Speak naturally and get AI-powered responses, all while maintaining your focus on the code.

## ✨ Features

### 🎯 **Core Features**
- **🎤 Voice Recognition** - Real-time speech-to-text using Web Speech API
- **📝 Live Transcription** - See your words appear as you speak
- **🤖 AI Integration** - Full OpenAI and Claude API support with multiple models
- **🧠 Context Awareness** - Automatically include current code context in AI requests
- **💬 Conversation History** - Save, load, and manage conversation sessions
- **⚙️ Settings Management** - Visual configuration for AI providers and API keys
- **⌨️ Keyboard Shortcuts** - Quick voice activation and controls with hotkeys
- **🌊 Visual Feedback** - Animated waveform shows listening status
- **📊 Status Integration** - Real-time updates in VS Code status bar

### 🔧 **Technical Features**
- **⚡ Dual-Bundle Architecture** - Separate extension and webview bundles
- **🔄 Real-time Communication** - Seamless messaging between UI and extension
- **🚨 Error Handling** - Comprehensive error reporting and recovery
- **🌐 Browser Support** - Works in Chrome, Edge, and Safari
- **🎨 Modern UI** - Clean React-based interface with multiple views
- **💾 Persistent Storage** - Conversation history saved in VS Code's global state

## 📦 Installation

### Option 1: Install from VS Code Marketplace
*Coming soon - extension will be published to the marketplace*

### Option 2: Install from Source

1. **Clone the repository**
   ```bash
   git clone https://github.com/TYLANDER/cursor-voice.git
   cd cursor-voice
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Compile the extension**
   ```bash
   npm run compile
   ```

4. **Install in VS Code**
   - Open VS Code
   - Go to Extensions (Ctrl+Shift+X)
   - Click "..." → "Install from VSIX..."
   - Select the generated `.vsix` file

### Option 3: Development Mode

1. **Clone and setup**
   ```bash
   git clone https://github.com/TYLANDER/cursor-voice.git
   cd cursor-voice
   npm install
   ```

2. **Open in VS Code**
   ```bash
   code .
   ```

3. **Press F5** to launch Extension Development Host

## 🚀 Usage

1. **Open CursorVoice**
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Type "Open CursorVoice"
   - Select the command

2. **Configure Settings**
   - Click "⚙️ Settings" to configure AI providers
   - Add your OpenAI or Claude API keys
   - Select preferred models for each provider

3. **Start Voice Recognition**
   - Click the "🎤 Start Listening" button
   - Speak naturally - your words will appear in real-time
   - Click "🛑 Stop Listening" when done

4. **Send to AI**
   - Toggle context awareness to include current code
   - Click "🤖 Send to AI" to process your transcript
   - AI response will appear below your transcript

5. **Manage Conversations**
   - Click "💾 Save Conversation" to save your interaction
   - Click "📚 History" to view saved conversations
   - Load previous conversations to continue discussions

6. **Clear and Reset**
   - Use "Clear" button to reset transcripts
   - Status updates appear in VS Code status bar

7. **Keyboard Shortcuts** (when CursorVoice panel is open)
   - `Ctrl+Shift+V` (Mac: `Cmd+Shift+V`) - Toggle voice listening
   - `Ctrl+Shift+A` (Mac: `Cmd+Shift+A`) - Send to AI
   - `Ctrl+Shift+C` (Mac: `Cmd+Shift+C`) - Clear transcript
   - `Ctrl+Shift+,` (Mac: `Cmd+Shift+,`) - Open settings
   - `Ctrl+Shift+H` (Mac: `Cmd+Shift+H`) - Open history
   - `Ctrl+Shift+S` (Mac: `Cmd+Shift+S`) - Save conversation

## 🛠️ Feature Roadmap

### ✅ **Completed Features (v0.1)**
- ✅ Voice recognition with Web Speech API
- ✅ Real-time transcription display
- ✅ Extension ↔ Webview messaging
- ✅ Real AI integration (OpenAI/Claude API)
- ✅ Settings UI for API configuration
- ✅ Context awareness with code integration
- ✅ Conversation history management
- ✅ Error handling and status reporting
- ✅ Multiple AI model support
- ✅ Persistent conversation storage
- ✅ Keyboard shortcuts for quick voice activation

### 📋 **Planned Features**
- 🎨 **Theme Support** - Light/dark mode compatibility
- 🌍 **Multi-language** - Support for different languages
- 📁 **File Integration** - Direct voice commands for file operations
- 🔍 **Code Analysis** - Voice-activated code reviews and suggestions
- 🔄 **Live AI Streaming** - Real-time AI response streaming
- 📤 **Export Features** - Export conversations to markdown/text
- 🏷️ **Conversation Tags** - Organize conversations with tags

### 🎯 **Future Vision**
- 🧠 **Smart Context** - Automatic code context detection
- 🎵 **Voice Commands** - Direct IDE control via voice
- 🔗 **Git Integration** - Voice-powered commit messages
- 📱 **Mobile Support** - Companion mobile app
- 🤝 **Team Features** - Shared voice sessions
- 🎓 **Learning Mode** - AI coding tutorials via voice

## 🔧 Development

### **Scripts**
```bash
# Development
npm run compile          # Compile TypeScript
npm run watch           # Watch for changes
npm run lint            # Run ESLint

# Production
npm run package         # Build production bundle
npm run vscode:prepublish # Pre-publish preparation

# Testing
npm run test            # Run tests
npm run compile-tests   # Compile test files
```

### **Architecture**
- **Extension Backend** (`src/extension.ts`) - VS Code extension host
- **Webview Frontend** (`src/webview/index.tsx`) - React UI
- **Dual Webpack Config** - Separate bundles for extension and webview
- **TypeScript** - Full type safety across the codebase

## 🌐 Browser Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Full | Recommended |
| Edge | ✅ Full | Recommended |
| Safari | ✅ Full | Recommended |
| Firefox | ❌ No | Web Speech API not supported |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Credits

**Created by Tyler Schmidt**

- GitHub: [@TYLANDER](https://github.com/TYLANDER)
- Extension: [CursorVoice](https://github.com/TYLANDER/cursor-voice)

---

## 🔗 Links

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [React Documentation](https://reactjs.org/docs)

---

*Built with ❤️ for the VS Code community*
