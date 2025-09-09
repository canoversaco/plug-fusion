import React, { useState } from 'react'
import { useAuth } from './AuthContext.jsx'

export default function Login(){
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    try { await login(username, password) }
    catch { setErr('Benutzername oder Passwort ist falsch.') }
    setBusy(false)
  }

  return (
    <div className="center">
      <form className="card" onSubmit={onSubmit}>
        <h2 style={{margin:'0 0 8px'}}>Willkommen 👋</h2>
        <p className="muted" style={{marginTop:0}}>Melde dich mit deinem Konto an.</p>
        <div style={{display:'grid', gap:12, margin:'16px 0'}}>
          <input className="input" placeholder="Benutzername" autoComplete="username"
                 value={username} onChange={e=>setUsername(e.target.value)} />
          <input className="input" placeholder="Passwort" type="password" autoComplete="current-password"
                 value={password} onChange={e=>setPassword(e.target.value)} />
          {err ? <div className="err">{err}</div> : null}
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Anmelden…' : 'Anmelden'}</button>
        </div>
      </form>
    </div>
  )
}
