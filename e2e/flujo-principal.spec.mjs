/**
 * E2E del flujo principal del piloto, sin mocks:
 *
 *   login → apertura de turno → venta con NCF → cierre cuadrado
 *
 * Todo se ejecuta por la UI real contra el backend real y una base PostgreSQL
 * real (`maxli_e2e`). Las respuestas HTTP solo se observan para afirmar que lo
 * que la pantalla muestra quedó realmente persistido; ninguna acción del flujo
 * se sustituye por una llamada a la API.
 *
 * Requisitos previos (ver README, sección «E2E del flujo principal»):
 *   · backend arrancado con perfil dev contra `maxli_e2e` (migraciones Flyway);
 *   · `npm run e2e:fixture` aplicado sobre esa base;
 *   · Vite sirviendo el SPA en E2E_BASE_URL.
 */
import { test, expect } from '@playwright/test';

// ── Datos del fixture (e2e/fixture-e2e.sql) ─────────────────────────────
const SKU = 'E2E-PROD-001';
const NOMBRE_PRODUCTO = 'Producto E2E Flujo Principal';
const CAJA = 'Caja E2E';
const PRECIO = '118.00';        // precio con ITBIS incluido (base 100 + 18 %)
const FONDO_INICIAL = '500.00';
const EFECTIVO_RECIBIDO = '200.00';
const CAMBIO_ESPERADO = '82.00';
const DECLARADO_AL_CIERRE = '618.00'; // 500 iniciales + 118 de efectivo neto

// ── Credenciales de la base efímera ─────────────────────────────────────
const USUARIO = process.env.E2E_ADMIN_USER ?? 'admin';
const PASSWORD_BOOTSTRAP = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'E2eBootstrap#2026';
const PASSWORD_NUEVA = process.env.E2E_ADMIN_NEW_PASSWORD ?? 'E2eFlujoPrincipal#2026';

/**
 * Abre una vista desde el menú lateral. La sección que contiene la vista activa
 * ya viene desplegada, así que pulsarla la plegaría: solo se despliega cuando la
 * opción no está a la vista.
 */
async function abrirVista(page, seccion, vista) {
  const menu = page.locator('aside');
  const opcion = menu.getByRole('button', { name: vista, exact: true });
  if (!(await opcion.isVisible())) {
    await menu.getByRole('button', { name: seccion, exact: true }).click();
  }
  await opcion.click();
}

