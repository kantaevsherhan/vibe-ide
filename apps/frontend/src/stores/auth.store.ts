import { defineStore } from 'pinia';
import { ref } from 'vue';
import { authApi, type AuthUser } from '../services/auth.api';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const checked = ref(false);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function check() {
    loading.value = true;
    error.value = null;
    try {
      user.value = (await authApi.me()).user;
    } catch {
      user.value = null;
    } finally {
      checked.value = true;
      loading.value = false;
    }
  }

  async function login(username: string, password: string) {
    loading.value = true;
    error.value = null;
    try {
      user.value = (await authApi.login(username, password)).user;
      checked.value = true;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Login failed.';
      throw caught;
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    await authApi.logout();
    user.value = null;
    checked.value = true;
  }

  return { user, checked, loading, error, check, login, logout };
});
