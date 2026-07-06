import { defineStore } from 'pinia';
import { ref } from 'vue';
import { gitApi } from '../services/git.api';
import type { GitFileStatus } from '../types/git';

export const useGitStore = defineStore('git', () => {
  const files = ref<GitFileStatus[]>([]);
  const projectName = ref<string | null>(null);
  const isRepository = ref(true);
  const message = ref<string | null>(null);
  const branch = ref<string | null>(null);
  const branches = ref<string[]>([]);
  const loading = ref(false);
  const committing = ref(false);
  const error = ref<string | null>(null);
  const messageText = ref<string | null>(null);

  function setProject(nextProjectName: string) {
    if (projectName.value === nextProjectName) return;
    projectName.value = nextProjectName;
    files.value = [];
    isRepository.value = true;
    message.value = null;
    branch.value = null;
    branches.value = [];
  }

  async function refresh() {
    if (!projectName.value) return;
    loading.value = true;
    error.value = null;
    message.value = null;
    messageText.value = null;
    try {
      const response = await gitApi.status(projectName.value);
      files.value = response.files;
      isRepository.value = response.isRepository;
      message.value = response.message ?? null;
      branch.value = response.branch ?? null;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Failed to load Git status.';
    } finally {
      loading.value = false;
    }
  }

  async function loadBranches() {
    if (!projectName.value || !isRepository.value) return;
    try {
      const response = await gitApi.branches(projectName.value);
      branch.value = response.current;
      branches.value = response.branches;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Failed to load branches.';
    }
  }

  async function checkout(nextBranch: string) {
    if (!projectName.value) return;
    loading.value = true;
    error.value = null;
    try {
      const response = await gitApi.checkout(projectName.value, nextBranch);
      branch.value = response.current;
      branches.value = response.branches;
      await refresh();
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Failed to switch branch.';
    } finally {
      loading.value = false;
    }
  }

  async function initRepository() {
    if (!projectName.value) return;
    loading.value = true;
    error.value = null;
    try {
      const response = await gitApi.init(projectName.value);
      files.value = response.files;
      isRepository.value = response.isRepository;
      message.value = response.message ?? null;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Failed to initialize Git repository.';
    } finally {
      loading.value = false;
    }
  }

  async function commit(commitMessage: string) {
    if (!projectName.value) return;
    committing.value = true;
    error.value = null;
    messageText.value = null;
    try {
      const response = await gitApi.commit(projectName.value, commitMessage);
      messageText.value = `Committed ${response.commit}`;
      await refresh();
      await loadBranches();
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Failed to commit changes.';
      throw caught;
    } finally {
      committing.value = false;
    }
  }

  return { files, projectName, isRepository, message, branch, branches, loading, committing, error, messageText, setProject, refresh, initRepository, loadBranches, checkout, commit };
});
