import { defineStore } from 'pinia';
import { ref } from 'vue';
import { clearApiAuthToken, isCrossOriginApi, setApiAuthToken } from '../services/api';
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
      const response = await authApi.login(username, password);
      user.value = response.user;
      if (isCrossOriginApi()) {
        setApiAuthToken(response.token ?? null);
      } else {
        clearApiAuthToken();
      }
      checked.value = true;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Login failed.';
      throw caught;
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      clearApiAuthToken();
      user.value = null;
      checked.value = true;
    }
  }

  return { user, checked, loading, error, check, login, logout };
});
