import { useState, useEffect, useCallback } from 'react';
import {
  X, Package, Plus, Edit2, Trash2, Check, Loader2,
  ChevronRight, ToggleLeft, ToggleRight, AlertCircle
} from 'lucide-react';
import { empaquesApi, Empaque } from '../../../imports/api';

interface EmpaqueModalProps {
  /** Empaque actualmente seleccionado (id). null = Unidad por defecto. */
  selectedId: number | null;
  onSelect: (empaque: Empaque) => void;
  onClose: () => void;
  /** Roles del usuario en sesión, provistos por App desde /auth/me. */
  userRoles: string[];
}

type Mode = 'select' | 'crud';

interface FormState {
  nombre: string;
  cantidad: string;
  descripcion: string;
  estado: string;
}

const EMPTY_FORM: FormState = { nombre: '', cantidad: '1', descripcion: '', estado: 'ACTIVO' };

// Muestra u oculta el CRUD según el rol. Los roles ya no se leen de
// localStorage —la sesión vive en una cookie HttpOnly—, así que llegan por
// props desde App, que los obtiene de /auth/me. Esto es solo presentación:
// quien decide de verdad es la matriz de permisos del backend.
function esSupervisorOAdmin(roles: string[]): boolean {
  return roles.some((rol) => {
    const normalizado = rol.toUpperCase();
    return normalizado.includes('ADMIN') || normalizado.includes('SUPERVISOR');
  });
}

