import React, { createContext, useContext, useMemo, useState } from 'react'

const Ctx = createContext(null)

export function AuthProvider({ children }){
  const [user, setUser] = useState(()=>{ try{ return JSON.parse(localStorage.getItem('pf_user')||'null') }catch{ return null } })
  const [token, setToken] = useState(()=> localStorage.getItem('pf_token') || '')

  const login = async (username, password)=>{
    const r = await fetch('/api/login', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ username, password }) })
    const d = await r.json()
    if (!r.ok) throw new Error(d?.error || 'login_failed')
    setUser(d.user); setToken(d.token)
    localStorage.setItem('pf_user', JSON.stringify(d.user))
    localStorage.setItem('pf_token', d.token)
    return d
  }
  const logout = ()=>{
    setUser(null); setToken('')
    localStorage.removeItem('pf_user'); localStorage.removeItem('pf_token')
  }
  const fetchWithAuth = (input, init={})=>{
    const headers = new Headers(init.headers || {})
    if (token) headers.set('Authorization','Bearer '+token)
    if (!headers.has('content-type') && init.body) headers.set('content-type','application/json')
    return fetch(input, { ...init, headers })
  }
  const value = useMemo(()=>({ user, token, login, logout, fetchWithAuth }), [user, token])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export const useAuth = ()=> useContext(Ctx)
