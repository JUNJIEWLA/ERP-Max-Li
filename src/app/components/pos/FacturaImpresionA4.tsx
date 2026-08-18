import React, { useState, useEffect } from 'react';
import { ConfiguracionEmpresa, VentaResponse, empresaApi, getNombreTipoNcf, formatFechaVencimientoNcf, resolucionNcfApi } from '../../../imports/api';

interface FacturaImpresionA4Props {
  venta: VentaResponse;
  empresa: ConfiguracionEmpresa | null;
  /**
   * Marca la hoja como reimpresión. Un comprobante fiscal se emite una vez: si
   * la copia sale idéntica al original, dos papeles con el mismo e-NCF circulan
   * sin que nada los distinga.
   */
  esCopia?: boolean;
}

// ── Generador vectorial SVG de Código de Barras Code 128 ─────────────

const CODE128_PATTERNS_ARRAY = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','312113',
  '312311','332111','314111','221411','431111','111224','111422','121124','121421','141122',
  '141221','112214','112412','122114','122411','142112','142211','241211','221114','411112',
  '421112','421211','212141','214121','412121','111143','111341','131141','114113','114311',
  '411113','411311','113141','114131','311141','411131','211412','211214','211412','133112',
  '313112','331112','321113','312114','214112','211241','114122','114221','311122','411121',
  '421111','241111','211142','213111','211312','111114','111411'
];

