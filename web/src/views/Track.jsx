import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

export default function Track({ orderId, onBack }){
  const { user, fetchWithAuth } = useAuth()
  const [order, setOrder] = useState(null)
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('')
  const [eta, setEta] = useState('')
  const [msg, setMsg] = useState('')
  const [chat, setChat] = useState([])
  const [sendText, setSendText] = useState('')
  const mapRef = useRef(null), markerRef = useRef(null)

  // Load order + messages
  useEffect(()=>{ (async()=>{
    const o = await fetchWithAuth('/api/orders/'+orderId).then(r=>r.json())
    setOrder(o.order||null); setItems(o.items||[])
    const m = await fetch('/api/orders/'+orderId+'/chat').then(r=>r.json())
    setChat(m.messages||[])
    setStatus(o.order?.status||'')
    setEta(o.order?.eta_at||'')
  })() },[orderId])

  // SSE subscribe
  useEffect(()=>{
    const ev = new EventSource('/api/orders/'+orderId+'/chat/stream')
    ev.onmessage = e => {
      try{
        const data = JSON.parse(e.data)
        if (data.type==='status'){ setStatus(data.status) }
        if (data.type==='eta'){ setEta(data.eta_at || '') }
        if (data.type==='location'){ placeMarker(data.lat, data.lng) }
      }catch{}
    }
    return ()=>ev.close()
  },[orderId])

  // Leaflet Map init
  function ensureMap(){
    if (mapRef.current) return mapRef.current
    const m = L.map('trackmap', { center:[52.52,13.405], zoom:12 })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OSM' }).addTo(m)
    mapRef.current = m
    return m
  }
  function placeMarker(lat,lng){
    const m = ensureMap()
    if (!markerRef.current){
      markerRef.current = L.marker([lat,lng]).addTo(m)
    } else {
      markerRef.current.setLatLng([lat,lng])
    }
    m.setView([lat,lng], 13)
  }

  const claim = async ()=>{
    const r = await fetchWithAuth('/api/orders/'+orderId+'/claim', { method:'POST' })
    const d = await r.json(); setMsg(r.ok?'✅ übernommen':'Fehler: '+(d?.error||''))
  }
  const sendEta = async (minutes)=>{
    const r = await fetchWithAuth('/api/orders/'+orderId+'/eta', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ eta_minutes: Number(minutes) }) })
    const d = await r.json(); setEta(d.eta_at||''); setMsg(r.ok?'✅ ETA gesendet':'Fehler: '+(d?.error||''))
  }
  const sendLoc = async ()=>{
    if (!navigator.geolocation) return setMsg('Geolocation nicht verfügbar')
    navigator.geolocation.getCurrentPosition(async (pos)=>{
      const { latitude:lat, longitude:lng } = pos.coords
      const r = await fetchWithAuth('/api/orders/'+orderId+'/location', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ lat, lng }) })
      setMsg(r.ok?'✅ Standort gesendet':'Fehler beim Standort')
    }, ()=> setMsg('Geolocation verweigert'))
  }
  const sendChat = async ()=>{
    const payload = { sender: user?.username||'anon', ciphertext: sendText, iv:'-' }
    const r = await fetch('/api/orders/'+orderId+'/chat', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) })
    if (r.ok){ setChat([...chat, { ...payload, created_at:new Date().toISOString() }]); setSendText('') }
  }

  const isCourierOrAdmin = user?.role==='courier' || user?.role==='admin'
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button className="btn-ghost" onClick={onBack}>← Zurück</button>
        <h3 className="font-semibold">Tracking #{orderId}</h3>
      </div>

      <div className="card">
        <div className="grid sm:grid-cols-3 gap-2 text-sm">
          <div>Status: <b>{status||order?.status||'-'}</b></div>
          <div>ETA: <b>{eta? new Date(eta).toLocaleString() : '—'}</b></div>
          <div>Kurier: <b>{order?.courier_username||'—'}</b></div>
        </div>
      </div>

      <div id="trackmap" className="rounded-xl border border-slate-800 h-60"></div>

      <div className="card">
        <div className="font-semibold mb-2">Bestellung</div>
        {items.map(it=>(
          <div key={it.id} className="flex items-center justify-between text-sm py-1 border-b border-slate-800/50">
            <div>{it.name} × {it.qty}</div>
            <div>{((it.price_cents||0)*it.qty/100).toFixed(2)} €</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="font-semibold mb-2">Chat</div>
        <div className="space-y-1 max-h-40 overflow-auto">
          {chat.map((m,i)=> <div key={i} className="text-sm"><b>{m.sender}:</b> {m.ciphertext}</div>)}
        </div>
        <div className="mt-2 flex gap-2">
          <input className="input flex-1" placeholder="Nachricht…" value={sendText} onChange={e=>setSendText(e.target.value)} />
          <button className="btn" onClick={sendChat}>Senden</button>
        </div>
      </div>

      {isCourierOrAdmin && (
        <div className="card">
          <div className="font-semibold mb-2">Kurier/Admin Aktionen</div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={claim}>Bestellung annehmen</button>
            <button className="btn-ghost" onClick={()=>sendEta(15)}>ETA 15m</button>
            <button className="btn-ghost" onClick={()=>sendEta(30)}>ETA 30m</button>
            <button className="btn-ghost" onClick={sendLoc}>Standort senden</button>
          </div>
          {msg ? <div className="mt-2 opacity-80 text-sm">{msg}</div> : null}
        </div>
      )}
    </div>
  )
}
