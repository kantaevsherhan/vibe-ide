<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Bell, Bot, Folder, MonitorCog, Palette, PencilLine, Settings } from '@lucide/vue';
import BaseModal from '../ui/BaseModal.vue';
import { useSettingsStore } from '../../stores/settings.store';

const props = defineProps<{
  open: boolean;
}>();

defineEmits<{
  close: [];
}>();

type SectionId = 'general' | 'appearance' | 'editor' | 'agents' | 'notifications' | 'workspace';

const settings = useSettingsStore();
const active = ref<SectionId>('general');
const fontSizes = [12, 13, 14, 15, 16, 18, 20, 22];
const sections = [
  { id: 'general' as const, label: 'General', icon: Settings },
  { id: 'appearance' as const, label: 'Appearance', icon: Palette },
  { id: 'editor' as const, label: 'Editor', icon: PencilLine },
  { id: 'agents' as const, label: 'Agents', icon: Bot },
  { id: 'notifications' as const, label: 'Notifications', icon: Bell },
  { id: 'workspace' as const, label: 'Workspace', icon: Folder }
];

const activeLabel = computed(() => sections.find((section) => section.id === active.value)?.label ?? 'Settings');

watch(
  () => props.open,
  (open) => {
    if (open && !settings.server && !settings.loading) void settings.loadServerSettings();
  }
);

onMounted(() => {
  if (props.open && !settings.server) void settings.loadServerSettings();
});
</script>

