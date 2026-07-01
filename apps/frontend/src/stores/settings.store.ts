import { defineStore } from 'pinia';
import { computed, reactive, ref, watch } from 'vue';
import { settingsApi, type LocalSettings, type ServerSettings, type ThemeName } from '../services/settings.api';
import type { AgentConfig } from '../types/agents';

const localStorageKey = 'vibeide:settings:local';
const defaultLocalSettings: LocalSettings = {
  theme: 'dark',
  fontSize: 14,
  fontFamily: 'JetBrains Mono'
};

const darkTheme = {
  '--bg-main': '#1e1e1e',
  '--bg-sidebar': '#252526',
  '--bg-activity': '#333333',
  '--bg-panel': '#181818',
  '--border': '#3c3c3c',
  '--text-main': '#cccccc',
  '--text-muted': '#858585',
  '--accent': '#007acc'
};

const lightTheme = {
  '--bg-main': '#f3f3f3',
  '--bg-sidebar': '#ffffff',
  '--bg-activity': '#e8e8e8',
  '--bg-panel': '#f8f8f8',
  '--border': '#d0d0d0',
  '--text-main': '#1f1f1f',
  '--text-muted': '#6a6a6a',
  '--accent': '#007acc'
};

function readLocalSettings(): LocalSettings {
  const raw = window.localStorage.getItem(localStorageKey);
  if (!raw) return { ...defaultLocalSettings };
  try {
    const parsed = JSON.parse(raw) as Partial<LocalSettings>;
    return {
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      fontSize: Number(parsed.fontSize) || defaultLocalSettings.fontSize,
      fontFamily: parsed.fontFamily?.trim() || defaultLocalSettings.fontFamily
    };
  } catch {
    return { ...defaultLocalSettings };
  }
}

function agentId(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || `agent-${Date.now()}`;
}

export const useSettingsStore = defineStore('settings', () => {
  const local = reactive<LocalSettings>(readLocalSettings());
  const server = ref<ServerSettings | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const testingTelegram = ref(false);
  const error = ref<string | null>(null);
  const message = ref<string | null>(null);
  let saveTimer: number | undefined;

  const editorFontFamily = computed(() => `${local.fontFamily}, JetBrains Mono, Cascadia Code, Consolas, monospace`);

  function applyTheme() {
    const theme = local.theme === 'light' ? lightTheme : darkTheme;
    Object.entries(theme).forEach(([key, value]) => document.documentElement.style.setProperty(key, value));
    document.documentElement.dataset.theme = local.theme;
  }

  function persistLocal() {
    window.localStorage.setItem(localStorageKey, JSON.stringify(local));
    applyTheme();
  }

  function setTheme(theme: ThemeName) {
    local.theme = theme;
    persistLocal();
  }

  function setFontSize(fontSize: number) {
    local.fontSize = fontSize;
    persistLocal();
  }

  function setFontFamily(fontFamily: string) {
    local.fontFamily = fontFamily.trim() || defaultLocalSettings.fontFamily;
    persistLocal();
  }

  async function loadServerSettings() {
    loading.value = true;
    error.value = null;
    try {
      server.value = (await settingsApi.get()).settings;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Failed to load settings.';
    } finally {
      loading.value = false;
    }
  }

  function scheduleSaveServerSettings() {
    if (!server.value) return;
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      void saveServerSettings();
    }, 300);
  }

  async function saveServerSettings() {
    if (!server.value) return;
    saving.value = true;
    error.value = null;
    try {
      server.value = (await settingsApi.update({
        agents: server.value.agents,
        notifications: server.value.notifications
      })).settings;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Failed to save settings.';
    } finally {
      saving.value = false;
    }
  }

  function updateAgent(index: number, patch: Partial<AgentConfig>) {
    if (!server.value?.agents[index]) return;
    server.value.agents[index] = { ...server.value.agents[index], ...patch };
    scheduleSaveServerSettings();
  }

  function updateAgentArgs(index: number, value: string) {
    updateAgent(index, { args: value.split(/\s+/).map((part) => part.trim()).filter(Boolean) });
  }

  function addCustomAgent() {
    if (!server.value) return;
    const name = 'Custom Agent';
    server.value.agents.push({
      id: agentId(`${name}-${server.value.agents.length + 1}`),
      name,
      command: '',
      args: [],
      enabled: false,
      inputMode: 'stdin'
    });
    scheduleSaveServerSettings();
  }

  function updateTelegram(patch: Partial<ServerSettings['notifications']['telegram']>) {
    if (!server.value) return;
    server.value.notifications.telegram = { ...server.value.notifications.telegram, ...patch };
    scheduleSaveServerSettings();
  }

  async function testTelegram() {
    if (!server.value) return;
    testingTelegram.value = true;
    error.value = null;
    message.value = null;
    try {
      const result = await settingsApi.testTelegram(server.value.notifications.telegram);
      message.value = result.message;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Failed to send notification.';
    } finally {
      testingTelegram.value = false;
    }
  }

  watch(() => local.theme, applyTheme, { immediate: true });

  return {
    local,
    server,
    loading,
    saving,
    testingTelegram,
    error,
    message,
    editorFontFamily,
    setTheme,
    setFontSize,
    setFontFamily,
    loadServerSettings,
    saveServerSettings,
    scheduleSaveServerSettings,
    updateAgent,
    updateAgentArgs,
    addCustomAgent,
    updateTelegram,
    testTelegram
  };
});
