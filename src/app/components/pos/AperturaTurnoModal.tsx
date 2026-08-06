import { useState, useEffect } from 'react';
import { Wallet, Loader2, AlertCircle, Building2, DollarSign, CheckCircle2, X, User } from 'lucide-react';
import { cajasApi, turnosCajaApi, usuariosApi, type Caja, type TurnoCaja, type Usuario } from '../../../imports/api';

interface AperturaTurnoModalProps {
  onTurnoAbierto: (turno: TurnoCaja) => void;
  onClose?: () => void;
}

export default function AperturaTurnoModal({ onTurnoAbierto, onClose }: AperturaTurnoModalProps) {
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [idCajaSel, setIdCajaSel] = useState('');
  const [idUsuarioSel, setIdUsuarioSel] = useState('');
  const [montoInicial, setMontoInicial] = useState('');
  const [observacion, setObservacion] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      cajasApi.listarActivas(0, 100),
      usuariosApi.listarActivos(0, 100),
    ])
      .then(([cajasData, usuariosData]) => {
        if (!isMounted) return;
        setCajas(cajasData.content);
        setUsuarios(usuariosData.content);
        if (cajasData.content.length > 0) {
          setIdCajaSel(String(cajasData.content[0].idCaja));
        }
        // Intentar pre-seleccionar usuario de sesión si existe
        const currentUser = localStorage.getItem('maxli_user');
        const matchUser = usuariosData.content.find((u) => u.username === currentUser);
        if (matchUser) {
          setIdUsuarioSel(String(matchUser.idUsuario));
        } else if (usuariosData.content.length > 0) {
          setIdUsuarioSel(String(usuariosData.content[0].idUsuario));
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Error al cargar datos para apertura de turno');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  const handleAbrir = async () => {
    const idCaja = Number(idCajaSel);
    const idUsuario = idUsuarioSel ? Number(idUsuarioSel) : undefined;
    const monto = Number(montoInicial || 0);

    if (!idCaja) {
      setError('Debes seleccionar una caja registradora física.');
      return;
    }
    if (isNaN(monto) || monto < 0) {
      setError('El monto inicial de caja (fondo de caja) debe ser un número válido ≥ 0.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const nuevoTurno = await turnosCajaApi.abrir({
        idCaja,
        idUsuario,
        montoInicial: monto,
        observacionApertura: observacion.trim() || undefined,
      });
      onTurnoAbierto(nuevoTurno);
    } catch (err: any) {
      setError(err.message || 'Error al abrir el turno de caja');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-border bg-gradient-to-r from-blue-600/10 via-primary/5 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-600/20">
              <Wallet size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Apertura de Turno de Caja</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Asigna la caja registradora física y el cajero autorizado para el turno.
              </p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Body Form */}
        <div className="p-6 space-y-4">
          
          {/* Selección de Caja Física */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
              <Building2 size={15} className="text-blue-600" />
              Caja Registradora Física <span className="text-rose-500">*</span>
            </label>
            {loading ? (
              <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-xl border border-border text-xs text-muted-foreground">
                <Loader2 size={16} className="animate-spin text-blue-600" />
                <span>Cargando datos...</span>
              </div>
            ) : cajas.length === 0 ? (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-600 font-medium">
                No hay cajas registradoras activas disponibles.
              </div>
            ) : (
              <select
                id="sel-apertura-caja"
                value={idCajaSel}
                onChange={(e) => setIdCajaSel(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60"
              >
                {cajas.map((c) => (
                  <option key={c.idCaja} value={c.idCaja}>
                    {c.nombre} (ID: #{c.idCaja})
                  </option>
                ))}
              </select>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              Terminal física donde funcionará el cobro.
            </p>
          </div>

          {/* Selección de Usuario / Cajero */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
              <User size={15} className="text-violet-600" />
              Usuario / Cajero Asignado <span className="text-rose-500">*</span>
            </label>
            {loading ? (
              <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-xl border border-border text-xs text-muted-foreground">
                <Loader2 size={16} className="animate-spin text-violet-600" />
                <span>Cargando usuarios...</span>
              </div>
            ) : usuarios.length === 0 ? (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-600 font-medium">
                No hay usuarios activos disponibles.
              </div>
            ) : (
              <select
                id="sel-apertura-usuario"
                value={idUsuarioSel}
                onChange={(e) => setIdUsuarioSel(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60"
              >
                {usuarios.map((u) => (
                  <option key={u.idUsuario} value={u.idUsuario}>
                    {u.username} ({u.email || `ID: #${u.idUsuario}`})
                  </option>
                ))}
              </select>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              Usuario responsable de procesar las ventas en esta caja.
            </p>
          </div>

          {/* Monto Inicial */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
              <DollarSign size={15} className="text-emerald-600" />
              Monto Inicial (Fondo de Caja en Efectivo) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">RD$</span>
              <input
                id="input-apertura-monto-inicial"
                type="number"
                step="0.01"
                min="0"
                value={montoInicial}
                onChange={(e) => setMontoInicial(e.target.value)}
                placeholder="0.00"
                className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/60"
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Efectivo en monedas y billetes entregado para dar cambio durante el turno.
            </p>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              Observaciones de Apertura <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
            </label>
            <textarea
              id="input-apertura-observacion"
              rows={2}
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Ej: Turno mañana, fondo verificado por supervisión..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-rose-600 text-sm bg-rose-500/10 border border-rose-500/20 px-3.5 py-2.5 rounded-xl animate-in fade-in">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 pt-2 border-t border-border flex items-center justify-end gap-3 bg-muted/20">
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-border hover:bg-muted transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
          )}
          <button
            id="btn-abrir-turno-caja"
            onClick={handleAbrir}
            disabled={saving || loading || cajas.length === 0 || usuarios.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all font-semibold text-sm shadow-md shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {saving ? 'Aperturando Turno...' : 'Abrir Turno de Caja'}
          </button>
        </div>

      </div>
    </div>
  );
}
