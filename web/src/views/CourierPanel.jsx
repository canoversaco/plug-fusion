import React, { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'

export default function CourierPanel({ gotoTrack }){
  const { fetchWithAuth } = useAuth()
  const [queue, setQueue] = useState([])
  const [mine, setMine] = useState([])

  const load = async ()=>{
    const q = await fetchWithAuth('/api/courier/queue').then(r=>r.json()).catch(()=>({orders:[]}))
    const m = await fetchWithAuth('/api/courier/my').then(r=>r.json()).catch(()=>({orders:[]}))
    setQueue(q.orders||[]); setMine(m.orders||[])
  }
  useEffect(()=>{ load() },[])

  const claim = async (id)=>{ await fetchWithAuth('/api/orders/'+id+'/claim',{method:'POST'}); await load() }
  const setStatus = async (id, status)=>{ await fetchWithAuth('/api/orders/'+id+'/status',{method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ status })}); await load() }
  const setETA = async (id, minutes)=>{ await fetchWithAuth('/api/orders/'+id+'/eta',{method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ eta_minutes: minutes })}); await load() }

  const Section = ({title, items, actions})=>(
    <div className="card">
      <div className="font-semibold mb-2">{title}</div>
      {items.length===0 ? <div className="opacity-70">leer</div> :
        items.map(o=>(
          <div key={o.id} className="flex items-center justify-between border border-slate-800 rounded-xl px-3 py-2">
            <div className="text-sm">#{o.id} — {o.status} · {(o.total_cents||o.subtotal_cents||0)/100} €</div>
            <div className="flex gap-2">
              {actions(o)}
              <button className="btn-ghost" onClick={()=>gotoTrack?.(o.id)}>Track</button>
            </div>
          </div>
        ))
      }
    </div>
  )

  return (
    <div className="space-y-4">
      <Section title="Offene Bestellungen" items={queue} actions={(o)=>(<>
        <button className="btn" onClick={()=>claim(o.id)}>Annehmen</button>
      </>)} />
      <Section title="Meine Aufträge" items={mine} actions={(o)=>(<>
        <button className="btn-ghost" onClick={()=>setStatus(o.id,'unterwegs')}>Unterwegs</button>
        <button className="btn-ghost" onClick={()=>setStatus(o.id,'zugestellt')}>Zugestellt</button>
        <button className="btn-ghost" onClick={()=>setETA(o.id,15)}>ETA 15m</button>
      </>)} />
    </div>
  )
}
