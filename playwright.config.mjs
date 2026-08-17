// Configuración Playwright del único E2E del piloto (flujo principal de caja).
//
// Deliberadamente mínima: un solo navegador (Chromium), un solo worker y sin
// reintentos. El E2E toca una base PostgreSQL real y compartida (maxli_e2e),
// así que dos workers sobre la misma base se pisarían el turno abierto.
// Los reintentos quedan en cero a propósito: un fallo intermitente aquí es un
// bug del flujo principal, no ruido que convenga esconder.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.mjs',

  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,

  // El flujo completo (login, apertura, venta, cierre) contra un backend real
  // no baja de ~30 s en CI; 3 min dan margen sin permitir un job colgado.
  timeout: 180_000,
  expect: { timeout: 15_000 },

  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

  use: {
    // 127.0.0.1 y no localhost: es el origen que el backend autoriza por CORS
    // en el workflow de CI.
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 20_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
