import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Link as LinkIcon, LogOut, User, Zap, BarChart3, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Definir las rutas donde la Navbar debe aparecer
  const activeRoutes = ["/", "/dashboard", "/login"];
  const isActiveRoute = activeRoutes.includes(location.pathname) || location.pathname.startsWith("/link/");

  // Si la ruta no está en la lista de activas, no renderizar la Navbar
  if (!isActiveRoute) return null;

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
      toast.success('¡Sesión cerrada exitosamente! ✨');
    } catch (error) {
      toast.error('Error al cerrar sesión');
    }
  };

  return (
    <>
      <nav className="navbar-glass">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="flex justify-between items-center h-20">
            {/* Logo y marca */}
            <div className="flex items-center group">
              <Link to="/" className="flex items-center text-white hover:text-white transition-all duration-300">
                <div className="relative p-3 mr-4">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-2xl blur-lg opacity-30 group-hover:opacity-50 transition-opacity duration-300"></div>
                  <LinkIcon className="h-8 w-8 relative z-10 group-hover:scale-110 transition-transform duration-300" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-2xl bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                    SCC Shortener
                  </span>
                  <span className="text-xs text-purple-200 opacity-75 font-medium">
                    Advanced URL Tracking
                  </span>
                </div>
              </Link>
            </div>

            {/* Navegación principal */}
            <div className="hidden md:flex items-center space-x-2">
              {user ? (
                <>
                  {/* Dashboard Link */}
                  <Link
                    to="/dashboard"
                    className={`group relative flex items-center px-6 py-3 rounded-2xl font-medium transition-all duration-300 ${
                      location.pathname === '/dashboard'
                        ? 'bg-white/20 text-white shadow-lg'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <BarChart3 className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform duration-300" />
                    <span className="link-hover">Dashboard</span>
                    {location.pathname === '/dashboard' && (
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-pink-400/20 rounded-2xl blur-xl"></div>
                    )}
                  </Link>

                  {/* Indicador de usuario */}
                  <div className="flex items-center px-4 py-2 mx-2 bg-white/10 rounded-full backdrop-blur-md border border-white/20">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-2 pulse-glow"></div>
                    <span className="text-white/90 text-sm font-medium truncate max-w-32">
                      {user.email?.split('@')[0]}
                    </span>
                  </div>

                  {/* Botón de cerrar sesión */}
                  <button
                    onClick={handleSignOut}
                    className="group flex items-center px-6 py-3 text-white/80 hover:text-white hover:bg-red-500/20 rounded-2xl font-medium transition-all duration-300 border border-transparent hover:border-red-400/30"
                  >
                    <LogOut className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform duration-300" />
                    <span className="link-hover">Salir</span>
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="group flex items-center px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25"
                >
                  <User className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform duration-300" />
                  <span>Iniciar Sesión</span>
                  <Sparkles className="h-4 w-4 ml-2 opacity-75" />
                </Link>
              )}
            </div>

            {/* Menú móvil */}
            <div className="md:hidden flex items-center space-x-2">
              {user ? (
                <>
                  <Link
                    to="/dashboard"
                    className="p-3 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-300"
                  >
                    <BarChart3 className="h-6 w-6" />
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="p-3 text-white/80 hover:text-white hover:bg-red-500/20 rounded-xl transition-all duration-300"
                  >
                    <LogOut className="h-6 w-6" />
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl transition-all duration-300 hover:scale-105"
                >
                  <User className="h-6 w-6" />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Línea decorativa inferior */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
      </nav>
    </>
  );
}
