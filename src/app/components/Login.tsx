import { useState, FormEvent } from 'react';
import { authApi } from '../../imports/api';

interface LoginProps {
  // Sin token: el backend lo deja en una cookie HttpOnly que este código no ve.
  onLogin: (username: string, roles: string[], permisos: string[], requiresPwdChange: boolean) => void;
  notice?: string;
}

export default function Login({ onLogin, notice }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await authApi.login(username.trim(), password);
      onLogin(data.username, data.roles, data.permisos, data.requiereCambioPassword);
    } catch (err: any) {
      if (err.message === 'Failed to fetch') {
        setError('No se pudo conectar con el servidor.');
      } else {
        setError(err.message || 'Usuario o contraseña incorrectos.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        {/* Logo / Brand */}
        <div className="login-brand">
          <div className="login-logo">
            <svg width="44" height="44" viewBox="0 0 500 400" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="login-gold-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFEB68"/>
                  <stop offset="60%" stopColor="#F5C832"/>
                  <stop offset="100%" stopColor="#E2B11B"/>
                </linearGradient>
                <linearGradient id="login-gold-grad-2" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FFF38B"/>
                  <stop offset="100%" stopColor="#EDBC26"/>
                </linearGradient>
              </defs>
              <path d="M 90,310 L 205,105 L 245,285 L 210,285 L 188,200 L 125,310 Z" fill="url(#login-gold-grad-1)" />
              <path d="M 160,250 L 205,150 L 230,260 L 210,260 L 195,200 L 175,250 Z" fill="url(#login-gold-grad-2)" />
              <path d="M 298,35 L 410,310 L 350,310 L 298,165 L 255,310 L 215,310 L 285,115 Z" fill="url(#login-gold-grad-1)" />
              <path d="M 285,115 L 325,210 L 275,310 L 255,310 L 295,200 L 275,150 Z" fill="url(#login-gold-grad-2)" />
            </svg>
          </div>
          <div>
            <h1 className="login-title">MAX ERP</h1>
            <p className="login-subtitle">Sistema de Gestión Empresarial</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {notice && (
            <div className="login-success" role="status">
              {notice}
            </div>
          )}

          <div className="login-field">
            <label htmlFor="login-username" className="login-label">Usuario</label>
            <input
              id="login-username"
              type="text"
              className="login-input"
              placeholder="Ingresa tu usuario"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password" className="login-label">Contraseña</label>
            <input
              id="login-password"
              type="password"
              className="login-input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="login-error" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            id="login-submit"
            className="login-btn"
            disabled={loading}
          >
            {loading ? (
              <span className="login-spinner" />
            ) : (
              'Iniciar sesión'
            )}
          </button>
        </form>

        <p className="login-footer">© 2026 Max Li · Todos los derechos reservados</p>
      </div>
    </div>
  );
}
