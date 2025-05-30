import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Mail, Lock, User, Sparkles, ArrowRight, Link2, Shield } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password);
        toast.success('¡Cuenta creada! 🎉 Verifica tu correo.');
      } else {
        await signIn(email, password);
        toast.success('¡Bienvenido de vuelta! ✨');
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error de autenticación');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 relative">
      {/* Elementos decorativos de fondo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-3/4 left-1/2 w-48 h-48 bg-blue-400/20 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Header con logo y título */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-3xl flex items-center justify-center float-animation shadow-2xl">
              <Link2 className="w-10 h-10 text-white" />
            </div>
          </div>
          
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-white">
              <span className="bg-gradient-to-r from-white via-purple-100 to-pink-100 bg-clip-text text-transparent">
                SCC Shortener
              </span>
            </h1>
            
            <h2 className="text-2xl font-semibold text-white/90">
              {isSignUp ? 'Crea tu cuenta' : 'Bienvenido de vuelta'}
            </h2>
            
            <p className="text-white/70 text-lg">
              {isSignUp 
                ? 'Únete para crear enlaces inteligentes con seguimiento avanzado'
                : 'Inicia sesión para gestionar tus enlaces'
              }
            </p>
          </div>
        </div>

        {/* Formulario principal */}
        <div className="glass-card p-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Campo de email */}
            <div className="space-y-2">
              <label className="block text-white/90 font-medium text-sm">
                📧 Correo electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-white/50" />
                </div>
                <input
                  type="email"
                  required
                  className="input-modern w-full pl-12"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Campo de contraseña */}
            <div className="space-y-2">
              <label className="block text-white/90 font-medium text-sm">
                🔒 Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-white/50" />
                </div>
                <input
                  type="password"
                  required
                  className="input-modern w-full pl-12"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Botón de envío */}
            <button
              type="submit"
              disabled={isLoading}
              className={`btn-gradient w-full py-4 text-lg font-semibold ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <span className="flex items-center justify-center">
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    {isSignUp ? (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        Crear Cuenta
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-5 h-5 mr-2" />
                        Iniciar Sesión
                      </>
                    )}
                  </>
                )}
              </span>
            </button>
          </form>

          {/* Divisor */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/20"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white/10 text-white/70 rounded-full">
                {isSignUp ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}
              </span>
            </div>
          </div>

          {/* Botón de alternancia */}
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="btn-secondary w-full py-3"
          >
            <span className="flex items-center justify-center">
              <User className="w-5 h-5 mr-2" />
              {isSignUp ? 'Ya tengo cuenta' : 'Crear nueva cuenta'}
            </span>
          </button>
        </div>

        {/* Características destacadas */}
        <div className="glass-card p-6">
          <h3 className="text-white font-semibold mb-4 text-center">
            ✨ Lo que obtienes
          </h3>
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="flex items-center text-white/80">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-3 pulse-glow"></div>
              <span>Enlaces cortos ilimitados</span>
            </div>
            <div className="flex items-center text-white/80">
              <div className="w-2 h-2 bg-blue-400 rounded-full mr-3 pulse-glow"></div>
              <span>Análisis en tiempo real</span>
            </div>
            <div className="flex items-center text-white/80">
              <div className="w-2 h-2 bg-purple-400 rounded-full mr-3 pulse-glow"></div>
              <span>Scripts de seguimiento personalizados</span>
            </div>
            <div className="flex items-center text-white/80">
              <div className="w-2 h-2 bg-pink-400 rounded-full mr-3 pulse-glow"></div>
              <span>Dashboard profesional</span>
            </div>
          </div>
        </div>

        {/* Footer de seguridad */}
        <div className="text-center">
          <div className="flex items-center justify-center text-white/60 text-xs">
            <Shield className="w-4 h-4 mr-2" />
            <span>Tus datos están protegidos y encriptados</span>
          </div>
        </div>
      </div>
    </div>
  );
}