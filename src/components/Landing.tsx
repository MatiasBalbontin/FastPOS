import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Toaster, toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';

export function Landing({ onSession }: { onSession: () => void }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Inject the CSS dynamically so it doesn't bleed into the main app when logged in
    const link = document.createElement('link');
    link.href = '/landing.css';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success('¡Bienvenido de vuelta!');
        onSession();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        toast.success('¡Registro exitoso! Revisa tu correo electrónico para confirmar tu cuenta.');
        setIsLogin(true);
      }
    } catch (error: any) {
      toast.error(error.message || 'Error en la autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-page-container">
      <Toaster position="top-right" theme="light" />
      {/* NAV */}
      <nav>
        <div className="nav-logo">
          <svg className="mountain" viewBox="0 0 60 40" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 38 L22 8 L30 18 L38 4 L58 38 Z" fill="white" opacity="0.9"/>
            <path d="M22 8 L28 16 L30 18 L32 14 L38 4" fill="none" stroke="rgba(26,90,255,0.8)" strokeWidth="2"/>
          </svg>
          <span>Fast<em>POS</em></span>
          <span className="nav-badge">SaaS</span>
        </div>
        <div className="nav-links">
          <a href="#features">Funciones</a>
          <a href="#screens">Vista Previa</a>
          <a href="#pricing">Precios</a>
          <a href="#login" className="btn-login">Iniciar Sesión →</a>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-text">
          <p className="hero-eyebrow animate delay-1">Sistema punto de venta</p>
          <h1 className="animate delay-2">
            El POS que no<br/>
            <span className="accent">te complica</span>
            <span className="line2">la vida.</span>
          </h1>
          <p className="hero-sub animate delay-3">
            Inventario FIFO, terminal de ventas, reportes en tiempo real y gestión de caja — todo en la nube.
          </p>
          <div className="hero-ctas animate delay-4">
            <a href="#login" className="btn-primary">
              Entrar al sistema
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
            <a href="#demo-video" className="btn-ghost" style={{ paddingLeft: '20px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              Ver demo
            </a>
          </div>
          <div className="hero-stats animate delay-5">
            <div className="stat-item">
              <div className="stat-num">Nube</div>
              <div className="stat-label">Sincronización total</div>
            </div>
            <div className="stat-item">
              <div className="stat-num">5</div>
              <div className="stat-label">Módulos integrados</div>
            </div>
            <div className="stat-item">
              <div className="stat-num">∞</div>
              <div className="stat-label">Multiusuario</div>
            </div>
          </div>
        </div>

        <div className="hero-mockup animate delay-3">
          <div className="mockup-shell">
            <div className="mockup-bar">
              <span className="dot dot-r"></span>
              <span className="dot dot-y"></span>
              <span className="dot dot-g"></span>
              <div className="mockup-url">fastpos.app — Inventario Maestro</div>
            </div>
            <div className="mockup-body">
              <div className="m-header">
                <div>
                  <div className="m-title">Inventario Maestro</div>
                  <div className="m-sub">Control de existencias y lotes FIFO</div>
                </div>
                <div className="m-actions">
                  <button className="m-btn m-btn-gray">Exportar</button>
                  <button className="m-btn m-btn-blue">Importar</button>
                </div>
              </div>
              <table className="m-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Stock</th>
                    <th>P. Venta</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="m-prod">PRUEBA</td>
                    <td>PRUEBA</td>
                    <td>250</td>
                    <td className="m-price">$1.000</td>
                    <td><span className="badge badge-ok">OK</span></td>
                  </tr>
                  <tr>
                    <td className="m-prod">SERVICIO CONTABLE</td>
                    <td>SERVICIO</td>
                    <td>0</td>
                    <td className="m-price">$200.000</td>
                    <td><span className="badge badge-low">BAJO</span></td>
                  </tr>
                </tbody>
              </table>
              <div className="m-total-row">
                <span className="m-total-label">Valor total inventario</span>
                <span className="m-total-val">$125.000</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DEMO VIDEO */}
      <section id="demo-video" style={{ padding: '100px 6vw', background: 'var(--navy-mid)', textAlign: 'center' }}>
        <span className="section-tag" style={{ color: 'var(--blue-bright)' }}>Video Demostrativo</span>
        <h2 className="section-title" style={{ color: 'white', margin: '0 auto 40px auto', fontFamily: "'Inter', sans-serif" }}>Descubre cómo funciona</h2>
        <div style={{ maxWidth: '900px', margin: '0 auto', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 40px 80px rgba(0,0,0,0.5)', position: 'relative', background: '#000', aspectRatio: '16/9' }}>
          <video controls style={{ width: '100%', height: '100%', display: 'block' }} poster="landing-assets/demo-poster.png">
            <source src="landing-assets/demo-video.mp4" type="video/mp4" />
            Tu navegador no soporta el elemento de video.
          </video>
        </div>
      </section>

      {/* FEATURES */}
      <section className="features" id="features">
        <span className="section-tag">Funcionalidades</span>
        <h2 className="section-title">Todo lo que necesitas, nada que no usas.</h2>
        <p className="section-desc">Diseñado para negocios reales: rápido de aprender, fácil de operar día a día.</p>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feat-icon">🖥️</div>
            <h3 className="feat-title">Terminal POS</h3>
            <p className="feat-desc">Escanea productos, arma comandas y procesa pagos en segundos. Soporte para efectivo y tarjeta con [F10] para ir directo al cobro.</p>
          </div>
          <div className="feature-card">
            <div className="feat-icon">📦</div>
            <h3 className="feat-title">Inventario FIFO</h3>
            <p className="feat-desc">Control total de existencias con método FIFO. Alertas de stock bajo, umbrales configurables e importación masiva vía Excel.</p>
          </div>
          <div className="feature-card">
            <div className="feat-icon">📊</div>
            <h3 className="feat-title">Reportes y Análisis</h3>
            <p className="feat-desc">Ingresos, costo de ventas, utilidad real, dominio por categoría y ranking de productos — con filtro por fecha.</p>
          </div>
          <div className="feature-card">
            <div className="feat-icon">📋</div>
            <h3 className="feat-title">Notas de Crédito</h3>
            <p className="feat-desc">Historial completo de ventas con opción de anulación. Registro de tickets completados y anulados con detalle por ítem.</p>
          </div>
          <div className="feature-card">
            <div className="feat-icon">💰</div>
            <h3 className="feat-title">Gastos de Caja</h3>
            <p className="feat-desc">Registra egresos y notas de cargo que se descuentan automáticamente del balance. Múltiples medios de pago.</p>
          </div>
          <div className="feature-card">
            <div className="feat-icon">☁️</div>
            <h3 className="feat-title">100% en la Nube</h3>
            <p className="feat-desc">Accede desde cualquier dispositivo con internet. Tus datos están seguros y respaldados automáticamente.</p>
          </div>
        </div>
      </section>

      {/* SCREENSHOTS */}
      <section className="screenshots" id="screens">
        <div className="screens-header">
          <div>
            <span className="section-tag" style={{ color: 'var(--blue-bright)' }}>Vista Previa</span>
            <h2 style={{ fontFamily: "'Inter',sans-serif", fontSize: 'clamp(1.8rem,2.5vw,2.4rem)', fontWeight: 800, letterSpacing: '-1px', marginTop: '8px' }}>Lo que verás al entrar</h2>
          </div>
        </div>
        <div className="screens-grid">
          <div className="screen-card">
            <div className="screen-label">Terminal POS</div>
            <div className="screen-preview" style={{ padding: 0, overflow: 'hidden' }}>
              <img src="landing-assets/pantallazo-pos.png" alt="Pantallazo POS" style={{ width: '100%', display: 'block', objectFit: 'cover', aspectRatio: '4/3', background: '#1a2e45' }} />
            </div>
          </div>
          <div className="screen-card">
            <div className="screen-label">Inventario Maestro</div>
            <div className="screen-preview" style={{ padding: 0, overflow: 'hidden' }}>
              <img src="landing-assets/pantallazo-inventario.png" alt="Pantallazo Inventario" style={{ width: '100%', display: 'block', objectFit: 'cover', aspectRatio: '4/3', background: '#1a2e45' }} />
            </div>
          </div>
          <div className="screen-card">
            <div className="screen-label">Reportes y Análisis</div>
            <div className="screen-preview" style={{ padding: 0, overflow: 'hidden' }}>
              <img src="landing-assets/pantallazo-reportes.png" alt="Pantallazo Reportes" style={{ width: '100%', display: 'block', objectFit: 'cover', aspectRatio: '4/3', background: '#1a2e45' }} />
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="pricing" id="pricing">
        <span className="section-tag">Planes</span>
        <h2 className="section-title" style={{ textAlign: 'center', margin: '0 auto' }}>Simple. Sin sorpresas.</h2>
        <p className="section-desc" style={{ textAlign: 'center', margin: '12px auto 0' }}>Elige el plan que se ajusta a tu negocio.</p>

        <div className="pricing-cards">
          <div className="price-card">
            <div className="price-name">Básico</div>
            <div className="price-amount">Gratis</div>
            <div className="price-period">Para siempre</div>
            <div className="price-desc">Ideal para probar el sistema y negocios pequeños.</div>
            <div className="price-divider"></div>
            <ul>
              <li>Terminal POS completo</li>
              <li>Hasta 50 productos</li>
              <li>Reportes básicos</li>
              <li>1 usuario</li>
            </ul>
            <a href="#login" className="btn-price btn-price-outline">Comenzar gratis</a>
          </div>

          <div className="price-card featured">
            <div className="feat-badge">MÁS POPULAR</div>
            <div className="price-name">Pro</div>
            <div className="price-amount">$9.990</div>
            <div className="price-period">/ mes · CLP</div>
            <div className="price-desc">Todo lo que un negocio en crecimiento necesita.</div>
            <div className="price-divider"></div>
            <ul>
              <li>Productos ilimitados</li>
              <li>Inventario FIFO completo</li>
              <li>Reportes avanzados</li>
              <li>Notas de crédito</li>
              <li>Gastos de caja</li>
              <li>Exportación Excel</li>
            </ul>
            <a href="#login" className="btn-price btn-price-solid">Empezar ahora →</a>
          </div>

          <div className="price-card">
            <div className="price-name">Empresa</div>
            <div className="price-amount">A medida</div>
            <div className="price-period">Según necesidad</div>
            <div className="price-desc">Para cadenas, franquicias o requerimientos especiales.</div>
            <div className="price-divider"></div>
            <ul>
              <li>Múltiples sucursales</li>
              <li>Usuarios ilimitados</li>
              <li>Integración API</li>
              <li>Soporte dedicado</li>
            </ul>
            <a href="#login" className="btn-price btn-price-outline">Contáctanos</a>
          </div>
        </div>
      </section>

      {/* LOGIN */}
      <section id="login">
        <div className="login-wrapper">
          <div className="login-copy">
            <p className="hero-eyebrow">Acceso al sistema</p>
            <h2>Entra a tu<br/>espacio de trabajo.</h2>
            <p>Tu inventario, tus ventas y tus reportes, disponibles al instante desde cualquier dispositivo.</p>
            <ul className="login-features">
              <li><span className="lf-dot"></span>Datos sincronizados en tiempo real</li>
              <li><span className="lf-dot"></span>Sesión segura con cifrado (Supabase)</li>
              <li><span class="lf-dot"></span>Acceso rápido con atajos de teclado</li>
              <li><span class="lf-dot"></span>Funciona en tablet y escritorio</li>
            </ul>
          </div>

          <div className="login-card">
            <div className="login-logo">
              <svg width="28" height="20" viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 38 L22 8 L30 18 L38 4 L58 38 Z" fill="#1a5aff" opacity="0.9"/>
              </svg>
              <span className="login-logo-text">Fast<em>POS</em></span>
              <span style={{ fontSize: '0.6rem', background: '#f59e0b', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>SaaS EDITION</span>
            </div>

            <h3 className="login-title">{isLogin ? 'Bienvenido de vuelta' : 'Crea tu tienda'}</h3>
            <p className="login-sub">{isLogin ? 'Ingresa tus credenciales para continuar' : 'Ingresa tus datos para empezar gratis'}</p>

            <form onSubmit={handleAuth}>
              <div className="form-group">
                <label className="form-label">Correo electrónico</label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="form-input" 
                  placeholder="usuario@empresa.cl" 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Contraseña</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="form-input" 
                    placeholder="••••••••••" 
                    style={{ paddingRight: '40px' }}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-soft)' }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {isLogin && (
                <div className="form-row">
                  <label className="remember">
                    <input type="checkbox" /> Recordarme
                  </label>
                  <a href="#" className="forgot">¿Olvidaste tu contraseña?</a>
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-submit" style={{ marginTop: isLogin ? '0' : '24px' }}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? 'Iniciar sesión' : 'Crear Cuenta')}
                {!loading && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>}
              </button>
            </form>

            <div className="login-divider">o</div>
            
            <div style={{ textAlign: 'center' }}>
              <button onClick={() => setIsLogin(!isLogin)} style={{ background: 'transparent', border: 'none', color: 'var(--blue)', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 600 }}>
                {isLogin ? '¿No tienes cuenta? Regístrate gratis' : '¿Ya tienes cuenta? Inicia sesión'}
              </button>
            </div>

            <div className="login-version">
              FastPOS <strong>SaaS EDITION</strong> · Todos los derechos reservados
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="footer-logo">Fast<em>POS</em></div>
        <p>El sistema punto de venta más ágil para tu negocio.</p>
        <div className="footer-links">
          <a href="#">Términos</a>
          <a href="#">Privacidad</a>
          <a href="#">Soporte</a>
        </div>
      </footer>
    </div>
  );
}
