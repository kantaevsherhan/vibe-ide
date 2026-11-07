<script setup lang="ts">
import AgentRunOptions from '../agents/AgentRunOptions.vue';
import { onMounted, ref } from 'vue';
import { settingsApi, type ServerSettings } from '../../services/settings.api';
import { apiRequest } from '../../services/api';

const data = ref<ServerSettings | null>(null);
const projects = ref<{ folderName: string; name: string }[]>([]);
const busy = ref(false);
const error = ref('');
const message = ref('');
const status = ref<{ lastCheckedAt: string | null; lastChronosAt: string | null; error: string | null } | null>(null);

async function load() {
  busy.value = true;
  error.value = '';
  try {
    const [settings, list, automation] = await Promise.all([
      settingsApi.get(),
      apiRequest<{ projects: typeof projects.value }>('/api/projects'),
      apiRequest<{ status: typeof status.value }>('/api/settings/automation')
    ]);
    data.value = settings.settings;
    projects.value = list.projects;
    status.value = automation.status;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Unable to load connections.';
  } finally {
    busy.value = false;
  }
}

async function save() {
  if (!data.value) return;
  busy.value = true;
  error.value = '';
  message.value = '';
  try {
    const result = await settingsApi.update({
      models: data.value.models, warmup: data.value.warmup, chronos: data.value.chronos
    });
    data.value = result.settings;
    message.value = 'Connections and schedule saved.';
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Unable to save. Check the fields and try again.';
  } finally {
    busy.value = false;
  }
}

async function check() {
  busy.value = true;
  error.value = '';
  try {
    status.value = (await apiRequest<{ status: typeof status.value }>('/api/settings/automation/check', { method: 'POST' })).status;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Unable to check automation.';
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="automation-settings space-y-6">
    <p v-if="error" role="alert" class="border border-ide-border p-3">{{ error }}</p>
    <p v-if="message" role="status" class="text-ide-text">{{ message }}</p>
    <p v-if="busy && !data" role="status">Loading connections…</p>
    <button v-if="!data && !busy" class="desktop-action-button min-h-11 px-4" @click="load">Retry loading</button>
    <form v-if="data" class="space-y-6" @submit.prevent="save">
      <section class="space-y-4">
        <h4 class="font-semibold">Model connections</h4>
        <p class="text-sm text-ide-muted">API models return suggestions in the task log. Set a model name to enable a connection.</p>
        <fieldset v-for="id in (['api', 'ollama'] as const)" :key="id" class="space-y-3 border-t border-ide-border pt-4">
          <legend class="pr-3 font-medium">{{ id === 'api' ? 'Compatible API' : 'Ollama' }}</legend>
          <label class="block">Model
            <input v-model="data.models[id].model" class="connection-input" autocomplete="off" placeholder="Exact model name" />
          </label>
          <label class="block">Base URL
            <input v-model="data.models[id].baseUrl" type="url" required class="connection-input" spellcheck="false" />
          </label>
          <label class="block">API key
            <input v-model="data.models[id].apiKey" type="password" class="connection-input" autocomplete="new-password" :placeholder="data.models[id].keyConfigured ? 'Saved. Leave blank to keep.' : 'Optional for local models'" />
          </label>
        </fieldset>
      </section>

      <section class="space-y-3 border-t border-ide-border pt-4">
        <h4 class="font-semibold">Daily CLI check</h4>
        <p id="warmup-help" class="text-sm text-ide-muted">Sends a short request once per selected agent each day. Provider rules determine usage windows. VibeIDE must be running at the chosen time. Queued work can delay the request.</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block">Time
            <input v-model="data.warmup.time" type="time" required class="connection-input" aria-describedby="warmup-help" />
          </label>
          <label class="block">Timezone
            <input v-model="data.warmup.timeZone" required class="connection-input" placeholder="Asia/Qyzylorda" />
          </label>
        </div>
        <label class="block">Project
          <select v-model="data.warmup.projectName" class="connection-input">
            <option value="">Select a project</option>
            <option v-for="project in projects" :key="project.folderName" :value="project.folderName">{{ project.folderName }}</option>
          </select>
        </label>
        <fieldset class="flex flex-wrap gap-4">
          <legend class="mb-2">Scheduled agents</legend>
          <label v-for="id in (['codex', 'claude'] as const)" :key="id" class="flex min-h-11 items-center gap-2">
            <input v-model="data.warmup.agents" type="checkbox" :value="id" /> {{ id === 'codex' ? 'Codex CLI' : 'Claude Code CLI' }}
          </label>
        </fieldset>
        <p class="text-sm text-ide-muted">Clear both checkboxes to disable the schedule. Missed times are skipped.</p>
      </section>

      <section class="space-y-3 border-t border-ide-border pt-4">
        <h4 class="font-semibold">Chronos task automation</h4>
        <label class="flex min-h-11 items-center gap-2">
          <input v-model="data.chronos.enabled" type="checkbox" /> Enable background checks
        </label>
        <p id="chronos-help" class="text-sm text-ide-muted">Checks every minute. Tasks with [vibe] in the title and a matching project run through the selected CLI. Successful runs are sent for review. Telegram notifications use the Notifications settings.</p>
        <label class="block">MCP URL
          <input v-model="data.chronos.url" type="url" required class="connection-input" aria-describedby="chronos-help" />
        </label>
        <label class="block">Chronos write token
          <input v-model="data.chronos.token" type="password" class="connection-input" autocomplete="new-password" :placeholder="data.chronos.tokenConfigured ? 'Saved. Leave blank to keep.' : 'Create an agent token in Chronos'" />
        </label>
        <label class="block">Project folder
          <select v-model="data.chronos.projectName" class="connection-input">
            <option value="">Select a project</option>
            <option v-for="project in projects" :key="project.folderName" :value="project.folderName">{{ project.folderName }}</option>
          </select>
        </label>
        <label class="block">Agent
          <select v-model="data.chronos.agentId" class="connection-input">
            <option value="codex">Codex CLI</option>
            <option value="claude">Claude Code CLI</option>
          </select>
        </label>
        <AgentRunOptions :model-value="data.chronos" @update:model-value="Object.assign(data.chronos, $event)" />
      </section>
      <div class="sticky bottom-0 flex flex-wrap gap-3 border-t border-ide-border bg-ide-sidebar py-3">
        <button type="submit" class="desktop-action-button min-h-11 px-4" :disabled="busy">{{ busy ? 'Working…' : 'Save connections and schedule' }}</button>
        <button type="button" class="desktop-action-button min-h-11 px-4" :disabled="busy" @click="check">Check saved automation</button>
      </div>
      <div v-if="status" role="status" class="space-y-2 text-sm">
        <p>Last check · {{ status.lastCheckedAt ? new Date(status.lastCheckedAt).toLocaleString() : 'Waiting for first check' }}</p>
        <p>Chronos sync · {{ status.lastChronosAt ? new Date(status.lastChronosAt).toLocaleString() : 'Waiting for connection' }}</p>
        <p v-if="status.error">{{ status.error }}</p>
      </div>
    </form>
  </div>
</template>

<style scoped>
.connection-input {
  @apply mt-1 block min-h-11 w-full min-w-0 border border-ide-border bg-ide-sidebar px-3 text-ide-text;
}
.automation-settings :is(input, select, button):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.automation-settings button:disabled {
  @apply cursor-wait opacity-50;
}
</style>
