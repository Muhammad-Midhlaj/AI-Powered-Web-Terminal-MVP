import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../database';
import { generateId, isValidEmail, isStrongPassword } from '@ai-terminal/shared';
import { authRateLimit } from '../middleware/rateLimit';

interface DatabaseUser {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
  last_login?: string;
  preferences: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const JWT_EXPIRES_IN = '7d';

export class AuthController {
  private router: Router;

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post('/register', authRateLimit, this.register.bind(this));
    this.router.post('/login', authRateLimit, this.login.bind(this));
    this.router.get('/verify', this.verifyToken.bind(this));
  }

  private async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, name } = req.body;

      // Validate input
      if (!email || !password || !name) {
        res.status(400).json({
          success: false,
          error: 'Email, password, and name are required'
        });
        return;
      }

      if (!isValidEmail(email)) {
        res.status(400).json({
          success: false,
          error: 'Invalid email format'
        });
        return;
      }

      if (!isStrongPassword(password)) {
        res.status(400).json({
          success: false,
          error: 'Password must be at least 8 characters long and contain uppercase, lowercase, and number'
        });
        return;
      }

      const db = getDatabase();

      // Check if user already exists
      const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
      if (existingUser) {
        res.status(409).json({
          success: false,
          error: 'User with this email already exists'
        });
        return;
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user
      const userId = generateId();
      const userStmt = db.prepare(`
        INSERT INTO users (id, email, name, password_hash, created_at, preferences)
        VALUES (?, ?, ?, ?, datetime('now'), ?)
      `);

      const defaultPreferences = JSON.stringify({
        theme: 'dark',
        defaultAIProvider: 'openai',
        autoConnectProfiles: [],
        terminalFontSize: 14,
        terminalFontFamily: 'Fira Code',
        showAIConfidence: true,
        requireConfirmationForDangerous: true
      });

      userStmt.run(userId, email, name, passwordHash, defaultPreferences);

      // Generate JWT token
      const token = jwt.sign(
        { userId, email, name },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Get created user (without password)
      const user = db.prepare(`
        SELECT id, email, name, created_at, last_login, preferences
        FROM users WHERE id = ?
      `).get(userId) as DatabaseUser;

      res.status(201).json({
        success: true,
        data: {
          user: {
            ...user,
            preferences: JSON.parse(user.preferences)
          },
          token,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  private async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      // Validate input
      if (!email || !password) {
        res.status(400).json({
          success: false,
          error: 'Email and password are required'
        });
        return;
      }

      const db = getDatabase();

      // Get user with password
      const user = db.prepare(`
        SELECT id, email, name, password_hash, created_at, last_login, preferences
        FROM users WHERE email = ?
      `).get(email) as DatabaseUser | undefined;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
        return;
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
        return;
      }

      // Update last login
      db.prepare('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?').run(user.id);

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, name: user.name },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // Remove password from response
      const { password_hash, ...userWithoutPassword } = user;

      res.json({
        success: true,
        data: {
          user: {
            ...userWithoutPassword,
            preferences: JSON.parse(user.preferences)
          },
          token,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  private async verifyToken(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: 'No token provided'
        });
        return;
      }

      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as any;

      const db = getDatabase();
      const user = db.prepare(`
        SELECT id, email, name, created_at, last_login, preferences
        FROM users WHERE id = ?
      `).get(decoded.userId) as DatabaseUser | undefined;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          user: {
            ...user,
            preferences: JSON.parse(user.preferences)
          }
        }
      });

    } catch (error) {
      res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
  }

  public getRouter(): Router {
    return this.router;
  }
} 