export default function EmpaqueModal({ selectedId, onSelect, onClose, userRoles }: EmpaqueModalProps) {
  const [mode, setMode] = useState<Mode>('select');
  const [empaques, setEmpaques] = useState<Empaque[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const canManage = esSupervisorOAdmin(userRoles);

  // Form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadEmpaques = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = mode === 'crud'
        ? await empaquesApi.listar()
        : await empaquesApi.listarActivos();
      setEmpaques(data);
    } catch {
      setError('Error al cargar empaques.');
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => { loadEmpaques(); }, [loadEmpaques]);

  // ── Handlers CRUD ────────────────────────────────────────

  const startCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
  };

  const startEdit = (e: Empaque) => {
    setEditingId(e.idEmpaque);
    setForm({
      nombre: e.nombre,
      cantidad: String(e.cantidad),
      descripcion: e.descripcion ?? '',
      estado: e.estado,
    });
    setFormError('');
  };

  const cancelForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
  };

  const handleSave = async () => {
    const nombre = form.nombre.trim();
    const cantidad = parseInt(form.cantidad);
    if (!nombre) { setFormError('El nombre es obligatorio.'); return; }
    if (!cantidad || cantidad < 1) { setFormError('La cantidad debe ser al menos 1.'); return; }

    setSaving(true);
    setFormError('');
    try {
      const body = { nombre, cantidad, descripcion: form.descripcion || undefined, estado: form.estado };
      if (editingId !== null) {
        await empaquesApi.actualizar(editingId, body);
      } else {
        await empaquesApi.crear(body);
      }
      cancelForm();
      await loadEmpaques();
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar el empaque.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await empaquesApi.eliminar(id);
      await loadEmpaques();
    } catch (err: any) {
      setError(err.message || 'Error al desactivar el empaque.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleEstado = async (e: Empaque) => {
    setSaving(true);
    try {
      await empaquesApi.actualizar(e.idEmpaque, {
        nombre: e.nombre,
        cantidad: e.cantidad,
        descripcion: e.descripcion ?? undefined,
        estado: e.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO',
      });
      await loadEmpaques();
    } catch (err: any) {
      setError(err.message || 'Error al cambiar estado.');
    } finally {
      setSaving(false);
    }
  };

  // Colors per quantity band
  const badgeColor = (qty: number) => {
    if (qty === 1) return 'bg-gray-100 text-gray-700 border-gray-200';
    if (qty <= 6) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (qty <= 12) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (qty <= 48) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-purple-50 text-purple-700 border-purple-200';
  };

  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Set initial highlighted index to currently selected empaque if any
  useEffect(() => {
    if (empaques.length > 0 && selectedId !== null) {
      const idx = empaques.findIndex(e => e.idEmpaque === selectedId);
      if (idx >= 0) setHighlightedIndex(idx);
    }
  }, [empaques, selectedId]);

  // Manejo de teclado para selector de empaques (Grid 2 columnas: ← ↑ → ↓ + Enter + Escape)
  useEffect(() => {
    if (mode !== 'select' || loading || empaques.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, empaques.length - 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 2, empaques.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 2, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (empaques[highlightedIndex]) {
          onSelect(empaques[highlightedIndex]);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, loading, empaques, highlightedIndex, onSelect, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col" style={{ maxHeight: '88vh' }}>

        {/* ── Header ────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <Package size={18} className="text-amber-500" />
            <div>
              <h2 className="text-base font-semibold leading-none">Cantidad de Empaque</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {mode === 'select' ? 'Navega con ← ↑ → ↓ y presiona Enter' : 'Gestionar empaques'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canManage && (
              <button
                onClick={() => { setMode(mode === 'select' ? 'crud' : 'select'); cancelForm(); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  mode === 'crud'
                    ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20'
                    : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/70'
                }`}
              >
                {mode === 'crud' ? '← Selector' : 'Gestionar'}
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* Error global */}
          {error && (
            <div className="mx-4 mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-2 text-xs text-destructive">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 size={22} className="animate-spin" />
              <p className="text-sm">Cargando empaques...</p>
            </div>
          )}

          {/* ══════════ MODO SELECTOR ══════════ */}
          {!loading && mode === 'select' && (
            <div className="p-3 grid grid-cols-2 gap-2.5">
              {empaques.length === 0 && (
                <div className="col-span-2 py-8 text-center text-muted-foreground text-sm">
                  No hay empaques activos configurados.
                </div>
              )}
              {empaques.map((e, index) => {
                const isSelected = e.idEmpaque === selectedId;
                const isHighlighted = index === highlightedIndex;
                return (
                  <button
                    key={e.idEmpaque}
                    id={`empaque-btn-${e.idEmpaque}`}
                    onClick={() => { onSelect(e); onClose(); }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-4 transition-all cursor-pointer ${
                      isHighlighted
                        ? 'border-amber-500 bg-amber-100/70 shadow-lg ring-4 ring-amber-400/50 scale-[1.02]'
                        : isSelected
                        ? 'border-amber-400 bg-amber-50/60 shadow-md'
                        : 'border-border bg-card hover:border-amber-300 hover:bg-amber-50/30'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-2 right-2 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center">
                        <Check size={11} className="text-white" />
                      </span>
                    )}
                    <span className={`text-3xl font-bold ${isSelected ? 'text-amber-600' : 'text-foreground'}`}>
                      {e.cantidad}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${badgeColor(e.cantidad)}`}>
                      {e.nombre}
                    </span>
                    {e.descripcion && (
                      <span className="text-[10px] text-muted-foreground text-center leading-tight">{e.descripcion}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}


          {/* ══════════ MODO CRUD ══════════ */}
          {!loading && mode === 'crud' && (
            <div className="p-4 space-y-4">
              {/* Formulario crear/editar */}
              {canManage && (
                <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    {editingId !== null ? <><Edit2 size={13} /> Editar Empaque</> : <><Plus size={13} /> Nuevo Empaque</>}
                  </h3>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Nombre *</label>
                      <input
                        value={form.nombre}
                        onChange={(e) => setForm(f => ({ ...f, nombre: e.target.value }))}
                        placeholder="Ej: Caja x 24"
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Cantidad (uds.) *</label>
                      <input
                        type="number"
                        min="1"
                        value={form.cantidad}
                        onChange={(e) => setForm(f => ({ ...f, cantidad: e.target.value }))}
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Descripción (opcional)</label>
                    <input
                      value={form.descripcion}
                      onChange={(e) => setForm(f => ({ ...f, descripcion: e.target.value }))}
                      placeholder="Ej: 24 unidades por caja"
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                  </div>

                  {formError && (
                    <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} />{formError}</p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
                    >
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      {editingId !== null ? 'Guardar Cambios' : 'Crear Empaque'}
                    </button>
                    {editingId !== null && (
                      <button
                        onClick={cancelForm}
                        className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Lista de empaques CRUD */}
              <div className="space-y-2">
                {empaques.map((e) => (
                  <div
                    key={e.idEmpaque}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                      e.estado === 'INACTIVO' ? 'opacity-50 bg-muted/30 border-border/40' : 'bg-card border-border'
                    } ${editingId === e.idEmpaque ? 'ring-2 ring-amber-400 border-amber-400' : ''}`}
                  >
                    {/* Quantity badge */}
                    <span className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-xl text-base font-bold border ${badgeColor(e.cantidad)}`}>
                      {e.cantidad}
                    </span>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{e.nombre}</p>
                      {e.descripcion && <p className="text-xs text-muted-foreground truncate">{e.descripcion}</p>}
                    </div>

                    {/* Estado badge */}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      e.estado === 'ACTIVO' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {e.estado}
                    </span>

                    {/* Actions */}
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleToggleEstado(e)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          title={e.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                        >
                          {e.estado === 'ACTIVO' ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>
                        <button
                          onClick={() => startEdit(e)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(e.idEmpaque)}
                          disabled={deletingId === e.idEmpaque}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                          title="Desactivar"
                        >
                          {deletingId === e.idEmpaque ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────── */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <span><kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono text-foreground">← ↑ → ↓</kbd> Navegar</span>
            <span><kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono text-foreground">Enter</kbd> Seleccionar</span>
            <span><kbd className="px-1.5 py-0.5 bg-muted border border-border rounded font-mono text-foreground">Esc</kbd> Salir</span>
          </div>
          <button onClick={onClose} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <X size={12} />
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
