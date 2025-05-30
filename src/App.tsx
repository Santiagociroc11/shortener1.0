import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Redirect from './pages/Redirect';
import Login from './pages/Login';
import LinkStats from "./pages/LinkStats";
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app-container">
          <Navbar />
          <div className="relative z-10">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/login" element={<Login />} />
              <Route path="/link/:shortUrl" element={<LinkStats />} />
              <Route path="/:shortUrl" element={<Redirect />} />
            </Routes>
          </div>
          <Toaster 
            position="top-right" 
            toastOptions={{
              style: {
                background: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(20px)',
                borderRadius: '15px',
              },
            }}
          />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;