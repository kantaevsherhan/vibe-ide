import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { systemApi } from '../services/system.api';

type UpdateStatus = 'idle' | 'checking' | 'updating' | 'updated' | 'current' | 'failed';

export const useSystemStore = defineStore('system', () => {
  const status = ref<UpdateStatus>('idle');
  const message = ref('');
  const logs = ref<string[]>([]);
  const loading = computed(() => status.value === 'checking' || status.value === 'updating');

  const buttonLabel = computed(() => {
    if (status.value === 'checking') return 'Checking...';
    if (status.value === 'updating') return 'Updating...';
    if (status.value === 'updated') return 'Updated successfully';
    if (status.value === 'current') return 'Already up to date';
    if (status.value === 'failed') return 'Update failed';
    return 'Check for Updates';
  });

  async function checkUpdate() {
    status.value = 'checking';
    message.value = '';
    logs.value = ['Checking updates...'];
    try {
      status.value = 'updating';
      const result = await systemApi.checkUpdate();
      logs.value = result.logs.length > 0 ? result.logs : ['Done.'];
      message.value = result.message;
      status.value = result.updated ? 'updated' : 'current';
    } catch (caught) {
      status.value = 'failed';
      message.value = caught instanceof Error ? caught.message : 'Update failed.';
      logs.value = [...logs.value, 'Update failed.'];
    }
  }

  return { status, message, logs, loading, buttonLabel, checkUpdate };
});
