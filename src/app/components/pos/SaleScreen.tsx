import { useState, useEffect, useCallback } from 'react';
import { Loader2, Lock, Wallet, ShieldAlert } from 'lucide-react';
import POSHeader from './POSHeader';
import SearchBar from './SearchBar';
import CartTable from './CartTable';
import { CartItem } from './CartRow';
import SaleSummaryPanel from './SaleSummaryPanel';
import ActionBar from './ActionBar';
import HoldListModal, { HeldSale } from './HoldListModal';
import NCFSelectorModal from './NCFSelectorModal';
import ClienteSelectorModal from './ClienteSelectorModal';
import CheckoutModal from './CheckoutModal';
import AperturaTurnoModal from './AperturaTurnoModal';
import { ClienteResumen, turnosCajaApi, ncfApi, type TurnoCaja, type VentaResponse, type Empaque, type Producto } from '../../../imports/api';
import EmpaqueModal from './EmpaqueModal';


// HeldSale is imported from HoldListModal

const tiposNCF = [
  { codigo: 'B01', nombre: 'Crédito Fiscal' },
  { codigo: 'B02', nombre: 'Consumidor Final' },
  { codigo: 'B14', nombre: 'Régimen Especial' },
  { codigo: 'B15', nombre: 'Gubernamental' },
];

