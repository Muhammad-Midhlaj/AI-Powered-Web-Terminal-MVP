// ID generation utility
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

// Date utilities
export function formatTimestamp(date: Date): string {
  return date.toISOString();
}

export function parseTimestamp(timestamp: string): Date {
  return new Date(timestamp);
}

// SSH utilities
export function isValidSSHPort(port: number): boolean {
  return port > 0 && port <= 65535;
}

export function isValidHostname(hostname: string): boolean {
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  return hostnameRegex.test(hostname) || ipRegex.test(hostname);
}

// Command safety utilities
export function isDangerousCommand(command: string): boolean {
  const dangerousPatterns = [
    /^\s*rm\s+-rf?\s+\//,
    /^\s*sudo\s+rm\s+-rf?\s+\//,
    /^\s*dd\s+if=/,
    /^\s*mkfs/,
    /^\s*fdisk/,
    /^\s*shutdown/,
    /^\s*reboot/,
    /^\s*halt/,
    /^\s*poweroff/,
    /^\s*kill\s+-9\s+1$/,
    /^\s*pkill\s+-f/,
    /^\s*killall/,
    />\s*\/dev\/sd[a-z]/,
    />\s*\/dev\/hd[a-z]/
  ];
  
  return dangerousPatterns.some(pattern => pattern.test(command.toLowerCase()));
}

// Terminal utilities
export function sanitizeTerminalOutput(output: string): string {
  // Remove ANSI escape sequences for non-terminal display
  return output.replace(/\x1b\[[0-9;]*m/g, '');
}

export function parseTerminalDimensions(cols: number, rows: number): { cols: number; rows: number } {
  return {
    cols: Math.max(1, Math.min(cols, 300)),
    rows: Math.max(1, Math.min(rows, 100))
  };
}

// Validation utilities
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isStrongPassword(password: string): boolean {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
}

// Error formatting
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
} 