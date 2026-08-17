import { useState } from 'react';
import { Lock, Loader2, ArrowRight } from 'lucide-react';
import { authApi } from '../../imports/api';

interface CambioPasswordObligatorioProps {
  username: string;
  onSuccess: () => void;
  onLogout: () => void;
}

export default function CambioPasswordObligatorio({ username, onSuccess, onLogout }: CambioPasswordObligatorioProps) {
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (passwordNueva !== confirmarPassword) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }
    if (passwordNueva.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (passwordNueva === passwordActual) {
      setError('La nueva contraseña debe ser diferente a la temporal.');
      return;
    }

    setLoading(true);
    try {
      await authApi.cambiarPassword(passwordActual, passwordNueva);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error al cambiar la contraseña. Verifica tu contraseña temporal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[100px]" />
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[40%] rounded-full bg-blue-500/5 blur-[100px]" />
      </div>

      <div className="w-full max-w-md bg-background border border-border rounded-3xl shadow-xl z-10 overflow-hidden relative">
        <div className="h-2 w-full bg-gradient-to-r from-primary to-blue-500" />
        
        <div className="p-8">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6">
            <Lock size={24} />
          </div>
          
          <h1 className="text-2xl font-bold text-foreground tracking-tight mb-2">Cambio Obligatorio</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Hola <span className="font-semibold">{username}</span>. Por seguridad, debes cambiar tu contraseña temporal antes de continuar al sistema.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm border border-destructive/20">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="pwd-actual" className="block text-xs font-semibold uppercase mb-1.5 text-muted-foreground">Contraseña Temporal / Actual</label>
              <input
                id="pwd-actual"
                type="password"
                autoComplete="current-password"
                required 
                value={passwordActual} 
                onChange={e => setPasswordActual(e.target.value)} 
                className="w-full px-4 py-3 border border-border rounded-xl bg-muted/20 text-sm focus:ring-2 focus:ring-primary focus:bg-background transition-colors" 
                placeholder="••••••••" 
              />
            </div>

            <div className="pt-2">
              <label htmlFor="pwd-nueva" className="block text-xs font-semibold uppercase mb-1.5 text-muted-foreground">Nueva Contraseña</label>
              <input
                id="pwd-nueva"
                type="password"
                autoComplete="new-password"
                required 
                value={passwordNueva} 
                onChange={e => setPasswordNueva(e.target.value)} 
                className="w-full px-4 py-3 border border-border rounded-xl bg-muted/20 text-sm focus:ring-2 focus:ring-primary focus:bg-background transition-colors" 
                placeholder="Mínimo 8 caracteres" 
              />
            </div>

            <div>
              <label htmlFor="pwd-confirmar" className="block text-xs font-semibold uppercase mb-1.5 text-muted-foreground">Confirmar Nueva Contraseña</label>
              <input
                id="pwd-confirmar"
                type="password"
                autoComplete="new-password"
                required 
                value={confirmarPassword} 
                onChange={e => setConfirmarPassword(e.target.value)} 
                className="w-full px-4 py-3 border border-border rounded-xl bg-muted/20 text-sm focus:ring-2 focus:ring-primary focus:bg-background transition-colors" 
                placeholder="Repetir contraseña" 
              />
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98] mt-6 shadow-sm disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : 'Actualizar contraseña'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={onLogout} className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">
              Cerrar sesión y volver al login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
