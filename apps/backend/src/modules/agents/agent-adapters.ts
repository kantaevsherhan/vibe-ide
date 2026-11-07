import type { AgentConfig, RunOptions } from './agents.types.js';

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
export class CustomAdapter extends BaseAdapter {}

export class CodexAdapter extends BaseAdapter {
  override build(agent: AgentConfig, prompt: string, promptFile: string): AgentLaunch {
    let args = this.stripUnsupportedArgs(agent.args);
    if (args[0] === 'exec' && !args.includes('--skip-git-repo-check')) {
      args = ['exec', '--skip-git-repo-check', ...args.slice(1)];
    }
    const cleanAgent = {
      ...agent,
      args
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
  return new CustomAdapter();
}

export function launchTask(agent: AgentConfig, prompt: string, promptFile: string, options?: RunOptions, review = false): AgentLaunch {
  const codex = agent.id === 'codex';
  const model = options?.model ? ['--model', options.model] : [];
  const effort = options?.effort
    ? codex ? ['-c', `model_reasoning_effort="${options.effort}"`] : ['--effort', options.effort]
    : [];

  if (review) {
    const args = codex
      ? ['exec', '--skip-git-repo-check', '--sandbox', 'read-only', ...model, ...effort, '-']
      : ['-p', '--permission-mode', 'plan', '--tools', 'Read,Glob,Grep',
        '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', ...model, ...effort];
    return { command: agent.command, args, inputMode: 'stdin' };
  }

  const args: string[] = [];
  for (let index = 0; index < agent.args.length; index++) {
    const arg = agent.args[index];
    if (model.length && ['--model', '-m'].includes(arg) || !codex && effort.length && arg === '--effort') {
      index++;
    } else if (!(model.length && /^(--model|-m)=/.test(arg) || !codex && effort.length && arg.startsWith('--effort='))) {
      args.push(arg);
    }
  }
  const promptIndex = args.findIndex((arg) => arg.includes('{prompt}') || arg.includes('{promptFile}'));
  args.splice(promptIndex < 0 ? args.length : promptIndex, 0, ...model, ...effort);
  const usesNativePrompt = agent.inputMode === 'argument' && args.at(-1) === '{prompt}' &&
    (codex ? args[0] === 'exec' : args.includes('-p') || args.includes('--print'));
  if (usesNativePrompt) {
    args.pop();
    if (codex) args.push('-');
    return adapterFor(agent).build({ ...agent, args, inputMode: 'stdin' }, prompt, promptFile);
  }
  return adapterFor(agent).build({ ...agent, args }, prompt, promptFile);
}
