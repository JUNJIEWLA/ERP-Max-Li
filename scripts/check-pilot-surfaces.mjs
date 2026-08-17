/**
 * Comprobación de superficies del piloto.
 *
 * El piloto debe ser honesto: ninguna opción visible puede mostrar datos
 * ficticios, simular una operación, no hacer nada o terminar en la vista
 * genérica "Esta sección está en desarrollo".
 *
 * Estas pruebas leen el código fuente como texto: no requieren dependencias
 * (node:test + node:fs). Ejecutar con `npm run check:pilot`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');

const read = (rel) => readFileSync(join(root, rel), 'utf8');

const App = read('src/app/App.tsx');
const Sidebar = read('src/app/components/Sidebar.tsx');
const Header = read('src/app/components/Header.tsx');
const NotasRecepcion = read('src/app/components/NotasRecepcion.tsx');

/** Todos los .ts/.tsx bajo src/, excluyendo los primitivos de shadcn/ui. */
function sourceFiles(dir = src, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (full.endsWith(join('components', 'ui'))) continue;
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push([full.slice(root.length + 1), readFileSync(full, 'utf8')]);
    }
  }
  return out;
}

/** IDs de los items navegables declarados en el Sidebar. */
function sidebarItemIds() {
  return [...Sidebar.matchAll(/\{\s*id:\s*'([^']+)'\s*,\s*label:/g)].map((m) => m[1]);
}

/** IDs con `case` propio en el switch de renderView de App.tsx. */
function appViewCases() {
  return [...App.matchAll(/case\s+'([^']+)':/g)].map((m) => m[1]);
}

// ─── 1. Dashboard ficticio ────────────────────────────────────────────────
test('el Sidebar no ofrece Dashboard', () => {
  assert.ok(!/Dashboard/.test(Sidebar), 'Sidebar.tsx todavía menciona Dashboard');
  assert.ok(!/'dashboard'/.test(Sidebar), "Sidebar.tsx todavía navega a 'dashboard'");
});

test('App no importa ni renderiza Dashboard', () => {
  assert.ok(
    !/import\s+Dashboard\s+from/.test(App),
    'App.tsx todavía importa Dashboard'
  );
  assert.ok(!/<Dashboard\s*\/>/.test(App), 'App.tsx todavía renderiza <Dashboard />');
});

test('no existe redirección ni fallback hacia dashboard', () => {
  for (const [path, content] of sourceFiles()) {
    if (path.endsWith('components/Dashboard.tsx')) continue; // código inaccesible, permitido
    assert.ok(
      !/'dashboard'/.test(content),
      `${path} todavía referencia la vista 'dashboard'`
    );
  }
});

// ─── 2. Devoluciones y Notas de Crédito ───────────────────────────────────
test('el Sidebar no ofrece Devoluciones ni Notas de Crédito', () => {
  const ids = sidebarItemIds();
  assert.ok(!ids.includes('devoluciones'), "Sidebar todavía expone 'devoluciones'");
  assert.ok(!ids.includes('notas-credito'), "Sidebar todavía expone 'notas-credito'");
  assert.ok(!/Notas de Crédito/.test(Sidebar), 'Sidebar todavía rotula Notas de Crédito');
});

test('App no importa ni renderiza Devoluciones', () => {
  assert.ok(
    !/import\s+Devoluciones\s+from/.test(App),
    'App.tsx todavía importa Devoluciones'
  );
  assert.ok(!/<Devoluciones\s*\/>/.test(App), 'App.tsx todavía renderiza <Devoluciones />');
  assert.ok(
    !appViewCases().includes('devoluciones'),
    "App.tsx todavía tiene la ruta 'devoluciones'"
  );
});

// ─── 3. Vista inicial y fallback ──────────────────────────────────────────
test('cada opción navegable del menú tiene una vista real', () => {
  const cases = appViewCases();
  const huerfanas = sidebarItemIds().filter((id) => !cases.includes(id));
  assert.deepEqual(
    huerfanas,
    [],
    `opciones del menú sin vista implementada: ${huerfanas.join(', ')}`
  );
});

test('no existe el fallback genérico "en desarrollo"', () => {
  for (const [path, content] of sourceFiles()) {
    assert.ok(
      !/en desarrollo/i.test(content),
      `${path} todavía muestra un placeholder "en desarrollo"`
    );
  }
});

test('existe un estado neutral cuando el usuario no tiene módulos', () => {
  assert.match(App, /No tienes módulos asignados/);
});

// ─── 4. Búsqueda simulada ─────────────────────────────────────────────────
test('el Header no contiene la búsqueda global ficticia', () => {
  assert.ok(!/placeholder="Buscar/.test(Header), 'Header todavía tiene el input de búsqueda global');
  assert.ok(!/\bSearch\b/.test(Header), 'Header todavía importa el icono Search sin usarlo');
});

test('las búsquedas reales de los módulos siguen conectadas', () => {
  assert.match(read('src/app/components/pos/SearchBar.tsx'), /productosApi|buscar/i);
  assert.match(read('src/app/components/Productos.tsx'), /search/i);
  assert.match(read('src/app/components/Inventario.tsx'), /search/i);
  assert.match(read('src/app/components/Clientes.tsx'), /search/i);
  assert.match(read('src/app/components/Proveedores.tsx'), /search/i);
});

// ─── 5. Reportes simulados ────────────────────────────────────────────────
test('no queda ninguna acción "Generar reporte" simulada', () => {
  for (const [path, content] of sourceFiles()) {
    assert.ok(!/Generar reporte/.test(content), `${path} todavía ofrece "Generar reporte"`);
    assert.ok(!/Generando reporte/.test(content), `${path} todavía simula "Generando reporte"`);
    assert.ok(!/onGenerarReporte/.test(content), `${path} todavía cablea onGenerarReporte`);
  }
});

test('el botón Exportar sin funcionalidad desaparece del historial de ventas', () => {
  const Ventas = read('src/app/components/Ventas.tsx');
  assert.ok(!/>\s*Exportar\s*</.test(Ventas), 'Ventas.tsx todavía ofrece un Exportar no-op');
});

test('la exportación CSV real de Inventario se conserva', () => {
  const Inventario = read('src/app/components/Inventario.tsx');
  assert.match(Inventario, /handleExportCSV/);
  assert.match(Inventario, /Exportar CSV/);
});

// ─── 6. Superficies reales que deben sobrevivir ───────────────────────────
test('NcfDashboard sigue conectado', () => {
  assert.match(App, /import\s+NcfDashboard\s+from/);
  assert.match(App, /<NcfDashboard\s*\/>/);
  assert.ok(sidebarItemIds().includes('ncf'), "Sidebar ya no expone 'ncf'");
});

test('se conserva el feedback real de recepción confirmada', () => {
  assert.match(NotasRecepcion, /Recepción confirmada exitosamente/);
});
