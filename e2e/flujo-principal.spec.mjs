/**
 * E2E del flujo principal del piloto, sin mocks:
 *
 *   login → apertura de turno → venta con NCF → devolución con Nota de
 *   Crédito B04 → cierre cuadrado
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
const STOCK_INICIAL = '10';
const FONDO_INICIAL = '500.00';
const EFECTIVO_RECIBIDO = '200.00';
const CAMBIO_ESPERADO = '82.00';
const MOTIVO_DEVOLUCION = 'Producto defectuoso reportado por el cliente';
// 500 iniciales + 118 vendidos − 118 devueltos: la devolución en efectivo
// deja el cajón exactamente como estaba al abrir el turno.
const DECLARADO_AL_CIERRE = '500.00';

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

/**
 * Lee por pantalla el stock del producto del fixture en Existencias. Es la
 * misma cifra que ve el almacenero: no se consulta la API por detrás.
 */
async function stockEnPantalla(page) {
  await abrirVista(page, 'Inventario', 'Existencias');
  await page.locator('#input-buscar-inventario').fill(SKU);

  const fila = page.getByRole('row', { name: new RegExp(SKU) });
  await expect(fila).toBeVisible();
  return fila.locator('[id^="stock-exist-"]');
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

test('login, apertura de turno, venta con NCF, devolución B04 y cierre cuadrado', async ({ page }) => {
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
  let ventaCreada;

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
    ventaCreada = cuerpo;
    expect(cuerpo.ncf).toMatch(/^B02\d{8}$/);
    expect(cuerpo.total).toBe(118);
    expect(cuerpo.cambio).toBe(82);

    await expect(page.getByRole('heading', { name: '¡Venta Procesada!' })).toBeVisible();
    await expect(page.getByText(`N° Control: ${cuerpo.numeroControl}`)).toBeVisible();
    await expect(page.getByText(`NCF: ${cuerpo.ncf}`)).toBeVisible();
    await expect(page.getByText(`Cambio: RD$${CAMBIO_ESPERADO}`)).toBeVisible();
  });

  await test.step(`la venta descuenta el stock de ${STOCK_INICIAL} a 9`, async () => {
    // El modal de éxito se cierra solo; navegar antes taparía el menú.
    await expect(page.getByRole('heading', { name: '¡Venta Procesada!' })).toBeHidden();

    await expect(await stockEnPantalla(page)).toHaveText('9');
  });

  await test.step('encontrar la venta en el Historial buscando su número de control', async () => {
    await abrirVista(page, 'Ventas', 'Historial de Ventas');
    // El Header repite el título de la vista: se ancla al contenido principal.
    await expect(
      page.getByRole('main').getByRole('heading', { name: 'Historial de Ventas' }),
    ).toBeVisible();

    // La búsqueda viaja al backend: se comprueba sobre la respuesta real que
    // el filtro lo aplicó el servidor y no el navegador.
    const respuesta = page.waitForResponse((r) => {
      const url = new URL(r.url());
      return url.pathname === '/api/ventas'
        && url.searchParams.get('q') === ventaCreada.numeroControl;
    });
    await page.locator('#filtro-ventas-q').fill(ventaCreada.numeroControl);
    await page.locator('#btn-buscar-ventas').click();

    const pagina = await (await respuesta).json();
    expect(pagina.totalElements).toBe(1);
    expect(pagina.content[0].idVenta).toBe(ventaCreada.idVenta);

    const fila = page.getByRole('row', { name: new RegExp(ventaCreada.numeroControl) });
    await expect(fila).toContainText(ventaCreada.ncf);
    await expect(fila).toContainText('RD$118.00');
    await expect(fila).toContainText(USUARIO);
    await expect(fila).toContainText('COMPLETADA');
  });

  await test.step('abrir el detalle real de la venta', async () => {
    await page.locator(`#btn-detalle-venta-${ventaCreada.idVenta}`).click();

    const modal = page.getByRole('heading', { name: 'Detalle de venta' });
    await expect(modal).toBeVisible();

    await expect(page.getByText(NOMBRE_PRODUCTO)).toBeVisible();
    await expect(page.locator('#detalle-total')).toHaveText('RD$118.00');
    await expect(page.locator('#detalle-recibido')).toHaveText(`RD$${EFECTIVO_RECIBIDO}`);
    await expect(page.locator('#detalle-cambio')).toHaveText(`RD$${CAMBIO_ESPERADO}`);
    // ITBIS persistido: base 100 + 18 %.
    await expect(page.locator('#detalle-itbis')).toHaveText('RD$18.00');
    await expect(page.locator('#detalle-pagos')).toContainText('EFECTIVO');
  });

  await test.step('la copia imprimible lleva los datos persistidos de la venta', async () => {
    // Se sustituye únicamente window.print: el diálogo nativo del navegador no
    // es automatizable y no forma parte de lo que hay que comprobar.
    await page.evaluate(() => {
      window.__impresiones = 0;
      window.print = () => { window.__impresiones += 1; };
    });

    await page.locator('#btn-reimprimir-venta').click();

    const ticket = page.locator('#ticket-reimpresion');
    await expect(ticket).toBeVisible();
    await expect(ticket).toContainText('COPIA');
    await expect(ticket).toContainText(ventaCreada.numeroControl);
    await expect(ticket).toContainText(ventaCreada.ncf);
    await expect(ticket).toContainText(NOMBRE_PRODUCTO);
    await expect(page.locator('#ticket-total')).toHaveText('RD$118.00');
    await expect(page.locator('#ticket-cambio')).toHaveText(`RD$${CAMBIO_ESPERADO}`);

    await page.locator('#btn-imprimir-copia').click();
    expect(await page.evaluate(() => window.__impresiones)).toBe(1);

    // Reimprimir no emite comprobante nuevo: el NCF sigue siendo el mismo.
    const revision = await page.request.get(`/api/ventas/${ventaCreada.idVenta}`);
    expect(revision.status()).toBe(200);
    expect((await revision.json()).ncf).toBe(ventaCreada.ncf);

    await page.getByRole('button', { name: 'Volver al detalle' }).click();
    // `exact` distingue el botón del modal del «Cerrar sesión» del menú.
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  });

  // ── Devolución completa en efectivo con Nota de Crédito B04 ───────────
  let devolucionCreada;
  let idLineaVenta;

  await test.step('abrir Devoluciones y Notas de Crédito desde el menú', async () => {
    await abrirVista(page, 'Ventas', 'Devoluciones y Notas de Crédito');
    await expect(
      page.getByRole('main').getByRole('heading', { name: 'Devoluciones y Notas de Crédito' }),
    ).toBeVisible();
  });

  await test.step('localizar la venta real por su número de control', async () => {
    await page.locator('#btn-nueva-devolucion').click();
    await expect(page.getByRole('heading', { name: 'Nueva devolución' })).toBeVisible();

    // El turno abierto se resuelve contra el backend: sin él no hay reembolso.
    await expect(page.locator('#devolucion-turno')).toContainText(`TURNO #${idTurno}`);

    const busqueda = page.waitForResponse((r) => {
      const url = new URL(r.url());
      return url.pathname === '/api/ventas'
        && url.searchParams.get('q') === ventaCreada.numeroControl;
    });
    await page.locator('#input-buscar-venta-devolucion').fill(ventaCreada.numeroControl);
    await page.locator('#btn-buscar-venta-devolucion').click();

    const pagina = await (await busqueda).json();
    expect(pagina.totalElements).toBe(1);
  });

  await test.step('la disponibilidad muestra una unidad devolvible', async () => {
    const disponible = page.waitForResponse(
      (r) => new URL(r.url()).pathname === `/api/devoluciones/ventas/${ventaCreada.idVenta}/disponible`,
    );
    await page.locator(`#btn-seleccionar-venta-${ventaCreada.idVenta}`).click();

    const cuerpo = await (await disponible).json();
    expect(cuerpo.devolvible).toBe(true);
    expect(cuerpo.lineas).toHaveLength(1);
    expect(cuerpo.lineas[0].cantidadVendida).toBe(1);
    expect(cuerpo.lineas[0].cantidadDevuelta).toBe(0);
    expect(cuerpo.lineas[0].cantidadDisponible).toBe(1);
    idLineaVenta = cuerpo.lineas[0].idDetalleVenta;

    const fila = page.locator(`#linea-devolucion-${idLineaVenta}`);
    await expect(fila).toContainText(NOMBRE_PRODUCTO);
    await expect(page.locator(`#disponible-linea-${idLineaVenta}`)).toHaveText('1');
  });

  await test.step('devolver la unidad en efectivo y emitir el B04', async () => {
    await page.locator(`#input-cantidad-devolver-${idLineaVenta}`).fill('1');
    await page.locator('#input-motivo-devolucion').fill(MOTIVO_DEVOLUCION);
    await page.locator('#select-metodo-reembolso').selectOption('EFECTIVO');

    const respuesta = page.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/devoluciones' && r.request().method() === 'POST',
    );
    await page.locator('#btn-confirmar-devolucion').click();

    const creada = await respuesta;
    expect(creada.status()).toBe(201);

    devolucionCreada = await creada.json();
    expect(devolucionCreada.ncf).toMatch(/^B04\d{8}$/);
    expect(devolucionCreada.tipoNcf).toBe('B04');
    expect(devolucionCreada.ncfAfectado).toBe(ventaCreada.ncf);
    expect(devolucionCreada.metodoReembolso).toBe('EFECTIVO');
    expect(devolucionCreada.total).toBe(118);
    expect(devolucionCreada.baseImponible).toBe(100);
    expect(devolucionCreada.itbis).toBe(18);
    expect(devolucionCreada.estadoVenta).toBe('DEVUELTA');

    // La pantalla muestra el resultado del servidor, no un B04 inventado.
    await expect(page.locator('#resultado-b04')).toHaveText(devolucionCreada.ncf);
    await expect(page.locator('#resultado-ncf-afectado')).toHaveText(ventaCreada.ncf);
    await expect(page.locator('#resultado-base')).toHaveText('RD$100.00');
    await expect(page.locator('#resultado-itbis')).toHaveText('RD$18.00');
    await expect(page.locator('#resultado-total')).toHaveText('RD$118.00');
    await expect(page.locator('#resultado-reembolso')).toContainText('EFECTIVO');

    await page.locator('#btn-cerrar-resultado-devolucion').click();
  });

  await test.step('el historial muestra la devolución persistida', async () => {
    const fila = page.getByRole('row', { name: new RegExp(devolucionCreada.numeroControl) });
    await expect(fila).toContainText(ventaCreada.numeroControl);
    await expect(fila).toContainText(devolucionCreada.ncf);
    await expect(fila).toContainText(ventaCreada.ncf);
    await expect(fila).toContainText(USUARIO);
    await expect(fila).toContainText('EFECTIVO');
    await expect(fila).toContainText('RD$118.00');
    await expect(fila).toContainText('CONFIRMADA');
  });

  await test.step('el detalle de la nota de crédito trae los importes acreditados', async () => {
    await page.locator(`#btn-detalle-devolucion-${devolucionCreada.idDevolucion}`).click();
    await expect(page.getByRole('heading', { name: 'Detalle de la devolución' })).toBeVisible();

    await expect(page.locator('#detalle-devolucion-b04')).toHaveText(devolucionCreada.ncf);
    await expect(page.locator('#detalle-devolucion-ncf-afectado')).toHaveText(ventaCreada.ncf);
    await expect(page.locator('#detalle-devolucion-venta')).toContainText(ventaCreada.numeroControl);
    await expect(page.locator('#detalle-devolucion-motivo')).toContainText(MOTIVO_DEVOLUCION);
    await expect(page.locator('#detalle-devolucion-base')).toHaveText('RD$100.00');
    await expect(page.locator('#detalle-devolucion-itbis')).toHaveText('RD$18.00');
    await expect(page.locator('#detalle-devolucion-total')).toHaveText('RD$118.00');

    const linea = page.getByRole('row', { name: new RegExp(SKU) });
    await expect(linea).toContainText(NOMBRE_PRODUCTO);
    await expect(linea).toContainText('RD$100.00');
    await expect(linea).toContainText('RD$18.00');

    await page.locator('#btn-cerrar-detalle-devolucion').click();
  });

  await test.step('la venta original queda DEVUELTA', async () => {
    await abrirVista(page, 'Ventas', 'Historial de Ventas');
    await page.locator('#filtro-ventas-q').fill(ventaCreada.numeroControl);
    await page.locator('#btn-buscar-ventas').click();

    const fila = page.getByRole('row', { name: new RegExp(ventaCreada.numeroControl) });
    await expect(fila).toContainText('DEVUELTA');
  });

  await test.step(`la devolución repone el stock de 9 a ${STOCK_INICIAL}`, async () => {
    await expect(await stockEnPantalla(page)).toHaveText(STOCK_INICIAL);
  });

  await test.step('la venta acumula exactamente una devolución y un B04', async () => {
    const revision = await page.request.get(`/api/devoluciones?idVenta=${ventaCreada.idVenta}`);
    expect(revision.status()).toBe(200);

    const pagina = await revision.json();
    expect(pagina.totalElements).toBe(1);
    expect(pagina.content[0].ncf).toBe(devolucionCreada.ncf);
  });

  await test.step('navegar a Turnos de Caja', async () => {
    await abrirVista(page, 'Caja', 'Turnos de Caja');
    await expect(page.getByRole('heading', { name: 'Turnos de Caja', exact: true })).toBeVisible();
  });

  await test.step(`cerrar el turno declarando RD$${DECLARADO_AL_CIERRE}`, async () => {
    await page.locator(`#btn-cerrar-turno-${idTurno}`).click();
    await expect(page.getByRole('heading', { name: 'Cerrar Turno de Caja' })).toBeVisible();

    // El cuadre lo calcula el backend: 500 de fondo + 118 vendidos − 118
    // devueltos en efectivo. La resta aparece como línea propia.
    await expect(page.locator('#cierre-devoluciones-efectivo')).toHaveText(`-RD$${PRECIO}`);
    await expect(page.locator('#cierre-monto-esperado')).toHaveText(`RD$${DECLARADO_AL_CIERRE}`);
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
