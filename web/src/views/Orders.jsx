import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import LiveTracker from '../components/LiveTracker.jsx'
import { Truck, ChevronRight, Clock, PackageSearch } from 'lucide-react'

const norm   = s => (s||'').toString().toLowerCase().replace(/\s+/g,'_')
const ACTIVE = new Set(['offen','akzeptiert','in_arbeit','unterwegs','bestätigt','bestaetigt','angenommen'])
const DONE   = new Set(['abgeschlossen','completed','fertig'])
const CANCEL = new Set(['storniert','canceled','cancelled'])
const cents  = v => typeof v==='number' ? (v/100).toFixed(2)+' €' : ''

const statusPill = (s0)=>{
  const s = norm(s0)
  const base = 'px-2 py-0.5 rounded-lg border text-[11px] capitalize'
  if (s==='offen')        return base+' border-slate-600 bg-slate-700/40 text-slate-200'
  if (s==='akzeptiert')   return base+' border-amber-400 bg-amber-500/15 text-amber-100'
  if (s==='in_arbeit')    return base+' border-sky-400 bg-sky-500/15 text-sky-100'
  if (s==='unterwegs')    return base+' border-indigo-400 bg-indigo-500/15 text-indigo-100'
  if (s==='abgeschlossen')return base+' border-emerald-400 bg-emerald-500/15 text-emerald-100'
  if (s==='storniert')    return base+' border-rose-400 bg-rose-500/15 text-rose-100'
  return base+' border-slate-600 bg-slate-800/40 text-slate-200'
}

function Row({o, open, onToggle}){
  const sKey = norm(o.status)||'offen'
  const created = o?.created_at ? new Date(o.created_at).toLocaleString() : ''
  const etaText = o?.eta_at ? new Date(o.eta_at).toLocaleTimeString().slice(0,5) : null
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <button onClick={onToggle} className="w-full p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-800/60 grid place-items-center"><Truck size={18}/></div>
        <div className="text-left">
          <div className="font-semibold">Bestellung #{o.id} • {cents(o.total_cents)}</div>
          <div className="text-xs opacity-70">{created}</div>
        </div>
        {etaText && <div className="ml-auto mr-2 text-xs opacity-80 flex items-center gap-1"><Clock size={12}/> ETA {etaText}</div>}
        <span className={statusPill(sKey)}>{sKey.replace('_',' ')}</span>
        <ChevronRight size={16} className={`ml-2 transition ${open?'rotate-90':''}`}/>
      </button>

      {open && (
        <div className="p-3 pt-0 space-y-3">
          {/* Live-Tracking */}
          <LiveTracker orderId={o.id}/>

          {/* Positionen */}
          {(o.items?.length||0)>0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="text-xs opacity-80 mb-2">Positionen</div>
              <ul className="text-sm space-y-1">
                {o.items.map((it,idx)=>(
                  <li key={idx} className="flex justify-between gap-3">
                    <span className="truncate">{(it.name||it.product_name||'Artikel')} × {it.qty||1}</span>
                    <span className="opacity-80">{cents(it.total_cents ?? it.price_cents)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Summe */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm flex justify-between">
            <span>Gesamtsumme</span>
            <span className="font-semibold">{cents(o.total_cents)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({title, data, loading}){
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold opacity-80">{title} <span className="ml-2 text-xs opacity-60">({data.length})</span></div>
      {loading && <div className="rounded-xl h-12 bg-slate-800/50 animate-pulse"/>}
      {!loading && data.length===0 && <div className="text-xs opacity-60">Keine Bestellungen.</div>}
      {data.map(o=> <Row key={o.id} o={o} open={data._openId===o.id} onToggle={()=>data._setOpenId(data._openId===o.id?null:o.id)}/>)}
    </div>
  )
}

export default function Orders(){
  const { fetchWithAuth } = useAuth()
  const [orders,setOrders]=useState([])
  const [openId,setOpenId]=useState(null)
  const [loading,setLoading]=useState(true)

  async function load(){
    setLoading(true)
    let list=null
    try{ const r=await fetchWithAuth('/api/my/orders'); if(r.ok){ const j=await r.json(); list=j.orders||j } }catch{}
    if(!Array.isArray(list)){
      try{ const r=await fetchWithAuth('/api/my/orders'); if(r.ok){ const j=await r.json(); list=j.orders||j } }catch{}
    }
    // zusätzlicher Fallback auf allgemeinere Routen (nur zur Sicherheit)
    if(!Array.isArray(list)){
      try{ const r=await fetchWithAuth('/api/orders?mine=1'); if(r.ok){ const j=await r.json(); list=j.orders||j } }catch{}
    }
    setOrders(Array.isArray(list)? list: [])
    setLoading(false)
  }
  useEffect(()=>{ load() },[])

  const groups = useMemo(()=>{
    const g = { aktiv:[], done:[], cancelled:[] }
    for(const o of orders){
      const s = norm(o.status)
      if (DONE.has(s))      g.done.push(o)
      else if (CANCEL.has(s)) g.cancelled.push(o)
      else if (ACTIVE.has(s)) g.aktiv.push(o)
      else g.aktiv.push(o)
    }
    // Sortierung: neueste oben
    for(const k of Object.keys(g)){ g[k].sort((a,b)=> (new Date(b.created_at||0)-new Date(a.created_at||0)) || (b.id-a.id)) }
    return g
  },[orders])

  // Offene Row-Kontrolle pro Section
  const aktivData     = Object.assign([], groups.aktiv);     aktivData._openId=openId; aktivData._setOpenId=setOpenId
  const doneData      = Object.assign([], groups.done);      doneData._openId=openId;  doneData._setOpenId=setOpenId
  const cancelledData = Object.assign([], groups.cancelled); cancelledData._openId=openId; cancelledData._setOpenId=setOpenId

  return (
    <div className="pf-pt-safe pf-pb-safe">
      <PageHeader icon={Truck} title="Meine Bestellungen" subtitle="Aktive Sendungen, ETA & deine Historie" />
      <div className="max-w-screen-md mx-auto p-3 space-y-4">
        <Section title="Aktiv"        data={aktivData}     loading={loading}/>
        <Section title="Abgeschlossen" data={doneData}      loading={loading}/>
        {cancelledData.length>0 && <Section title="Storniert" data={cancelledData} loading={loading}/>}
        {!loading && orders.length===0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-center">
            <PackageSearch className="mx-auto mb-2 opacity-70" size={20}/>
            <div className="font-semibold">Du hast noch keine Bestellungen</div>
            <div className="text-sm opacity-80 mt-1">Starte im Menü und lege etwas in den Warenkorb.</div>
            <button className="btn mt-3" onClick={()=>{ location.hash = '#/menu' }}>Zum Menü</button>
          </div>
        )}
      </div>
    </div>
  )
}
