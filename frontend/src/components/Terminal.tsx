import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import { useSocketStore } from '../stores/socketStore';
import { useTerminalStore } from '../stores/terminalStore';
import { TerminalDimensions } from '@ai-terminal/shared';
import 'xterm/css/xterm.css';

interface TerminalProps {
  sessionId: string;
  className?: string;
}

export function Terminal({ sessionId, className = '' }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const { socket, isConnected } = useSocketStore();
  const { sessions } = useTerminalStore();
  
  const session = sessions.find(s => s.id === sessionId);

  useEffect(() => {
    if (!terminalRef.current || isInitialized) return;

    // Initialize xterm.js
    const xterm = new XTerm({
      theme: {
        background: '#0f172a',
        foreground: '#e2e8f0',
        cursor: '#38bdf8',
        cursorAccent: '#0f172a',
        selection: '#334155',
        black: '#1e293b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f8fafc',
        brightBlack: '#475569',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      fontFamily: '"Fira Code", "Monaco", "Menlo", "Ubuntu Mono", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      allowTransparency: false,
      scrollback: 10000,
      rightClickSelectsWord: true,
      macOptionIsMeta: true,
    });

    // Add addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);

    // Try to load WebGL addon for better performance
    try {
      const webglAddon = new WebglAddon();
      xterm.loadAddon(webglAddon);
    } catch (error) {
      console.warn('WebGL addon failed to load, fallback to canvas:', error);
    }

    // Open terminal
    xterm.open(terminalRef.current);

    // Fit terminal to container
    fitAddon.fit();

    // Store references
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    setIsInitialized(true);

    // Handle window resize
    const handleResize = () => {
      if (fitAddon && isConnected) {
        fitAddon.fit();
        const dimensions: TerminalDimensions = {
          cols: xterm.cols,
          rows: xterm.rows
        };
        socket?.emit('terminal:resize', { sessionId, dimensions });
      }
    };

    window.addEventListener('resize', handleResize);

    // Handle terminal input
    const handleData = (data: string) => {
      if (isConnected && socket) {
        socket.emit('terminal:input', { sessionId, input: data });
      }
    };

    xterm.onData(handleData);

    // Handle terminal output from socket
    const handleOutput = (data: { sessionId: string; output: string }) => {
      if (data.sessionId === sessionId) {
        xterm.write(data.output);
      }
    };

    socket?.on('terminal:output', handleOutput);

    // Initial resize after connection
    setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      socket?.off('terminal:output', handleOutput);
      xterm.dispose();
    };
  }, [sessionId, socket, isConnected, isInitialized]);

  // Handle focus
  useEffect(() => {
    if (xtermRef.current && session?.status === 'connected') {
      xtermRef.current.focus();
    }
  }, [session?.status]);

  // Handle session status changes
  useEffect(() => {
    if (!xtermRef.current) return;

    const xterm = xtermRef.current;
    
    switch (session?.status) {
      case 'connecting':
        xterm.write('\r\n\x1b[33mConnecting to server...\x1b[0m\r\n');
        break;
      case 'connected':
        xterm.write('\r\n\x1b[32mConnected successfully!\x1b[0m\r\n');
        break;
      case 'error':
        xterm.write('\r\n\x1b[31mConnection failed!\x1b[0m\r\n');
        break;
      case 'disconnected':
        xterm.write('\r\n\x1b[31mDisconnected from server\x1b[0m\r\n');
        break;
      case 'reconnecting':
        xterm.write('\r\n\x1b[33mReconnecting...\x1b[0m\r\n');
        break;
    }
  }, [session?.status]);

  const handleClear = () => {
    if (xtermRef.current) {
      xtermRef.current.clear();
      socket?.emit('terminal:clear', sessionId);
    }
  };

  const handleFit = () => {
    if (fitAddonRef.current && isConnected) {
      fitAddonRef.current.fit();
      const dimensions: TerminalDimensions = {
        cols: xtermRef.current?.cols || 80,
        rows: xtermRef.current?.rows || 24
      };
      socket?.emit('terminal:resize', { sessionId, dimensions });
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Terminal Actions */}
      <div className="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${
            session?.status === 'connected' ? 'bg-green-500' :
            session?.status === 'connecting' || session?.status === 'reconnecting' ? 'bg-yellow-500' :
            'bg-red-500'
          }`} />
          <span className="text-sm text-gray-300">
            {session?.title || `Session ${sessionId.slice(0, 8)}`}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleFit}
            className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            title="Fit terminal to window"
          >
            Fit
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            title="Clear terminal"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Terminal Container */}
      <div className="flex-1 overflow-hidden">
        <div
          ref={terminalRef}
          className="w-full h-full"
          style={{ backgroundColor: '#0f172a' }}
        />
      </div>
    </div>
  );
} 