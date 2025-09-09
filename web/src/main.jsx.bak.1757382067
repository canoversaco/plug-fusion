import 'leaflet/dist/leaflet.css';

import { CartProvider } from "./cart/CartContext.jsx";
import "./styles.css";

import React from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider, useAuth } from './auth/AuthContext.jsx'
import Login from './auth/Login.jsx'
import App from './App.jsx'

function Gate(){
  const { loading, user } = useAuth()
  if (loading) return <div className="center"><div className="card">Lade…</div></div>
  return user ? <App /> : <Login />
}
createRoot(document.getElementById('root')).render(
  <AuthProvider><CartProvider><Gate/></CartProvider></AuthProvider>
)
// auto-mount Chat FAB
