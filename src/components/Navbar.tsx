import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Link as LinkIcon, LogOut, User, BarChart3 } from 'lucide-react';
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
      toast.success('Sesión cerrada exitosamente');
    } catch (error) {
      toast.error('Error al cerrar sesión');
    }
  };

  return (
    <nav className="navbar-minimal">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo y marca */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center text-gray-900 hover:text-gray-700 transition-colors duration-200">
              <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center mr-3">
                <LinkIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-xl text-black">SCC Shortener</span>
                <div className="text-xs text-gray-500 font-medium">URL Tracking</div>
              </div>
            </Link>
          </div>

          {/* Navegación principal */}
          <div className="hidden md:flex items-center space-x-6">
            {user ? (
              <>
                {/* Dashboard Link */}
                <Link
                  to="/dashboard"
                  className={`flex items-center px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    location.pathname === '/dashboard'
                      ? 'bg-yellow-400 text-black'
                      : 'text-gray-700 hover:text-black hover:bg-gray-100'
                  }`}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Dashboard
                </Link>

                {/* Indicador de usuario */}
                <div className="flex items-center px-3 py-1 bg-gray-100 rounded-full border">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></div>
                  <span className="text-gray-700 text-sm font-medium">
                    {user.email?.split('@')[0]}
                  </span>
                </div>

                {/* Botón de cerrar sesión */}
                <button
                  onClick={handleSignOut}
                  className="flex items-center px-4 py-2 text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg font-medium transition-all duration-200"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Salir
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="btn-primary px-6 py-2"
              >
                <User className="h-4 w-4 mr-2" />
                Iniciar Sesión
              </Link>
            )}
          </div>

          {/* Menú móvil */}
          <div className="md:hidden flex items-center space-x-3">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    location.pathname === '/dashboard'
                      ? 'bg-yellow-400 text-black'
                      : 'text-gray-700 hover:text-black hover:bg-gray-100'
                  }`}
                >
                  <BarChart3 className="h-5 w-5" />
                </Link>
                <button
                  onClick={handleSignOut}
                  className="p-2 text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="btn-primary p-2"
              >
                <User className="h-5 w-5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
