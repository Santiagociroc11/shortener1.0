import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Link as LinkIcon, LogOut, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation(); // Obtener la ruta actual

  // Definir las rutas donde la Navbar debe aparecer
  const activeRoutes = ["/", "/dashboard", "/login"];
  const isActiveRoute = activeRoutes.includes(location.pathname) || location.pathname.startsWith("/link/");

  // Si la ruta no está en la lista de activas, no renderizar la Navbar
  if (!isActiveRoute) return null;

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
      toast.success('Signed out successfully');
    } catch (error) {
      toast.error('Error signing out');
    }
  };

  return (
    <>
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center text-gray-900">
                <LinkIcon className="h-6 w-6 mr-2" />
                <span className="font-bold text-xl">Acortador con Tracking - SCC</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <Link
                    to="/dashboard"
                    className="text-gray-700 hover:text-gray-900 flex items-center"
                  >
                    <User className="h-5 w-5 mr-1" />
                    Dashboard
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="text-gray-700 hover:text-gray-900 flex items-center"
                  >
                    <LogOut className="h-5 w-5 mr-1" />
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="text-gray-700 hover:text-gray-900 flex items-center"
                >
                  <User className="h-5 w-5 mr-1" />
                  Iniciar sesión
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
