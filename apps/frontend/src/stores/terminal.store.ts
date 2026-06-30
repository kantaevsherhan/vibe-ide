import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { TerminalSocket } from '../services/terminal.ws';
import type { TerminalOutputMessage, TerminalSession } from '../types/terminal';

const socket = new TerminalSocket();

export const useTerminalStore = defineStore('terminal', () => {
  const sessions = ref<TerminalSession[]>([]);
  const activeId = ref<string | null>(null);
  const outputs = ref<Record<string, string>>({});
  const restored = ref(false);
  const activeSession = computed(() => sessions.value.find((session) => session.id === activeId.value) ?? null);

  function connect() {
    socket.connect(handleMessage);
  }

  function create() {
    connect();
    const id = crypto.randomUUID();
    activeId.value = id;
    socket.send({ type: 'create', terminalId: id });
    return id;
  }

  function close(id: string) {
    socket.send({ type: 'close', terminalId: id });
  }

  function input(id: string, data: string) {
    socket.send({ type: 'input', terminalId: id, data });
  }

  function resize(id: string, cols: number, rows: number) {
    socket.send({ type: 'resize', terminalId: id, cols, rows });
  }

  function handleMessage(message: TerminalOutputMessage) {
    if (message.type === 'snapshot') {
      sessions.value = message.sessions.map((session) => ({
        id: session.id,
        name: session.name,
        createdAt: session.createdAt
      }));
      outputs.value = Object.fromEntries(message.sessions.map((session) => [session.id, session.output]));
      if (!activeId.value || !sessions.value.some((session) => session.id === activeId.value)) {
        activeId.value = sessions.value.at(-1)?.id ?? null;
      }
      restored.value = true;
    }
    if (message.type === 'created') {
      if (!sessions.value.some((session) => session.id === message.session.id)) {
        sessions.value.push({
          id: message.session.id,
          name: message.session.name,
          createdAt: message.session.createdAt
        });
      }
      outputs.value[message.session.id] = message.session.output;
      activeId.value = message.session.id;
    }
    if (message.type === 'output') {
      outputs.value[message.terminalId] = (outputs.value[message.terminalId] ?? '') + message.data;
    }
    if (message.type === 'closed') {
      sessions.value = sessions.value.filter((session) => session.id !== message.terminalId);
      delete outputs.value[message.terminalId];
      if (activeId.value === message.terminalId) activeId.value = sessions.value.at(-1)?.id ?? null;
    }
    if (message.type === 'error') {
      outputs.value[message.terminalId] = `${outputs.value[message.terminalId] ?? ''}\r\n${message.message}\r\n`;
    }
  }

  return { sessions, activeId, activeSession, outputs, restored, connect, create, close, input, resize };
});
