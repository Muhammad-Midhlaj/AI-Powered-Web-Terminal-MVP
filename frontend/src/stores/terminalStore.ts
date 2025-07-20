import { create } from 'zustand';
import { TerminalSession, SSHConnectionStatus } from '@ai-terminal/shared';

interface TerminalState {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  addSession: (session: TerminalSession) => void;
  removeSession: (sessionId: string) => void;
  updateSessionStatus: (sessionId: string, status: SSHConnectionStatus) => void;
  setActiveSession: (sessionId: string) => void;
  setSessions: (sessions: TerminalSession[]) => void;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  isLoading: false,
  error: null,

  addSession: (session: TerminalSession) => {
    set(state => ({
      sessions: [...state.sessions, session],
      activeSessionId: session.id
    }));
  },

  removeSession: (sessionId: string) => {
    set(state => {
      const newSessions = state.sessions.filter(s => s.id !== sessionId);
      const newActiveSessionId = state.activeSessionId === sessionId 
        ? (newSessions.length > 0 ? newSessions[0].id : null)
        : state.activeSessionId;
      
      return {
        sessions: newSessions,
        activeSessionId: newActiveSessionId
      };
    });
  },

  updateSessionStatus: (sessionId: string, status: SSHConnectionStatus) => {
    set(state => ({
      sessions: state.sessions.map(session =>
        session.id === sessionId
          ? { ...session, status, lastActivity: new Date() }
          : session
      )
    }));
  },

  setActiveSession: (sessionId: string) => {
    const { sessions } = get();
    const sessionExists = sessions.some(s => s.id === sessionId);
    
    if (sessionExists) {
      set({ activeSessionId: sessionId });
    }
  },

  setSessions: (sessions: TerminalSession[]) => {
    set({ sessions });
  },

  clearError: () => {
    set({ error: null });
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  }
})); 