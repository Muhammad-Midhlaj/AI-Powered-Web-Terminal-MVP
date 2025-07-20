import { NodeSSH } from 'node-ssh';
import { EventEmitter } from 'events';
import { 
  SSHCredentials, 
  SSHConnectionStatus, 
  TerminalSession,
  TerminalDimensions,
  generateId 
} from '@ai-terminal/shared';

export interface SSHConnection {
  id: string;
  ssh: NodeSSH;
  status: SSHConnectionStatus;
  credentials: SSHCredentials;
  shell?: any;
  dimensions: TerminalDimensions;
  lastActivity: Date;
}

export class SSHManager extends EventEmitter {
  private connections: Map<string, SSHConnection> = new Map();
  private readonly connectionTimeout = 30000; // 30 seconds
  private readonly keepAliveInterval = 60000; // 1 minute

  constructor() {
    super();
    this.startKeepAliveCheck();
  }

  async createConnection(credentials: SSHCredentials): Promise<string> {
    const connectionId = generateId();
    const ssh = new NodeSSH();

    const connection: SSHConnection = {
      id: connectionId,
      ssh,
      status: SSHConnectionStatus.CONNECTING,
      credentials,
      dimensions: { cols: 80, rows: 24 },
      lastActivity: new Date()
    };

    this.connections.set(connectionId, connection);
    this.emit('statusChange', connectionId, SSHConnectionStatus.CONNECTING);

    try {
      // Prepare connection config
      const config: any = {
        host: credentials.host,
        port: credentials.port,
        username: credentials.username,
        readyTimeout: this.connectionTimeout,
        keepaliveInterval: this.keepAliveInterval
      };

      // Add authentication method
      if (credentials.password) {
        config.password = credentials.password;
      } else if (credentials.privateKey) {
        config.privateKey = credentials.privateKey;
        if (credentials.passphrase) {
          config.passphrase = credentials.passphrase;
        }
      }

      // Connect to SSH server
      await ssh.connect(config);
      
      // Request a shell
      const shell = await ssh.requestShell({
        cols: connection.dimensions.cols,
        rows: connection.dimensions.rows,
        term: 'xterm-256color'
      });

      connection.shell = shell;
      connection.status = SSHConnectionStatus.CONNECTED;
      connection.lastActivity = new Date();

      // Set up shell event handlers
      shell.on('data', (data: Buffer) => {
        connection.lastActivity = new Date();
        this.emit('data', connectionId, data.toString());
      });

      shell.on('close', () => {
        this.handleConnectionClose(connectionId);
      });

      shell.on('error', (error: Error) => {
        this.handleConnectionError(connectionId, error);
      });

      this.emit('statusChange', connectionId, SSHConnectionStatus.CONNECTED);
      return connectionId;

    } catch (error) {
      connection.status = SSHConnectionStatus.ERROR;
      this.emit('statusChange', connectionId, SSHConnectionStatus.ERROR, error instanceof Error ? error.message : 'Unknown error');
      this.connections.delete(connectionId);
      throw error;
    }
  }

  async sendCommand(connectionId: string, command: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== SSHConnectionStatus.CONNECTED) {
      throw new Error('Connection not available');
    }

    if (!connection.shell) {
      throw new Error('Shell not available');
    }

    connection.lastActivity = new Date();
    connection.shell.write(command);
  }

  async resizeTerminal(connectionId: string, dimensions: TerminalDimensions): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.status !== SSHConnectionStatus.CONNECTED) {
      throw new Error('Connection not available');
    }

    if (!connection.shell) {
      throw new Error('Shell not available');
    }

    connection.dimensions = dimensions;
    connection.shell.setWindow(dimensions.rows, dimensions.cols);
  }

  async closeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    try {
      if (connection.shell) {
        connection.shell.end();
      }
      connection.ssh.dispose();
    } catch (error) {
      console.error('Error closing SSH connection:', error);
    }

    this.connections.delete(connectionId);
    this.emit('statusChange', connectionId, SSHConnectionStatus.DISCONNECTED);
  }

  getConnectionStatus(connectionId: string): SSHConnectionStatus {
    const connection = this.connections.get(connectionId);
    return connection ? connection.status : SSHConnectionStatus.DISCONNECTED;
  }

  getActiveConnections(): string[] {
    return Array.from(this.connections.keys()).filter(id => {
      const connection = this.connections.get(id);
      return connection && connection.status === SSHConnectionStatus.CONNECTED;
    });
  }

  private handleConnectionClose(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.status = SSHConnectionStatus.DISCONNECTED;
      this.emit('statusChange', connectionId, SSHConnectionStatus.DISCONNECTED);
      this.attemptReconnection(connectionId);
    }
  }

  private handleConnectionError(connectionId: string, error: Error): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.status = SSHConnectionStatus.ERROR;
      this.emit('statusChange', connectionId, SSHConnectionStatus.ERROR, error.message);
      this.attemptReconnection(connectionId);
    }
  }

  private async attemptReconnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    // Wait before attempting reconnection
    setTimeout(async () => {
      try {
        connection.status = SSHConnectionStatus.RECONNECTING;
        this.emit('statusChange', connectionId, SSHConnectionStatus.RECONNECTING);

        // Dispose old connection
        connection.ssh.dispose();
        
        // Create new SSH instance
        const newSSH = new NodeSSH();
        connection.ssh = newSSH;

        // Prepare connection config
        const config: any = {
          host: connection.credentials.host,
          port: connection.credentials.port,
          username: connection.credentials.username,
          readyTimeout: this.connectionTimeout,
          keepaliveInterval: this.keepAliveInterval
        };

        if (connection.credentials.password) {
          config.password = connection.credentials.password;
        } else if (connection.credentials.privateKey) {
          config.privateKey = connection.credentials.privateKey;
          if (connection.credentials.passphrase) {
            config.passphrase = connection.credentials.passphrase;
          }
        }

        await newSSH.connect(config);
        
        const shell = await newSSH.requestShell({
          cols: connection.dimensions.cols,
          rows: connection.dimensions.rows,
          term: 'xterm-256color'
        });

        connection.shell = shell;
        connection.status = SSHConnectionStatus.CONNECTED;
        connection.lastActivity = new Date();

        // Set up shell event handlers
        shell.on('data', (data: Buffer) => {
          connection.lastActivity = new Date();
          this.emit('data', connectionId, data.toString());
        });

        shell.on('close', () => {
          this.handleConnectionClose(connectionId);
        });

        shell.on('error', (error: Error) => {
          this.handleConnectionError(connectionId, error);
        });

        this.emit('statusChange', connectionId, SSHConnectionStatus.CONNECTED);

      } catch (error) {
        connection.status = SSHConnectionStatus.ERROR;
        this.emit('statusChange', connectionId, SSHConnectionStatus.ERROR, error instanceof Error ? error.message : 'Unknown error');
      }
    }, 5000); // Wait 5 seconds before reconnecting
  }

  private startKeepAliveCheck(): void {
    setInterval(() => {
      const now = new Date();
      for (const [connectionId, connection] of this.connections) {
        const timeSinceActivity = now.getTime() - connection.lastActivity.getTime();
        
        // Close connections that have been inactive for too long (30 minutes)
        if (timeSinceActivity > 30 * 60 * 1000) {
          console.log(`Closing inactive connection: ${connectionId}`);
          this.closeConnection(connectionId);
        }
      }
    }, this.keepAliveInterval);
  }

  // Cleanup all connections
  public cleanup(): void {
    for (const connectionId of this.connections.keys()) {
      this.closeConnection(connectionId);
    }
  }
} 