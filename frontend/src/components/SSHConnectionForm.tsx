import { useState } from 'react';
import { SSHConnectionProfile } from '../../../shared/src/types';

interface SSHConnectionFormProps {
  onSubmit: (data: { 
    profile: Omit<SSHConnectionProfile, 'id' | 'createdAt' | 'lastUsed' | 'isActive'>; 
    credentials: {
      password?: string;
      privateKey?: string;
      passphrase?: string;
    }
  }) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function SSHConnectionForm({ onSubmit, onCancel, isLoading }: SSHConnectionFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: '22',
    username: '',
    authMethod: 'password' as 'password' | 'publicKey',
    password: '',
    privateKey: '',
    passphrase: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Connection name is required';
    }

    if (!formData.host.trim()) {
      newErrors.host = 'Host is required';
    }

    if (!formData.port.trim()) {
      newErrors.port = 'Port is required';
    } else {
      const port = parseInt(formData.port);
      if (isNaN(port) || port < 1 || port > 65535) {
        newErrors.port = 'Port must be between 1 and 65535';
      }
    }

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }

    if (formData.authMethod === 'password' && !formData.password) {
      newErrors.password = 'Password is required';
    }

    if (formData.authMethod === 'publicKey' && !formData.privateKey.trim()) {
      newErrors.privateKey = 'Private key is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit({
        profile: {
          name: formData.name,
          host: formData.host,
          port: parseInt(formData.port),
          username: formData.username,
          authMethod: formData.authMethod
        },
        credentials: formData.authMethod === 'password' 
          ? { password: formData.password }
          : { privateKey: formData.privateKey, passphrase: formData.passphrase || undefined }
      });
    } catch (error) {
      console.error('Failed to save SSH profile:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto animate-slide-in">
        <div className="card-header">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-terminal-text">Add SSH Connection</h2>
          </div>
          <p className="text-terminal-muted mt-2">Configure a new SSH connection to your server</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="form-label">
              Connection Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              className="form-input"
              placeholder="My Server"
              value={formData.name}
              onChange={handleInputChange}
            />
            {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="host" className="form-label">
                Host
              </label>
              <input
                id="host"
                name="host"
                type="text"
                className="form-input"
                placeholder="example.com"
                value={formData.host}
                onChange={handleInputChange}
              />
              {errors.host && <p className="text-red-400 text-sm mt-1">{errors.host}</p>}
            </div>

            <div>
              <label htmlFor="port" className="form-label">
                Port
              </label>
              <input
                id="port"
                name="port"
                type="number"
                className="form-input"
                placeholder="22"
                value={formData.port}
                onChange={handleInputChange}
              />
              {errors.port && <p className="text-red-400 text-sm mt-1">{errors.port}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="username" className="form-label">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              className="form-input"
              placeholder="root"
              value={formData.username}
              onChange={handleInputChange}
            />
            {errors.username && <p className="text-red-400 text-sm mt-1">{errors.username}</p>}
          </div>

          <div>
            <label htmlFor="authMethod" className="form-label">
              Authentication Method
            </label>
            <select
              id="authMethod"
              name="authMethod"
              className="form-input"
              value={formData.authMethod}
              onChange={handleInputChange}
            >
              <option value="password">Password</option>
              <option value="publicKey">Private Key</option>
            </select>
          </div>

          {formData.authMethod === 'password' ? (
            <div>
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="form-input"
                placeholder="Enter password"
                value={formData.password}
                onChange={handleInputChange}
              />
              {errors.password && <p className="text-red-400 text-sm mt-1">{errors.password}</p>}
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="privateKey" className="form-label">
                  Private Key
                </label>
                <textarea
                  id="privateKey"
                  name="privateKey"
                  rows={4}
                  className="form-input"
                  placeholder="-----BEGIN PRIVATE KEY-----..."
                  value={formData.privateKey}
                  onChange={handleInputChange}
                />
                {errors.privateKey && <p className="text-red-400 text-sm mt-1">{errors.privateKey}</p>}
              </div>

              <div>
                <label htmlFor="passphrase" className="form-label">
                  Passphrase (Optional)
                </label>
                <input
                  id="passphrase"
                  name="passphrase"
                  type="password"
                  className="form-input"
                  placeholder="Enter passphrase if required"
                  value={formData.passphrase}
                  onChange={handleInputChange}
                />
              </div>
            </>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex-1"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <div className="loading-spinner mr-3"></div>
                  Saving...
                </span>
              ) : (
                'Save Connection'
              )}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 