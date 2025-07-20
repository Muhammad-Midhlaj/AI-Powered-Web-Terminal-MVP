# AI-Powered Web Terminal MVP

A web-based terminal application that connects to Linux machines via SSH and enables natural language interaction with the operating system using LLM APIs.

## Features

- 🖥️ **Web-based SSH Terminal**: Connect to remote Linux servers directly from your browser
- 🤖 **AI Integration**: Natural language to command translation and system administration assistance
- 📱 **Modern UI**: Clean, responsive interface inspired by modern terminals
- 🔒 **Secure Connections**: Encrypted SSH connections with profile management
- 📈 **Multi-Session Support**: Manage multiple SSH connections simultaneously
- 🎯 **Command Safety**: AI-powered analysis and warnings for dangerous operations

## Tech Stack

### Frontend
- React 18 with TypeScript
- Tailwind CSS + shadcn/ui components
- xterm.js for terminal emulation
- Socket.io-client for real-time communication
- Zustand for state management

### Backend
- Node.js with Express
- Socket.io for WebSocket communication
- node-ssh for SSH client functionality
- LangChain for AI integration
- SQLite database (MVP)
- JWT authentication

## Project Structure

```
├── frontend/          # React frontend application
├── backend/           # Node.js backend server
├── shared/            # Shared TypeScript types and utilities
└── docs/             # Documentation
```

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm 8+

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ai-web-terminal-mvp
```

2. Install dependencies:
```bash
npm run install:all
```

3. Set up environment variables:
```bash
# Backend environment
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration
```

4. Start development servers:
```bash
npm run dev
```

This will start:
- Frontend development server on `http://localhost:3000`
- Backend server on `http://localhost:5000`

### Environment Variables

#### Backend (.env)
```
PORT=5000
JWT_SECRET=your-jwt-secret
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
DATABASE_URL=./data/terminal.db
CORS_ORIGIN=http://localhost:3000
```

## Usage

1. **Connect to SSH Server**: Add your server credentials in the connection manager
2. **Natural Language Commands**: Type commands in plain English
3. **AI Assistance**: Get command explanations and safety warnings
4. **Multi-Session Management**: Open multiple terminal tabs for different servers

## API Documentation

### WebSocket Events

#### Client to Server
- `ssh:connect` - Establish SSH connection
- `terminal:input` - Send terminal input
- `ai:query` - Request AI assistance

#### Server to Client
- `terminal:output` - Terminal output data
- `ssh:status` - Connection status updates
- `ai:response` - AI assistance response

## Development

### Scripts
- `npm run dev` - Start both frontend and backend in development mode
- `npm run build` - Build all packages for production
- `npm run test` - Run all tests
- `npm run lint` - Lint all code

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## Security Considerations

- SSH credentials are encrypted before storage
- JWT tokens for secure authentication
- Command safety checks via AI analysis
- CORS protection configured
- Input sanitization for all user inputs

## License

MIT License - see LICENSE file for details 