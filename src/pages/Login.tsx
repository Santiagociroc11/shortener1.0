import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Mail, Lock, User, Link2, Shield } from 'lucide-react';

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
        toast.success('¡Cuenta creada! Verifica tu correo.');
      } else {
        await signIn(email, password);
        toast.success('¡Bienvenido de vuelta!');
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error de autenticación');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header con logo y título */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center">
              <Link2 className="w-8 h-8 text-white" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-black">
              SCC Shortener
            </h1>
            
            <h2 className="text-xl font-semibold text-gray-700">
              {isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
            </h2>
            
            <p className="text-gray-600">
              {isSignUp 
                ? 'Únete para crear enlaces con seguimiento avanzado'
                : 'Accede a tu cuenta para gestionar enlaces'
              }
            </p>
          </div>
        </div>

        {/* Formulario principal */}
        <div className="minimal-card p-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Campo de email */}
            <div className="space-y-2">
              <label className="block text-gray-900 font-medium text-sm">
                Correo electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  required
                  className="input-minimal pl-10"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Campo de contraseña */}
            <div className="space-y-2">
              <label className="block text-gray-900 font-medium text-sm">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  required
                  className="input-minimal pl-10"
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
              className={`btn-accent w-full py-3 text-base font-semibold ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <span className="flex items-center justify-center">
                {isLoading ? (
                  <>
                    <div className="spinner mr-2"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <User className="w-4 h-4 mr-2" />
                    {isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
                  </>
                )}
              </span>
            </button>
          </form>

          {/* Divisor */}
          <div className="divider"></div>

          {/* Botón de alternancia */}
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="btn-secondary w-full py-3"
          >
            <span className="flex items-center justify-center">
              {isSignUp ? 'Ya tengo una cuenta' : 'Crear nueva cuenta'}
            </span>
          </button>
        </div>

        {/* Características destacadas */}
        <div className="minimal-card p-6">
          <h3 className="text-gray-900 font-semibold mb-4 text-center">
            ✨ Características principales
          </h3>
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="flex items-center text-gray-700">
              <div className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></div>
              <span>Enlaces cortos ilimitados</span>
            </div>
            <div className="flex items-center text-gray-700">
              <div className="w-2 h-2 bg-gray-400 rounded-full mr-3"></div>
              <span>Análisis en tiempo real</span>
            </div>
            <div className="flex items-center text-gray-700">
              <div className="w-2 h-2 bg-black rounded-full mr-3"></div>
              <span>Scripts de seguimiento personalizados</span>
            </div>
            <div className="flex items-center text-gray-700">
              <div className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></div>
              <span>Dashboard profesional</span>
            </div>
          </div>
        </div>

        {/* Footer de seguridad */}
        <div className="text-center">
          <div className="flex items-center justify-center text-gray-500 text-xs">
            <Shield className="w-4 h-4 mr-2" />
            <span>Tus datos están protegidos y encriptados</span>
          </div>
        </div>
      </div>
    </div>
  );
}