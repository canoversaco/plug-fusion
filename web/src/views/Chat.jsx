import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { RefreshCw, Send, Package, MessageSquarePlus, UserPlus } from 'lucide-react'

function Bubble({me, msg}){
  return (
    <div className={`flex ${me?'justify-end':'justify-start'}`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-snug ${me?'bg-emerald-600 text-white':'bg-slate-800 text-slate-50'}`}>
        <div className="opacity-80 text-[11px] mb-0.5">{msg.sender}</div>
        <div>{msg.text}</div>
        <div className="opacity-50 text-[10px] mt-1">{(msg.created_at||'').replace('T',' ').slice(0,16)}</div>
      </div>
    </div>
  )
}

export default function Chat(){
  const { fetchWithAuth, user } = useAuth()
  const [convs,setConvs]=useState([])
  const [active,setActive]=useState(null)
  const [msgs,setMsgs]=useState([])
  const [txt,setTxt]=useState('')
  const [order,setOrder]=useState(null)
  const scRef=useRef(null)

  async function loadConvs(){
    const r=await fetchWithAuth('/api/chat/my'); if(!r.ok) return
    const d=await r.json(); setConvs(d.conversations||[])
    const h=new URL(location.href).hash
    const id=(h.includes('id=') && Number(h.split('id=')[1]))||null
    if(id && !active){ const c=(d.conversations||[]).find(x=>x.id===id); if(c) openConv(c) }
  }
  async function openConv(c){
    setActive(c); setOrder(null)
    const r=await fetchWithAuth(`/api/chat/${c.id}/messages`); if(!r.ok) return
    const d=await r.json(); setMsgs(d.messages||[])
    setTimeout(()=>{ scRef.current?.scrollTo({top:9e6,behavior:'smooth'}) }, 80)
  }
  async function send(){
    const m=txt.trim(); if(!m||!active) return
    setTxt('')
    await fetchWithAuth(`/api/chat/${active.id}/message`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:m})})
    openConv(active)
  }
  async function openOrderInfo(){
    if(!active?.order_id) return
    const r=await fetchWithAuth(`/api/chat/order/${active.order_id}`); if(!r.ok) return
    const d=await r.json(); setOrder(d)
  }
  async function startAdmin(){
    const r=await fetchWithAuth('/api/chat/start/admin',{method:'POST'})
    if(r.ok){ await loadConvs() }
  }
  async function startWith(){
    const u=prompt('Kunden-Benutzername:'); if(!u) return
    const r=await fetchWithAuth('/api/chat/start/with',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:u})})
    if(r.ok){ await loadConvs() }
  }

  useEffect(()=>{ loadConvs(); const id=setInterval(loadConvs,4000); return ()=>clearInterval(id) },[])

  return (
    <div className="mx-auto max-w-screen-md pb-28">
      <div className="sticky top-0 z-20 backdrop-blur bg-slate-950/80 border-b border-slate-800 px-4 py-3 flex items-center gap-2">
        <div className="font-extrabold">Chat</div>
        <div className="ml-auto flex gap-2">
          <button className="inline-flex items-center gap-2 text-sm rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5" onClick={loadConvs}>
            <RefreshCw size={16}/> Aktualisieren
          </button>
          {user?.role==='user' && (
            <button className="inline-flex items-center gap-2 text-sm rounded-xl border border-emerald-600 bg-emerald-500/20 px-3 py-1.5" onClick={startAdmin}>
              <MessageSquarePlus size={16}/> Admin anschreiben
            </button>
          )}
          {(user?.role==='admin'||user?.role==='courier') && (
            <button className="inline-flex items-center gap-2 text-sm rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5" onClick={startWith}>
              <UserPlus size={16}/> Kunde anschreiben
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3">
        <div className="md:col-span-1 rounded-2xl border border-slate-800 bg-slate-900">
          <div className="p-2 text-xs text-slate-400">Unterhaltungen</div>
          <div className="divide-y divide-slate-800">
            {convs.map(c=>(
              <button key={c.id} onClick={()=>openConv(c)} className={`w-full text-left px-3 py-2 hover:bg-slate-800 ${active?.id===c.id?'bg-slate-800':''}`}>
                <div className="text-sm font-semibold truncate">{c.title || (c.type==='order' ? `Bestellung #${c.order_id}` : 'Direkt')}</div>
                <div className="text-xs text-slate-400 truncate">{c.last_message || '—'}</div>
              </button>
            ))}
            {convs.length===0 && <div className="px-3 py-6 text-sm text-slate-500">Keine Chats.</div>}
          </div>
        </div>

        <div className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-900 flex flex-col h-[70vh]">
          {active?.order_id && (
            <div className="m-3 rounded-xl border border-emerald-700/50 bg-emerald-900/20 p-2 text-xs">
              <button className="inline-flex items-center gap-2" onClick={openOrderInfo}>
                <Package size={14}/> Bestellung #{active.order_id} öffnen
              </button>
              {order && order?.order?.id===active.order_id && (
                <div className="mt-2 grid grid-cols-1 gap-1">
                  {order.items.map((it,idx)=>(
                    <div key={idx} className="flex justify-between gap-2">
                      <div className="truncate">{it.name} {it.grams?`(${it.grams}g)`:''}</div>
                      <div className="text-slate-300">{(it.price_cents*it.qty/100).toFixed(2)} €</div>
                    </div>
                  ))}
                  <div className="mt-1 text-right font-semibold">Summe: {(order.order.total_cents/100).toFixed(2)} €</div>
                </div>
              )}
            </div>
          )}

          <div ref={scRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {msgs.map(m=><Bubble key={m.id} me={m.sender===user?.username} msg={m}/>)}
            {msgs.length===0 && <div className="text-sm text-slate-500 px-2">Noch keine Nachrichten.</div>}
          </div>

          <div className="p-2 border-t border-slate-800 flex gap-2">
            <input className="flex-1 rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm" placeholder="Nachricht schreiben…" value={txt} onChange={e=>setTxt(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') send()}}/>
            <button className="rounded-xl border border-emerald-600 bg-emerald-500/20 px-3 py-2" onClick={send}><Send size={16}/></button>
          </div>
        </div>
      </div>
    </div>
  )
}
