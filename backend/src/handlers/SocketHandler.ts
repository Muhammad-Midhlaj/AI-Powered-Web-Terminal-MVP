import { Socket } from 'socket.io';
import { SSHManager } from '../services/SSHManager';
import { AIService } from '../services/AIService';
import { ProfileController } from '../controllers/ProfileController';
import { getDatabase } from '../database';
import { 
  SSHCredentials, 
  SSHConnectionStatus, 
  TerminalDimensions,
  generateId 
} from '@ai-terminal/shared';

interface DatabaseProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_method: string;
  encrypted_credentials: string;
}

interface AuthenticatedSocket extends Socket {
  userId: string;
  userEmail: string;
}

export class SocketHandler {
  private socket: AuthenticatedSocket;
  private sshManager: SSHManager;
  private aiService: AIService;
  private profileController: ProfileController;
  private userSessions: Map<string, string> = new Map(); // sessionId -> connectionId

  constructor(
    socket: AuthenticatedSocket, 
    sshManager: SSHManager, 
    aiService: AIService
  ) {
    this.socket = socket;
    this.sshManager = sshManager;
    this.aiService = aiService;
    this.profileController = new ProfileController();
  }

  public initialize(): void {
    this.socket.on('ssh:connect', this.handleSSHConnect.bind(this));
    this.socket.on('ssh:disconnect', this.handleSSHDisconnect.bind(this));
    this.socket.on('terminal:input', this.handleTerminalInput.bind(this));
    this.socket.on('terminal:resize', this.handleTerminalResize.bind(this));
    this.socket.on('terminal:clear', this.handleTerminalClear.bind(this));
    this.socket.on('ai:query', this.handleAIQuery.bind(this));
    this.socket.on('ai:translate', this.handleAITranslate.bind(this));
    this.socket.on('ai:explain', this.handleAIExplain.bind(this));
    this.socket.on('session:create', this.handleSessionCreate.bind(this));
    this.socket.on('session:destroy', this.handleSessionDestroy.bind(this));
    this.socket.on('session:list', this.handleSessionList.bind(this));

    // Listen to SSH manager events
    this.sshManager.on('statusChange', this.handleSSHStatusChange.bind(this));
    this.sshManager.on('data', this.handleSSHData.bind(this));
  }

