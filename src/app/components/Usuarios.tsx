import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, Plus, Search, Edit2, UserX, UserCheck,
  Shield, KeyRound, Loader2, X, Save, AlertCircle, RefreshCw
} from 'lucide-react';
import { usuariosApi, rolesApi, permisosApi, Usuario, Rol, Permiso } from '../../imports/api';

const formatDateTime = (s: string) =>
  new Date(s).toLocaleString('es-DO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('TODOS');
  const [filterRol, setFilterRol] = useState('TODOS');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resettingUsuario, setResettingUsuario] = useState<Usuario | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [resUsuarios, resRoles, resPermisos] = await Promise.all([
        usuariosApi.listar(0, 100),
        rolesApi.listarTodos(),
        permisosApi.listar()
      ]);
      setUsuarios(resUsuarios.content);
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

  const handleDesactivar = async (id: number) => {
    if (!confirm('¿Estás seguro de desactivar este usuario? No podrá iniciar sesión.')) return;
    try {
      await usuariosApi.desactivar(id);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error al desactivar usuario');
    }
  };

  const filtered = usuarios.filter((u) => {
    const term = searchTerm.toLowerCase();
    const matchSearch = u.username.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
    const matchEstado = filterEstado === 'TODOS' || u.estado === filterEstado;
    const matchRol = filterRol === 'TODOS' || u.roles.includes(filterRol);
    return matchSearch && matchEstado && matchRol;
  });

  const totales = {
    activos: usuarios.filter(u => u.estado === 'ACTIVO').length,
    inactivos: usuarios.filter(u => u.estado === 'INACTIVO').length,
    suspendidos: usuarios.filter(u => u.estado === 'SUSPENDIDO').length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión de acceso, credenciales y roles del personal.
          </p>
        </div>
        <button
          onClick={() => { setEditingUsuario(null); setIsModalOpen(true); }}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/90 transition-all shadow-sm active:scale-95"
        >
          <Plus size={18} />
          Nuevo Usuario
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-background border border-border p-4 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
            <Users size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Usuarios</p>
            <p className="text-2xl font-bold">{usuarios.length}</p>
          </div>
        </div>
        <div className="bg-background border border-border p-4 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
            <UserCheck size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Activos</p>
            <p className="text-2xl font-bold">{totales.activos}</p>
          </div>
        </div>
        <div className="bg-background border border-border p-4 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-100 text-rose-600 rounded-xl">
            <UserX size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Inactivos</p>
            <p className="text-2xl font-bold">{totales.inactivos}</p>
          </div>
        </div>
        <div className="bg-background border border-border p-4 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
            <Shield size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Suspendidos</p>
            <p className="text-2xl font-bold">{totales.suspendidos}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-background border border-border p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por usuario o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-xl bg-background text-sm focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={filterRol}
            onChange={(e) => setFilterRol(e.target.value)}
            className="px-3 py-2 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-auto"
          >
            <option value="TODOS">Todos los Roles</option>
            {roles.map(r => (
              <option key={r.idRol} value={r.nombre}>{r.nombre}</option>
            ))}
          </select>
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="px-3 py-2 border border-border rounded-xl bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-auto"
          >
            <option value="TODOS">Todos los Estados</option>
            <option value="ACTIVO">Activos</option>
            <option value="INACTIVO">Inactivos</option>
            <option value="SUSPENDIDO">Suspendidos</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-background border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
              <tr>
                <th className="px-6 py-4 font-semibold">Usuario</th>
                <th className="px-6 py-4 font-semibold">Roles</th>
                <th className="px-6 py-4 font-semibold">Estado</th>
                <th className="px-6 py-4 font-semibold">Última Mod.</th>
                <th className="px-6 py-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                    Cargando usuarios...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    No se encontraron usuarios.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.idUsuario} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{u.username}</div>
                      <div className="text-muted-foreground text-xs">{u.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map(rol => (
                          <span key={rol} className="px-2 py-1 text-[10px] font-medium bg-secondary text-secondary-foreground rounded-md">
                            {rol}
                          </span>
                        ))}
                        {u.permisoExtraIds.length > 0 && (
                          <span className="px-2 py-1 text-[10px] font-medium bg-blue-100 text-blue-700 border border-blue-200 rounded-md">
                            + Permisos Extra
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                        u.estado === 'ACTIVO' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                        u.estado === 'SUSPENDIDO' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                        'bg-rose-100 text-rose-700 border-rose-200'
                      }`}>
                        {u.estado}
                      </span>
                      {u.requiereCambioPassword && (
                        <div className="mt-1 text-[10px] text-amber-600 flex items-center gap-1">
                          <AlertCircle size={10} /> Requiere cambio de pwd
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {formatDateTime(u.fechaModificacion)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setResettingUsuario(u); setIsResetModalOpen(true); }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Resetear Contraseña"
                        >
                          <KeyRound size={16} />
                        </button>
                        <button
                          onClick={() => { setEditingUsuario(u); setIsModalOpen(true); }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDesactivar(u.idUsuario)}
                          disabled={u.estado === 'INACTIVO'}
                          className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-30"
                          title="Desactivar"
                        >
                          <UserX size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <UsuarioModal
          usuario={editingUsuario}
          roles={roles}
          permisosCatalog={permisos}
          onClose={() => setIsModalOpen(false)}
          onSaved={() => { setIsModalOpen(false); fetchData(); }}
        />
      )}

      {isResetModalOpen && resettingUsuario && (
        <ResetPasswordModal
          usuario={resettingUsuario}
          onClose={() => setIsResetModalOpen(false)}
          onSaved={() => { setIsResetModalOpen(false); fetchData(); }}
        />
      )}
    </div>
  );
}

// ── Modal de creación / edición de Usuario ──────────────────────────
function UsuarioModal({
  usuario,
  roles,
  permisosCatalog,
  onClose,
  onSaved,
}: {
  usuario: Usuario | null;
  roles: Rol[];
  permisosCatalog: Permiso[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = usuario !== null;
  const [form, setForm] = useState({
    username: usuario?.username || '',
    email: usuario?.email || '',
    password: '',
    estado: usuario?.estado || 'ACTIVO',
  });

  // All selected permission IDs — fully editable regardless of source
  const [selectedPermisoIds, setSelectedPermisoIds] = useState<number[]>([]);

  // Initialize permissions once when modal opens
  const initializedRef = useRef(false);
  useEffect(() => {
    if (roles.length > 0 && !initializedRef.current) {
      initializedRef.current = true;
      if (usuario) {
        // Edit mode: combine role permissions + extra permissions
        const rolePerms = roles
          .filter(r => usuario.rolIds.includes(r.idRol))
          .flatMap(r => r.permisos.map(p => p.idPermiso));
        const allPerms = new Set([...rolePerms, ...usuario.permisoExtraIds]);
        setSelectedPermisoIds(Array.from(allPerms));
      }
    }
  }, [usuario, roles]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Group permissions by module
  const permisosByModulo = permisosCatalog.reduce((acc, p) => {
    if (!acc[p.modulo]) acc[p.modulo] = [];
    acc[p.modulo].push(p);
    return acc;
  }, {} as Record<string, Permiso[]>);

  // Detect if current selection matches exactly a role
  const matchedRole = roles.find(r => {
    const rolePermsSet = new Set(r.permisos.map(p => p.idPermiso));
    if (rolePermsSet.size !== selectedPermisoIds.length) return false;
    return selectedPermisoIds.every(id => rolePermsSet.has(id));
  });

  // Determine dropdown value
  const selectValue = matchedRole
    ? String(matchedRole.idRol)
    : selectedPermisoIds.length === 0
      ? "0"
      : "CUSTOM";

  const handleRoleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const roleId = Number(e.target.value);
    if (roleId === 0) {
      setSelectedPermisoIds([]);
      return;
    }
    const role = roles.find(r => r.idRol === roleId);
    if (role) {
      setSelectedPermisoIds(role.permisos.map(p => p.idPermiso));
    }
  };

  const togglePermiso = (id: number) => {
    setSelectedPermisoIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isEdit && !form.password) {
      setError('La contraseña es obligatoria para nuevos usuarios.');
      return;
    }

    setSaving(true);
    try {
      // If permissions match a role exactly, assign that role with no extras.
      // Otherwise, send all selected as permisoExtraIds with no role.
      const body = {
        username: form.username,
        email: form.email,
        password: form.password || undefined,
        estado: form.estado,
        rolIds: matchedRole ? [matchedRole.idRol] : [] as number[],
        permisoExtraIds: matchedRole ? [] as number[] : selectedPermisoIds,
      };

      if (isEdit) {
        await usuariosApi.actualizar(usuario.idUsuario, body);
      } else {
        await usuariosApi.crear(body as any);
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}>
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-4xl mx-auto overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <Users size={18} className="text-blue-500" />
            <h2 className="text-base font-semibold">{isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={15} /></button>
        </div>

        <form id="usuario-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column 1: Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b pb-2">Información Básica</h3>
              <div>
                <label className="block text-xs font-semibold uppercase mb-1.5">Username <span className="text-destructive">*</span></label>
                <input required value={form.username} onChange={e => setForm({...form, username: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary" placeholder="Ej. jrodriguez" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase mb-1.5">Email <span className="text-destructive">*</span></label>
                <input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary" placeholder="usuario@maxli.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase mb-1.5">Contraseña {isEdit ? '(opcional)' : <span className="text-destructive">*</span>}</label>
                <input type="password" autoComplete="new-password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary" placeholder={isEdit ? "Dejar en blanco para mantener actual" : "Asignar contraseña inicial"} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase mb-1.5">Estado</label>
                <select value={form.estado} onChange={e => setForm({...form, estado: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary">
                  <option value="ACTIVO">Activo</option>
                  <option value="INACTIVO">Inactivo</option>
                  <option value="SUSPENDIDO">Suspendido</option>
                </select>
              </div>

              <h3 className="text-sm font-semibold text-foreground border-b pb-2 pt-4">Asignación de Rol</h3>
              <div>
                <label className="block text-xs font-semibold uppercase mb-1.5">Rol Base</label>
                <select value={selectValue} onChange={handleRoleSelectChange} className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary">
                  <option value="0">Sin rol (permisos manuales)</option>
                  {roles.map(r => <option key={r.idRol} value={r.idRol}>{r.nombre}</option>)}
                  {selectValue === "CUSTOM" && <option value="CUSTOM" disabled>Personalizado (permisos editados)</option>}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectValue === "CUSTOM"
                    ? 'Los permisos fueron modificados manualmente. Se guardarán como permisos individuales.'
                    : 'Seleccionar un rol carga sus permisos. Puede editarlos libremente a la derecha.'}
                </p>
              </div>
            </div>

            {/* Column 2: Permissions Grid */}
            <div>
              <h3 className="text-sm font-semibold text-foreground border-b pb-2 mb-4">Permisos Granulares</h3>
              <div className="space-y-4">
                {selectValue === "CUSTOM" && (
                  <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                    <AlertCircle size={12} className="shrink-0" />
                    Modo personalizado — los permisos se guardarán individualmente sin rol asignado.
                  </div>
                )}
                {Object.entries(permisosByModulo).map(([modulo, perms]) => (
                  <div key={modulo} className="bg-muted/20 border border-border rounded-xl overflow-hidden">
                    <div className="bg-muted/40 px-3 py-2 font-medium text-sm text-foreground border-b border-border">
                      {modulo}
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
                ))}
              </div>
            </div>
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-xl transition-colors">Cancelar</button>
          <button type="submit" form="usuario-form" disabled={saving} className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Guardando...' : 'Guardar Usuario'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal de Reset Password ──────────────────────────────
function ResetPasswordModal({ usuario, onClose, onSaved }: { usuario: Usuario; onClose: () => void; onSaved: () => void }) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await usuariosApi.resetearPassword(usuario.idUsuario, password);
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Error al resetear la contraseña');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}>
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border bg-muted/30">
          <RefreshCw size={18} className="text-blue-500" />
          <h2 className="text-base font-semibold">Resetear Contraseña</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Se forzará a <strong>{usuario.username}</strong> a cambiar esta contraseña en su próximo inicio de sesión.
          </p>
          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">{error}</div>}
          <div>
            <label className="block text-xs font-semibold uppercase mb-1.5">Nueva Contraseña Temporal <span className="text-destructive">*</span></label>
            <input required type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary" placeholder="Min. 8 caracteres" />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-xl transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
