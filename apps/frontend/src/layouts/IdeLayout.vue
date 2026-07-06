<script setup lang="ts">
import { Bot, Download, Files, GitBranch, Maximize, Menu, Minimize, NotebookText, TerminalSquare, X } from '@lucide/vue';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import ActivityBar from '../components/activity-bar/ActivityBar.vue';
import AgentChatSidebar from '../components/agents/AgentChatSidebar.vue';
import EditorTabs from '../components/editor/EditorTabs.vue';
import WorkspaceEditor from '../components/editor/WorkspaceEditor.vue';
import WorkspaceHealth from '../components/health/WorkspaceHealth.vue';
import TitleBar from '../components/layout/TitleBar.vue';
import NotesPanel from '../components/notes/NotesPanel.vue';
import FileExplorer from '../components/sidebar/FileExplorer.vue';
import GitPanel from '../components/sidebar/GitPanel.vue';
import TerminalPanel from '../components/sidebar/TerminalPanel.vue';
import TerminalView from '../components/terminal/TerminalView.vue';
import { useResizable } from '../composables/useResizable';
import { useFilesStore } from '../stores/files.store';
import { useGitStore } from '../stores/git.store';
import { useAgentsStore } from '../stores/agents.store';
import { useHealthStore } from '../stores/health.store';
import { useNotesStore } from '../stores/notes.store';
import { useTerminalStore } from '../stores/terminal.store';
import { useEditorStore } from '../stores/editor.store';
import { useProjectsStore } from '../stores/projects.store';
import SettingsModal from '../components/settings/SettingsModal.vue';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type IdeView = 'files' | 'git' | 'terminal' | 'notes';

const activeView = ref<IdeView>('files');
const drawerOpen = ref(false);
const isFullscreen = ref(false);
const isMobile = ref(false);
const deferredInstallPrompt = ref<BeforeInstallPromptEvent | null>(null);
const settingsOpen = ref(false);
const mobileAgentsOpen = ref(false);
const desktopSidebarVisible = ref(true);
const desktopAgentsVisible = ref(true);
const terminalPanelVisible = ref(true);
const files = useFilesStore();
const git = useGitStore();
const agents = useAgentsStore();
const health = useHealthStore();
const notes = useNotesStore();
const editor = useEditorStore();
const terminals = useTerminalStore();
const projects = useProjectsStore();
const route = useRoute();
let mobileMediaQuery: MediaQueryList | null = null;
const projectName = computed(() => String(route.params.projectName ?? ''));
const titleProjectName = computed(() => projects.projects.find((project) => project.folderName === projectName.value)?.name ?? projectName.value);

const sidebarResize = useResizable({
  key: 'vibeide.sidebar.size',
  direction: 'horizontal',
  defaultWidth: 280
});

const terminalResize = useResizable({
  key: 'vibeide.terminal.size',
  direction: 'vertical',
  defaultHeight: 280,
  verticalGrowthDirection: 'up'
});

const activeTitle = computed(() => {
  if (activeView.value === 'files') return 'Files';
  if (activeView.value === 'git') return 'Git';
  if (activeView.value === 'terminal') return 'Terminal';
  if (activeView.value === 'notes') return 'Notes';
  return 'Files';
});

const navItems = [
  { id: 'files', label: 'Files', icon: Files },
  { id: 'git', label: 'Git', icon: GitBranch },
  { id: 'terminal', label: 'Terminal', icon: TerminalSquare },
  { id: 'notes', label: 'Notes', icon: NotebookText }
] as const;

function selectMobileView(view: IdeView) {
  activeView.value = view;
  drawerOpen.value = view !== 'terminal';
}

function selectDesktopView(view: IdeView) {
  if (activeView.value === view) {
    desktopSidebarVisible.value = !desktopSidebarVisible.value;
    return;
  }
  activeView.value = view;
  desktopSidebarVisible.value = true;
}

function showTerminalPanel() {
  terminalPanelVisible.value = true;
  activeView.value = 'terminal';
  desktopSidebarVisible.value = true;
}

async function enterFullscreen() {
  if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
    await document.documentElement.requestFullscreen();
  }
}

async function exitFullscreen() {
  if (document.fullscreenElement && document.exitFullscreen) {
    await document.exitFullscreen();
  }
}

