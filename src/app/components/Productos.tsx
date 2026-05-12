import { Plus, Filter, Search, Eye, Edit, Trash2, Package } from 'lucide-react';

const productosData = [
  {
    codigo: 'PROD-001',
    nombre: 'Laptop Dell Inspiron 15',
    categoria: 'Electrónica',
    marca: 'Dell',
    stock: 25,
    minimo: 10,
    precioVenta: 'RD$ 32,500.00',
    costo: 'RD$ 24,000.00',
    estado: 'Activo'
  },
  {
    codigo: 'PROD-002',
    nombre: 'Samsung Galaxy S24',
    categoria: 'Electrónica',
    marca: 'Samsung',
    stock: 15,
    minimo: 5,
    precioVenta: 'RD$ 45,000.00',
    costo: 'RD$ 35,000.00',
    estado: 'Activo'
  },
  {
    codigo: 'PROD-003',
    nombre: 'Camisa Polo Hombre',
    categoria: 'Ropa',
    marca: 'Lacoste',
    stock: 8,
    minimo: 15,
    precioVenta: 'RD$ 2,500.00',
    costo: 'RD$ 1,200.00',
    estado: 'Bajo Stock'
  },
  {
    codigo: 'PROD-004',
    nombre: 'Zapatillas Nike Air Max',
    categoria: 'Deportes',
    marca: 'Nike',
    stock: 42,
    minimo: 20,
    precioVenta: 'RD$ 8,500.00',
    costo: 'RD$ 5,000.00',
    estado: 'Activo'
  },
  {
    codigo: 'PROD-005',
    nombre: 'Cafetera Espresso',
    categoria: 'Hogar',
    marca: 'Oster',
    stock: 18,
    minimo: 10,
    precioVenta: 'RD$ 6,200.00',
    costo: 'RD$ 3,800.00',
    estado: 'Activo'
  },
];

export default function Productos() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2>Catálogo de Productos</h2>
          <p className="text-muted-foreground mt-1">Gestiona tu inventario de productos</p>
        </div>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity">
          <Plus size={20} />
          Nuevo Producto
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Total Productos</p>
              <p className="text-2xl mt-1">2,543</p>
            </div>
            <div className="w-12 h-12 bg-chart-1 rounded-lg flex items-center justify-center text-white">
              <Package size={24} />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Bajo Stock</p>
              <p className="text-2xl mt-1 text-yellow-600">23</p>
            </div>
            <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center text-white">
              <Package size={24} />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Sin Stock</p>
              <p className="text-2xl mt-1 text-red-600">5</p>
            </div>
            <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center text-white">
              <Package size={24} />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Categorías</p>
              <p className="text-2xl mt-1">12</p>
            </div>
            <div className="w-12 h-12 bg-chart-3 rounded-lg flex items-center justify-center text-white">
              <Package size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <input
                type="text"
                placeholder="Buscar producto..."
                className="w-80 pl-10 pr-4 py-2 bg-input-background border border-border rounded-lg"
              />
            </div>

            <select className="px-3 py-2 bg-input-background border border-border rounded-lg">
              <option>Todas las categorías</option>
              <option>Electrónica</option>
              <option>Ropa</option>
              <option>Hogar</option>
              <option>Deportes</option>
            </select>

            <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg flex items-center gap-2">
              <Filter size={18} />
              Filtros
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-muted-foreground">Código</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Nombre</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Categoría</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Marca</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Stock</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Precio Venta</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Estado</th>
                <th className="text-left py-3 px-4 text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productosData.map((producto) => (
                <tr key={producto.codigo} className="border-b border-border hover:bg-accent transition-colors">
                  <td className="py-3 px-4">{producto.codigo}</td>
                  <td className="py-3 px-4">{producto.nombre}</td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">{producto.categoria}</td>
                  <td className="py-3 px-4 text-sm">{producto.marca}</td>
                  <td className="py-3 px-4">
                    <span className={producto.stock < producto.minimo ? 'text-red-600' : ''}>
                      {producto.stock} / {producto.minimo}
                    </span>
                  </td>
                  <td className="py-3 px-4">{producto.precioVenta}</td>
                  <td className="py-3 px-4">
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      producto.estado === 'Activo'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {producto.estado}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <button className="p-1 hover:bg-accent rounded" title="Ver">
                        <Eye size={18} className="text-muted-foreground" />
                      </button>
                      <button className="p-1 hover:bg-accent rounded" title="Editar">
                        <Edit size={18} className="text-muted-foreground" />
                      </button>
                      <button className="p-1 hover:bg-accent rounded" title="Eliminar">
                        <Trash2 size={18} className="text-destructive" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