<template>
  <BaseModal
    v-if="open"
    title="Settings"
    panel-class="max-w-[1100px] h-[70vh] min-h-[620px]"
    @close="$emit('close')"
  >
    <div class="grid h-[calc(70vh-49px)] min-h-[570px] grid-cols-[230px_minmax(0,1fr)]">
      <aside class="border-r border-ide-border bg-ide-panel/70 p-2">
        <button
          v-for="section in sections"
          :key="section.id"
          class="flex h-10 w-full items-center gap-3 px-3 text-left text-sm hover:bg-white/10"
          :class="active === section.id ? 'bg-ide-accent/20 text-ide-text' : 'text-ide-muted'"
          @click="active = section.id"
        >
          <component :is="section.icon" :size="17" />
          {{ section.label }}
        </button>
      </aside>

      <section class="min-h-0 overflow-auto p-6 thin-scrollbar">
        <div class="mb-5 flex items-center justify-between gap-3 border-b border-ide-border pb-4">
          <div>
            <h3 class="text-lg font-semibold">{{ activeLabel }} Settings</h3>
            <p class="text-sm text-ide-muted">
              Local settings stay on this device. Server settings are shared for this VibeIDE workspace.
            </p>
          </div>
          <span class="text-xs text-ide-muted">{{ settings.saving ? 'Saving...' : 'Auto save' }}</span>
        </div>

        <p v-if="settings.error" class="mb-4 border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{{ settings.error }}</p>
        <p v-if="settings.message" class="mb-4 border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-200">{{ settings.message }}</p>

        <div v-if="active === 'general'" class="space-y-4">
          <section class="border border-ide-border bg-ide-panel p-4">
            <h4 class="mb-2 font-medium">Settings Storage</h4>
            <p class="text-sm text-ide-muted">Appearance and editor font settings are local. Agents, notifications, and workspace settings are stored on the server.</p>
          </section>
          <section class="border border-ide-border bg-ide-panel p-4">
            <h4 class="mb-2 font-medium">Status</h4>
            <p class="text-sm text-ide-muted">{{ settings.loading ? 'Loading server settings...' : 'Settings are ready.' }}</p>
          </section>
        </div>

        <div v-else-if="active === 'appearance'" class="space-y-4">
          <section class="border border-ide-border bg-ide-panel p-4">
            <h4 class="mb-3 font-medium">Theme</h4>
            <label class="block max-w-xs">
              <span class="mb-1 block text-xs uppercase tracking-wide text-ide-muted">Theme</span>
              <select
                class="h-9 w-full border border-ide-border bg-ide-sidebar px-3 outline-none focus:border-ide-accent"
                :value="settings.local.theme"
                @change="settings.setTheme(($event.target as HTMLSelectElement).value === 'light' ? 'light' : 'dark')"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
          </section>
        </div>

        <div v-else-if="active === 'editor'" class="space-y-4">
          <section class="grid gap-4 border border-ide-border bg-ide-panel p-4 md:grid-cols-2">
            <label class="block">
              <span class="mb-1 block text-xs uppercase tracking-wide text-ide-muted">Font Size</span>
              <select
                class="h-9 w-full border border-ide-border bg-ide-sidebar px-3 outline-none focus:border-ide-accent"
                :value="settings.local.fontSize"
                @change="settings.setFontSize(Number(($event.target as HTMLSelectElement).value))"
              >
                <option v-for="size in fontSizes" :key="size" :value="size">{{ size }}</option>
              </select>
            </label>
            <label class="block">
              <span class="mb-1 block text-xs uppercase tracking-wide text-ide-muted">Font Family</span>
              <input
                class="h-9 w-full border border-ide-border bg-ide-sidebar px-3 outline-none focus:border-ide-accent"
                :value="settings.local.fontFamily"
                placeholder="JetBrains Mono"
                @change="settings.setFontFamily(($event.target as HTMLInputElement).value)"
              />
            </label>
          </section>
        </div>

        <div v-else-if="active === 'agents'" class="space-y-4">
          <section v-if="settings.server" class="space-y-3">
            <div class="flex items-center justify-between gap-3">
              <h4 class="font-medium">AI Agents</h4>
              <button class="desktop-action-button h-8 px-3" @click="settings.addCustomAgent">Add Custom Agent</button>
            </div>
            <article v-for="(agent, index) in settings.server.agents" :key="agent.id" class="border border-ide-border bg-ide-panel p-4">
              <div class="mb-3 flex items-center justify-between gap-3">
                <strong>{{ agent.name || 'Agent' }}</strong>
                <label class="flex items-center gap-2 text-sm text-ide-muted">
                  <input type="checkbox" :checked="agent.enabled" @change="settings.updateAgent(index, { enabled: ($event.target as HTMLInputElement).checked })" />
                  Enabled
                </label>
              </div>
              <div class="grid gap-3 md:grid-cols-2">
                <label class="block">
                  <span class="mb-1 block text-xs uppercase tracking-wide text-ide-muted">Name</span>
                  <input class="h-9 w-full border border-ide-border bg-ide-sidebar px-3 outline-none focus:border-ide-accent" :value="agent.name" @input="settings.updateAgent(index, { name: ($event.target as HTMLInputElement).value })" />
                </label>
                <label class="block">
                  <span class="mb-1 block text-xs uppercase tracking-wide text-ide-muted">Command</span>
                  <input class="h-9 w-full border border-ide-border bg-ide-sidebar px-3 font-mono outline-none focus:border-ide-accent" :value="agent.command" @input="settings.updateAgent(index, { command: ($event.target as HTMLInputElement).value })" />
                </label>
                <label class="block md:col-span-2">
                  <span class="mb-1 block text-xs uppercase tracking-wide text-ide-muted">Arguments</span>
                  <input class="h-9 w-full border border-ide-border bg-ide-sidebar px-3 font-mono outline-none focus:border-ide-accent" :value="agent.args.join(' ')" placeholder="-p {prompt}" @input="settings.updateAgentArgs(index, ($event.target as HTMLInputElement).value)" />
                </label>
                <label class="block">
                  <span class="mb-1 block text-xs uppercase tracking-wide text-ide-muted">Working Directory</span>
                  <input class="h-9 w-full border border-ide-border bg-ide-sidebar px-3 outline-none" disabled placeholder="Current project folder" />
                </label>
                <label class="block">
                  <span class="mb-1 block text-xs uppercase tracking-wide text-ide-muted">Input Mode</span>
                  <select class="h-9 w-full border border-ide-border bg-ide-sidebar px-3 outline-none focus:border-ide-accent" :value="agent.inputMode ?? 'stdin'" @change="settings.updateAgent(index, { inputMode: ($event.target as HTMLSelectElement).value as 'stdin' | 'argument' | 'file' })">
                    <option value="stdin">stdin</option>
                    <option value="argument">argument</option>
                    <option value="file">file</option>
                  </select>
                </label>
              </div>
            </article>
          </section>
        </div>

        <div v-else-if="active === 'notifications'" class="space-y-4">
          <section v-if="settings.server" class="border border-ide-border bg-ide-panel p-4">
            <div class="mb-3 flex items-center justify-between gap-3">
              <h4 class="font-medium">Telegram</h4>
              <label class="flex items-center gap-2 text-sm text-ide-muted">
                <input type="checkbox" :checked="settings.server.notifications.telegram.enabled" @change="settings.updateTelegram({ enabled: ($event.target as HTMLInputElement).checked })" />
                Enable Notifications
              </label>
            </div>
            <div class="grid gap-3 md:grid-cols-2">
              <label class="block">
                <span class="mb-1 block text-xs uppercase tracking-wide text-ide-muted">Bot Token</span>
                <input class="h-9 w-full border border-ide-border bg-ide-sidebar px-3 font-mono outline-none focus:border-ide-accent" :value="settings.server.notifications.telegram.botToken" @input="settings.updateTelegram({ botToken: ($event.target as HTMLInputElement).value })" />
              </label>
              <label class="block">
                <span class="mb-1 block text-xs uppercase tracking-wide text-ide-muted">Chat ID</span>
                <input class="h-9 w-full border border-ide-border bg-ide-sidebar px-3 font-mono outline-none focus:border-ide-accent" :value="settings.server.notifications.telegram.chatId" @input="settings.updateTelegram({ chatId: ($event.target as HTMLInputElement).value })" />
              </label>
            </div>
            <button class="mt-4 h-9 bg-ide-accent px-4 font-medium text-white hover:bg-[#0b86d1] disabled:opacity-50" :disabled="settings.testingTelegram" @click="settings.testTelegram">
              {{ settings.testingTelegram ? 'Sending...' : 'Test Notification' }}
            </button>
          </section>
        </div>

        <div v-else-if="active === 'workspace'" class="space-y-4">
          <section v-if="settings.server" class="grid gap-4 border border-ide-border bg-ide-panel p-4 md:grid-cols-2">
            <label class="block md:col-span-2">
              <span class="mb-1 block text-xs uppercase tracking-wide text-ide-muted">Workspace Path</span>
              <input class="h-9 w-full border border-ide-border bg-ide-sidebar px-3 font-mono outline-none" disabled :value="settings.server.workspace.path" />
            </label>
            <label class="flex items-center gap-2 text-sm text-ide-muted">
              <input type="checkbox" disabled :checked="settings.server.workspace.readOnly" />
              Read Only
            </label>
            <label class="flex items-center gap-2 text-sm text-ide-muted">
              <input type="checkbox" disabled :checked="settings.server.workspace.autoIgnore" />
              Auto Ignore
            </label>
            <p class="md:col-span-2 text-sm text-ide-muted">More workspace settings will be available in a future version.</p>
          </section>
        </div>
      </section>
    </div>
  </BaseModal>
</template>
