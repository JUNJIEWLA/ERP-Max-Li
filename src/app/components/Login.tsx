import { useState, FormEvent } from 'react';
import { authApi } from '../../imports/api';

interface LoginProps {
  onLogin: (token: string, username: string, roles: string[], permisos: string[], requiresPwdChange: boolean) => void;
}

export default function Login({ onLogin }: LoginProps) {
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
      onLogin(data.token, data.username, data.roles, data.permisos, data.requiereCambioPassword);
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
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="12" fill="url(#lg)" />
              <path d="M10 28V14l10-6 10 6v14l-10 6-10-6z" fill="white" fillOpacity=".15" />
              <path d="M20 8l10 6v12M20 8L10 14v12M10 26l10 6 10-6" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
              <defs>
                <linearGradient id="lg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <h1 className="login-title">ERP Max Li</h1>
            <p className="login-subtitle">Sistema de Gestión Empresarial</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
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
