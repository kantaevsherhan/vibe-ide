import path from 'node:path';

export type VibeIdeConfig = {
  server: {
    host: string;
    port: number;
  };
  auth: {
    enabled: boolean;
    username: string;
    password: string;
    email: string;
    sessionSecret: string;
  };
  workspace: {
    path: string;
  };
  security: {
    allowTerminal: boolean;
    allowGit: boolean;
    maxFileSizeMb: number;
    allowedOrigins: string[];
  };
};

export function createDefaultConfig(projectRoot: string): VibeIdeConfig {
  return {
    server: {
      host: '0.0.0.0',
      port: 8080
    },
    auth: {
      enabled: true,
      username: 'admin',
      password: 'change-me',
      email: 'admin@example.com',
      sessionSecret: 'change-this-secret'
    },
    workspace: {
      path: process.env.WORKSPACE_DIR ?? path.join(projectRoot, 'workspace')
    },
    security: {
      allowTerminal: true,
      allowGit: true,
      maxFileSizeMb: 10,
      allowedOrigins: ['*']
    }
  };
}
