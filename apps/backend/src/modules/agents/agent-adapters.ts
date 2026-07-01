import type { AgentConfig } from './agents.types.js';

export type AgentLaunch = {
  command: string;
  args: string[];
  inputMode: AgentConfig['inputMode'];
};

export interface AgentAdapter {
  build(agent: AgentConfig, prompt: string, promptFile: string): AgentLaunch;
}

class BaseAdapter implements AgentAdapter {
  build(agent: AgentConfig, prompt: string, promptFile: string): AgentLaunch {
    return {
      command: agent.command,
      args: this.buildArgs(agent, prompt, promptFile),
      inputMode: agent.inputMode ?? 'stdin'
    };
  }

  protected buildArgs(agent: AgentConfig, prompt: string, promptFile: string) {
    const mode = agent.inputMode ?? 'stdin';
    const args = agent.args.map((arg) => arg.replaceAll('{prompt}', prompt).replaceAll('{promptFile}', promptFile));
    const hasPromptPlaceholder = agent.args.some((arg) => arg.includes('{prompt}'));
    const hasPromptFilePlaceholder = agent.args.some((arg) => arg.includes('{promptFile}'));

    if (mode === 'argument' && !hasPromptPlaceholder) return [...args, prompt];
    if (mode === 'file' && !hasPromptFilePlaceholder) return [...args, promptFile];
    return args;
  }
}

export class ClaudeAdapter extends BaseAdapter {}
export class GeminiAdapter extends BaseAdapter {}
export class CustomAdapter extends BaseAdapter {}

export class CodexAdapter extends BaseAdapter {
  override build(agent: AgentConfig, prompt: string, promptFile: string): AgentLaunch {
    const cleanAgent = {
      ...agent,
      args: this.stripUnsupportedArgs(agent.args)
    };
    return super.build(cleanAgent, prompt, promptFile);
  }

  private stripUnsupportedArgs(args: string[]) {
    const next: string[] = [];
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      if (arg === '--ask-for-approval') {
        index += 1;
        continue;
      }
      next.push(arg);
    }
    return next;
  }
}

export function adapterFor(agent: AgentConfig): AgentAdapter {
  if (agent.id === 'claude') return new ClaudeAdapter();
  if (agent.id === 'codex') return new CodexAdapter();
  if (agent.id === 'gemini') return new GeminiAdapter();
  return new CustomAdapter();
}
