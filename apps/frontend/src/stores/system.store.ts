import { defineStore } from 'pinia';
import { computed, onUnmounted, ref } from 'vue';
import { systemApi, type RuntimeInfo, type UpdateJobStatus, type UpdateStatusResponse, type UpdateStrategy } from '../services/system.api';

export const useSystemStore = defineStore('system', () => {
  const status = ref<UpdateJobStatus | 'idle'>('idle');
  const jobId = ref<string | null>(null);
  const message = ref('');
  const logs = ref('');
  const error = ref<string | null>(null);
  const runtime = ref<RuntimeInfo | null>(null);
  const currentVersion = ref<string | null>(null);
  const latestVersion = ref<string | null>(null);
  const restartStatus = ref<string | null>(null);
  const startedAt = ref<string | null>(null);
  const finishedAt = ref<string | null>(null);
  let pollTimer: number | undefined;
  let reconnectTimer: number | undefined;

  const loading = computed(() => ['checking', 'downloading', 'installing', 'building', 'waiting_restart', 'restarting'].includes(status.value));
  const buttonLabel = computed(() => {
    if (loading.value) return 'Updating...';
    if (status.value === 'finished') return 'Updated successfully';
    if (status.value === 'failed') return 'Update failed';
    return 'Check for Updates';
  });

  async function loadRuntime() {
    runtime.value = await systemApi.runtime();
  }

  async function checkUpdate(strategy: UpdateStrategy = 'cancel') {
    if (loading.value) return;
    reset();
    status.value = 'checking';
    message.value = 'Update started';
    logs.value = 'Update started\n';

    try {
      await loadRuntime().catch(() => undefined);
      const started = await systemApi.startUpdate(strategy);
      jobId.value = started.jobId;
      message.value = started.message;
      startPolling();
    } catch (caught) {
      status.value = 'failed';
      error.value = caught instanceof Error ? caught.message : 'Update failed';
      message.value = error.value;
      logs.value += `${message.value}\n`;
    }
  }

  function startPolling() {
    stopPolling();
    void poll();
    pollTimer = window.setInterval(() => {
      void poll();
    }, 1500);
  }

  async function poll() {
    if (!jobId.value) return;
    try {
      const [nextStatus, nextLogs] = await Promise.all([
        systemApi.updateStatus(jobId.value),
        systemApi.updateLogs(jobId.value)
      ]);
      applyStatus(nextStatus);
      logs.value = nextLogs.logs;
      if (nextStatus.status === 'finished' || nextStatus.status === 'failed') stopPolling();
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Failed to read update status.';
      message.value = error.value;
      startReconnectPolling();
    }
  }

  function applyStatus(nextStatus: UpdateStatusResponse) {
    status.value = nextStatus.status;
    message.value = nextStatus.message;
    error.value = nextStatus.error ?? null;
    currentVersion.value = nextStatus.currentVersion ?? null;
    latestVersion.value = nextStatus.latestVersion ?? null;
    runtime.value = nextStatus.runtime ?? runtime.value;
    restartStatus.value = nextStatus.restartStatus ?? null;
    startedAt.value = nextStatus.startedAt;
    finishedAt.value = nextStatus.finishedAt ?? null;
    if (nextStatus.status === 'finished') {
      message.value = nextStatus.message || 'Update completed successfully.';
    }
    if (nextStatus.status === 'failed') {
      message.value = nextStatus.error ?? nextStatus.message ?? 'Update failed';
    }
  }

  function stopPolling() {
    if (!pollTimer) return;
    window.clearInterval(pollTimer);
    pollTimer = undefined;
  }

  function startReconnectPolling() {
    if (reconnectTimer) return;
    reconnectTimer = window.setInterval(async () => {
      try {
        await loadRuntime();
        if (jobId.value) await poll();
        window.dispatchEvent(new CustomEvent('vibeide:backend-reconnected'));
        stopReconnectPolling();
      } catch {
        // Keep waiting until the backend is reachable again.
      }
    }, 2000);
  }

  function stopReconnectPolling() {
    if (!reconnectTimer) return;
    window.clearInterval(reconnectTimer);
    reconnectTimer = undefined;
  }

  function reset() {
    stopPolling();
    stopReconnectPolling();
    jobId.value = null;
    status.value = 'idle';
    message.value = '';
    logs.value = '';
    error.value = null;
    currentVersion.value = null;
    latestVersion.value = null;
    restartStatus.value = null;
    startedAt.value = null;
    finishedAt.value = null;
  }

  onUnmounted(() => {
    stopPolling();
    stopReconnectPolling();
  });

  return {
    status,
    jobId,
    message,
    logs,
    error,
    runtime,
    currentVersion,
    latestVersion,
    restartStatus,
    startedAt,
    finishedAt,
    loading,
    buttonLabel,
    loadRuntime,
    checkUpdate,
    poll
  };
});
