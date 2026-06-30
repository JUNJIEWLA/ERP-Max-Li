import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Plus, Edit2, Trash2, CheckCircle2, X, Save, Loader2
} from 'lucide-react';
import { rolesApi, permisosApi, Rol, Permiso } from '../../imports/api';

export default function Roles() {
  const [roles, setRoles] = useState<Rol[]>([]);
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRol, setEditingRol] = useState<Rol | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [resRoles, resPermisos] = await Promise.all([
        rolesApi.listarTodos(),
        permisosApi.listar()
      ]);
      setRoles(resRoles);
      setPermisos(resPermisos);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEliminar = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este rol? Se removerá de todos los usuarios asignados.')) return;
    try {
      await rolesApi.eliminar(id);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar rol');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Roles del Sistema</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión de plantillas de permisos (Roles) para asignar a los usuarios.
          </p>
        </div>
        <button
          onClick={() => { setEditingRol(null); setIsModalOpen(true); }}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-all shadow-sm active:scale-95"
        >
          <Plus size={18} />
          Nuevo Rol
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 py-12 text-center text-muted-foreground">
            <Loader2 className="animate-spin mx-auto mb-2" size={24} />
            Cargando roles...
          </div>
        ) : roles.length === 0 ? (
          <div className="col-span-2 py-12 text-center text-muted-foreground border border-border rounded-2xl bg-background">
            No se encontraron roles.
          </div>
        ) : (
          roles.map(rol => (
            <div key={rol.idRol} className="bg-background border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative group">
              <div className="absolute top-4 right-4 flex opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => { setEditingRol(rol); setIsModalOpen(true); }}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                  title="Editar"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleEliminar(rol.idRol)}
                  className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg"
                  title="Eliminar"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                  <Shield size={20} />
                </div>
                <h3 className="font-semibold text-foreground text-lg">{rol.nombre}</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4 min-h-[40px] pr-8">
                {rol.descripcion || 'Sin descripción'}
              </p>
              <div className="border-t border-border pt-4 flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{rol.permisos?.length || 0} Permisos asignados</span>
                <div className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 size={14} /> Activo
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <RolModal
          rol={editingRol}
          permisosCatalog={permisos}
          onClose={() => setIsModalOpen(false)}
          onSaved={() => { setIsModalOpen(false); fetchData(); }}
        />
      )}
    </div>
  );
}

function RolModal({
  rol,
  permisosCatalog,
  onClose,
  onSaved,
}: {
  rol: Rol | null;
  permisosCatalog: Permiso[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = rol !== null;
  const [form, setForm] = useState({
    nombre: rol?.nombre || '',
    descripcion: rol?.descripcion || '',
  });

  const [selectedPermisoIds, setSelectedPermisoIds] = useState<number[]>(
    rol ? rol.permisos.map(p => p.idPermiso) : []
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const permisosByModulo = permisosCatalog.reduce((acc, p) => {
    if (!acc[p.modulo]) acc[p.modulo] = [];
    acc[p.modulo].push(p);
    return acc;
  }, {} as Record<string, Permiso[]>);

  const togglePermiso = (id: number) => {
    setSelectedPermisoIds(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSelectAllInModulo = (moduloPerms: Permiso[]) => {
    const ids = moduloPerms.map(p => p.idPermiso);
    const allSelected = ids.every(id => selectedPermisoIds.includes(id));
    if (allSelected) {
      setSelectedPermisoIds(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setSelectedPermisoIds(prev => Array.from(new Set([...prev, ...ids])));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const body = {
        nombre: form.nombre,
        descripcion: form.descripcion,
        permisoIds: selectedPermisoIds,
      };

      if (isEdit) {
        await rolesApi.actualizar(rol.idRol, body);
      } else {
        await rolesApi.crear(body);
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el rol.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}>
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-3xl mx-auto overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <Shield size={18} className="text-blue-500" />
            <h2 className="text-base font-semibold">{isEdit ? 'Editar Rol' : 'Nuevo Rol'}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={15} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">{error}</div>}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase mb-1.5">Nombre del Rol <span className="text-destructive">*</span></label>
              <input required value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary uppercase" placeholder="Ej. GERENTE" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase mb-1.5">Descripción</label>
              <textarea value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary min-h-[60px]" placeholder="Breve descripción de las responsabilidades del rol" />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground border-b pb-2 mb-4">Permisos Asignados</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(permisosByModulo).map(([modulo, perms]) => {
                const isAllSelected = perms.every(p => selectedPermisoIds.includes(p.idPermiso));
                return (
                  <div key={modulo} className="bg-muted/20 border border-border rounded-xl overflow-hidden">
                    <div className="bg-muted/40 px-3 py-2 flex items-center justify-between border-b border-border">
                      <span className="font-medium text-sm text-foreground">{modulo}</span>
                      <button type="button" onClick={() => handleSelectAllInModulo(perms)} className="text-[10px] uppercase font-bold text-blue-600 hover:text-blue-800">
                        {isAllSelected ? 'Desmarcar Todos' : 'Marcar Todos'}
                      </button>
                    </div>
                    <div className="p-3 grid grid-cols-1 gap-2">
                      {perms.map(p => (
                        <label key={p.idPermiso} className="flex items-start gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={selectedPermisoIds.includes(p.idPermiso)}
                            onChange={() => togglePermiso(p.idPermiso)}
                            className="mt-1 rounded text-primary focus:ring-primary border-border"
                          />
                          <div>
                            <span className="text-sm font-medium text-foreground block group-hover:text-primary transition-colors">{p.nombreClave}</span>
                            <span className="text-xs text-muted-foreground block">{p.descripcion}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-xl transition-colors">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Guardando...' : 'Guardar Rol'}
          </button>
        </div>
      </div>
    </div>
  );
}
