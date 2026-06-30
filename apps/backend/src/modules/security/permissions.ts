import type { VibeIdeConfig } from '../../config/default-config.js';

export function ensureTerminalAllowed(config: VibeIdeConfig) {
  if (!config.security.allowTerminal) {
    throw Object.assign(new Error('Terminal is disabled by server configuration.'), { statusCode: 403 });
  }
}

export function ensureGitAllowed(config: VibeIdeConfig) {
  if (!config.security.allowGit) {
    throw Object.assign(new Error('Git is disabled by server configuration.'), { statusCode: 403 });
  }
}
