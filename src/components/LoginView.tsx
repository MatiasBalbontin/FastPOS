import React, { useState } from 'react';
import { Lock, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

interface LoginViewProps {
  onLoginSuccess: () => void;
}

export function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      toast.error('Por favor, ingresa la contraseña.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Sesión iniciada con éxito');
        onLoginSuccess();
      } else {
        toast.error(data.error || 'Contraseña incorrecta');
      }
    } catch {
      toast.error('Error de conexión con el servidor');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-black relative overflow-hidden">
      {/* Background decorative gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse delay-700"></div>

      <div className="w-full max-w-md p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl relative z-10 text-center">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl text-blue-400">
            <ShoppingCart size={32} />
          </div>
        </div>

        <h2 className="text-3xl font-extrabold text-white tracking-tight">FastPOS</h2>
        <p className="text-sm text-slate-400 mt-2 mb-8">Ingresa la contraseña administrativa para continuar</p>

        <form onSubmit={handleSubmit} className="space-y-6 text-left">
          <div className="relative">
            <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 tracking-widest">Contraseña de Acceso</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full bg-white/5 border border-white/10 py-3 pl-12 pr-4 text-sm text-white rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3 rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-blue-500 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-blue-500/20"
          >
            {isLoading ? 'Autenticando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
