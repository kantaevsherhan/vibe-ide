import { createPinia } from 'pinia';
import { createApp } from 'vue';
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router';
import { Capacitor } from '@capacitor/core';
import App from './App.vue';
import IdeLayout from './layouts/IdeLayout.vue';
import LoginPage from './pages/LoginPage.vue';
import ProjectsPage from './pages/ProjectsPage.vue';
import { initCapacitor } from './capacitor/initCapacitor';
import { setupOrientation } from './capacitor/setupOrientation';
import { useAuthStore } from './stores/auth.store';
import { useSettingsStore } from './stores/settings.store';
import './app/styles.css';

const pinia = createPinia();
useSettingsStore(pinia);
const router = createRouter({
  history: Capacitor.isNativePlatform() ? createWebHashHistory() : createWebHistory(),
  routes: [
    { path: '/', redirect: '/projects' },
    { path: '/login', component: LoginPage },
    { path: '/projects', component: ProjectsPage },
    { path: '/ide/:projectName', component: IdeLayout },
    { path: '/:pathMatch(.*)*', redirect: '/projects' }
  ]
});

router.beforeEach(async (to) => {
  const auth = useAuthStore(pinia);
  if (!auth.checked) await auth.check();

  if (!auth.user && to.path !== '/login') return '/login';
  if (auth.user && to.path === '/login') return '/projects';
  return true;
});

createApp(App).use(pinia).use(router).mount('#app');
void initCapacitor();
void setupOrientation();

if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}
