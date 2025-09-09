import React, { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { RotateCcw, Bike, Clock, MapPin, Navigation, CheckCircle2 } from 'lucide-react'

export default function Courier(){
  const { fetchWithAuth, user } = useAuth()
  const canSee = user && (user.role==='courier' || user.role==='admin')
  const [openOrders,setOpenOrders]=useState([])
  const [myOrders,setMyOrders]=useState([])
  const [errOpen,setErrOpen]=useState('')
  const [errMine,setErrMine]=useState('')
  const [eta,setEta]=useState('')
  const [lat,setLat]=useState(null)
  const [lng,setLng]=useState(null)

  async function loadBoth(){
    setErrOpen(''); setErrMine('')
    try{
      const ro = await fetchWithAuth('/api/courier/orders/all')
      if(!ro.ok){ setErrOpen(`Fehler ${ro.status}`); setOpenOrders([]) }
      else{ const d=await ro.json().catch(()=>({})); setOpenOrders(d.orders||[]) }
    }catch{ setErrOpen('Netzwerkfehler'); setOpenOrders([]) }

    try{
      const rm = await fetchWithAuth('/api/courier/orders/mine')
      if(!rm.ok){ setErrMine(`Fehler ${rm.status}`); setMyOrders([]) }
      else{ const d=await rm.json().catch(()=>({})); setMyOrders(d.orders||[]) }
    }catch{ setErrMine('Netzwerkfehler'); setMyOrders([]) }
  }

  useEffect(()=>{ if(canSee) loadBoth() },[canSee])
  useEffect(()=>{
    if(!canSee) return
    const id = setInterval(loadBoth, 5000) // Auto-Refresh
    return ()=>clearInterval(id)
  },[canSee])

  function gps(){ if(!navigator.geolocation) return; navigator.geolocation.getCurrentPosition(p=>{ setLat(p.coords.latitude); setLng(p.coords.longitude) }) }

  if(!canSee) return <div className="mx-auto max-w-screen-sm p-4">Kein Zugriff. (Rolle „courier“ oder „admin“)</div>

  return (
    <div className="mx-auto max-w-screen-sm px-3 pb-28">
      <div className="sticky top-0 z-20 backdrop-blur-md bg-slate-950/80 border-b border-slate-800 px-2 py-3 flex items-center gap-2">
        <div className="font-extrabold text-lg">Kurier</div>
        <button className="ml-auto rounded-xl border border-slate-700 px-3 py-2 text-sm inline-flex items-center gap-2" onClick={loadBoth}>
          <RotateCcw size={16}/> Aktualisieren
        </button>
      </div>

      {/* Quick-Update */}
      <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
        <div className="text-xs text-slate-400 mb-2">Schnell-Update</div>
        <div className="grid grid-cols-3 gap-2">
          <input className="rounded-lg bg-slate-950 border border-slate-700 px-2 py-2 text-sm" placeholder="ETA (Min)" value={eta} onChange={e=>setEta(e.target.value)} />
          <input className="rounded-lg bg-slate-950 border border-slate-700 px-2 py-2 text-sm" placeholder="Lat" value={lat??''} onChange={e=>setLat(e.target.value)} />
          <input className="rounded-lg bg-slate-950 border border-slate-700 px-2 py-2 text-sm" placeholder="Lng" value={lng??''} onChange={e=>setLng(e.target.value)} />
        </div>
        <div className="mt-2 flex gap-2">
          <button className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2 text-sm" onClick={gps}>GPS übernehmen</button>
        </div>
      </div>

      {/* Offen */}
      <div className="mt-4">
        <div className="text-sm font-semibold mb-2">Alle Bestellungen</div>
        {errOpen && <div className="mb-2 rounded-lg border border-red-800 bg-red-900/30 p-2 text-sm">{errOpen}</div>}
        <div className="space-y-2">
          {openOrders.map(o=>(
            <div key={o.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold">#{o.id} • {(o.total_cents/100).toFixed(2)} €</div>
                <button className="rounded-lg border border-emerald-600 bg-emerald-500/20 px-3 py-1.5 text-sm"
                        onClick={async()=>{ const r=await fetchWithAuth(`/api/courier/orders/${o.id}/claim`,{method:'POST'}); if(r.ok) loadBoth() }}>
                  Übernehmen
                </button>
              </div>
              <div className="text-xs text-slate-400">Status: {o.status} • Kunde: {o.user_username}</div>
            </div>
          ))}
          {openOrders.length===0 && !errOpen && <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">leer</div>}
        </div>
      </div>

      {/* Meine */}
      <div className="mt-6">
        <div className="text-sm font-semibold mb-2">Meine Aufträge</div>
        {errMine && <div className="mb-2 rounded-lg border border-red-800 bg-red-900/30 p-2 text-sm">{errMine}</div>}
        <div className="space-y-2">
          {myOrders.map(o=>(
            <div key={o.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
              <div className="font-semibold mb-1">#{o.id} • {(o.total_cents/100).toFixed(2)} €</div>
              <div className="text-xs text-slate-400 mb-2">Status: {o.status} • ETA: {o.eta_minutes!=null?`${o.eta_minutes} min`:'—'}</div>
              <div className="grid grid-cols-2 gap-2">
                <button className="rounded-lg border border-slate-700 px-2 py-2 text-sm flex items-center justify-center gap-2"
                        onClick={async()=>{ if(eta) await fetchWithAuth(`/api/courier/orders/${o.id}/eta`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({eta_minutes:Number(eta)})}); loadBoth() }}>
                  <Clock size={16}/> ETA
                </button>
                <button className="rounded-lg border border-slate-700 px-2 py-2 text-sm flex items-center justify-center gap-2"
                        onClick={async()=>{ if(lat!=null && lng!=null) await fetchWithAuth(`/api/courier/orders/${o.id}/location`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({lat:Number(lat),lng:Number(lng)})}); loadBoth() }}>
                  <MapPin size={16}/> Position
                </button>
                <button className="rounded-lg border border-slate-700 px-2 py-2 text-sm flex items-center justify-center gap-2"
                        onClick={async()=>{ await fetchWithAuth(`/api/courier/orders/${o.id}/status`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({status:'unterwegs'})}); loadBoth() }}>
                  <Bike size={16}/> Unterwegs
                </button>
                <button className="rounded-lg border border-slate-700 px-2 py-2 text-sm flex items-center justify-center gap-2"
                        onClick={async()=>{ await fetchWithAuth(`/api/courier/orders/${o.id}/status`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({status:'angekommen'})}); loadBoth() }}>
                  <Navigation size={16}/> Angekommen
                </button>
                <button className="col-span-2 rounded-lg border border-emerald-600 bg-emerald-500/20 px-2 py-2 text-sm flex items-center justify-center gap-2"
                        onClick={async()=>{ await fetchWithAuth(`/api/courier/orders/${o.id}/status`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({status:'abgeschlossen'})}); loadBoth() }}>
                  <CheckCircle2 size={16}/> Abgeschlossen
                </button>
              </div>
            </div>
          ))}
          {myOrders.length===0 && !errMine && <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">leer</div>}
        </div>
      </div>
    </div>
  )
}
