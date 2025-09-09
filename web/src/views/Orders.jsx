import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { Clock, MapPin, Truck, MessageSquare, Send } from 'lucide-react'

function useSSE(orderId, token, onEvent){
  const esRef = useRef(null)
  useEffect(()=>{
    if (!orderId || !token) return
    try{
      const es = new EventSource(`/api/orders/${orderId}/stream?t=${encodeURIComponent(token)}`)
      es.onmessage = (e)=>{ try{ onEvent(JSON.parse(e.data)) }catch{} }
      es.onerror = ()=>{}
      esRef.current = es
      return ()=>{ es.close() }
    }catch{}
  },[orderId, token, onEvent])
}

export default function Orders(){
  const { token, fetchWithAuth } = useAuth()
  const [list,setList]=useState([])
  const [sel,setSel]=useState(null)
  const [detail,setDetail]=useState(null)
  const [msgs,setMsgs]=useState([])
  const [msg,setMsg]=useState('')

  async function loadList(){
    const r = await fetchWithAuth('/api/my/orders')
    const d = await r.json().catch(()=>({}))
    setList(d.orders||[])
  }
  async function loadDetail(id){
    const r = await fetchWithAuth(`/api/my/orders/${id}`)
    const d = await r.json().catch(()=>({}))
    setDetail(d||null)
    const mr = await fetchWithAuth(`/api/orders/${id}/messages`)
    const md = await mr.json().catch(()=>({}))
    setMsgs(md.messages||[])
  }

  useEffect(()=>{ loadList() },[])
  useEffect(()=>{ if (sel) loadDetail(sel) },[sel])

  useSSE(sel, token, (ev)=>{
    if (ev.kind==='status' && detail?.order){ setDetail(d=>({...d, order:{...d.order, status: ev.status}})) }
    if (ev.kind==='eta' && detail?.order){ setDetail(d=>({...d, order:{...d.order, eta_minutes: ev.eta_minutes}})) }
    if (ev.kind==='position' && detail?.order){ setDetail(d=>({...d, order:{...d.order, courier_lat: ev.lat, courier_lng: ev.lng}})) }
    if (ev.kind==='message'){ loadDetail(sel) }
  })

  return (
    <div className="mx-auto max-w-screen-sm px-3 py-3 pb-28">
      <div className="text-xl font-bold mb-2">Meine Bestellungen</div>
      <div className="space-y-2">
        {list.map(o=>(
          <div key={o.id} className="rounded-xl border border-slate-800 bg-slate-900 p-2 flex items-center justify-between">
            <div>
              <div className="font-semibold">#{o.id} • {(o.total_cents/100).toFixed(2)} €</div>
              <div className="text-xs text-slate-400">{o.status} • {o.mode || 'pickup'}</div>
            </div>
            <button className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm"
                    onClick={()=>setSel(o.id)}>Details</button>
          </div>
        ))}
        {list.length===0 && <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">Noch keine Bestellungen.</div>}
      </div>

      {sel && detail && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-end" onClick={(e)=>{ if(e.target===e.currentTarget){ setSel(null); setDetail(null) }}}>
          <div className="w-full max-h-[88vh] overflow-auto rounded-t-2xl border border-slate-800 bg-slate-950 p-3">
            <div className="h-1 w-12 bg-slate-700 rounded-full mx-auto mb-2" />
            <div className="flex items-center justify-between">
              <div className="font-bold text-lg">Bestellung #{detail.order?.id}</div>
              <button className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm" onClick={()=>{setSel(null); setDetail(null)}}>Schließen</button>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-2">
                <div className="text-xs text-slate-400">Status</div>
                <div className="font-semibold">{detail.order?.status}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-2">
                <div className="text-xs text-slate-400">ETA</div>
                <div className="font-semibold">{detail.order?.eta_minutes!=null ? `${detail.order.eta_minutes} min` : '—'}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-2">
                <div className="text-xs text-slate-400">Kurier</div>
                <div className="font-semibold">{detail.order?.courier_username || '—'}</div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-2">
                <div className="text-xs text-slate-400">Koordinaten</div>
                <div className="font-semibold">{detail.order?.courier_lat!=null ? `${detail.order.courier_lat.toFixed(5)}, ${detail.order.courier_lng.toFixed(5)}` : '—'}</div>
              </div>
            </div>

            <div className="mt-3">
              <div className="text-sm font-bold mb-1">Artikel</div>
              <div className="space-y-1">
                {(detail.items||[]).map(it=>(
                  <div key={it.product_id+'-'+it.grams} className="rounded-lg border border-slate-800 bg-slate-900 p-2 flex items-center justify-between">
                    <div className="text-sm">{it.name} <span className="text-slate-400">• {it.grams}g × {it.qty}</span></div>
                    <div className="text-sm font-semibold">{(it.price_cents/100*it.qty).toFixed(2)} €</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <div className="text-sm font-bold mb-1 inline-flex items-center gap-2"><MessageSquare size={16}/> Chat</div>
              <div className="space-y-1 max-h-56 overflow-auto rounded-xl border border-slate-800 bg-slate-900 p-2">
                {msgs.map(m=>(
                  <div key={m.id} className="text-sm">
                    <span className="text-emerald-400 font-semibold">{m.sender_username}:</span> {m.text}
                    <span className="text-xs text-slate-500"> • {m.created_at}</span>
                  </div>
                ))}
                {msgs.length===0 && <div className="text-sm text-slate-400">Noch keine Nachrichten.</div>}
              </div>
              <div className="mt-2 flex gap-2">
                <input className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm" placeholder="Nachricht…" value={msg} onChange={e=>setMsg(e.target.value)} />
                <button className="rounded-xl border border-slate-700 px-3 py-2 text-sm" onClick={async ()=>{
                  if(!msg.trim()) return
                  const r = await fetchWithAuth(`/api/orders/${sel}/messages`, {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({text:msg})})
                  if(r.ok){ setMsg(''); const mr=await fetchWithAuth(`/api/orders/${sel}/messages`); const md=await mr.json(); setMsgs(md.messages||[]) }
                }}>
                  <Send size={16}/>
                </button>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              {['wartet_bestätigung','angenommen'].includes(detail.order?.status) && (
                <button className="flex-1 rounded-xl border border-red-600 bg-red-500/10 py-2 text-sm font-semibold"
                        onClick={async()=>{ const r=await fetchWithAuth(`/api/my/orders/${sel}/cancel`,{method:'POST'}); if(r.ok){ await loadList(); await loadDetail(sel) } }}>
                  Bestellung stornieren
                </button>
              )}
              <button className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2 text-sm font-semibold"
                      onClick={()=>{ window.location.hash='#/menu' }}>
                Zurück zum Menü
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
