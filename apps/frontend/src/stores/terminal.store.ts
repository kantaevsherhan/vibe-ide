import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { TerminalSocket } from '../services/terminal.ws';
import type { TerminalOutputMessage, TerminalSession } from '../types/terminal';

const socket = new TerminalSocket();

export const useTerminalStore = defineStore('terminal', () => {
  const sessions = ref<TerminalSession[]>([]);
  const activeId = ref<string | null>(null);
  const outputs = ref<Record<string, string>>({});
  const projectName = ref<string | null>(null);
  const restored = ref(false);
  const activeSession = computed(() => sessions.value.find((session) => session.id === activeId.value) ?? null);

  function setProject(nextProjectName: string) {
    if (projectName.value === nextProjectName) return;
    projectName.value = nextProjectName;
    sessions.value = [];
    outputs.value = {};
    activeId.value = null;
    restored.value = false;
    connect();
  }

  function connect() {
    if (!projectName.value) return;
    socket.connect(projectName.value, handleMessage);
  }

  function create() {
    if (!projectName.value) return null;
    connect();
    const id = crypto.randomUUID();
    activeId.value = id;
    socket.send({ type: 'create', projectName: projectName.value, terminalId: id });
    return id;
  }

  function close(id: string) {
    if (!projectName.value) return;
    socket.send({ type: 'close', projectName: projectName.value, terminalId: id });
  }

  function input(id: string, data: string) {
    if (!projectName.value) return;
    socket.send({ type: 'input', projectName: projectName.value, terminalId: id, data });
  }

  function resize(id: string, cols: number, rows: number) {
    if (!projectName.value) return;
    socket.send({ type: 'resize', projectName: projectName.value, terminalId: id, cols, rows });
  }

  function handleMessage(message: TerminalOutputMessage) {
    if (message.type === 'snapshot') {
      sessions.value = message.sessions.map((session) => ({
        id: session.id,
        projectName: session.projectName,
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
          projectName: message.session.projectName,
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

  return { sessions, activeId, activeSession, outputs, projectName, restored, setProject, connect, create, close, input, resize };
});