  private async handleSSHConnect(data: { sessionId: string; profileId: string }): Promise<void> {
    try {
      const { sessionId, profileId } = data;
      const db = getDatabase();
      
      // Emit connecting status
      this.socket.emit('ssh:status', {
        sessionId,
        status: SSHConnectionStatus.CONNECTING
      });
      
      // Get profile with encrypted credentials
      const profile = db.prepare(`
        SELECT id, name, host, port, username, auth_method, encrypted_credentials
        FROM ssh_profiles 
        WHERE id = ? AND user_id = ? AND is_active = 1
      `).get(profileId, this.socket.userId) as DatabaseProfile | undefined;

      if (!profile) {
        this.socket.emit('ssh:status', {
          sessionId,
          status: SSHConnectionStatus.ERROR,
          error: 'Profile not found'
        });
        return;
      }

      // Decrypt credentials
      const decryptedCredentials = this.profileController.decryptCredentials(profile.encrypted_credentials);

      // Create SSH credentials object
      const sshCredentials: SSHCredentials = {
        id: profile.id,
        name: profile.name,
        host: profile.host,
        port: profile.port,
        username: profile.username,
        password: decryptedCredentials.password,
        privateKey: decryptedCredentials.privateKey,
        passphrase: decryptedCredentials.passphrase
      };

      // Create SSH connection
      const connectionId = await this.sshManager.createConnection(sshCredentials);
      
      // Store session mapping
      this.userSessions.set(sessionId, connectionId);

      // Update last used timestamp - FIX: Use single quotes for 'now'
      db.prepare('UPDATE ssh_profiles SET last_used = datetime(\'now\') WHERE id = ?').run(profileId);

      // Create session record - FIX: Use single quotes for 'now'
      db.prepare(`
        INSERT INTO terminal_sessions (id, user_id, profile_id, status, created_at, last_activity)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(sessionId, this.socket.userId, profileId, SSHConnectionStatus.CONNECTED);

      // Emit connected status
      this.socket.emit('ssh:status', {
        sessionId,
        status: SSHConnectionStatus.CONNECTED,
        profile: {
          id: profile.id,
          name: profile.name,
          host: profile.host,
          port: profile.port,
          username: profile.username
        }
      });

      // Set up SSH connection event handlers - Create specific handlers for this session
      const dataHandler = (connId: string, data: string) => {
        if (connId === connectionId) {
          this.socket.emit('terminal:output', { sessionId, data });
        }
      };

      const statusHandler = (connId: string, status: SSHConnectionStatus, error?: string) => {
        if (connId === connectionId) {
          this.socket.emit('ssh:status', {
            sessionId,
            status,
            error
          });
          
          if (status === SSHConnectionStatus.DISCONNECTED || status === SSHConnectionStatus.ERROR) {
            this.userSessions.delete(sessionId);
            // Clean up event listeners
            this.sshManager.removeListener('data', dataHandler);
            this.sshManager.removeListener('statusChange', statusHandler);
          }
        }
      };

      // Add event listeners
      this.sshManager.on('data', dataHandler);
      this.sshManager.on('statusChange', statusHandler);

      // Clean up on socket disconnect
      this.socket.on('disconnect', () => {
        this.sshManager.removeListener('data', dataHandler);
        this.sshManager.removeListener('statusChange', statusHandler);
      });

    } catch (error) {
      console.error('SSH connect error:', error);
      this.socket.emit('ssh:status', {
        sessionId: data?.sessionId,
        status: SSHConnectionStatus.ERROR,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleSSHDisconnect(sessionId: string): Promise<void> {
    try {
      const connectionId = this.userSessions.get(sessionId);
      if (connectionId) {
        await this.sshManager.closeConnection(connectionId);
        this.userSessions.delete(sessionId);
      }

      // Update session status in database
      const db = getDatabase();
      db.prepare(`
        UPDATE terminal_sessions 
        SET status = ?, last_activity = datetime('now')
        WHERE id = ? AND user_id = ?
      `).run(SSHConnectionStatus.DISCONNECTED, sessionId, this.socket.userId);

    } catch (error) {
      console.error('SSH disconnect error:', error);
    }
  }

  private async handleTerminalInput(data: { sessionId: string; data: string }): Promise<void> {
    try {
      const connectionId = this.userSessions.get(data.sessionId);
      if (connectionId && data.data) {
        await this.sshManager.sendCommand(connectionId, data.data);
      }
    } catch (error) {
      console.error('Terminal input error:', error);
    }
  }

  private async handleTerminalResize(data: { sessionId: string; dimensions: TerminalDimensions }): Promise<void> {
    try {
      const connectionId = this.userSessions.get(data.sessionId);
      if (connectionId) {
        await this.sshManager.resizeTerminal(connectionId, data.dimensions);
      }
    } catch (error) {
      console.error('Terminal resize error:', error);
    }
  }

  private async handleTerminalClear(sessionId: string): Promise<void> {
    try {
      // Terminal clear is handled on the client side
      // This event is mainly for logging purposes
      console.log(`Terminal cleared for session: ${sessionId}`);
    } catch (error) {
      console.error('Terminal clear error:', error);
    }
  }

  private async handleAIQuery(query: any): Promise<void> {
    try {
      const response = await this.aiService.translateNaturalLanguage(
        query.query,
        query.context
      );

      // Store query in database
      const db = getDatabase();
      db.prepare(`
        INSERT INTO ai_queries (
          id, user_id, session_id, query, response, commands, explanation, warnings, confidence, timestamp
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        response.id,
        this.socket.userId,
        query.sessionId,
        query.query,
        response.response,
        JSON.stringify(response.commands),
        response.explanation,
        JSON.stringify(response.warnings),
        response.confidence
      );

      this.socket.emit('ai:response', response);

    } catch (error) {
      console.error('AI query error:', error);
      this.socket.emit('ai:response', {
        id: generateId(),
        queryId: query.id,
        response: 'Sorry, I encountered an error processing your request.',
        commands: [],
        explanation: 'Error occurred during AI processing',
        warnings: ['AI service temporarily unavailable'],
        confidence: 0,
        timestamp: new Date()
      });
    }
  }

  private async handleAITranslate(data: { sessionId: string; naturalLanguage: string }): Promise<void> {
    try {
      const response = await this.aiService.translateNaturalLanguage(data.naturalLanguage);
      this.socket.emit('ai:response', response);
    } catch (error) {
      console.error('AI translate error:', error);
    }
  }

  private async handleAIExplain(data: { sessionId: string; command: string }): Promise<void> {
    try {
      const response = await this.aiService.explainCommand(data.command);
      this.socket.emit('ai:response', response);
    } catch (error) {
      console.error('AI explain error:', error);
    }
  }

  private async handleSessionCreate(profileId: string): Promise<void> {
    try {
      // This will be handled by handleSSHConnect
      await this.handleSSHConnect({ sessionId: generateId(), profileId });
    } catch (error) {
      console.error('Session create error:', error);
    }
  }

  private async handleSessionDestroy(sessionId: string): Promise<void> {
    try {
      await this.handleSSHDisconnect(sessionId);
    } catch (error) {
      console.error('Session destroy error:', error);
    }
  }

  private async handleSessionList(): Promise<void> {
    try {
      const db = getDatabase();
      const sessions = db.prepare(`
        SELECT ts.id, ts.profile_id, ts.status, ts.created_at, ts.last_activity, ts.title,
               sp.name as profile_name, sp.host, sp.port, sp.username
        FROM terminal_sessions ts
        JOIN ssh_profiles sp ON ts.profile_id = sp.id
        WHERE ts.user_id = ? AND ts.status != ?
        ORDER BY ts.last_activity DESC
      `).all(this.socket.userId, SSHConnectionStatus.DISCONNECTED);

      this.socket.emit('session:list', { sessions });
    } catch (error) {
      console.error('Session list error:', error);
    }
  }

  private handleSSHStatusChange(connectionId: string, status: SSHConnectionStatus, error?: string): void {
    // Find the session ID for this connection
    let sessionId: string | undefined;
    for (const [sessId, connId] of this.userSessions.entries()) {
      if (connId === connectionId) {
        sessionId = sessId;
        break;
      }
    }

    if (sessionId) {
      this.socket.emit('ssh:status', {
        sessionId,
        status,
        error
      });

      // Update database
      const db = getDatabase();
      db.prepare(`
        UPDATE terminal_sessions 
        SET status = ?, last_activity = datetime('now')
        WHERE profile_id = ? AND user_id = ?
      `).run(status, sessionId, this.socket.userId);
    }
  }

  private handleSSHData(connectionId: string, data: string): void {
    // Find the session ID for this connection
    let sessionId: string | undefined;
    for (const [sessId, connId] of this.userSessions.entries()) {
      if (connId === connectionId) {
        sessionId = sessId;
        break;
      }
    }

    if (sessionId) {
      this.socket.emit('terminal:output', {
        sessionId,
        output: data
      });
    }
  }

  public cleanup(): void {
    // Close all SSH connections for this user
    for (const connectionId of this.userSessions.values()) {
      this.sshManager.closeConnection(connectionId).catch(console.error);
    }
    this.userSessions.clear();

    // Remove all listeners
    this.socket.removeAllListeners();
  }
} 