/** Envía el formulario de login y devuelve la respuesta real del backend. */
async function enviarLogin(page, password) {
  await page.locator('#login-username').fill(USUARIO);
  await page.locator('#login-password').fill(password);

  const respuesta = page.waitForResponse(
    (r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
  );
  await page.locator('#login-submit').click();
  return respuesta;
}

test('login, apertura de turno, venta con NCF y cierre cuadrado', async ({ page }) => {
  await test.step('abrir la aplicación', async () => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'ERP Max Li' })).toBeVisible();
  });

  await test.step('iniciar sesión y resolver el cambio obligatorio', async () => {
    const respuesta = await enviarLogin(page, PASSWORD_BOOTSTRAP);

    // Una base recién migrada exige cambiar la contraseña temporal. Si el E2E
    // se repite sobre la misma base, esa contraseña ya se consumió y el login
    // válido es el de la contraseña nueva.
    if (respuesta.status() !== 200) {
      await expect(page.getByRole('alert')).toBeVisible();
      const reintento = await enviarLogin(page, PASSWORD_NUEVA);
      expect(reintento.status()).toBe(200);
      return;
    }

    const cambioObligatorio = page.getByRole('heading', { name: 'Cambio Obligatorio' });
    if (await cambioObligatorio.isVisible()) {
      await page.getByLabel('Contraseña Temporal / Actual').fill(PASSWORD_BOOTSTRAP);
      await page.getByLabel('Nueva Contraseña', { exact: true }).fill(PASSWORD_NUEVA);
      await page.getByLabel('Confirmar Nueva Contraseña').fill(PASSWORD_NUEVA);
      await page.getByRole('button', { name: 'Actualizar contraseña' }).click();

      // El cambio invalida el token en curso: vuelve al login con aviso.
      await expect(page.getByRole('status')).toContainText('Contraseña actualizada');
      const reintento = await enviarLogin(page, PASSWORD_NUEVA);
      expect(reintento.status()).toBe(200);
    }
  });

  await test.step('entrar al POS', async () => {
    // `exact` distingue el título de la vista (h2 «Punto de Venta») del
    // encabezado del propio POS (h3 «Punto de venta»).
    await expect(page.getByRole('heading', { name: 'Punto de Venta', exact: true })).toBeVisible();
  });

  let idTurno;

  await test.step(`abrir turno con fondo RD$${FONDO_INICIAL}`, async () => {
    await page.locator('#btn-iniciar-apertura-turno').click();

    const selectorCaja = page.locator('#sel-apertura-caja');
    await expect(selectorCaja).toBeVisible();
    const opcion = selectorCaja.locator('option', { hasText: CAJA });
    await selectorCaja.selectOption(await opcion.getAttribute('value'));

    await page.locator('#input-apertura-monto-inicial').fill(FONDO_INICIAL);

    const respuesta = page.waitForResponse(
      (r) => r.url().includes('/api/cajas/turnos/abrir') && r.request().method() === 'POST',
    );
    await page.locator('#btn-abrir-turno-caja').click();

    const turno = await (await respuesta).json();
    idTurno = turno.idTurnoCaja;
    expect(turno.estado).toBe('ABIERTO');
    expect(turno.cajaNombre).toBe(CAJA);
  });

  await test.step('el POS muestra el turno abierto sobre la caja E2E', async () => {
    await expect(page.getByText(`Caja: ${CAJA}`)).toBeVisible();
    await expect(page.getByText(`Turno: TURNO #${idTurno}`)).toBeVisible();
  });

  await test.step('buscar el producto por SKU y añadir una unidad', async () => {
    // La búsqueda tiene un debounce de 150 ms y auto-agrega la coincidencia
    // exacta de SKU: se espera al estado visible del carrito, no a un reloj.
    await page.getByPlaceholder(/Escanear código de barras/).fill(SKU);

    const fila = page.getByRole('row', { name: new RegExp(SKU) });
    await expect(fila).toBeVisible();
    await expect(fila).toContainText(NOMBRE_PRODUCTO);
    await expect(fila).toContainText(`RD$${PRECIO}`);
  });

  await test.step(`cobrar RD$${PRECIO} en efectivo recibiendo RD$${EFECTIVO_RECIBIDO}`, async () => {
    await page.getByRole('button', { name: 'Cobrar (ESC)' }).click();

    await expect(page.getByRole('heading', { name: 'Cobro de Venta' })).toBeVisible();
    // El total lo fija el backend (/ventas/recalcular): que el botón muestre
    // el importe —y no «Recalculando…»— es la señal de que ya respondió.
    const botonCobrar = page.getByRole('button', { name: `Cobrar RD$${PRECIO}` });
    await expect(botonCobrar).toBeVisible();

    // El botón sigue deshabilitado hasta que el efectivo recibido cubre el
    // total: primero se declara el monto, después se habilita el cobro.
    await page.locator('#input-monto-recibido').fill(EFECTIVO_RECIBIDO);
    await expect(page.locator('#checkout-cambio')).toHaveText(`RD$${CAMBIO_ESPERADO}`);
    await expect(botonCobrar).toBeEnabled();

    const respuesta = page.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/ventas' && r.request().method() === 'POST',
    );
    await botonCobrar.click();

    const venta = await respuesta;
    expect(venta.status()).toBe(201);

    const cuerpo = await venta.json();
    expect(cuerpo.ncf).toMatch(/^B02\d{8}$/);
    expect(cuerpo.total).toBe(118);
    expect(cuerpo.cambio).toBe(82);

    await expect(page.getByRole('heading', { name: '¡Venta Procesada!' })).toBeVisible();
    await expect(page.getByText(`N° Control: ${cuerpo.numeroControl}`)).toBeVisible();
    await expect(page.getByText(`NCF: ${cuerpo.ncf}`)).toBeVisible();
    await expect(page.getByText(`Cambio: RD$${CAMBIO_ESPERADO}`)).toBeVisible();
  });

  await test.step('navegar a Turnos de Caja', async () => {
    await abrirVista(page, 'Caja', 'Turnos de Caja');
    await expect(page.getByRole('heading', { name: 'Turnos de Caja', exact: true })).toBeVisible();
  });

  await test.step(`cerrar el turno declarando RD$${DECLARADO_AL_CIERRE}`, async () => {
    await page.locator(`#btn-cerrar-turno-${idTurno}`).click();
    await expect(page.getByRole('heading', { name: 'Cerrar Turno de Caja' })).toBeVisible();

    // El efectivo esperado lo calcula el backend: 500 de fondo + 118 netos.
    await expect(page.getByText(`RD$${DECLARADO_AL_CIERRE}`).first()).toBeVisible();
    await page.locator('#input-cierre-monto-declarado').fill(DECLARADO_AL_CIERRE);
    await expect(page.getByText('Diferencia Calculada: RD$0.00')).toBeVisible();

    const respuesta = page.waitForResponse(
      (r) => r.url().includes(`/api/cajas/turnos/${idTurno}/cerrar`) && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Confirmar Cierre de Caja' }).click();

    const cierre = await respuesta;
    expect(cierre.status()).toBe(200);

    const cuerpo = await cierre.json();
    expect(cuerpo.estado).toBe('CERRADO');
    expect(cuerpo.diferencia).toBe(0);
  });

  await test.step('el turno queda CERRADO y cuadrado en la tabla', async () => {
    const fila = page.getByRole('row', { name: new RegExp(`#TRN-0*${idTurno}\\b`) });
    await expect(fila).toContainText('CERRADO');
    await expect(fila).toContainText('Cuadrado');
  });

  await test.step('ya no hay turno abierto para el usuario', async () => {
    await abrirVista(page, 'Ventas', 'Punto de Venta');
    await expect(page.getByRole('heading', { name: 'No tienes un Turno de Caja Abierto' })).toBeVisible();
  });
});
