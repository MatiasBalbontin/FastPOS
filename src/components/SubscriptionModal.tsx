import React from 'react';
import { CreditCard, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const SubscriptionModal = () => {
  const { signOut } = useAuth();

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white max-w-lg w-full rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="bg-blue-600 p-8 text-center text-white relative">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CreditCard size={32} />
          </div>
          <h2 className="text-2xl font-bold mb-2">Activa tu Suscripción</h2>
          <p className="text-blue-100 text-sm">Tu empresa requiere activación manual para comenzar a operar.</p>
        </div>
        
        <div className="p-8">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 mb-6">
            <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-amber-800">
              <strong>Estado: Pendiente de Pago</strong>
              <p className="mt-1">
                Para completar la habilitación, realiza el pago usando el botón de abajo. Una vez procesado, habilitaremos tu entorno de trabajo.
              </p>
            </div>
          </div>

          {/* El enlace de MercadoPago iría aquí. Se puede cambiar por una URL real de pago. */}
          <a 
            href="https://link.mercadopago.cl/fastpos" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-[#009EE3] text-white font-bold py-4 rounded-xl hover:bg-[#008ACA] transition-colors mb-4 shadow-lg shadow-[#009EE3]/30"
          >
            Pagar con MercadoPago
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>

          <div className="text-center">
            <button 
              onClick={signOut}
              className="text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors"
            >
              Cerrar sesión por ahora
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
