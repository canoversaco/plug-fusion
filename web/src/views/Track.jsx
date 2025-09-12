import React, { useEffect, useState } from 'react'
import { Clock, MapPin, Navigation, CheckCircle2, Loader2 } from 'lucide-react'

const STATUS_LABEL = {offen:'Offen', akzeptiert:'Akzeptiert', in_arbeit:'In Arbeit', unterwegs:'Unterwegs', abgeschlossen:'Abgeschlossen'}
const STATUS_STYLE = {
  offen:'bg-slate-800 text-slate-200 ring-1 ring-slate-600',
  akzeptiert:'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/60',
  in_arbeit:'bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/60',
  unterwegs:'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/60',
  abgeschlossen:'bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/60'
}
const canon=(s)=>{ s=String(s||'').toLowerCase()
  if (/(abgeschlossen|completed|delivered|finished|done)/.test(s)) return 'abgeschlossen'
  if (/(unterwegs|in_transit|on[_-]?the[_-]?way)/.test(s)) return 'unterwegs'
  if (/(in[_-]?arbeit|in[_-]?progress|preparing)/.test(s)) return 'in_arbeit'
  if (/(akzeptiert|angenommen|accepted|assigned|claimed)/.test(s)) return 'akzeptiert'
  return 'offen'
}
const parseTime=v=>{ if(!v) return null; const t=typeof v==='number'?v:Date.parse(v); return isNaN(t)?null:t }
const etaCalc=o=>{ const now=Date.now()
  const etaAt=parseTime(o.eta_at||o.etaAt); if(etaAt) return {target:etaAt,ms:Math.max(0,etaAt-now)}
  const m=o.eta_minutes??o.etaMinutes??o.eta_min; if(typeof m==='number'){ const t=now+m*60*1000; return {target:t,ms:m*60*1000} }
  const base=({offen:25,akzeptiert:18,in_arbeit:12,unterwegs:8,abgeschlossen:0})[canon(o.status)]??20
  const created=parseTime(o.created_at||o.created)||now; const t=created+base*60*1000; return {target:t,ms:Math.max(0,t-now)}
}
const etaText=ms=>{ const m=Math.round(ms/60000); if(m<=0) return 'gleich da'; if(m<60) return `≈ ${m} min`; const h=Math.floor(m/60),mm=m%60; return `≈ ${h}h ${mm}m` }

export default function Track(){
  const [order,setOrder]=useState(null)
  const [loading,setLoading]=useState(true)
  const id = (location.hash.match(/\d+$/)||[])[0]

  async function load(){
    setLoading(true)
    try{
      const r = await fetch(`/api/orders/${id}`)
      const d = await r.json().catch(()=>({}))
      setOrder(d.order || d || null)
    }catch{ /* noop */ }
    setLoading(false)
  }
  useEffect(()=>{ load(); const t=setInterval(load, 5000); return ()=>clearInterval(t) },[id])

  if (!id) return <div className="p-4">Keine Bestellnummer gefunden.</div>
  if (loading && !order) return <div className="p-6 flex items-center gap-2"><Loader2 className="animate-spin"/><div>Lade Tracking…</div></div>
  if (!order) return <div className="p-4">Bestellung nicht gefunden.</div>

  const v = canon(order.status)
  const eta = etaCalc(order)

  return (
    <div className="pf-pt-safe pf-pb-safe p-4">
      <div className="max-w-xl mx-auto space-y-4">
        <div className="rounded-2xl p-4 bg-gradient-to-r from-slate-800/80 to-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs opacity-80">Bestellung #{order.id}</div>
              <div className="text-xl font-extrabold flex items-center gap-2">
                Live-Tracking
                <span className={`px-2 py-0.5 rounded-full text-[11px] ${STATUS_STYLE[v]}`}>{STATUS_LABEL[v]}</span>
              </div>
            </div>
            <div className="text-right text-sm opacity-80">
              <div className="flex items-center gap-1 justify-end"><Clock size={14}/> {etaText(eta.ms)}</div>
              {order.destination||order.address ? <div className="flex items-center gap-1 justify-end"><MapPin size={14}/> {order.destination||order.address}</div> : null}
            </div>
          </div>

          {/* animierter Fortschritt */}
          <div className="mt-4 relative">
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className={`h-2 ${v==='unterwegs'?'animate-pulse':''} ${v==='in_arbeit'?'animate-[pulse_1.5s_ease-in-out_infinite]':''} bg-gradient-to-r from-emerald-500 via-cyan-500 to-fuchsia-500`} style={{
                width: v==='offen'? '8%' : v==='akzeptiert'? '25%' : v==='in_arbeit'? '55%' : v==='unterwegs'? '85%' : '100%'
              }} />
            </div>
            <div className="mt-2 text-xs opacity-80">
              {v==='offen' && 'Wartet auf Bestätigung'}
              {v==='akzeptiert' && 'Bestellung wurde angenommen'}
              {v==='in_arbeit' && 'Deine Bestellung wird vorbereitet'}
              {v==='unterwegs' && 'Kurier ist auf dem Weg'}
              {v==='abgeschlossen' && 'Zugestellt • Vielen Dank!'}
            </div>
          </div>
        </div>

        {/* Positionen (falls vorhanden) */}
        {(order.items||order.order_items)?.length ? (
          <div className="rounded-2xl p-4 border border-slate-800 bg-slate-950/60">
            <div className="text-sm font-semibold mb-2">Bestellte Artikel</div>
            <div className="space-y-1 text-sm">
              {(order.items||order.order_items).map((it,i)=>(
                <div key={i} className="flex justify-between">
                  <div className="opacity-80">{it.name||it.product_name||`Pos. ${i+1}`}{it.qty?` × ${it.qty}`:''}</div>
                  <div className="font-mono">{((it.total_cents ?? it.price_cents ?? 0)/100).toFixed(2)} €</div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-right text-sm font-semibold">
              {order.total_cents!=null ? <>Summe {(order.total_cents/100).toFixed(2)} €</> : null}
            </div>
          </div>
        ) : null}

        {v!=='abgeschlossen' ? (
          <div className="rounded-2xl p-4 border border-slate-800 bg-slate-950/40 flex items-center gap-2">
            <Navigation size={18} className="opacity-80"/><div className="text-sm opacity-80">Tracking aktualisiert automatisch.</div>
          </div>
        ) : (
          <div className="rounded-2xl p-4 border border-teal-700/50 bg-teal-500/10 flex items-center gap-2">
            <CheckCircle2 size={18} className="opacity-80"/><div className="text-sm">Abgeschlossen – Guten Appetit!</div>
          </div>
        )}
      </div>
    </div>
  )
}
