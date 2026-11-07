import type { RunOptions, TaskOptions } from './agents.types.js';

export function validateTaskOptions({ run, reviewer }: TaskOptions): TaskOptions {
  function validate(options: RunOptions | undefined): RunOptions | undefined {
    if (options === undefined) return;
    if (!options || typeof options !== 'object' ||
        (options.model !== undefined && (typeof options.model !== 'string' || !/^[a-z0-9][a-z0-9._:/@+\-]{0,199}$/i.test(options.model))) ||
        (options.effort !== undefined && !['low', 'medium', 'high', 'xhigh', 'max'].includes(options.effort))) {
      throw Object.assign(new Error('Enter a valid model ID and reasoning level.'), { statusCode: 400 });
    }
    return { model: options.model, effort: options.effort };
  }

  if (reviewer !== undefined && (!reviewer || !['codex', 'claude'].includes(reviewer.agentId))) {
    throw Object.assign(new Error('Choose Codex CLI or Claude Code CLI for the review.'), { statusCode: 400 });
  }
  return { run: validate(run), reviewer: reviewer && { ...validate(reviewer), agentId: reviewer.agentId } };
}
