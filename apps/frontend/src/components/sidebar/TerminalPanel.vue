<script setup lang="ts">
import { Plus, TerminalSquare, X } from '@lucide/vue';
import { useTerminalStore } from '../../stores/terminal.store';

const terminals = useTerminalStore();

const emit = defineEmits<{
  openTerminal: [];
}>();

function create() {
  terminals.create();
  emit('openTerminal');
}

function select(id: string) {
  terminals.activeId = id;
  emit('openTerminal');
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col">
    <header class="flex h-9 items-center justify-between px-3 text-[11px] uppercase tracking-wide text-ide-muted">
      <span>Terminals</span>
      <button class="grid h-6 w-6 place-items-center rounded hover:bg-white/10 hover:text-ide-text" title="New terminal" @click="create">
        <Plus :size="15" />
      </button>
    </header>

    <div class="min-h-0 flex-1 overflow-auto thin-scrollbar">
      <p v-if="terminals.sessions.length === 0" class="px-3 py-4 text-ide-muted">No terminals yet.</p>
      <button
        v-for="session in terminals.sessions"
        :key="session.id"
        class="group flex h-7 w-full items-center gap-2 px-3 text-left text-ide-muted hover:bg-white/5 hover:text-ide-text"
        :class="{ 'bg-[#37373d] text-ide-text': terminals.activeId === session.id }"
        @click="select(session.id)"
      >
        <TerminalSquare class="shrink-0 text-ide-accent" :size="14" />
        <span class="truncate">{{ session.name }}</span>
        <span
          class="ml-auto hidden h-5 w-5 place-items-center rounded text-xs text-ide-muted hover:bg-white/10 hover:text-ide-text group-hover:grid"
          @click.stop="terminals.close(session.id)"
        >
          <X :size="13" />
        </span>
      </button>
    </div>
  </section>
</template>
