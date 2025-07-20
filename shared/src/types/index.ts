// SSH Connection Types
export interface SSHCredentials {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface SSHConnectionProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: 'password' | 'publicKey';
  createdAt: Date;
  lastUsed?: Date;
  isActive: boolean;
}

export enum SSHConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
  RECONNECTING = 'reconnecting'
}

// Terminal Session Types
export interface TerminalSession {
  id: string;
  profileId: string;
  status: SSHConnectionStatus;
  createdAt: Date;
  lastActivity: Date;
  title?: string;
}

export interface TerminalDimensions {
  cols: number;
  rows: number;
}

// AI Integration Types
export interface AIQuery {
  id: string;
  sessionId: string;
  query: string;
  timestamp: Date;
  context?: string;
}

export interface AIResponse {
  id: string;
  queryId: string;
  response: string;
  commands?: string[];
  explanation?: string;
  warnings?: string[];
  confidence: number;
  timestamp: Date;
}

export enum AIProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  OLLAMA = 'ollama'
}

export interface AIConfig {
  provider: AIProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

// WebSocket Event Types
export interface WebSocketEvents {
  // SSH Connection Events
  'ssh:connect': (credentials: SSHCredentials) => void;
  'ssh:disconnect': (sessionId: string) => void;
  'ssh:status': (status: { sessionId: string; status: SSHConnectionStatus; error?: string }) => void;
  
  // Terminal Events
  'terminal:input': (data: { sessionId: string; input: string }) => void;
  'terminal:output': (data: { sessionId: string; output: string }) => void;
  'terminal:resize': (data: { sessionId: string; dimensions: TerminalDimensions }) => void;
  'terminal:clear': (sessionId: string) => void;
  
  // AI Events
  'ai:query': (query: AIQuery) => void;
  'ai:response': (response: AIResponse) => void;
  'ai:translate': (data: { sessionId: string; naturalLanguage: string }) => void;
  'ai:explain': (data: { sessionId: string; command: string }) => void;
  
  // Session Events
  'session:create': (profileId: string) => void;
  'session:destroy': (sessionId: string) => void;
  'session:list': () => void;
  'session:switch': (sessionId: string) => void;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  lastLogin?: Date;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  defaultAIProvider: AIProvider;
  autoConnectProfiles: string[];
  terminalFontSize: number;
  terminalFontFamily: string;
  showAIConfidence: boolean;
  requireConfirmationForDangerous: boolean;
}

// Authentication Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  expiresAt: Date;
}

// Error Types
export class SSHConnectionError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'SSHConnectionError';
  }
}

export class AIServiceError extends Error {
  constructor(
    message: string,
    public provider: AIProvider,
    public code?: string
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>; 