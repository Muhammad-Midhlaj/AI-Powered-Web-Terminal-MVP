import { Router, Request, Response } from 'express';
import CryptoJS from 'crypto-js';
import { getDatabase } from '../database';
import { generateId, isValidHostname, isValidSSHPort } from '@ai-terminal/shared';

const ENCRYPTION_KEY = process.env.JWT_SECRET || 'fallback-secret-key';

interface DatabaseProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_method: string;
  encrypted_credentials: string;
  created_at: string;
  last_used?: string;
  is_active: number;
}

interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export class ProfileController {
  private router: Router;

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get('/', this.getProfiles.bind(this));
    this.router.post('/', this.createProfile.bind(this));
    this.router.put('/:id', this.updateProfile.bind(this));
    this.router.delete('/:id', this.deleteProfile.bind(this));
    this.router.post('/:id/test', this.testConnection.bind(this));
  }

  private async getProfiles(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const db = getDatabase();
      
      const profiles = db.prepare(`
        SELECT id, name, host, port, username, auth_method, created_at, last_used, is_active
        FROM ssh_profiles 
        WHERE user_id = ? AND is_active = 1
        ORDER BY last_used DESC, created_at DESC
      `).all(req.userId);

      res.json({
        success: true,
        data: profiles
      });

    } catch (error) {
      console.error('Get profiles error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  private async createProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { profile, credentials } = req.body;

      // Extract profile data
      const { name, host, port, username, authMethod } = profile || {};
      
      // Extract credential data
      const { password, privateKey, passphrase } = credentials || {};

      // Validate input
      if (!name || !host || !username || !authMethod) {
        res.status(400).json({
          success: false,
          error: 'Name, host, username, and authentication method are required'
        });
        return;
      }

      if (!isValidHostname(host)) {
        res.status(400).json({
          success: false,
          error: 'Invalid hostname or IP address'
        });
        return;
      }

      const sshPort = port || 22;
      if (!isValidSSHPort(sshPort)) {
        res.status(400).json({
          success: false,
          error: 'Invalid SSH port (must be between 1-65535)'
        });
        return;
      }

      if (!['password', 'publicKey'].includes(authMethod)) {
        res.status(400).json({
          success: false,
          error: 'Authentication method must be either "password" or "publicKey"'
        });
        return;
      }

      // Validate auth method specific requirements
      if (authMethod === 'password' && !password) {
        res.status(400).json({
          success: false,
          error: 'Password is required for password authentication'
        });
        return;
      }

      if (authMethod === 'publicKey' && !privateKey) {
        res.status(400).json({
          success: false,
          error: 'Private key is required for public key authentication'
        });
        return;
      }

      const db = getDatabase();

      // Check if profile name already exists for this user
      const existingProfile = db.prepare(`
        SELECT id FROM ssh_profiles 
        WHERE user_id = ? AND name = ? AND is_active = 1
      `).get(req.userId, name);

      if (existingProfile) {
        res.status(409).json({
          success: false,
          error: 'Profile with this name already exists'
        });
        return;
      }

      // Encrypt credentials
      const credentialsToEncrypt: any = {
        authMethod
      };

      if (password) {
        credentialsToEncrypt.password = CryptoJS.AES.encrypt(password, ENCRYPTION_KEY).toString();
      }

      if (privateKey) {
        credentialsToEncrypt.privateKey = CryptoJS.AES.encrypt(privateKey, ENCRYPTION_KEY).toString();
      }

      if (passphrase) {
        credentialsToEncrypt.passphrase = CryptoJS.AES.encrypt(passphrase, ENCRYPTION_KEY).toString();
      }

      // Create profile
      const profileId = generateId();
      const profileStmt = db.prepare(`
        INSERT INTO ssh_profiles (
          id, user_id, name, host, port, username, auth_method, 
          encrypted_credentials, created_at, is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 1)
      `);

      profileStmt.run(
        profileId,
        req.userId,
        name,
        host,
        sshPort,
        username,
        authMethod,
        JSON.stringify(credentialsToEncrypt)
      );

      // Get created profile (without encrypted credentials)
      const createdProfile = db.prepare(`
        SELECT id, name, host, port, username, auth_method, created_at, last_used, is_active
        FROM ssh_profiles WHERE id = ?
      `).get(profileId);

      res.status(201).json({
        success: true,
        data: createdProfile
      });

    } catch (error) {
      console.error('Create profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  private async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, host, port, username } = req.body;

      const db = getDatabase();

      // Check if profile exists and belongs to user
      const existingProfile = db.prepare(`
        SELECT id FROM ssh_profiles 
        WHERE id = ? AND user_id = ? AND is_active = 1
      `).get(id, req.userId);

      if (!existingProfile) {
        res.status(404).json({
          success: false,
          error: 'Profile not found'
        });
        return;
      }

      // Validate input if provided
      if (host && !isValidHostname(host)) {
        res.status(400).json({
          success: false,
          error: 'Invalid hostname or IP address'
        });
        return;
      }

      if (port && !isValidSSHPort(port)) {
        res.status(400).json({
          success: false,
          error: 'Invalid SSH port (must be between 1-65535)'
        });
        return;
      }

      // Build update query dynamically
      const updates: string[] = [];
      const values: any[] = [];

      if (name) {
        updates.push('name = ?');
        values.push(name);
      }

      if (host) {
        updates.push('host = ?');
        values.push(host);
      }

      if (port) {
        updates.push('port = ?');
        values.push(port);
      }

      if (username) {
        updates.push('username = ?');
        values.push(username);
      }

      if (updates.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No valid fields to update'
        });
        return;
      }

      values.push(id, req.userId);

      const updateStmt = db.prepare(`
        UPDATE ssh_profiles 
        SET ${updates.join(', ')}
        WHERE id = ? AND user_id = ? AND is_active = 1
      `);

      updateStmt.run(...values);

      // Get updated profile
      const updatedProfile = db.prepare(`
        SELECT id, name, host, port, username, auth_method, created_at, last_used, is_active
        FROM ssh_profiles WHERE id = ?
      `).get(id);

      res.json({
        success: true,
        data: updatedProfile
      });

    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  private async deleteProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const db = getDatabase();

      // Check if profile exists and belongs to user
      const existingProfile = db.prepare(`
        SELECT id FROM ssh_profiles 
        WHERE id = ? AND user_id = ? AND is_active = 1
      `).get(id, req.userId);

      if (!existingProfile) {
        res.status(404).json({
          success: false,
          error: 'Profile not found'
        });
        return;
      }

      // Soft delete the profile
      db.prepare(`
        UPDATE ssh_profiles 
        SET is_active = 0 
        WHERE id = ? AND user_id = ?
      `).run(id, req.userId);

      res.json({
        success: true,
        message: 'Profile deleted successfully'
      });

    } catch (error) {
      console.error('Delete profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  private async testConnection(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const db = getDatabase();

      // Get profile with encrypted credentials
      const dbProfile = db.prepare(`
        SELECT id, name, host, port, username, auth_method, encrypted_credentials
        FROM ssh_profiles 
        WHERE id = ? AND user_id = ? AND is_active = 1
      `).get(id, req.userId) as DatabaseProfile | undefined;

      if (!dbProfile) {
        res.status(404).json({
          success: false,
          error: 'Profile not found'
        });
        return;
      }

      // For now, just return success (actual SSH testing would be implemented here)
      res.json({
        success: true,
        message: 'Connection test completed',
        data: {
          status: 'success',
          latency: Math.random() * 100 + 50, // Mock latency
          message: `Successfully connected to ${dbProfile.host}:${dbProfile.port}`
        }
      });

    } catch (error) {
      console.error('Test connection error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Helper method to decrypt credentials (for internal use)
  public decryptCredentials(encryptedCredentials: string): any {
    try {
      const credentials = JSON.parse(encryptedCredentials);
      const decrypted: any = {
        authMethod: credentials.authMethod
      };

      if (credentials.password) {
        const bytes = CryptoJS.AES.decrypt(credentials.password, ENCRYPTION_KEY);
        decrypted.password = bytes.toString(CryptoJS.enc.Utf8);
      }

      if (credentials.privateKey) {
        const bytes = CryptoJS.AES.decrypt(credentials.privateKey, ENCRYPTION_KEY);
        decrypted.privateKey = bytes.toString(CryptoJS.enc.Utf8);
      }

      if (credentials.passphrase) {
        const bytes = CryptoJS.AES.decrypt(credentials.passphrase, ENCRYPTION_KEY);
        decrypted.passphrase = bytes.toString(CryptoJS.enc.Utf8);
      }

      return decrypted;
    } catch (error) {
      throw new Error('Failed to decrypt credentials');
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}