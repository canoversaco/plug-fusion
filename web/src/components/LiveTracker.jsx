import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Truck, Clock, MapPin } from 'lucide-react'

const STATUS_META = {
  offen:        { label:'Offen',        cls:'bg-slate-700/60 text-slate-200' },
  akzeptiert:   { label:'Akzeptiert',   cls:'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  'in_arbeit':  { label:'In Arbeit',    cls:'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
  unterwegs:    { label:'Unterwegs',    cls:'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40' },
  abgeschlossen:{ label:'Abgeschlossen',cls:'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  cancelled:    { label:'Storniert',    cls:'bg-rose-500/20 text-rose-300 border-rose-500/40' },
}

function fmtLeft(ms){
  if (!ms || ms<=0) return 'gleich da'
  const s = Math.floor(ms/1000)
  const m = Math.floor(s/60), r = s%60
  return `${m}m ${String(r).padStart(2,'0')}s`
}

export default function LiveTracker({ orderId, compact=false }){
  const [info,setInfo]=useState(null) // {status, eta_at, courier_lat, courier_lng, customer_lat, customer_lng, created_at, updated_at, total_cents}
  const [now,setNow]=useState(Date.now())
  const esRef=useRef(null)
  const pollRef=useRef(0)

  useEffect(()=>{
    setNow(Date.now())
    const t=setInterval(()=>setNow(Date.now()), 1000)
    return ()=> clearInterval(t)
  },[])

  useEffect(()=>{
    if(!orderId) return
    let stopped=false

    async function fetchOnce(){
      const urls=[
        `/api/orders/${orderId}`,
        `/api/orders/${orderId}/tracking`,
        `/api/orders/tracking/${orderId}`,
        `/api/admin/orders/${orderId}`,
        `/api/orders?id=${orderId}`
      ]
      for(const u of urls){
        try{
          const r = await fetch(u, { credentials:'include' })
          if(!r.ok) continue
          const j = await r.json()
          const obj = j.order || j.data || j
          if (obj && (obj.status || obj.eta_at || obj.id)){
            setInfo(obj); return
          }
        }catch{}
      }
    }

    function trySSE(){
      const paths = [
        `/api/orders/${orderId}/events`,
        `/api/orders/${orderId}/sse`,
        `/api/orders/live?id=${orderId}`
      ]
      for(const p of paths){
        try{
          const es = new EventSource(p, { withCredentials:true })
          es.onmessage = (ev)=>{
            try{
              const j = JSON.parse(ev.data)
              const obj = j.order || j.data || j
              if (obj) setInfo(prev => ({...prev, ...obj}))
            }catch{}
          }
          es.onerror = ()=>{ es.close() }
          esRef.current = es
          return true
        }catch{}
      }
      return false
    }

    // Start
    fetchOnce()
    const hasSSE = trySSE()
    if(!hasSSE){
      clearInterval(pollRef.current)
      pollRef.current = setInterval(fetchOnce, 5000)
    }

    return ()=>{
      stopped=true
      try{ esRef.current && esRef.current.close() }catch{}
      clearInterval(pollRef.current)
    }
  },[orderId])

  const etaMs = useMemo(()=>{
    if (!info?.eta_at) return 0
    const etaTs = new Date(info.eta_at).getTime()
    return Math.max(0, etaTs - now)
  },[info?.eta_at, now])

  const progress = useMemo(()=>{
    const start = info?.created_at ? new Date(info.created_at).getTime() : (info?.updated_at ? new Date(info.updated_at).getTime()-10*60*1000 : now-10*60*1000)
    const end   = info?.eta_at ? new Date(info.eta_at).getTime() : (start + 10*60*1000)
    const pct = Math.max(0, Math.min(100, ((now - start)/(end - start))*100))
    return isFinite(pct)? pct : 0
  },[info?.created_at, info?.updated_at, info?.eta_at, now])

  const statusKey=(info?.status||'offen').toLowerCase()
  const meta = STATUS_META[statusKey] || STATUS_META.offen

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-3">
      {/* Kopf */}
      <div className="flex items-center gap-2">
        <Truck size={16} className="text-emerald-400"/>
        <div className="font-semibold">Live-Tracking</div>
        <div className={`ml-auto px-2 py-0.5 rounded-full text-xs border ${meta.cls}`}>
          {meta.label}
        </div>
      </div>

      {/* ETA + Progress */}
      <div className="flex items-center gap-2 text-sm">
        <Clock size={14} className="opacity-80"/>
        <div className="opacity-80">ETA:</div>
        <div className="font-semibold">{info?.eta_at ? new Date(info.eta_at).toLocaleTimeString().slice(0,5) : '—'}</div>
        <div className="ml-2 text-xs opacity-70">({fmtLeft(etaMs)})</div>
        {typeof info?.total_cents==='number' && (
          <div className="ml-auto text-xs opacity-80">Summe {(info.total_cents/100).toFixed(2)} €</div>
        )}
      </div>
      <div className="h-2 rounded-full overflow-hidden bg-slate-800">
        <div className="h-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-fuchsia-500 transition-all"
             style={{ width: `${progress}%` }} />
      </div>

      {/* Simple „Map“ */}
      <div className="relative h-32 rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage:'radial-gradient(#94a3b8 1px, transparent 1px)',
          backgroundSize:'12px 12px'
        }}/>
        <div className="absolute left-3 top-3 flex items-center gap-1 text-xs opacity-80">
          <MapPin size={12}/> Kunde
        </div>
        <div className="absolute right-3 bottom-3 flex items-center gap-1 text-xs opacity-80">
          <Truck size={12}/> Kurier
        </div>
        {/* animierter Punkt (pulsierend), wandert proportional zum Progress */}
        <div className="absolute w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_10px_2px_rgba(16,185,129,.6)]"
             style={{
               left: `calc(${progress}% - 8px)`,
               top: `calc(${Math.max(10, 100 - progress)}% - 8px)`,
               transition:'left .6s ease, top .6s ease'
             }}>
          <div className="absolute inset-0 rounded-full animate-ping bg-emerald-400/50"></div>
        </div>
      </div>

      {!info && (
        <div className="text-xs opacity-70">Warte auf Tracking-Daten …</div>
      )}
    </div>
  )
}
