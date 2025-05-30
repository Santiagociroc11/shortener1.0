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
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/login" element={<Login />} />
            <Route path="/link/:shortUrl" element={<LinkStats />} />
            <Route path="/:shortUrl" element={<Redirect />} />
          </Routes>
          <Toaster 
            position="top-right" 
            toastOptions={{
              style: {
                background: 'white',
                color: '#111827',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
              },
            }}
          />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;