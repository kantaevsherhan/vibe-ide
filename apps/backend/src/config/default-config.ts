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
    maxFolderChildren: number;
  };
  security: {
    allowTerminal: boolean;
    allowGit: boolean;
    maxFileSizeMb: number;
    allowedOrigins: string[];
  };
  ignore: {
    enabled: boolean;
    useDefaultRules: boolean;
    vibeIgnoreFile: string;
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
      path: process.env.WORKSPACE_DIR ?? path.join(projectRoot, 'workspace'),
      maxFolderChildren: 500
    },
    security: {
      allowTerminal: true,
      allowGit: true,
      maxFileSizeMb: 5,
      allowedOrigins: ['*']
    },
    ignore: {
      enabled: true,
      useDefaultRules: true,
      vibeIgnoreFile: '.vibeignore'
    }
  };
}