async function installPwa() {
  if (!deferredInstallPrompt.value) return;
  await deferredInstallPrompt.value.prompt();
  await deferredInstallPrompt.value.userChoice;
  deferredInstallPrompt.value = null;
}

function syncFullscreenState() {
  isFullscreen.value = Boolean(document.fullscreenElement);
}

function onBeforeInstallPrompt(event: Event) {
  event.preventDefault();
  deferredInstallPrompt.value = event as BeforeInstallPromptEvent;
}

function syncMobileState() {
  isMobile.value = Boolean(mobileMediaQuery?.matches);
  if (!isMobile.value) drawerOpen.value = false;
}

function handleGlobalKeys(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'w') {
    event.preventDefault();
    if (editor.activePath) editor.close(editor.activePath);
  }
}

function reloadWorkspaceState() {
  void files.refresh();
  void notes.refresh();
  void git.refresh();
  void agents.refresh();
  void health.refresh();
  terminals.connect();
}

onMounted(async () => {
  if (projects.projects.length === 0) void projects.loadProjects();
  files.setProject(projectName.value);
  git.setProject(projectName.value);
  agents.setProject(projectName.value);
  health.setProject(projectName.value);
  notes.setProject(projectName.value);
  editor.setProject(projectName.value);
  terminals.setProject(projectName.value);
  await files.refresh();
  await notes.refresh();
  void agents.refresh();
  void health.refresh();
  syncFullscreenState();
  mobileMediaQuery = window.matchMedia('(max-width: 899px)');
  syncMobileState();
  mobileMediaQuery.addEventListener('change', syncMobileState);
  document.addEventListener('fullscreenchange', syncFullscreenState);
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  document.addEventListener('keydown', handleGlobalKeys, true);
  window.addEventListener('vibeide:backend-reconnected', reloadWorkspaceState);
});

onBeforeUnmount(() => {
  mobileMediaQuery?.removeEventListener('change', syncMobileState);
  document.removeEventListener('fullscreenchange', syncFullscreenState);
  window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  document.removeEventListener('keydown', handleGlobalKeys, true);
  window.removeEventListener('vibeide:backend-reconnected', reloadWorkspaceState);
});
</script>

