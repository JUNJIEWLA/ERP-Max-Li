import React from 'react';
import { ConfiguracionEmpresa, VentaResponse } from '../../../imports/api';
import { CartItem } from './CartRow';

interface TicketImpresionProps {
  venta: VentaResponse;
  empresa: ConfiguracionEmpresa | null;
  cart?: CartItem[];
  montoRecibido?: number;
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

  // Code128-B Start code = 104
  let checksum = 104;
  let codeStr = '211214'; // Start Code B pattern

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
  codeStr += '2331112'; // Stop code + trailing bar

  // Render SVG bars
  const barElements: React.ReactNode[] = [];
  let posX = 10; // Quiet zone
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
      className="w-full max-w-[220px] h-[45px] mx-auto block"
      preserveAspectRatio="none"
    >
      {barElements}
    </svg>
  );
}

// ── Componente Principal del Ticket 80mm ─────────────────────────────

export default function TicketImpresion({ venta, empresa, cart, montoRecibido }: TicketImpresionProps) {
  const nombreComercial = empresa?.nombreComercial || 'PLAZA MAX';
  const razonSocial = empresa?.razonSocial || 'Comercial Plaza Max, S.R.L.';
  const rncEmpresa = empresa?.rnc || '13338823';
  const direccionEmpresa = empresa?.direccion
    ? `${empresa.direccion}${empresa.ciudad ? `, ${empresa.ciudad}` : ''}${empresa.provincia ? `, ${empresa.provincia}` : ''}`
    : 'AV. 27 DE FEBRERO #123, SANTO DOMINGO';
  const telefonoEmpresa = empresa?.telefonoPrincipal || '809-555-0100';

  const fechaFormateada = venta.fechaVenta
    ? new Intl.DateTimeFormat('es-DO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(venta.fechaVenta))
    : new Intl.DateTimeFormat('es-DO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(new Date());

  const ncf = venta.ncf || 'B0200000001';
  const numeroControl = venta.numeroControl || `VNT-${venta.idVenta}`;

  // Cliente
  const clienteNombre = venta.nombreClienteTemporal || (venta.idCliente ? `Cliente #${venta.idCliente}` : 'Consumidor Final');
  const clienteRnc = venta.rncTemporal || '';

  // Cantidad total de artículos
  const totalArticulos = venta.detalles
    ? venta.detalles.reduce((acc, item) => acc + item.cantidad, 0)
    : (cart ? cart.reduce((acc, item) => acc + item.cantidad, 0) : 0);

  // Método de pago
  const metodoPago = (venta.metodoPagoPrincipal || 'EFECTIVO').toUpperCase();
  const montoPagado = montoRecibido && montoRecibido >= venta.total ? montoRecibido : venta.total;

  const politicaDevolucion = empresa?.politicaDevolucion || 'Cambios válidos dentro de los 30 días presentando este comprobante y el producto en su empaque original. No se realiza devolución de dinero en efectivo.';

  return (
    <div id="printable-ticket" className="hidden print:block text-black font-mono text-[11px] leading-tight w-[80mm] mx-auto p-1 bg-white">
      
      {/* ── 1. Encabezado y Datos Fiscales ───────────────────────────── */}
      <div className="text-center font-bold text-base tracking-wider uppercase mb-1">
        {nombreComercial}
      </div>
      <div className="text-center text-[11px] font-semibold mb-1">
        Factura de Consumo Electrónica
      </div>
      <div className="text-center text-[10px] space-y-0.5 mb-2">
        <div><span className="font-bold">e-NCF:</span> {ncf}</div>
        <div><span className="font-bold">Fecha de vencimiento:</span> 31/12/2099</div>
      </div>

      <div className="border-t border-dashed border-black my-1" />

      {/* ── 2. Datos de Nuestra Empresa (Emisor) ────────────────────── */}
      <div className="text-[10px] space-y-0.5 uppercase mb-2">
        <div className="font-bold">{nombreComercial}</div>
        <div>{razonSocial}</div>
        <div><span className="font-bold">RNC:</span> {rncEmpresa}</div>
        <div><span className="font-bold">Dirección:</span> {direccionEmpresa}</div>
        <div><span className="font-bold">Tel:</span> {telefonoEmpresa}</div>
      </div>

      {/* ── 3. Datos del Cliente (Si aplica) ────────────────────────── */}
      {(clienteNombre !== 'Consumidor Final' || clienteRnc) && (
        <>
          <div className="border-t border-dashed border-black my-1" />
          <div className="text-[10px] space-y-0.5 mb-2">
            <div><span className="font-bold">Razón social / cliente:</span> {clienteNombre}</div>
            {clienteRnc && <div><span className="font-bold">RNC / Cédula:</span> {clienteRnc}</div>}
          </div>
        </>
      )}

      <div className="border-t border-dashed border-black my-1" />

      {/* ── 4. Cabecera de la Venta ──────────────────────────────────── */}
      <div className="text-[10px] space-y-0.5 mb-2">
        <div><span className="font-bold">FECHA:</span> {fechaFormateada}</div>
        <div><span className="font-bold">Factura #:</span> {numeroControl}</div>
        {venta.cajeroNombre && <div><span className="font-bold">Cajero:</span> {venta.cajeroNombre}</div>}
        <div><span className="font-bold">Caja:</span> {venta.cajaNombre || 'Caja Principal'}</div>
      </div>

      <div className="border-t border-black my-1" />

      {/* ── 5. Detalle de Artículos ──────────────────────────────────── */}
      <div className="text-[10px]">
        <div className="flex justify-between font-bold border-b border-black pb-0.5 mb-1">
          <span className="w-12 text-left">UD</span>
          <span className="w-16 text-right">PRECIO</span>
          <span className="w-16 text-right">IMPORTE</span>
        </div>

        {venta.detalles && venta.detalles.length > 0 ? (
          venta.detalles.map((det, idx) => {
            const codigo = det.skuProducto || det.codigoProducto;
            const importeLinea = det.importe ?? (det.cantidad * det.precioUnitario - (det.descuentoMonto || 0));
            return (
              <div key={idx} className="mb-1.5 space-y-0.5">
                <div className="font-semibold break-words">
                  {codigo ? `[${codigo}] ` : ''}{det.nombreProducto}
                </div>
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="w-12 text-left">{det.cantidad}</span>
                  <span className="w-16 text-right">{det.precioUnitario.toFixed(2)}</span>
                  <span className="w-16 text-right font-semibold">{importeLinea.toFixed(2)}</span>
                </div>
              </div>
            );
          })
        ) : cart ? (
          cart.map((item, idx) => (
            <div key={idx} className="mb-1.5 space-y-0.5">
              <div className="font-semibold break-words">
                {item.codigo ? `[${item.codigo}] ` : ''}{item.descripcion}
              </div>
              <div className="flex justify-between text-[10px] font-mono">
                <span className="w-12 text-left">{item.cantidad}</span>
                <span className="w-16 text-right">{item.precioUnitario.toFixed(2)}</span>
                <span className="w-16 text-right font-semibold">{item.importe.toFixed(2)}</span>
              </div>
            </div>
          ))
        ) : null}
      </div>

      <div className="border-t border-dashed border-black my-1.5" />

      {/* ── 6. Totales ──────────────────────────────────────────────── */}
      <div className="text-[11px] space-y-1">
        <div className="flex justify-between">
          <span>Subtotal Gravado:</span>
          <span className="font-mono">RD$ {venta.subtotal ? venta.subtotal.toFixed(2) : (venta.total - (venta.itbis || 0)).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Total ITBIS:</span>
          <span className="font-mono">RD$ {venta.itbis ? venta.itbis.toFixed(2) : '0.00'}</span>
        </div>

        <div className="border-t border-black my-1" />

        <div className="flex justify-between font-bold text-[12px]">
          <span>TOTAL ({totalArticulos} art.):</span>
          <span className="font-mono">RD$ {venta.total.toFixed(2)}</span>
        </div>

        <div className="border-t border-dashed border-black my-1" />

        <div className="flex justify-between text-[11px] font-semibold">
          <span>{metodoPago}:</span>
          <span className="font-mono">RD$ {montoPagado.toFixed(2)}</span>
        </div>

        {venta.cambio > 0 && (
          <div className="flex justify-between text-[10px] text-gray-800">
            <span>Cambio / Vuelto:</span>
            <span className="font-mono">RD$ {venta.cambio.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="border-t border-black my-2" />

      {/* ── 7. Pie de Página (Código de Barras) ───────────────────────── */}
      <div className="text-center space-y-1 mt-2">
        <div className="flex justify-center">
          {generateCode128Svg(numeroControl)}
        </div>
        <div className="text-[10px] font-mono font-bold tracking-widest">
          {numeroControl}
        </div>
      </div>

      {/* ── 8. Política de Devolución ───────────────────────────────── */}
      {politicaDevolucion && (
        <>
          <div className="border-t border-dashed border-black my-2" />
          <div className="text-center text-[9px] leading-tight text-gray-800 uppercase px-1 pb-1">
            <div className="font-bold mb-0.5">POLÍTICA DE DEVOLUCIÓN</div>
            <div>{politicaDevolucion}</div>
          </div>
        </>
      )}

    </div>
  );
}
