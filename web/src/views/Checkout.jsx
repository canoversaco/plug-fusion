import React, { useEffect, useMemo, useState } from 'react'
import { Minus, Plus, Trash2, ShoppingCart, Check, ArrowRight } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { useCart as _useCart } from '../cart/CartContext.jsx'

const fmt = (c)=> ((c||0)/100).toFixed(2)+' €'

function useCartSafe(){
  const ctx = (typeof _useCart === 'function') ? _useCart() : null
  const [localItems, setLocalItems] = useState([])
  const [tick, setTick] = useState(false)

  useEffect(()=>{
    if (ctx) return
    try{
      const raw = localStorage.getItem('pf_cart') || '[]'
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) setLocalItems(arr)
    }catch{ setLocalItems([]) }
  }, [ctx])

  const add   = (p,q=1)=> ctx?.addItem ? ctx.addItem(p,q) : setLocalItems(arr=>{
    const cp = [...arr]; const id=String(p.id); const i = cp.findIndex(x=>String(x.id)===id)
    if (i>=0) cp[i].qty = Math.min(99,(cp[i].qty||1)+q)
    else cp.push({ id:p.id, name:p.name, price_cents:(p.sale_price_cents??p.price_cents??0), qty:q, image_url:p.image_url||p.banner_image_url||null})
    localStorage.setItem('pf_cart', JSON.stringify(cp)); setTick(v=>!v); return cp
  })
  const remove= (id)=> ctx?.removeItem ? ctx.removeItem(id) : setLocalItems(arr=>{
    const cp = arr.filter(x=>String(x.id)!==String(id)); localStorage.setItem('pf_cart', JSON.stringify(cp)); setTick(v=>!v); return cp
  })
  const setQty= (id,q)=> ctx?.setQty ? ctx.setQty(id,q) : setLocalItems(arr=>{
    const cp = arr.map(x=> String(x.id)===String(id) ? { ...x, qty:Math.max(1,Math.min(99,q)) } : x )
    localStorage.setItem('pf_cart', JSON.stringify(cp)); setTick(v=>!v); return cp
  })
  const clear = ()=> ctx?.clearCart ? ctx.clearCart() : (localStorage.setItem('pf_cart','[]'), setLocalItems([]), setTick(v=>!v))

  const items = ctx?.items ?? localItems
  const totalCents = ctx?.totalCents ?? items.reduce((s,it)=> s + (it.price_cents||0)*(it.qty||1), 0)
  const count = ctx?.count ?? items.reduce((n,it)=> n + (it.qty||1), 0)

  return { items, totalCents, count, add, remove, setQty, clear }
}

function authHeaders(){
  const token = (typeof localStorage!=='undefined' && (localStorage.getItem('token')||localStorage.getItem('authToken')||localStorage.getItem('jwt'))) || ''
  const h = {'content-type':'application/json'}
  if (token) h['authorization'] = 'Bearer '+token
  return { h, token }
}

async function tryPOST(fetcher, url, body, token){
  // zusätzlich: token auch als Query, falls Header ignoriert wird
  const u = token ? (url + (url.includes('?')?'&':'?') + 'token=' + encodeURIComponent(token)) : url
  try{
    const r = await fetcher(u, { method:'POST', headers: {'content-type':'application/json', ...(token?{'authorization':'Bearer '+token}:{})}, body: JSON.stringify(body) })
    const ok = r.ok || [200,201,202].includes(r.status)
    const txt = await r.text().catch(()=>null)
    if (!ok) return { ok:false, status:r.status, text:txt }
    if (!txt) return { ok:true, data:{} }
    try{ return { ok:true, data: JSON.parse(txt) } } catch { return { ok:true, data:{} } }
  }catch(e){
    return { ok:false, status:0, text:String(e) }
  }
}

function buildPayloads(items){
  // Normalisierte Items
  const norm = items.map(it=>({
    id: it.id,
    product_id: it.id,
    qty: it.qty||1,
    quantity: it.qty||1,
    price_cents: it.price_cents||0
  }))
  // optionale Adresse aus LocalStorage (falls dein Flow Treffpunkt/Adresse speichert)
  let addr = null
  try{
    const p = JSON.parse(localStorage.getItem('pf_address')||'null') || JSON.parse(localStorage.getItem('profile')||'null')
    if (p) addr = p.address || p.destination || p.addr || null
  }catch{}
  const common = addr ? { destination: addr, address: addr } : {}

  return [
    { // häufigster Fall in diesem Projekt
      items: norm.map(n=>({ product_id:n.product_id, qty:n.qty })), ...common
    },
    { lines: norm.map(n=>({ product_id:n.product_id, quantity:n.quantity })), ...common },
    { cart:  norm.map(n=>({ id:n.id, qty:n.qty })), ...common },
    { products: norm.map(n=>({ id:n.id, qty:n.qty })), ...common },
    { order: { items: norm.map(n=>({ product_id:n.product_id, qty:n.qty })), ...common } },
    { // ganz minimal
      items: norm.map(n=>({ id:n.id, qty:n.qty })), ...common
    }
  ]
}

