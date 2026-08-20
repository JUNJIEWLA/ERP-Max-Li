import { useState, useEffect, FormEvent } from 'react';
import { authApi } from '../../imports/api';

interface LoginProps {
  // Sin token: el backend lo deja en una cookie HttpOnly que este código no ve.
  onLogin: (username: string, roles: string[], permisos: string[], requiresPwdChange: boolean) => void;
  notice?: string;
}

export default function Login({ onLogin, notice }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberUser, setRememberUser] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Cargar usuario recordado al iniciar
  useEffect(() => {
    const savedUser = localStorage.getItem('erp_saved_username');
    if (savedUser) {
      setUsername(savedUser);
      setRememberUser(true);
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cleanUser = username.trim();
      const data = await authApi.login(cleanUser, password);

      // Guardar o limpiar usuario recordado
      if (rememberUser) {
        localStorage.setItem('erp_saved_username', cleanUser);
      } else {
        localStorage.removeItem('erp_saved_username');
      }

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
      <div className="login-backdrop-overlay" />

      <div className="login-container">
        {/* Columna Izquierda: Mensaje de Bienvenida */}
        <div className="login-hero">
          <div className="login-brand-badge">
            <svg width="28" height="28" viewBox="0 0 500 400" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="hero-gold-1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFEB68"/>
                  <stop offset="60%" stopColor="#F5C832"/>
                  <stop offset="100%" stopColor="#E2B11B"/>
                </linearGradient>
                <linearGradient id="hero-gold-2" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FFF38B"/>
                  <stop offset="100%" stopColor="#EDBC26"/>
                </linearGradient>
              </defs>
              <path d="M 90,310 L 205,105 L 245,285 L 210,285 L 188,200 L 125,310 Z" fill="url(#hero-gold-1)" />
              <path d="M 160,250 L 205,150 L 230,260 L 210,260 L 195,200 L 175,250 Z" fill="url(#hero-gold-2)" />
              <path d="M 298,35 L 410,310 L 350,310 L 298,165 L 255,310 L 215,310 L 285,115 Z" fill="url(#hero-gold-1)" />
              <path d="M 285,115 L 325,210 L 275,310 L 255,310 L 295,200 L 275,150 Z" fill="url(#hero-gold-2)" />
            </svg>
            <span role="heading" aria-level={1}>MAX ERP</span>
          </div>

          <h1 className="login-hero-title">
            Bienvenido<br />de Nuevo
          </h1>
          <p className="login-hero-subtitle">
            Acceda al sistema con sus credenciales corporativas para continuar gestionando sus operaciones.
          </p>
        </div>

        {/* Columna Derecha: Tarjeta de Iniciar Sesión */}
        <div className="login-card">
          <h2 className="login-card-title">Iniciar sesión</h2>

          <form onSubmit={handleSubmit} className="login-form">
            {notice && (
              <div className="login-success" role="status">
                {notice}
              </div>
            )}

            <div className="login-field">
              <label htmlFor="login-username" className="login-label">Usuario</label>
              <div className="login-input-wrap">
                <input
                  id="login-username"
                  type="text"
                  className="login-input"
                  placeholder="Ingrese su usuario"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="login-password" className="login-label">Contraseña</label>
              <div className="login-input-wrap">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="login-input"
                  placeholder="Ingrese su contraseña"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="login-options">
              <label className="login-checkbox-label">
                <input
                  type="checkbox"
                  className="login-checkbox"
                  checked={rememberUser}
                  onChange={e => setRememberUser(e.target.checked)}
                />
                <span>Recordar usuario</span>
              </label>
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

            <div className="login-actions">
              <button
                type="button"
                className="login-forgot-link"
                onClick={() => setShowForgotModal(true)}
              >
                ¿Olvidó su contraseña?
              </button>
            </div>

            <p className="login-disclaimer">
              Al hacer clic en &ldquo;Iniciar sesión&rdquo; usted acepta los{' '}
              <a href="#terms" onClick={(e) => { e.preventDefault(); }}>Términos de Servicio</a> |{' '}
              <a href="#privacy" onClick={(e) => { e.preventDefault(); }}>Política de Privacidad</a>
            </p>
          </form>
        </div>
      </div>

      {/* Modal Informativo Olvidó Contraseña */}
      {showForgotModal && (
        <div className="login-modal-overlay" onClick={() => setShowForgotModal(false)}>
          <div className="login-modal" onClick={e => e.stopPropagation()}>
            <div className="login-modal-header">
              <h3>Recuperación de Acceso</h3>
              <button
                type="button"
                className="login-modal-close"
                onClick={() => setShowForgotModal(false)}
              >
                ×
              </button>
            </div>
            <div className="login-modal-body">
              <p>
                Por motivos de seguridad corporativa, el restablecimiento de contraseñas es gestionado directamente por el Administrador del Sistema o el Departamento de TI.
              </p>
              <div className="login-modal-hint">
                <strong>Contacto de Soporte:</strong>
                <span>admin@maxli.com / Soporte Interno</span>
              </div>
            </div>
            <div className="login-modal-footer">
              <button
                type="button"
                className="login-btn login-modal-btn"
                onClick={() => setShowForgotModal(false)}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

