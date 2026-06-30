<script setup lang="ts">
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { Plus } from '@lucide/vue';
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useTerminalStore } from '../../stores/terminal.store';

const terminals = useTerminalStore();
const container = ref<HTMLElement | null>(null);
let xterm: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let resizeObserver: ResizeObserver | null = null;
let lastRenderedId: string | null = null;

function ensureTerminal() {
  if (xterm || !container.value) return;

  xterm = new Terminal({
    cursorBlink: true,
    fontFamily: 'JetBrains Mono, Cascadia Code, Consolas, monospace',
    fontSize: 12,
    theme: {
      background: '#181818',
      foreground: '#cccccc',
      cursor: '#007acc',
      selectionBackground: '#264f78'
    }
  });
  fitAddon = new FitAddon();
  xterm.loadAddon(fitAddon);
  xterm.open(container.value);
  xterm.onData((data) => {
    if (terminals.activeId) terminals.input(terminals.activeId, data);
  });

  resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(container.value);
}

function resize() {
  if (!fitAddon || !terminals.activeId) return;
  fitAddon.fit();
  terminals.resize(terminals.activeId, xterm?.cols ?? 100, xterm?.rows ?? 24);
}

async function renderSession() {
  await nextTick();
  ensureTerminal();
  if (!xterm) return;

  const id = terminals.activeId;
  if (!id) {
    xterm.clear();
    xterm.write('Create a terminal from the sidebar to start.\r\n');
    lastRenderedId = null;
    return;
  }

  if (lastRenderedId !== id) {
    xterm.clear();
    xterm.write(terminals.outputs[id] ?? '');
    lastRenderedId = id;
    resize();
    return;
  }

  const output = terminals.outputs[id] ?? '';
  xterm.clear();
  xterm.write(output);
}

watch(() => terminals.activeId, renderSession);
watch(() => terminals.activeId && terminals.outputs[terminals.activeId], renderSession);

onMounted(() => {
  ensureTerminal();
  void renderSession();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  xterm?.dispose();
});
</script>

<template>
  <section class="grid min-h-0 grid-rows-[28px_minmax(0,1fr)] border-t border-ide-border bg-ide-panel">
    <header class="flex items-center justify-between border-b border-ide-border px-3 text-[11px] uppercase tracking-wide text-ide-muted">
      <span>Terminal</span>
      <div class="flex items-center gap-1">
        <button class="grid h-6 w-6 place-items-center rounded hover:bg-white/10 hover:text-ide-text" title="New terminal" @click="terminals.create">
          <Plus :size="15" />
        </button>
        <span v-if="terminals.activeSession" class="normal-case tracking-normal">{{ terminals.activeSession.name }}</span>
      </div>
    </header>
    <div ref="container" class="min-h-0 p-2 thin-scrollbar" />
  </section>
</template>
