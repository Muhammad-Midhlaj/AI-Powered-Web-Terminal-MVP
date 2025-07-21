import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Terminal } from '../components/Terminal';
import { SSHConnectionForm } from '../components/SSHConnectionForm';
import { useSocketStore } from '../stores/socketStore';
import { useTerminalStore } from '../stores/terminalStore';
import { useSSHStore } from '../stores/sshStore';
import { useAuthStore } from '../stores/authStore';
import { SSHConnectionStatus } from '../../../shared/src/types';
import { toast } from '../components/ui/toaster';

export function TerminalPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { 
    sessions, 
    activeSessionId, 
    setActiveSession, 
    addSession,
    setLoading: setTerminalLoading 
  } = useTerminalStore();
  const { socket, connect: connectSocket } = useSocketStore();
  const { 
    profiles, 
    loadProfiles, 
    createProfile, 
    isLoading: sshLoading 
  } = useSSHStore();

  const [showSSHForm, setShowSSHForm] = useState(false);

  // Connect to WebSocket when authenticated
  useEffect(() => {
    if (isAuthenticated && !socket?.connected) {
      connectSocket();
    }
  }, [isAuthenticated, socket?.connected, connectSocket]);

  // Load SSH profiles when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadProfiles();
    }
  }, [isAuthenticated, loadProfiles]);

  // Set active session from URL parameter
  useEffect(() => {
    if (sessionId && sessionId !== activeSessionId) {
      setActiveSession(sessionId);
    }
  }, [sessionId, activeSessionId, setActiveSession]);

  const handleCreateSSHProfile = async (data: {
    profile: any;
    credentials: any;
  }) => {
    try {
      await createProfile(data);
      setShowSSHForm(false);
    } catch (error) {
      console.error('Failed to create SSH profile:', error);
    }
  };

  const handleConnect = async (profileId: string) => {
    if (!socket?.connected) {
      toast.error('WebSocket not connected. Please try again.');
      return;
    }

    try {
      setTerminalLoading(true);
      
      // Generate session ID
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create new session
      const newSession = {
        id: sessionId,
        profileId: profileId,
        status: SSHConnectionStatus.CONNECTING,
        createdAt: new Date(),
        lastActivity: new Date(),
        title: profiles.find(p => p.id === profileId)?.name || 'Terminal Session'
      };

      // Add session to store
      addSession(newSession);
      
      // Navigate to the new session
      navigate(`/terminal/${sessionId}`);
      
      // Request SSH connection through WebSocket
      socket.emit('ssh:connect', {
        sessionId,
        profileId
      });

      toast.success('Connecting to server...');
      
    } catch (error) {
      console.error('Failed to connect:', error);
      toast.error('Failed to initiate connection');
    } finally {
      setTerminalLoading(false);
    }
  };

  // Show terminal if there's an active session
  const currentSessionId = sessionId || activeSessionId;
  const currentSession = sessions.find(s => s.id === currentSessionId);

  // Debug logging
  console.log('TerminalPage Debug:', {
    sessionId,
    activeSessionId,
    currentSessionId,
    sessionsCount: sessions.length,
    currentSession,
    isAuthenticated
  });

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-300 mt-4">Please log in to access the terminal.</p>
        </div>
      </div>
    );
  }

  // If we have a sessionId but no current session, show loading
  if (currentSessionId && !currentSession) {
    return (
      <div className="h-screen bg-terminal-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-terminal-text mb-2">Connecting to terminal session...</p>
          <p className="text-terminal-muted text-sm">Session ID: {currentSessionId?.slice(0, 12)}...</p>
        </div>
      </div>
    );
  }

  // If no session at all, show the dashboard
  if (!currentSessionId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-terminal-bg via-gray-900 to-blue-900 flex items-center justify-center p-6">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 -right-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse-slow"></div>
          <div className="absolute bottom-1/4 -left-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse-slow"></div>
        </div>

        <div className="relative w-full max-w-4xl mx-auto">
          <div className="text-center mb-12 animate-fade-in">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-r from-blue-600 to-blue-700 shadow-2xl mb-8">
              <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-terminal-text mb-4">
              {profiles.length > 0 ? 'Choose Your Connection' : 'Welcome to AI Terminal'}
            </h1>
            <p className="text-xl text-terminal-muted max-w-2xl mx-auto">
              {profiles.length > 0 
                ? 'Select an SSH connection to start your terminal session'
                : 'Create your first SSH connection to begin using the AI-powered terminal'
              }
            </p>
          </div>
          
          {profiles.length > 0 && (
            <div className="mb-12 animate-slide-in">
              <div className="grid gap-6 max-w-3xl mx-auto">
                {profiles.map((profile, index) => (
                  <div 
                    key={profile.id} 
                    className="card hover:scale-105 transition-transform duration-200 cursor-pointer group"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center shadow-lg">
                          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12l4-4m-4 4l4 4" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-terminal-text group-hover:text-blue-400 transition-colors">
                            {profile.name}
                          </h3>
                          <p className="text-terminal-muted">
                            {profile.username}@{profile.host}:{profile.port}
                          </p>
                          <div className="flex items-center mt-2 space-x-2">
                            <span className="status-dot connected"></span>
                            <span className="text-xs text-green-400">Ready to connect</span>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleConnect(profile.id)}
                        className="btn-primary group-hover:scale-105 transition-transform"
                        disabled={sshLoading}
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Connect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="text-center animate-slide-in" style={{ animationDelay: '300ms' }}>
            <button 
              onClick={() => setShowSSHForm(true)}
              className="btn-primary text-lg px-8 py-4"
              disabled={sshLoading}
            >
              {sshLoading ? (
                <span className="flex items-center">
                  <div className="loading-spinner mr-3"></div>
                  Loading...
                </span>
              ) : (
                <span className="flex items-center">
                  <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add SSH Connection
                </span>
              )}
            </button>
            
            {profiles.length === 0 && (
              <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
                <div className="card text-center border-blue-500/20">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-terminal-text mb-2">AI Powered</h3>
                  <p className="text-sm text-terminal-muted">Natural language commands with intelligent assistance</p>
                </div>
                
                <div className="card text-center border-green-500/20">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-terminal-text mb-2">Secure SSH</h3>
                  <p className="text-sm text-terminal-muted">End-to-end encrypted connections to your servers</p>
                </div>
                
                <div className="card text-center border-purple-500/20">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-terminal-text mb-2">Multi-Session</h3>
                  <p className="text-sm text-terminal-muted">Manage multiple terminal sessions simultaneously</p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {showSSHForm && (
          <SSHConnectionForm
            onSubmit={handleCreateSSHProfile}
            onCancel={() => setShowSSHForm(false)}
            isLoading={sshLoading}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Terminal Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-semibold text-white">AI Web Terminal</h1>
          <div className="text-sm text-gray-400">
            {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'} active
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${socket?.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-400">
              {socket?.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Session Tabs */}
      {sessions.length > 1 && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 flex space-x-1">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => setActiveSession(session.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                session.id === currentSessionId
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {session.title || `Session ${session.id.slice(0, 8)}`}
              <span className={`ml-2 w-2 h-2 rounded-full inline-block ${
                session.status === 'connected' ? 'bg-green-500' :
                session.status === 'connecting' ? 'bg-yellow-500' :
                'bg-red-500'
              }`}></span>
            </button>
          ))}
        </div>
      )}

      {/* Terminal Container */}
      <div className="flex-1 overflow-hidden">
        <Terminal sessionId={currentSessionId} className="h-full" />
      </div>

      {/* Status Bar */}
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 flex items-center justify-between text-sm text-gray-400">
        <div className="flex items-center space-x-4">
          <span>Session: {currentSessionId?.slice(0, 8)}</span>
          <span>•</span>
          <span>Ready for commands</span>
        </div>
        
        <div className="flex items-center space-x-4">
          <span>AI Assistant: Ready</span>
          <span>•</span>
          <span>Type '/ai' for help</span>
        </div>
      </div>
    </div>
  );
} 