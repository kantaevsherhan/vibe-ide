<script setup lang="ts">
import type { RunOptions, TaskOptions } from '../../types/agents';

defineProps<{ reviewers?: { id: string; name: string }[] }>();
const options = defineModel<TaskOptions>({ required: true });
const cliReviewers = [{ id: 'codex', name: 'Codex CLI' }, { id: 'claude', name: 'Claude Code CLI' }];
const efforts: NonNullable<RunOptions['effort']>[] = ['low', 'medium', 'high', 'xhigh', 'max'];

function selectReviewer(id: string) {
  const reviewer = id === 'codex' || id === 'claude' ? { agentId: id } as const : undefined;
  options.value = { ...options.value, reviewer };
}

function update(role: 'run' | 'reviewer', patch: RunOptions) {
  if (role === 'run') {
    options.value = { ...options.value, run: { ...options.value.run, ...patch } };
  } else if (options.value.reviewer) {
    options.value = { ...options.value, reviewer: { ...options.value.reviewer, ...patch } };
  }
}
</script>

<template>
  <details class="border border-ide-border bg-ide-panel text-sm">
    <summary class="min-h-11 cursor-pointer px-3 py-2.5 text-ide-text">Model and review</summary>
    <div class="grid gap-3 border-t border-ide-border p-3">
      <label>
        Reviewer
        <select class="run-input" aria-label="Reviewer" :value="options.reviewer?.agentId ?? ''"
          @change="selectReviewer(($event.target as HTMLSelectElement).value)">
          <option value="">No automatic review</option>
          <option v-for="agent in reviewers ?? cliReviewers" :key="agent.id" :value="agent.id">{{ agent.name }}</option>
        </select>
      </label>
      <template v-for="role in (['run', 'reviewer'] as const)" :key="role">
        <div v-if="role === 'run' || options.reviewer" class="grid gap-3">
          <label>
            {{ role === 'run' ? 'Executor model' : 'Reviewer model' }}
            <input class="run-input" placeholder="Provider default" autocomplete="off" spellcheck="false"
              :value="options[role]?.model ?? ''"
              @input="update(role, { model: ($event.target as HTMLInputElement).value.trim() || undefined })" />
          </label>
          <label>
            {{ role === 'run' ? 'Executor reasoning' : 'Reviewer reasoning' }}
            <select class="run-input" :aria-label="role === 'run' ? 'Executor reasoning' : 'Reviewer reasoning'" :value="options[role]?.effort ?? ''"
              @change="update(role, { effort: (($event.target as HTMLSelectElement).value || undefined) as RunOptions['effort'] })">
              <option value="">Provider default</option>
              <option v-for="level in efforts" :key="level" :value="level">{{ level }}</option>
            </select>
          </label>
        </div>
      </template>
      <p v-if="options.reviewer" class="text-ide-text">Review starts after a successful run and has its own log.</p>
    </div>
  </details>
</template>

<style scoped>
.run-input {
  @apply mt-1 block min-h-11 w-full min-w-0 border border-ide-border bg-ide-sidebar px-3 text-ide-text;
}
summary:focus-visible, .run-input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
