import { useState, useEffect } from 'react';
import POSHeader from './POSHeader';
import SearchBar from './SearchBar';
import CartTable from './CartTable';
import { CartItem } from './CartRow';
import SaleFooter from './SaleFooter';
import ActionBar from './ActionBar';

interface HeldSale {
  id: number;
  items: CartItem[];
  total: number;
  timestamp: Date;
}

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
  const [tipoNCFIndex, setTipoNCFIndex] = useState(0);

  const cajeroNombre = 'Juan P.';
  const cajaId = 'CAJA-01';
  const turnoId = 'T-2026042';
  const clienteNombre = 'Cliente General';
  const ncf = 'B01-00000042';
  const tipoNCF = tiposNCF[tipoNCFIndex];

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + item.importe, 0);
  };

  const calculateDescuentoLinea = () => {
    return cart.reduce((sum, item) => {
      const descuento = (item.precioUnitario * item.cantidad * item.descuentoLinea) / 100;
      return sum + descuento;
    }, 0);
  };

  const calculateITBIS = () => {
    const subtotalConDescuento = calculateSubtotal() - calculateDescuentoLinea() - descuentoGlobal;
    return subtotalConDescuento * 0.18;
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const descuentoTotal = calculateDescuentoLinea() + descuentoGlobal;
    const subtotalConDescuento = subtotal - descuentoTotal;
    const itbis = subtotalConDescuento * 0.18;
    return subtotalConDescuento + itbis;
  };

  const getTotalItems = () => {
    return cart.reduce((sum, item) => sum + item.cantidad, 0);
  };

  const getTotalAhorrado = () => {
    return calculateDescuentoLinea() + descuentoGlobal;
  };

  const handleProductSelect = (product: any) => {
    const existingIndex = cart.findIndex((item) => item.codigo === product.codigo);

    if (existingIndex >= 0) {
      const updatedCart = [...cart];
      updatedCart[existingIndex].cantidad += qtyToAdd;
      const descuento = (updatedCart[existingIndex].precioUnitario * updatedCart[existingIndex].cantidad * updatedCart[existingIndex].descuentoLinea) / 100;
      updatedCart[existingIndex].importe = (updatedCart[existingIndex].cantidad * updatedCart[existingIndex].precioUnitario) - descuento;
      setCart(updatedCart);
    } else {
      const newItem: CartItem = {
        id: nextId,
        codigo: product.codigo,
        descripcion: product.nombre,
        precioUnitario: product.precio,
        cantidad: qtyToAdd,
        descuentoLinea: 0,
        unidad: product.unidad,
        importe: product.precio * qtyToAdd,
      };
      setCart([...cart, newItem]);
      setNextId(nextId + 1);
    }

    setQtyToAdd(1);
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
    }
  };

  const handleHold = () => {
    if (cart.length === 0) return;
    const newHeldSale: HeldSale = {
      id: Date.now(),
      items: [...cart],
      total: calculateTotal(),
      timestamp: new Date(),
    };
    setHoldList([...holdList, newHeldSale]);
    setCart([]);
    setSelectedRowIndex(-1);
    alert('Venta guardada en espera');
  };

  const handleHoldList = () => {
    if (holdList.length === 0) {
      alert('No hay ventas en espera');
      return;
    }
    alert(`Hay ${holdList.length} venta(s) en espera. (Funcionalidad de lista en desarrollo)`);
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    alert(`Procesando cobro de RD$${calculateTotal().toFixed(2)}\n\nItems: ${getTotalItems()}\n(Ir a pantalla de pago)`);
  };

  const handleChangeTipoNCF = () => {
    setTipoNCFIndex((prev) => (prev + 1) % tiposNCF.length);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'F3':
          e.preventDefault();
          alert('Seleccionar cliente (F3)');
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
          alert('Función Pesar (F8)');
          break;
        case 'Escape':
          e.preventDefault();
          handleCheckout();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, holdList, tipoNCFIndex]);

  return (
    <div className="h-full flex flex-col bg-background">
      <POSHeader
        ncf={ncf}
        tipoDocumento={tipoNCF.nombre}
        cajero={cajeroNombre}
        caja={cajaId}
        turno={turnoId}
        onChangeTipoDocumento={handleChangeTipoNCF}
      />

      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <SearchBar onProductSelect={handleProductSelect} />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              value={qtyToAdd}
              onChange={(e) => setQtyToAdd(parseInt(e.target.value) || 1)}
              className="w-20 text-center px-3 py-3 border border-border rounded-lg"
            />
            <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2">
              Agregar
            </button>
            <button className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 transition-opacity">
              Pesar
            </button>
            <button className="px-4 py-3 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 transition-opacity">
              F8
            </button>
          </div>
        </div>
      </div>

      <CartTable
        items={cart}
        selectedRowIndex={selectedRowIndex}
        onSelectRow={setSelectedRowIndex}
        onUpdateQty={handleUpdateQty}
        onUpdateDiscount={handleUpdateDiscount}
        onRemoveItem={handleRemoveItem}
      />

      <SaleFooter
        totalItems={getTotalItems()}
        clienteNombre={clienteNombre}
        ncfTipo={tipoNCF.codigo}
        tipoNCF={tipoNCF.nombre}
        descuentoGlobal={descuentoGlobal}
        onDescuentoGlobalChange={setDescuentoGlobal}
        descuentoAutomatico={0}
        descuentoLinea={calculateDescuentoLinea()}
        totalAhorrado={getTotalAhorrado()}
        subtotal={calculateSubtotal() - calculateDescuentoLinea() - descuentoGlobal}
        itbis={calculateITBIS()}
        total={calculateTotal()}
      />

      <ActionBar
        onCancel={handleCancel}
        onHold={handleHold}
        onHoldList={handleHoldList}
        onCheckout={handleCheckout}
        disabled={cart.length === 0}
      />
    </div>
  );
}