<template>
  <div class="ide-window h-screen w-screen bg-ide-main text-ide-text">
    <TitleBar :project-name="titleProjectName" />
    <div
      class="ide-shell h-full w-full bg-ide-main text-[13px] text-ide-text"
      :style="
        !isMobile
          ? {
              '--sidebar-width': desktopSidebarVisible ? `${sidebarResize.width.value}px` : '0px',
              '--sidebar-handle-width': desktopSidebarVisible ? '4px' : '0px',
              '--terminal-height': terminalPanelVisible ? `${terminalResize.height.value}px` : '0px',
              '--terminal-handle-height': terminalPanelVisible ? '4px' : '0px',
              '--agent-sidebar-width': desktopAgentsVisible ? '380px' : '0px'
            }
          : undefined
      "
    >
    <header class="mobile-header">
      <button class="touch-button" title="Open sidebar" @click="drawerOpen = true">
        <Menu :size="22" />
      </button>
      <div class="min-w-0">
        <div class="truncate text-sm font-semibold">VibeIDE</div>
        <div class="truncate text-[11px] text-ide-muted">{{ activeTitle }}</div>
      </div>
      <button v-if="deferredInstallPrompt" class="install-button" @click="installPwa">Install VibeIDE</button>
      <button v-if="!isFullscreen" class="touch-button" title="Enter Fullscreen" @click="enterFullscreen">
        <Maximize :size="20" />
        <span class="sr-only">Enter Fullscreen</span>
      </button>
      <button v-else class="touch-button" title="Exit Fullscreen" @click="exitFullscreen">
        <Minimize :size="20" />
        <span class="sr-only">Exit Fullscreen</span>
      </button>
      <button class="touch-button" title="AI Agents" @click="mobileAgentsOpen = true">
        <Bot :size="20" />
      </button>
    </header>

    <ActivityBar v-if="!isMobile" v-model="activeView" class="desktop-activity" @select-view="selectDesktopView" @settings="settingsOpen = true" />

    <aside v-if="!isMobile && desktopSidebarVisible" class="desktop-sidebar min-w-0 border-r border-ide-border bg-ide-sidebar">
      <FileExplorer v-if="activeView === 'files'" :active="activeView === 'files'" />
      <GitPanel v-else-if="activeView === 'git'" />
      <TerminalPanel v-else-if="activeView === 'terminal'" />
      <NotesPanel v-else-if="activeView === 'notes'" />
    </aside>

    <button
      v-if="!isMobile && desktopSidebarVisible"
      class="resize-handle-vertical"
      :class="{ 'resize-handle-active': sidebarResize.isResizing.value }"
      title="Resize sidebar"
      @mousedown="sidebarResize.startResize"
    />

    <main class="editor-area min-w-0">
      <header class="workspace-header">
        <div class="workspace-status">
          <WorkspaceHealth />
        </div>
        <div class="workspace-actions">
        <button v-if="deferredInstallPrompt" class="desktop-action-button gap-2 px-2" @click="installPwa">
          <Download :size="14" />
          Install VibeIDE
        </button>
        <button class="desktop-action-button w-8" :title="desktopAgentsVisible ? 'Hide AI Agents' : 'Show AI Agents'" @click="desktopAgentsVisible = !desktopAgentsVisible">
          <Bot :size="15" />
          <span class="sr-only">{{ desktopAgentsVisible ? 'Hide AI Agents' : 'Show AI Agents' }}</span>
        </button>
        <button v-if="!terminalPanelVisible" class="desktop-action-button w-8" title="Show Terminal" @click="showTerminalPanel">
          <TerminalSquare :size="15" />
          <span class="sr-only">Show Terminal</span>
        </button>
        <button v-if="!isFullscreen" class="desktop-action-button w-8" title="Enter Fullscreen" @click="enterFullscreen">
          <Maximize :size="15" />
          <span class="sr-only">Enter Fullscreen</span>
        </button>
        <button v-else class="desktop-action-button w-8" title="Exit Fullscreen" @click="exitFullscreen">
          <Minimize :size="15" />
          <span class="sr-only">Exit Fullscreen</span>
        </button>
      </div>
      </header>
      <EditorTabs />
      <WorkspaceEditor />
      <button
        v-if="!isMobile && terminalPanelVisible"
        class="resize-handle-horizontal"
        :class="{ 'resize-handle-active': terminalResize.isResizing.value }"
        title="Resize terminal"
        @mousedown="terminalResize.startResize"
      />
      <TerminalView v-if="!isMobile && terminalPanelVisible" class="desktop-terminal" @close-panel="terminalPanelVisible = false" />
    </main>

    <AgentChatSidebar v-if="!isMobile && desktopAgentsVisible" closable class="desktop-agent-sidebar" @close="desktopAgentsVisible = false" />

    <div v-if="isMobile && drawerOpen" class="mobile-scrim" @click="drawerOpen = false" />
    <aside v-if="isMobile" class="mobile-drawer" :class="{ 'is-open': drawerOpen }">
      <header class="flex h-12 items-center justify-between border-b border-ide-border px-3">
        <span class="text-xs uppercase tracking-wide text-ide-muted">{{ activeTitle }}</span>
        <button class="touch-button" title="Close sidebar" @click="drawerOpen = false">
          <X :size="20" />
        </button>
      </header>
      <FileExplorer v-if="activeView === 'files'" :active="activeView === 'files'" />
      <GitPanel v-else-if="activeView === 'git'" />
      <TerminalPanel v-else-if="activeView === 'terminal'" />
      <NotesPanel v-else-if="activeView === 'notes'" />
    </aside>

    <section v-if="isMobile && activeView === 'terminal'" class="mobile-terminal-overlay">
      <TerminalView />
    </section>

    <div v-if="isMobile && mobileAgentsOpen" class="mobile-scrim" @click="mobileAgentsOpen = false" />
    <AgentChatSidebar v-if="isMobile && mobileAgentsOpen" mobile class="mobile-agent-overlay" @close="mobileAgentsOpen = false" />

    <nav v-if="isMobile" class="mobile-bottom-nav">
      <button
        v-for="item in navItems"
        :key="item.id"
        class="mobile-nav-button"
        :class="{ 'is-active': activeView === item.id }"
        @click="selectMobileView(item.id)"
      >
        <component :is="item.icon" :size="21" />
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <div v-if="sidebarResize.isResizing.value || terminalResize.isResizing.value" class="resize-shield" />
      <SettingsModal :open="settingsOpen" @close="settingsOpen = false" />
    </div>
  </div>
</template>
