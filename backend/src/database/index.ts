import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database;

export function initializeDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(process.env.DATABASE_URL || './data/terminal.db');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Initialize database
      db = new Database(process.env.DATABASE_URL || './data/terminal.db');
      
      // Enable foreign keys
      db.pragma('foreign_keys = ON');
      
      // Create tables
      createTables();
      
      console.log('Database connected successfully');
      resolve();
    } catch (error) {
      console.error('Database connection failed:', error);
      reject(error);
    }
  });
}

function createTables() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      preferences TEXT DEFAULT '{}'
    )
  `);

  // SSH Connection Profiles table
  db.exec(`
    CREATE TABLE IF NOT EXISTS ssh_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 22,
      username TEXT NOT NULL,
      auth_method TEXT NOT NULL CHECK (auth_method IN ('password', 'publicKey')),
      encrypted_credentials TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used DATETIME,
      is_active BOOLEAN DEFAULT true,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);

  // Terminal Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS terminal_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'disconnected',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
      title TEXT,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (profile_id) REFERENCES ssh_profiles (id) ON DELETE CASCADE
    )
  `);

  // AI Query History table
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_queries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_id TEXT,
      query TEXT NOT NULL,
      response TEXT,
      commands TEXT,
      explanation TEXT,
      warnings TEXT,
      confidence REAL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES terminal_sessions (id) ON DELETE SET NULL
    )
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
    CREATE INDEX IF NOT EXISTS idx_ssh_profiles_user_id ON ssh_profiles (user_id);
    CREATE INDEX IF NOT EXISTS idx_terminal_sessions_user_id ON terminal_sessions (user_id);
    CREATE INDEX IF NOT EXISTS idx_terminal_sessions_profile_id ON terminal_sessions (profile_id);
    CREATE INDEX IF NOT EXISTS idx_ai_queries_user_id ON ai_queries (user_id);
    CREATE INDEX IF NOT EXISTS idx_ai_queries_session_id ON ai_queries (session_id);
  `);
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
} 