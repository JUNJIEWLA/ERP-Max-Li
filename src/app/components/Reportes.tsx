import { useState, useRef, useCallback, useEffect } from 'react';
import {
  FileText, Download, Search, Loader2, AlertTriangle, X, FileSpreadsheet,
  Calendar, Filter, Printer, RefreshCw
} from 'lucide-react';
import {
  reportesApi, empresaApi,
  type ReporteVentasResponse, type ReporteFiltros,
  type VentaResumen, type ConfiguracionEmpresa
} from '../../imports/api';

// ── Formato ──────────────────────────────────────────────
const fmtMoneda = (v: number | null | undefined) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(v ?? 0);

const fmtFechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-DO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const fmtFecha = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('es-DO', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

const hoy = () => new Date().toISOString().split('T')[0];

const METODOS_PAGO = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CHEQUE'];

// ── Exportación a Excel ──────────────────────────────────
function exportarExcel(tableHtml: string, nombreArchivo: string) {
  const htmlCompleto = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8">
    <style>td,th{mso-number-format:'\\@';font-family:Arial;font-size:10pt;border:1px solid #ccc;padding:4px 8px;}
    th{background:#1e293b;color:#fff;font-weight:bold;}
    .money{mso-number-format:'#\\,##0\\.00';text-align:right;}
    </style></head>
    <body>${tableHtml}</body></html>`;
  const blob = new Blob([htmlCompleto], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nombreArchivo}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Exportación a Word ───────────────────────────────────
function exportarWord(html: string, nombreArchivo: string) {
  const htmlCompleto = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8">
    <style>
      body{font-family:Arial,sans-serif;font-size:11pt;color:#1e293b;}
      h1{font-size:16pt;color:#0f172a;border-bottom:2px solid #0f172a;padding-bottom:6pt;}
      h2{font-size:13pt;color:#334155;margin-top:12pt;}
      table{border-collapse:collapse;width:100%;margin-top:8pt;}
      td,th{border:1px solid #cbd5e1;padding:5pt 8pt;font-size:10pt;}
      th{background:#1e293b;color:#fff;font-weight:bold;}
      .text-right{text-align:right;}
      .total-row{font-weight:bold;background:#f1f5f9;}
      .header-info{font-size:10pt;color:#64748b;margin:2pt 0;}
    </style></head>
    <body>${html}</body></html>`;
  const blob = new Blob([htmlCompleto], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nombreArchivo}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Componente Reportes ──────────────────────────────────

export default function Reportes() {
  const [filtros, setFiltros] = useState<ReporteFiltros>({
    desde: hoy(),
    hasta: hoy(),
  });
  const [reporte, setReporte] = useState<ReporteVentasResponse | null>(null);
  const [empresa, setEmpresa] = useState<ConfiguracionEmpresa | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    empresaApi.obtener().then(setEmpresa).catch(() => {});
  }, []);

  const generar = useCallback(() => {
    if (!filtros.desde || !filtros.hasta) {
      setError('Seleccione las fechas desde y hasta.');
      return;
    }
    setLoading(true);
    setError(null);
    setReporte(null);
    reportesApi.ventas(filtros)
      .then(setReporte)
      .catch((e: any) => setError(e.message || 'Error al generar el reporte'))
      .finally(() => setLoading(false));
  }, [filtros]);

  const nombreArchivo = `Reporte_Ventas_${filtros.desde}_${filtros.hasta}`;

  // ── Generar HTML del reporte (para exportar) ───────────
  const generarHtmlReporte = useCallback(() => {
    if (!reporte) return '';
    const enc = empresa;
    const filas = reporte.ventas.map((v: VentaResumen) => `
      <tr>
        <td>${v.numeroControl}</td>
        <td>${fmtFechaHora(v.fechaVenta)}</td>
        <td>${v.clienteNombre || 'Consumidor Final'}</td>
        <td>${v.cajeroNombre}</td>
        <td>${v.ncf || '—'}</td>
        <td>${v.metodoPagoPrincipal}</td>
        <td>${v.estado}</td>
        <td class="text-right money">${(v.total ?? 0).toFixed(2)}</td>
      </tr>
    `).join('');

    return `
      <h1>${enc?.nombreComercial || 'Reporte de Ventas'}</h1>
      ${enc?.razonSocial ? `<p class="header-info">${enc.razonSocial}</p>` : ''}
      ${enc?.rnc ? `<p class="header-info">RNC: ${enc.rnc}</p>` : ''}
      ${enc?.direccion ? `<p class="header-info">Dirección: ${enc.direccion}</p>` : ''}
      ${enc?.telefonoPrincipal ? `<p class="header-info">Tel: ${enc.telefonoPrincipal}</p>` : ''}
      <h2>Reporte de Ventas</h2>
      <p class="header-info">Período: ${fmtFecha(filtros.desde)} — ${fmtFecha(filtros.hasta)}</p>
      <p class="header-info">Generado: ${new Date().toLocaleString('es-DO')}</p>
      <p class="header-info">Total de transacciones: ${reporte.totalTransacciones}</p>
      <table>
        <thead>
          <tr>
            <th>N° Control</th>
            <th>Fecha</th>
            <th>Cliente</th>
            <th>Cajero</th>
            <th>NCF</th>
            <th>Método Pago</th>
            <th>Estado</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${filas}
          <tr>
            <td colspan="7" class="text-right">Ventas brutas facturadas</td>
            <td class="text-right money">${(reporte.totalVentasBrutas ?? 0).toFixed(2)}</td>
          </tr>
          <tr>
            <td colspan="7" class="text-right">
              (−) Notas de crédito B04${reporte.totalDevoluciones ? ` (${reporte.totalDevoluciones})` : ''}
            </td>
            <td class="text-right money">${(reporte.totalNotasCredito ?? 0).toFixed(2)}</td>
          </tr>
          <tr>
            <td colspan="7" class="text-right">ITBIS neto</td>
            <td class="text-right money">${(reporte.totalItbis ?? 0).toFixed(2)}</td>
          </tr>
          <tr class="total-row">
            <td colspan="7" class="text-right"><strong>VENTAS NETAS</strong></td>
            <td class="text-right money"><strong>${(reporte.totalVentas ?? 0).toFixed(2)}</strong></td>
          </tr>
        </tbody>
      </table>
    `;
  }, [reporte, empresa, filtros]);

  const handleExportWord = () => exportarWord(generarHtmlReporte(), nombreArchivo);
  const handleExportExcel = () => {
    if (!reporte) return;
    // Para Excel solo la tabla
    const tableHtml = generarHtmlReporte();
    exportarExcel(tableHtml, nombreArchivo);
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head><meta charset="utf-8">
      <title>${nombreArchivo}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:11pt;color:#1e293b;padding:20px;}
        h1{font-size:16pt;border-bottom:2px solid #0f172a;padding-bottom:6pt;}
        h2{font-size:13pt;color:#334155;margin-top:12pt;}
        table{border-collapse:collapse;width:100%;margin-top:8pt;}
        td,th{border:1px solid #cbd5e1;padding:5pt 8pt;font-size:9pt;}
        th{background:#1e293b;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
        .text-right{text-align:right;}
        .total-row{font-weight:bold;background:#f1f5f9;}
        .header-info{font-size:10pt;color:#64748b;margin:2pt 0;}
        @media print{body{padding:0;}}
      </style></head><body>
      ${generarHtmlReporte()}
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  return (
    <div className="p-6 space-y-6 overflow-auto">
      {/* ── Encabezado ────────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Reportes</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Genere reportes de ventas con filtros y expórtelos a Word o Excel
        </p>
      </div>

      {/* ── Filtros ───────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={16} className="text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Filtros del Reporte</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Fecha desde */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Desde</label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="date"
                value={filtros.desde}
                onChange={e => setFiltros(p => ({ ...p, desde: e.target.value }))}
                className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
          {/* Fecha hasta */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Hasta</label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="date"
                value={filtros.hasta}
                onChange={e => setFiltros(p => ({ ...p, hasta: e.target.value }))}
                className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
          {/* Cajero */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Cajero</label>
            <input
              type="text"
              placeholder="Todos"
              value={filtros.cajero || ''}
              onChange={e => setFiltros(p => ({ ...p, cajero: e.target.value || undefined }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
          {/* Método de pago */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Método de Pago</label>
            <select
              value={filtros.metodoPago || ''}
              onChange={e => setFiltros(p => ({ ...p, metodoPago: e.target.value || undefined }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="">Todos</option>
              {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {/* Botón Generar */}
          <div className="flex items-end">
            <button
              onClick={generar}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition font-medium text-sm disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Generar Reporte
            </button>
          </div>
        </div>
        {/* Accesos rápidos */}
        <div className="flex gap-2 mt-3">
          {[
            { label: 'Hoy', desde: hoy(), hasta: hoy() },
            { label: 'Esta Semana', desde: (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split('T')[0]; })(), hasta: hoy() },
            { label: 'Este Mes', desde: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; })(), hasta: hoy() },
          ].map(preset => (
            <button
              key={preset.label}
              onClick={() => setFiltros(p => ({ ...p, desde: preset.desde, hasta: preset.hasta }))}
              className="px-3 py-1 text-xs bg-accent/50 hover:bg-accent text-foreground rounded-md transition-colors border border-border/50"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* ── Vista Previa del Reporte ──────────────────────── */}
      {reporte && (
        <div className="space-y-4">
          {/* Barra de acciones */}
          <div className="flex items-center justify-between bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <FileText size={18} className="text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {reporte.totalTransacciones} ventas encontradas
                </p>
                <p className="text-xs text-muted-foreground">
                  {fmtFecha(filtros.desde)} — {fmtFecha(filtros.hasta)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-foreground rounded-lg transition text-sm"
              >
                <Printer size={16} />
                Imprimir
              </button>
              <button
                onClick={handleExportWord}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-medium"
              >
                <FileText size={16} />
                Word
              </button>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition text-sm font-medium"
              >
                <FileSpreadsheet size={16} />
                Excel
              </button>
            </div>
          </div>

          {/* Preview tipo documento */}
          <div ref={previewRef} className="bg-white dark:bg-slate-950 border border-border rounded-xl shadow-lg overflow-hidden">
            {/* Encabezado del documento */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6">
              <h1 className="text-xl font-bold tracking-wide">{empresa?.nombreComercial || 'Reporte de Ventas'}</h1>
              {empresa?.razonSocial && empresa.razonSocial !== empresa.nombreComercial && (
                <p className="text-slate-300 text-sm mt-0.5">{empresa.razonSocial}</p>
              )}
              <div className="flex gap-6 mt-3 text-xs text-slate-400">
                {empresa?.rnc && <span>RNC: {empresa.rnc}</span>}
                {empresa?.telefonoPrincipal && <span>Tel: {empresa.telefonoPrincipal}</span>}
                {empresa?.direccion && <span>{empresa.direccion}</span>}
              </div>
            </div>

            <div className="p-6">
              {/* Título y resumen */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Reporte de Ventas</h2>
                  <p className="text-sm text-muted-foreground">
                    Período: {fmtFecha(filtros.desde)} — {fmtFecha(filtros.hasta)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">{fmtMoneda(reporte.totalVentas)}</p>
                  <p className="text-xs text-muted-foreground">
                    {reporte.totalTransacciones} transacciones
                    {reporte.totalDevoluciones > 0 && ' · neto de devoluciones'}
                  </p>
                </div>
              </div>

              {/* Tabla de ventas */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-left">
                      <th className="py-2.5 px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">N° Control</th>
                      <th className="py-2.5 px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Fecha</th>
                      <th className="py-2.5 px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Cliente</th>
                      <th className="py-2.5 px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Cajero</th>
                      <th className="py-2.5 px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">NCF</th>
                      <th className="py-2.5 px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Pago</th>
                      <th className="py-2.5 px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Estado</th>
                      <th className="py-2.5 px-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporte.ventas.map((v: VentaResumen, i: number) => (
                      <tr key={v.idVenta} className={`border-b border-border/30 hover:bg-accent/30 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-900/50'}`}>
                        <td className="py-2 px-3 font-mono text-xs">{v.numeroControl}</td>
                        <td className="py-2 px-3 text-xs">{fmtFechaHora(v.fechaVenta)}</td>
                        <td className="py-2 px-3 font-medium">{v.clienteNombre || 'Consumidor Final'}</td>
                        <td className="py-2 px-3">{v.cajeroNombre}</td>
                        <td className="py-2 px-3 font-mono text-xs">{v.ncf || '—'}</td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            v.metodoPagoPrincipal === 'EFECTIVO' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            v.metodoPagoPrincipal === 'TARJETA' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                            v.metodoPagoPrincipal === 'TRANSFERENCIA' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                            'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {v.metodoPagoPrincipal}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            v.estado === 'COMPLETADA' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            v.estado === 'DEVUELTA' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                            'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}>
                            {v.estado}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">{fmtMoneda(v.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {/*
                    Las tres líneas encadenadas dejan el neto verificable contra
                    la tabla: la columna Total suma el bruto, la nota de crédito
                    lo corrige y el resultado es lo que la tienda se quedó.
                  */}
                  <tfoot>
                    <tr className="border-t border-border">
                      <td colSpan={7} className="py-2 px-3 text-right text-sm text-muted-foreground">
                        Ventas brutas facturadas
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-sm">{fmtMoneda(reporte.totalVentasBrutas)}</td>
                    </tr>
                    <tr>
                      <td colSpan={7} className="py-2 px-3 text-right text-sm text-muted-foreground">
                        (−) Notas de crédito B04
                        {reporte.totalDevoluciones > 0 && ` (${reporte.totalDevoluciones})`}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-sm text-red-600 dark:text-red-400">
                        {fmtMoneda(reporte.totalNotasCredito)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={7} className="py-2 px-3 text-right text-sm text-muted-foreground">
                        ITBIS neto {reporte.totalDescuentos > 0 && `· Descuentos ${fmtMoneda(reporte.totalDescuentos)}`}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-sm">{fmtMoneda(reporte.totalItbis)}</td>
                    </tr>
                    <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                      <td colSpan={7} className="py-3 px-3 text-right text-sm uppercase tracking-wider">Ventas Netas</td>
                      <td className="py-3 px-3 text-right font-mono text-base">{fmtMoneda(reporte.totalVentas)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Pie de documento */}
              <div className="mt-6 pt-4 border-t border-border text-xs text-muted-foreground flex justify-between">
                <span>Generado el {new Date().toLocaleString('es-DO')}</span>
                <span>{empresa?.nombreComercial || 'ERP Max'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estado vacío */}
      {!reporte && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FileText size={48} strokeWidth={1} className="mb-4 opacity-30" />
          <p className="text-lg font-medium">Seleccione un rango de fechas</p>
          <p className="text-sm mt-1">Y presione "Generar Reporte" para ver la vista previa</p>
        </div>
      )}
    </div>
  );
}