export default function Checkout(){
  const { fetchWithAuth } = useAuth()
  const fetcher = fetchWithAuth || fetch
  const cart = useCartSafe()

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const lines = useMemo(()=> cart.items.map(it=>({
    id: it.id, name: it.name, qty: it.qty||1, price_cents: it.price_cents||0
  })), [cart.items])

  const total = cart.totalCents
  const canPay = lines.length>0 && !submitting

  async function submit(){
    if (lines.length===0) { setError('Warenkorb ist leer.'); return }
    setSubmitting(true); setError(null)

    const { h, token } = authHeaders()
    const endpoints = [
      '/api/orders/checkout',
      '/api/checkout',
      '/api/orders/create',
      '/api/order/create',
      '/api/orders',          // POST
      '/api/order',           // POST
      '/api/orders/new',
      '/api/orders/submit',
      '/api/checkout/min',
    ]
    const payloads = buildPayloads(lines)

    // nacheinander alle Kombinationen testen
    let resp = { ok:false }
    for (const url of endpoints){
      for (const body of payloads){
        resp = await tryPOST(fetcher, url, body, token)
        if (resp.ok){
          // Order-ID herausfinden
          const d = resp.data || {}
          const oid = d.order_id || d.id || d.order?.id || d.data?.id
          cart.clear()
          window.location.hash = oid ? `#/orders/${oid}` : '#/orders'
          setSubmitting(false)
          return
        }
        // bei 401: gleich abbrechen und Hinweis anzeigen
        if (resp.status===401){ setSubmitting(false); setError('Nicht eingeloggt. Bitte zuerst anmelden.'); return }
      }
    }

    // Wenn alles scheitert: Fehltext anzeigen (gekürzt)
    const msg = resp.text ? String(resp.text).slice(0,240) : 'Unbekannter Fehler'
    setError(`Checkout fehlgeschlagen. ${msg}`)
    setSubmitting(false)
  }

  return (
    <div className="pf-pt-safe pf-pb-safe p-3 space-y-3">
      <div className="rounded-2xl p-4 bg-gradient-to-r from-emerald-600/20 via-fuchsia-600/20 to-cyan-600/20 border border-slate-800">
        <div className="text-xs opacity-80">Checkout</div>
        <div className="text-2xl font-extrabold flex items-center gap-2"><ShoppingCart size={18}/> Warenkorb</div>
      </div>

      {error && <div className="rounded-xl border border-rose-600/50 bg-rose-500/10 p-3 text-sm">⚠️ {error}</div>}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="px-3 py-2 text-sm font-semibold border-b border-slate-800">Artikel</div>
        {lines.length===0 ? (
          <div className="p-3 text-sm opacity-70">Dein Warenkorb ist leer.</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {lines.map(it=>(
              <div key={it.id} className="p-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-sm font-semibold">{it.name||('Artikel #'+it.id)}</div>
                  <div className="text-xs opacity-70">{fmt(it.price_cents)} • Einzelpreis</div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-2 py-1 rounded-lg border border-slate-700" onClick={()=>cart.setQty(it.id, Math.max(1,(it.qty||1)-1))}><Minus size={14}/></button>
                  <div className="w-8 text-center">{it.qty}</div>
                  <button className="px-2 py-1 rounded-lg border border-slate-700" onClick={()=>cart.setQty(it.id, Math.min(99,(it.qty||1)+1))}><Plus size={14}/></button>
                </div>
                <div className="w-20 text-right font-semibold">{fmt(it.price_cents*(it.qty||1))}</div>
                <button className="btn-ghost text-rose-400" onClick={()=>cart.remove(it.id)}><Trash2 size={16}/></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summe & Aktionen */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
        <div className="flex justify-between text-sm">
          <span>Zwischensumme</span>
          <span className="font-semibold">{fmt(total)}</span>
        </div>
        <div className="mt-2 flex gap-2">
          <button className="btn-ghost" onClick={cart.clear}><Trash2 size={16}/> Leeren</button>
          <button className="btn inline-flex items-center gap-2 ml-auto" disabled={!lines.length || submitting} onClick={submit}>
            {submitting ? 'Sende…' : (<><Check size={16}/> Bezahlen <ArrowRight size={16}/></>)}
          </button>
        </div>
      </div>
    </div>
  )
}
