<script setup lang="ts">
import { Bot, ClipboardList, ExternalLink, GitBranch, MapPin, TerminalSquare, Trash2 } from '@lucide/vue';
import type { Project } from '../../services/projects.api';

defineProps<{
  project: Project;
}>();

defineEmits<{
  open: [folderName: string];
  delete: [project: Project];
}>();

function gitLabel(project: Project) {
  if (project.health.gitClean) return 'Clean';
  return `${project.health.gitChangedFiles} Changes`;
}

function statusClass(status: string) {
  if (status === 'running' || status === 'active') return 'text-ide-accent';
  if (status === 'waiting') return 'text-yellow-300';
  if (status === 'error') return 'text-red-300';
  return 'text-ide-muted';
}
</script>

<template>
  <article class="flex min-h-80 flex-col border border-ide-border bg-ide-sidebar p-4 shadow-[0_10px_30px_rgba(0,0,0,0.16)]">
    <div class="mb-4">
      <div class="mb-1 text-[11px] uppercase tracking-wide text-ide-muted">Project Name</div>
      <h2 class="truncate text-xl font-semibold text-ide-text">{{ project.name }}</h2>
    </div>

    <div class="mb-4">
      <div class="mb-1 text-[11px] uppercase tracking-wide text-ide-muted">Description</div>
      <p class="line-clamp-3 min-h-12 text-sm leading-5 text-ide-muted">{{ project.description || 'No description.' }}</p>
    </div>

    <div class="mb-4">
      <div class="mb-1 text-[11px] uppercase tracking-wide text-ide-muted">Location</div>
      <div class="flex min-w-0 items-center gap-2 border border-ide-border bg-ide-panel px-2 py-1.5 font-mono text-xs text-ide-accent">
        <MapPin :size="13" class="shrink-0 text-ide-muted" />
        <span class="truncate">{{ project.location }}</span>
      </div>
    </div>

    <div class="mb-4">
      <div class="mb-2 text-[11px] uppercase tracking-wide text-ide-muted">Runtime</div>
      <div class="flex flex-wrap gap-2">
        <span class="inline-flex items-center gap-1.5 border border-ide-border bg-ide-panel px-2 py-1 text-xs text-ide-muted">
          <TerminalSquare :size="13" />
          {{ project.runtime.activeTerminals }} Terminals
        </span>
        <span class="inline-flex items-center gap-1.5 border border-ide-border bg-ide-panel px-2 py-1 text-xs text-ide-muted">
          <Bot :size="13" />
          {{ project.runtime.runningAgents }} Agents
        </span>
        <span class="inline-flex items-center gap-1.5 border border-ide-border bg-ide-panel px-2 py-1 text-xs text-ide-muted">
          <ClipboardList :size="13" />
          {{ project.runtime.activeTasks }} Tasks
        </span>
        <span class="inline-flex items-center gap-1.5 border border-ide-border bg-ide-panel px-2 py-1 text-xs" :class="project.health.gitClean ? 'text-green-300' : 'text-ide-accent'">
          <GitBranch :size="13" />
          {{ gitLabel(project) }}
        </span>
      </div>
    </div>

    <div class="mb-4">
      <div class="mb-2 text-[11px] uppercase tracking-wide text-ide-muted">Workspace Health</div>
      <div class="grid gap-1.5 text-xs">
        <div class="flex items-center justify-between gap-2">
          <span class="inline-flex items-center gap-1.5 text-ide-muted"><GitBranch :size="13" />Git</span>
          <span :class="project.health.gitClean ? 'text-green-300' : 'text-ide-accent'">{{ gitLabel(project) }}</span>
        </div>
        <div class="flex items-center justify-between gap-2">
          <span class="inline-flex items-center gap-1.5 text-ide-muted"><TerminalSquare :size="13" />Terminals</span>
          <span :class="statusClass(project.health.terminalStatus)">{{ project.health.terminalStatus === 'active' ? 'Active' : 'Inactive' }}</span>
        </div>
        <div class="flex items-center justify-between gap-2">
          <span class="inline-flex items-center gap-1.5 text-ide-muted"><Bot :size="13" />Agents</span>
          <span :class="statusClass(project.health.agentStatus)">{{ project.health.agentStatus }}</span>
        </div>
      </div>
    </div>

    <div class="mt-auto flex gap-2 pt-2">
      <button class="inline-flex h-9 flex-1 items-center justify-center gap-2 bg-ide-accent px-3 text-sm font-medium text-white hover:bg-[#0b86d1]" @click="$emit('open', project.folderName)">
        <ExternalLink :size="15" />
        Open Project
      </button>
      <button
        class="grid h-9 w-10 place-items-center border border-ide-border text-ide-muted hover:border-red-500/60 hover:text-red-200"
        title="Delete project"
        @click="$emit('delete', project)"
      >
        <Trash2 :size="15" />
      </button>
    </div>
  </article>
</template>
