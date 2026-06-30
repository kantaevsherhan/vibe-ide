import { createPinia } from 'pinia';
import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import IdeLayout from './layouts/IdeLayout.vue';
import LoginPage from './pages/LoginPage.vue';
import { useAuthStore } from './stores/auth.store';
import './app/styles.css';

const pinia = createPinia();
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginPage },
    { path: '/:pathMatch(.*)*', component: IdeLayout }
  ]
});

router.beforeEach(async (to) => {
  const auth = useAuthStore(pinia);
  if (!auth.checked) await auth.check();

  if (!auth.user && to.path !== '/login') return '/login';
  if (auth.user && to.path === '/login') return '/';
  return true;
});

createApp(App).use(pinia).use(router).mount('#app');
