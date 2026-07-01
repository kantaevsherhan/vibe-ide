import { defineStore } from 'pinia';
import { computed, onUnmounted, ref } from 'vue';
import { systemApi, type UpdateJobStatus, type UpdateStatusResponse } from '../services/system.api';

export const useSystemStore = defineStore('system', () => {
  const status = ref<UpdateJobStatus | 'idle'>('idle');
  const jobId = ref<string | null>(null);
  const message = ref('');
  const logs = ref('');
  const error = ref<string | null>(null);
  const startedAt = ref<string | null>(null);
  const finishedAt = ref<string | null>(null);
  let pollTimer: number | undefined;

  const loading = computed(() => ['checking', 'updating', 'installing', 'building'].includes(status.value));
  const buttonLabel = computed(() => {
    if (loading.value) return 'Updating...';
    if (status.value === 'done') return 'Updated successfully';
    if (status.value === 'error') return 'Update failed';
    return 'Check for Updates';
  });

  async function checkUpdate() {
    if (loading.value) return;
    reset();
    status.value = 'checking';
    message.value = 'Update started';
    logs.value = 'Update started\n';

    try {
      const started = await systemApi.startUpdate();
      jobId.value = started.jobId;
      message.value = started.message;
      startPolling();
    } catch (caught) {
      status.value = 'error';
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
      if (nextStatus.status === 'done' || nextStatus.status === 'error') stopPolling();
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Failed to read update status.';
      message.value = error.value;
    }
  }

  function applyStatus(nextStatus: UpdateStatusResponse) {
    status.value = nextStatus.status;
    message.value = nextStatus.message;
    error.value = nextStatus.error ?? null;
    startedAt.value = nextStatus.startedAt;
    finishedAt.value = nextStatus.finishedAt ?? null;
    if (nextStatus.status === 'done') {
      message.value = 'Update completed successfully. Please restart VibeIDE to apply changes.';
    }
    if (nextStatus.status === 'error') {
      message.value = nextStatus.error ?? nextStatus.message ?? 'Update failed';
    }
  }

  function stopPolling() {
    if (!pollTimer) return;
    window.clearInterval(pollTimer);
    pollTimer = undefined;
  }

  function reset() {
    stopPolling();
    jobId.value = null;
    status.value = 'idle';
    message.value = '';
    logs.value = '';
    error.value = null;
    startedAt.value = null;
    finishedAt.value = null;
  }

  onUnmounted(stopPolling);

  return {
    status,
    jobId,
    message,
    logs,
    error,
    startedAt,
    finishedAt,
    loading,
    buttonLabel,
    checkUpdate,
    poll
  };
});