function generateCode128Svg(text: string): React.ReactNode {
  if (!text) return null;

  let checksum = 104;
  let codeStr = '211214';

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const codeVal = charCode - 32;
    if (codeVal >= 0 && codeVal < 95) {
      checksum += (i + 1) * codeVal;
      codeStr += CODE128_PATTERNS_ARRAY[codeVal] || '212222';
    }
  }

  const checksumVal = checksum % 103;
  codeStr += CODE128_PATTERNS_ARRAY[checksumVal] || '212222';
  codeStr += '2331112';

  const barElements: React.ReactNode[] = [];
  let posX = 10;
  const quietZone = 10;
  const barHeight = 45;

  for (let i = 0; i < codeStr.length; i++) {
    const width = parseInt(codeStr[i], 10) * 1.5;
    const isBar = i % 2 === 0;
    if (isBar) {
      barElements.push(
        <rect key={i} x={posX} y={0} width={width} height={barHeight} fill="#000000" />
      );
    }
    posX += width;
  }

  const totalWidth = posX + quietZone;

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${barHeight}`}
      className="w-[240px] h-[45px] mx-auto block"
      preserveAspectRatio="none"
    >
      {barElements}
    </svg>
  );
}

const fmtMoneda = (v: number | null | undefined) =>
  new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(v ?? 0);

const fmtFechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-DO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

export default function FacturaImpresionA4({ venta, empresa, esCopia = false }: FacturaImpresionA4Props) {
  const [empresaState, setEmpresaState] = useState<ConfiguracionEmpresa | null>(empresa || null);

  useEffect(() => {
    if (empresa) {
      setEmpresaState(empresa);
    } else {
      empresaApi.obtener()
        .then(data => setEmpresaState(data))
        .catch(() => {});
    }
  }, [empresa]);

  const activeEmpresa = empresaState || empresa;

  const nombreComercial = activeEmpresa?.nombreComercial || activeEmpresa?.razonSocial || '';
  const razonSocial = activeEmpresa?.razonSocial || '';
  const rncEmpresa = activeEmpresa?.rnc || '';
  const direccionEmpresa = activeEmpresa?.direccion
    ? `${activeEmpresa.direccion}${activeEmpresa.ciudad ? `, ${activeEmpresa.ciudad}` : ''}${activeEmpresa.provincia ? `, ${activeEmpresa.provincia}` : ''}`
    : '';
  const telefonoEmpresa = activeEmpresa?.telefonoPrincipal || activeEmpresa?.telefonoSecundario || '';
  const emailEmpresa = activeEmpresa?.emailFacturacion || activeEmpresa?.emailComercial || '';

  const ncf = venta.ncf || 'B0200000001';
  const tituloFactura = getNombreTipoNcf(venta.tipoNcf, venta.ncf);
  const numeroControl = venta.numeroControl || `VNT-${venta.idVenta}`;

  const clienteNombre = (venta.nombreClienteTemporal && venta.nombreClienteTemporal.trim())
    ? venta.nombreClienteTemporal
    : (venta.clienteNombre && venta.clienteNombre !== 'Consumidor Final'
        ? venta.clienteNombre
        : (venta.clienteNombre || 'Consumidor Final'));
  const clienteRnc = venta.rncTemporal || venta.clienteRncCedula || '—';

  const [vencimientoState, setVencimientoState] = useState<any>(venta.fechaVencimientoNcf || null);

  useEffect(() => {
    if (venta.fechaVencimientoNcf) {
      setVencimientoState(venta.fechaVencimientoNcf);
    } else if (venta.tipoNcf || venta.ncf) {
      const tipo = venta.tipoNcf || (venta.ncf ? venta.ncf.substring(0, 3) : 'B02');
      resolucionNcfApi.previsualizar(tipo)
        .then(res => {
          if (res.fechaVencimiento) {
            setVencimientoState(res.fechaVencimiento);
          }
        })
        .catch(() => {});
    }
  }, [venta.fechaVencimientoNcf, venta.tipoNcf, venta.ncf]);

  const fechaVencimientoTexto = formatFechaVencimientoNcf(vencimientoState);

  const politicaDevolucion = empresa?.politicaDevolucion || 'Cambios válidos dentro de los 30 días presentando este comprobante y el producto en su empaque original. No se realiza devolución de dinero en efectivo.';

  return (
    <div id="printable-a4" className="hidden print:block text-black font-sans text-xs w-[210mm] max-w-[210mm] mx-auto p-8 bg-white box-border">
      
      {esCopia && (
        <div
          id="factura-marca-copia"
          className="text-center font-bold text-sm tracking-widest uppercase border-2 border-slate-900 py-1 mb-4"
        >
          COPIA — Reimpresión
        </div>
      )}

      {/* ── Encabezado Principal ─────────────────────────────────────── */}
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
        {/* Lado Izquierdo: Datos de la Empresa */}
        <div className="space-y-1 max-w-[55%]">
          {empresa?.logoUrl && (
            <img src={empresa.logoUrl} alt="Logo" className="h-12 max-w-[200px] object-contain mb-2" />
          )}
          <h1 className="text-xl font-bold text-slate-900 uppercase tracking-wide">{nombreComercial}</h1>
          <p className="font-semibold text-slate-700">{razonSocial}</p>
          <p><span className="font-semibold">RNC:</span> {rncEmpresa}</p>
          <p><span className="font-semibold">Dirección:</span> {direccionEmpresa}</p>
          <p><span className="font-semibold">Tel:</span> {telefonoEmpresa} | <span className="font-semibold">Email:</span> {emailEmpresa}</p>
        </div>

        {/* Lado Derecho: Documento Fiscal (NCF Box) */}
        <div className="border-2 border-slate-900 rounded-lg p-4 text-right min-w-[240px] bg-slate-50 space-y-1">
          <h2 className="text-sm font-bold uppercase text-slate-900">{tituloFactura}</h2>
          <div className="pt-2 border-t border-slate-300">
            <p className="text-xs"><span className="font-bold text-slate-800">NCF:</span></p>
            <p className="font-mono text-sm font-bold text-blue-950">{ncf}</p>
          </div>
          <p className="text-[11px] text-slate-600"><span className="font-semibold">Vencimiento:</span> {fechaVencimientoTexto}</p>
          <div className="pt-2 border-t border-slate-300 text-left text-[11px] space-y-0.5">
            <p><span className="font-bold">Factura N°:</span> <span className="font-mono">{numeroControl}</span></p>
            <p><span className="font-bold">Fecha / Hora:</span> {fmtFechaHora(venta.fechaVenta)}</p>
          </div>
        </div>
      </div>

      {/* ── Bloque de Cliente y Sucursal ─────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 mb-6 border border-slate-300 rounded-lg p-3 bg-slate-50/50">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Datos del Cliente</h3>
          <p className="text-sm font-bold text-slate-900">{clienteNombre}</p>
          <p className="text-xs text-slate-700 mt-0.5"><span className="font-semibold">RNC / Cédula:</span> {clienteRnc}</p>
        </div>
        <div className="text-right">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Detalles de Operación</h3>
          <p className="text-xs"><span className="font-semibold">Cajero:</span> {venta.cajeroNombre || 'Administrador'}</p>
          <p className="text-xs"><span className="font-semibold">Caja:</span> {venta.cajaNombre || 'Caja Principal'}</p>
          <p className="text-xs"><span className="font-semibold">Estado:</span> <span className="font-bold text-emerald-700">{venta.estado || 'COMPLETADA'}</span></p>
        </div>
      </div>

      {/* ── Tabla de Productos ───────────────────────────────────────── */}
      <table className="w-full border-collapse mb-6 text-xs">
        <thead>
          <tr className="bg-slate-900 text-white font-semibold">
            <th className="py-2 px-3 text-left w-24">SKU / Cód</th>
            <th className="py-2 px-3 text-left">Descripción del Producto</th>
            <th className="py-2 px-3 text-right w-16">Cant.</th>
            <th className="py-2 px-3 text-right w-24">Precio Un.</th>
            <th className="py-2 px-3 text-right w-20">Descuento</th>
            <th className="py-2 px-3 text-right w-20">ITBIS</th>
            <th className="py-2 px-3 text-right w-28">Importe Total</th>
          </tr>
        </thead>
        <tbody>
          {venta.detalles.map((d, i) => {
            const tasaItbis = d.tasaItbis ? (d.tasaItbis > 1 ? d.tasaItbis / 100 : d.tasaItbis) : 0.18;
            const itbisMonto = d.itbisLinea ?? (d.importe - (d.importe / (1 + tasaItbis)));
            return (
              <tr key={d.idDetalleVenta || i} className="border-b border-slate-200 odd:bg-white even:bg-slate-50">
                <td className="py-2 px-3 font-mono text-slate-600">{d.skuProducto || `PRD-${d.idProducto}`}</td>
                <td className="py-2 px-3 font-medium text-slate-900">{d.nombreProducto}</td>
                <td className="py-2 px-3 text-right font-semibold">{d.cantidad}</td>
                <td className="py-2 px-3 text-right font-mono">{fmtMoneda(d.precioUnitario)}</td>
                <td className="py-2 px-3 text-right font-mono text-slate-600">{fmtMoneda(d.descuentoProrrateado + (d.descuentoMonto || 0))}</td>
                <td className="py-2 px-3 text-right font-mono text-slate-600">{fmtMoneda(itbisMonto)}</td>
                <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{fmtMoneda(d.importe)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ── Totales y Formas de Pago ─────────────────────────────────── */}
      <div className="flex justify-between items-start gap-6 mb-8">
        {/* Formas de Pago */}
        <div className="flex-1 border border-slate-300 rounded-lg p-3 space-y-1.5 bg-slate-50/30">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1 mb-1">
            Forma de Pago
          </h3>
          {venta.ingresos.map((ing, i) => (
            <div key={i} className="flex justify-between text-xs font-medium">
              <span>{ing.metodoPago}{ing.referencia ? ` (Ref: ${ing.referencia})` : ''}:</span>
              <span className="font-mono font-bold">{fmtMoneda(ing.monto)}</span>
            </div>
          ))}
          {venta.montoRecibido > 0 && (
            <div className="flex justify-between text-xs text-slate-600 pt-1 border-t border-slate-200">
              <span>Monto Recibido:</span>
              <span className="font-mono">{fmtMoneda(venta.montoRecibido)}</span>
            </div>
          )}
          {venta.cambio > 0 && (
            <div className="flex justify-between text-xs text-emerald-700 font-semibold">
              <span>Cambio / Vuelto:</span>
              <span className="font-mono">{fmtMoneda(venta.cambio)}</span>
            </div>
          )}
        </div>

        {/* Resumen Fiscal de Totales */}
        <div className="w-72 border-2 border-slate-900 rounded-lg p-4 bg-slate-50 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-600">Subtotal Gravado:</span>
            <span className="font-mono font-semibold">{fmtMoneda(venta.subtotal)}</span>
          </div>
          {venta.descuentoTotal > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Descuento Total:</span>
              <span className="font-mono font-semibold">-{fmtMoneda(venta.descuentoTotal)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-600">Total ITBIS (18%):</span>
            <span className="font-mono font-semibold">{fmtMoneda(venta.itbis)}</span>
          </div>

          <div className="border-t-2 border-slate-900 pt-2 flex justify-between items-center text-sm font-bold text-slate-900">
            <span>TOTAL A PAGAR:</span>
            <span className="font-mono text-base">{fmtMoneda(venta.total)}</span>
          </div>
        </div>
      </div>

      {/* ── Pie de Página (Código de Barras y Política) ──────────────── */}
      <div className="border-t border-slate-300 pt-4 text-center space-y-2">
        <div className="flex justify-center">
          {generateCode128Svg(numeroControl)}
        </div>
        <p className="font-mono font-bold text-xs tracking-widest text-slate-800">{numeroControl}</p>
        <p className="text-[10px] text-slate-500">Gracias por su compra en {nombreComercial}. Documento impreso en formato oficial A4 / Carta.</p>

        {politicaDevolucion && (
          <div className="pt-2 border-t border-slate-200 mt-2 text-[10px] text-slate-600 max-w-xl mx-auto">
            <span className="font-bold text-slate-800">POLÍTICA DE DEVOLUCIÓN: </span>
            {politicaDevolucion}
          </div>
        )}
      </div>

    </div>
  );
}