export default function SaleScreen() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [holdList, setHoldList] = useState<HeldSale[]>([]);
  const [selectedRowIndex, setSelectedRowIndex] = useState(-1);
  const [nextId, setNextId] = useState(1);
  const [qtyToAdd, setQtyToAdd] = useState(1);
  const [descuentoGlobal, setDescuentoGlobal] = useState(0);
  const [tipoDescuentoGlobal, setTipoDescuentoGlobal] = useState<'%' | 'RD$'>('%');
  const [tipoNCFIndex, setTipoNCFIndex] = useState(1); // default: B02 — Consumidor Final

  const [showHoldList, setShowHoldList] = useState(false);
  const [showNCFSelector, setShowNCFSelector] = useState(false);
  const [showClienteSelector, setShowClienteSelector] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<ClienteResumen | null>(null);
  const [ncfPreview, setNcfPreview] = useState<string>('...');
  const [selectedEmpaque, setSelectedEmpaque] = useState<Empaque | null>(null);
  const [showEmpaqueModal, setShowEmpaqueModal] = useState(false);

  // ── State de Turno de Caja (CashShift) ──────────────────────────────
  const [activeTurno, setActiveTurno] = useState<TurnoCaja | null>(null);
  const [checkingTurno, setCheckingTurno] = useState(true);

  const checkActiveTurno = useCallback(async () => {
    setCheckingTurno(true);
    try {
      const turno = await turnosCajaApi.abiertoActual();
      setActiveTurno(turno);
    } catch {
      setActiveTurno(null);
    } finally {
      setCheckingTurno(false);
    }
  }, []);

  useEffect(() => {
    checkActiveTurno();
  }, [checkActiveTurno]);

  const cajeroNombre = activeTurno?.usernameUsuarioApertura || 'Sin cajero';
  const cajaId = activeTurno?.cajaNombre || (activeTurno?.idCaja ? `Caja #${activeTurno.idCaja}` : 'Sin caja');
  const turnoId = activeTurno?.idTurnoCaja ? `TURNO #${activeTurno.idTurnoCaja}` : 'Sin turno';
  const clienteNombre = selectedCliente ? selectedCliente.nombreCompleto : 'Consumidor Final';
  const tipoNCF = tiposNCF[tipoNCFIndex];

  // ── Previsualización del próximo NCF (sin consumir) ─────────────────
  useEffect(() => {
    let cancelled = false;
    setNcfPreview('...');
    ncfApi.preview(tipoNCF.codigo)
      .then((data) => { if (!cancelled) setNcfPreview(data.ncfCompleto); })
      .catch(() => { if (!cancelled) setNcfPreview('—'); });
    return () => { cancelled = true; };
  }, [tipoNCF.codigo]);

  /** Suma de importes de líneas (ya incluye ITBIS y descuento por línea) */
  const calculateImporteLineas = () => {
    return cart.reduce((sum, item) => sum + item.importe, 0);
  };

  /** Suma de todos los descuentos por línea en RD$ */
  const calculateDescuentoLinea = () => {
    return cart.reduce((sum, item) => {
      const descuento = (item.precioUnitario * item.cantidad * item.descuentoLinea) / 100;
      return sum + descuento;
    }, 0);
  };

  /** Calcula el monto real en RD$ del descuento global */
  const calculateDescuentoGlobalMonto = () => {
    const importeTotal = calculateImporteLineas();
    if (descuentoGlobal <= 0 || importeTotal <= 0) return 0;
    if (tipoDescuentoGlobal === '%') {
      return (importeTotal * descuentoGlobal) / 100;
    }
    return Math.min(importeTotal, descuentoGlobal);
  };

  /** Total final a pagar (con ITBIS incluido) */
  const calculateTotalPagar = () => {
    const importeTotal = calculateImporteLineas();
    const descGlobalMonto = calculateDescuentoGlobalMonto();
    return Math.max(0, importeTotal - descGlobalMonto);
  };

  const getTotalItems = () => {
    return cart.reduce((sum, item) => sum + item.cantidad, 0);
  };

  const getTotalAhorrado = () => {
    return calculateDescuentoLinea() + calculateDescuentoGlobalMonto();
  };



  const handleProductSelect = (product: Producto) => {
    const empaqueMultiplier = selectedEmpaque?.cantidad ?? 1;
    const cantidadTotal = qtyToAdd * empaqueMultiplier;
    const precio = product.precioVenta;

    const existingIndex = cart.findIndex((item) => item.id === product.idProducto);

    if (existingIndex >= 0) {
      const updatedCart = [...cart];
      updatedCart[existingIndex].cantidad += cantidadTotal;
      const descuento = (updatedCart[existingIndex].precioUnitario * updatedCart[existingIndex].cantidad * updatedCart[existingIndex].descuentoLinea) / 100;
      updatedCart[existingIndex].importe = (updatedCart[existingIndex].cantidad * updatedCart[existingIndex].precioUnitario) - descuento;
      setCart(updatedCart);
    } else {
      const newItem: CartItem = {
        id: product.idProducto,
        codigo: product.sku || product.codigoBarras || `PRD-${product.idProducto}`,
        descripcion: product.nombre,
        precioUnitario: precio,
        cantidad: cantidadTotal,
        descuentoLinea: 0,
        unidad: 'PZ',
        importe: precio * cantidadTotal,
      };
      setCart([...cart, newItem]);
    }

    // Resetear cantidad a 1 y empaque a Unidad tras agregar producto
    setQtyToAdd(1);
    setSelectedEmpaque(null);
  };


  const handleUpdateQty = (index: number, cantidad: number) => {
    const updatedCart = [...cart];
    updatedCart[index].cantidad = cantidad;
    const descuento = (updatedCart[index].precioUnitario * cantidad * updatedCart[index].descuentoLinea) / 100;
    updatedCart[index].importe = (cantidad * updatedCart[index].precioUnitario) - descuento;
    setCart(updatedCart);
  };

  const handleUpdateDiscount = (index: number, descuento: number) => {
    const updatedCart = [...cart];
    updatedCart[index].descuentoLinea = descuento;
    const descuentoMonto = (updatedCart[index].precioUnitario * updatedCart[index].cantidad * descuento) / 100;
    updatedCart[index].importe = (updatedCart[index].cantidad * updatedCart[index].precioUnitario) - descuentoMonto;
    setCart(updatedCart);
  };

  const handleRemoveItem = (index: number) => {
    const updatedCart = cart.filter((_, i) => i !== index);
    setCart(updatedCart);
    if (selectedRowIndex >= updatedCart.length) {
      setSelectedRowIndex(updatedCart.length - 1);
    }
  };

  const handleCancel = () => {
    if (cart.length === 0) return;
    if (confirm('¿Está seguro de cancelar esta venta?')) {
      setCart([]);
      setSelectedRowIndex(-1);
      setSelectedEmpaque(null);
      setQtyToAdd(1);
    }
  };

  /** Selección de cliente: auto-rellena descuento y NCF; ambos permanecen editables. */
  const handleClienteSelect = (cliente: ClienteResumen | null) => {
    setSelectedCliente(cliente);
    if (cliente) {
      // Auto-fill descuento global con el predeterminado del cliente
      setDescuentoGlobal(cliente.descuentoPredeterminado);
      setTipoDescuentoGlobal('%');
      // Auto-seleccionar tipo NCF preferido del cliente
      const ncfIdx = tiposNCF.findIndex((t) => t.codigo === cliente.tipoNcfPreferido);
      if (ncfIdx >= 0) setTipoNCFIndex(ncfIdx);
    } else {
      // Limpiar cliente → resetear a defaults: B02 Consumidor Final
      setDescuentoGlobal(0);
      setTipoDescuentoGlobal('%');
      setTipoNCFIndex(1); // B02 — Consumidor Final
    }
  };


  const handleHold = () => {
    if (cart.length === 0) return;
    // Si hay una orden activa en la caja, la pausamos antes de cargar
    const newHeldSale: HeldSale = {
      id: Date.now(),
      items: [...cart],
      total: calculateTotalPagar(),
      timestamp: new Date(),
      clienteNombre,
    };
    setHoldList([...holdList, newHeldSale]);
    setCart([]);
    setDescuentoGlobal(0);
    setSelectedCliente(null);
    setSelectedRowIndex(-1);
    setSelectedEmpaque(null);
    setQtyToAdd(1);
  };

  const handleHoldList = () => {
    setShowHoldList(true);
  };

  const handleResumeHeld = (sale: HeldSale) => {
    // Si hay carrito activo, pausarlo primero
    if (cart.length > 0) {
      const currentHeld: HeldSale = {
        id: Date.now(),
        items: [...cart],
        total: calculateTotalPagar(),
        timestamp: new Date(),
        clienteNombre,
      };

      setHoldList((prev) => [...prev.filter((s) => s.id !== sale.id), currentHeld]);
    } else {
      setHoldList((prev) => prev.filter((s) => s.id !== sale.id));
    }
    setCart(sale.items);
    setDescuentoGlobal(0);
    setSelectedCliente(null);
    setSelectedRowIndex(-1);
    setSelectedEmpaque(null);
    setQtyToAdd(1);
    setShowHoldList(false);
  };

  const handleDeleteHeld = (id: number) => {
    setHoldList((prev) => prev.filter((s) => s.id !== id));
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setShowCheckout(true);
  };

  const handleVentaCompletada = (_venta: VentaResponse) => {
    // Limpiar carrito y estado tras venta exitosa
    setCart([]);
    setSelectedRowIndex(-1);
    setDescuentoGlobal(0);
    setSelectedCliente(null);
    setTipoNCFIndex(1); // reset to B02
    setSelectedEmpaque(null);
    setQtyToAdd(1);
    setShowCheckout(false);
  };


  const handleChangeTipoNCF = () => {
    setTipoNCFIndex((prev) => (prev + 1) % tiposNCF.length);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'F3':
          e.preventDefault();
          setShowClienteSelector(true);
          break;
        case 'F4':
          e.preventDefault();
          handleCancel();
          break;
        case 'F5':
          e.preventDefault();
          handleHold();
          break;
        case 'F6':
          e.preventDefault();
          handleHoldList();
          break;
        case 'F7':
          e.preventDefault();
          handleChangeTipoNCF();
          break;
        case 'F8':
          e.preventDefault();
          setShowEmpaqueModal(true);
          break;
        case 'F10':
          e.preventDefault();
          setShowNCFSelector(true);
          break;
        case 'Escape':
          e.preventDefault();
          if (showCheckout) { setShowCheckout(false); break; }
          if (showHoldList) { setShowHoldList(false); break; }
          if (showNCFSelector) { setShowNCFSelector(false); break; }
          if (showClienteSelector) { setShowClienteSelector(false); break; }
          handleCheckout();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, holdList, tipoNCFIndex, showHoldList, showNCFSelector, showClienteSelector, showCheckout]);

  const [showAperturaModal, setShowAperturaModal] = useState(false);

  if (checkingTurno) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-background gap-3">
        <Loader2 size={36} className="animate-spin text-blue-600" />
        <p className="text-sm font-medium text-muted-foreground">Verificando estado de turno de caja...</p>
      </div>
    );
  }

  if (!activeTurno) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-background p-6">
        <div className="bg-card border border-border rounded-2xl shadow-xl max-w-lg w-full p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
          
          <div className="inline-flex p-4 bg-amber-500/10 text-amber-600 rounded-2xl border border-amber-500/20">
            <Lock size={40} />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              Caja No Aperturada
            </span>
            <h2 className="text-2xl font-bold text-foreground">No tienes un Turno de Caja Abierto</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Para poder facturar, registrar cobros y emitir comprobantes en el Punto de Venta, la caja debe estar abierta y vinculada a tu usuario.
            </p>
          </div>

          <div className="bg-muted/40 rounded-xl p-4 border border-border text-left space-y-2.5 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Terminal Física:</span>
              <span className="font-semibold text-foreground">Requerida</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Cajero Autorizado:</span>
              <span className="font-semibold text-foreground">Sesión Activa</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Fondo de Caja (Monto Inicial):</span>
              <span className="font-semibold text-foreground">Por ingresar</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            {(() => {
              let isSupervisorOrAdmin = false;
              try {
                const rolesRaw = localStorage.getItem('maxli_roles');
                if (rolesRaw) {
                  const roles: string[] = JSON.parse(rolesRaw);
                  isSupervisorOrAdmin = roles.some((r) => {
                    const u = r.toUpperCase();
                    return u.includes('ADMIN') || u.includes('SUPERVISOR') || u.includes('SUPERVISORA');
                  });
                }
              } catch {
                isSupervisorOrAdmin = false;
              }

              if (isSupervisorOrAdmin) {
                return (
                  <button
                    id="btn-iniciar-apertura-turno"
                    onClick={() => setShowAperturaModal(true)}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20"
                  >
                    <Wallet size={18} />
                    Abrir Turno de Caja Ahora
                  </button>
                );
              }

              return (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-2 text-left">
                  <ShieldAlert size={18} className="flex-shrink-0 text-amber-600" />
                  <span>
                    No posees permisos de apertura. Solicita a un <strong>Administrador</strong> o <strong>Supervisora</strong> que abra un turno de caja asignado a tu usuario.
                  </span>
                </div>
              );
            })()}
            
            <button
              onClick={checkActiveTurno}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-border text-muted-foreground font-medium text-xs hover:bg-muted hover:text-foreground transition-colors"
            >
              <Loader2 size={14} className={checkingTurno ? 'animate-spin' : 'hidden'} />
              Recomprobar Estado de Caja
            </button>
          </div>
        </div>

        {showAperturaModal && (
          <AperturaTurnoModal
            onTurnoAbierto={(turno) => {
              setActiveTurno(turno);
              setShowAperturaModal(false);
            }}
            onClose={() => setShowAperturaModal(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <POSHeader
        ncf={ncfPreview}
        tipoDocumento={tipoNCF.nombre}
        cajero={cajeroNombre}
        caja={cajaId}
        turno={turnoId}
        clienteNombre={clienteNombre}
        tieneCliente={selectedCliente !== null}
        onChangeTipoDocumento={handleChangeTipoNCF}
      />

      <div className="px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SearchBar onProductSelect={handleProductSelect} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Cant:</span>
            <input
              type="number"
              min="1"
              value={qtyToAdd}
              onChange={(e) => setQtyToAdd(parseInt(e.target.value) || 1)}
              className="w-16 text-center px-1 py-1 border border-border rounded text-lg font-bold bg-background focus:ring-2 focus:ring-primary focus:outline-none"
            />
            <button
              onClick={() => setShowEmpaqueModal(true)}
              id="pos-btn-empaque"
              title="F8 — Seleccionar tipo de empaque"
              className={`px-3 py-2 rounded text-sm font-medium transition-all h-[38px] flex items-center justify-center gap-1.5 border ${
                selectedEmpaque && selectedEmpaque.cantidad > 1
                  ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100 shadow-sm'
                  : 'bg-secondary text-secondary-foreground border-border hover:opacity-90'
              }`}
            >
              <span className="text-xs font-semibold">
                {selectedEmpaque ? selectedEmpaque.nombre : 'Unidad'}
              </span>
              {selectedEmpaque && selectedEmpaque.cantidad > 1 && (
                <span className="text-[11px] font-mono font-bold bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded">
                  ×{selectedEmpaque.cantidad}
                </span>
              )}
            </button>

            {selectedEmpaque && selectedEmpaque.cantidad > 1 && (
              <span className="text-xs font-bold text-amber-800 bg-amber-100/90 border border-amber-300/80 px-2.5 py-1 rounded-md shadow-xs flex items-center gap-1">
                = {qtyToAdd * selectedEmpaque.cantidad} uds.
              </span>
            )}

            <button className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:opacity-90 transition-opacity h-[38px] flex items-center justify-center">
              Agregar
            </button>
          </div>
        </div>
      </div>

      {/* Área central: tabla + panel de resumen con la misma altura */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <CartTable
            items={cart}
            selectedRowIndex={selectedRowIndex}
            onSelectRow={setSelectedRowIndex}
            onUpdateQty={handleUpdateQty}
            onUpdateDiscount={handleUpdateDiscount}
            onRemoveItem={handleRemoveItem}
          />
        </div>

        <SaleSummaryPanel
          totalItems={getTotalItems()}
          clienteNombre={clienteNombre}
          tieneClienteSeleccionado={selectedCliente !== null}
          descuentoClientePredeterminado={selectedCliente?.descuentoPredeterminado ?? 0}
          onAbrirSelectorCliente={() => setShowClienteSelector(true)}
          ncfTipo={tipoNCF.codigo}
          tipoNCF={tipoNCF.nombre}
          descuentoGlobal={descuentoGlobal}
          tipoDescuentoGlobal={tipoDescuentoGlobal}
          onDescuentoGlobalChange={setDescuentoGlobal}
          onTipoDescuentoGlobalChange={setTipoDescuentoGlobal}
          descuentoGlobalMonto={calculateDescuentoGlobalMonto()}
          descuentoAutomatico={0}
          descuentoLinea={calculateDescuentoLinea()}
          totalAhorrado={getTotalAhorrado()}
          subtotal={null}
          itbis={null}
          total={calculateTotalPagar()}
        />
      </div>

      <ActionBar
        onCancel={handleCancel}
        onHold={handleHold}
        onHoldList={handleHoldList}
        onCheckout={handleCheckout}
        disabled={cart.length === 0}
        holdCount={holdList.length}
      />

      {/* Modal: Lista de Espera */}
      {showHoldList && (
        <HoldListModal
          holdList={holdList}
          onResume={handleResumeHeld}
          onDelete={handleDeleteHeld}
          onClose={() => setShowHoldList(false)}
        />
      )}

      {/* Modal: Selector NCF */}
      {showNCFSelector && (
        <NCFSelectorModal
          tiposNCF={tiposNCF}
          currentIndex={tipoNCFIndex}
          onSelect={setTipoNCFIndex}
          onClose={() => setShowNCFSelector(false)}
        />
      )}

      {/* Modal: Selector de Cliente */}
      {showClienteSelector && (
        <ClienteSelectorModal
          onSelect={handleClienteSelect}
          onClose={() => setShowClienteSelector(false)}
        />
      )}

      {/* Modal: Checkout / Cobro */}
      {showCheckout && activeTurno && (
        <CheckoutModal
          cart={cart}
          idTurnoCaja={activeTurno.idTurnoCaja}
          idCliente={selectedCliente?.idCliente ?? null}
          nombreClienteTemporal={clienteNombre !== 'Consumidor Final' ? clienteNombre : ''}
          rncTemporal={selectedCliente?.rncCedula ?? ''}
          tipoNcf={tipoNCF.codigo}
          descuentoGlobal={calculateDescuentoGlobalMonto()}
          onClose={() => setShowCheckout(false)}
          onVentaCompletada={handleVentaCompletada}
        />
      )}


      {/* Modal: Selector de Empaque */}
      {showEmpaqueModal && (
        <EmpaqueModal
          selectedId={selectedEmpaque?.idEmpaque ?? null}
          onSelect={(empaque) => {
            if (empaque.cantidad === 1) {
              setSelectedEmpaque(null);
            } else {
              setSelectedEmpaque(empaque);
            }
          }}
          onClose={() => setShowEmpaqueModal(false)}
        />
      )}


    </div>
  );
}
