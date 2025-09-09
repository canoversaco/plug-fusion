import React, { useEffect, useMemo, useState } from 'react'
import { ShoppingCart, X, Minus, Plus, LayoutGrid, List, Tag, Sparkles } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'

function usePersistentCart(){
  const [cart, setCart] = useState(()=>{ try { return JSON.parse(localStorage.getItem('pf_cart')||'[]') } catch { return [] } })
  const persist = (c)=>{ setCart(c); localStorage.setItem('pf_cart', JSON.stringify(c)) }
  const add = (item)=>{ const next=[...cart]; const i=next.findIndex(x=>x.id===item.id && x.grams===item.grams); if(i>=0) next[i].qty+=item.qty||1; else next.push({...item, qty:item.qty||1}); persist(next) }
  const inc = (id,grams)=> persist(cart.map(x=> x.id===id && x.grams===grams ? {...x, qty:x.qty+1} : x))
  const dec = (id,grams)=> persist(cart.flatMap(x=> x.id===id && x.grams===grams ? (x.qty>1?[{...x, qty:x.qty-1}]:[]) : [x]))
  const clear = ()=> persist([])
  const total = cart.reduce((s,x)=> s + x.price_cents*x.qty, 0)
  const count = cart.reduce((s,x)=> s + x.qty, 0)
  return { cart, add, inc, dec, clear, total, count }
}

export default function Menu(){
  const { fetchWithAuth } = useAuth()
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [tiers, setTiers] = useState([])
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [sale, setSale] = useState(false)
  const [feat, setFeat] = useState(false)
  const [view, setView] = useState('list')
  const [toast, setToast] = useState('')
  const [showCart, setShowCart] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selGrams, setSelGrams] = useState({}) // productId -> grams
  const cart = usePersistentCart()

  useEffect(()=>{ (async()=>{
    let cats = []
    try{ const cr = await fetch('/api/categories').then(r=>r.ok?r.json():{categories:[]}); cats = cr.categories||[] }catch{}
    let prod = []
    try{ const pr = await fetch('/api/products').then(r=>r.json()); prod = pr.products||[]; if(!cats?.length) cats = pr.categories||[] }catch{}
    let t=[]
    try{ t = (await fetch('/api/product-tiers').then(r=>r.ok?r.json():{tiers:[]})).tiers||[] }catch{}
    setCategories(cats); setProducts(prod); setTiers(t)
  })() },[])

  useEffect(()=>{ if (!toast) return; const t=setTimeout(()=>setToast(''), 1400); return ()=>clearTimeout(t) },[toast])

  const cats = useMemo(()=>[{id:'all', name:'Alle', highlight:0}, ...(categories||[])], [categories])

  const tiersMap = useMemo(()=>{
    const m = new Map()
    for (const t of (tiers||[])){
      const key = Number(t.product_id)
      if (!m.has(key)) m.set(key, [])
      m.get(key).push({ grams: Number(t.grams), price_cents: Number(t.price_cents) })
    }
    for (const [k,arr] of m) arr.sort((a,b)=>a.grams-b.grams)
    return m
  },[tiers])

  const shown = useMemo(()=>{
    const s = q.trim().toLowerCase()
    return (products||[]).filter(p=>{
      if (cat!=='all' && String(p.category_id)!==String(cat)) return false
      if (sale && p.sale_price_cents==null) return false
      if (feat && !p.featured) return false
      if (!s) return true
      return (p.name||'').toLowerCase().includes(s) || (p.category_name||'').toLowerCase().includes(s)
    })
  },[q, cat, sale, feat, products])

  const addToCart = (p)=>{
    const list = tiersMap.get(p.id) || [{ grams:1, price_cents: Number(p.price_cents||0)}]
    const g = selGrams[p.id] ?? list[0].grams
    const tier = list.find(x=>x.grams===g) || list[0]
    cart.add({ id:p.id, grams:tier.grams, name:`${p.name} • ${tier.grams}g`, price_cents:tier.price_cents, image_url:p.image_url })
    setToast('Zum Warenkorb hinzugefügt')
  }

  async function doCheckout(){
    if (cart.cart.length===0 || submitting) return
    setSubmitting(true)
    try{
      const payload = { items: cart.cart.map(it=>({ product_id: it.id, grams: it.grams, qty: it.qty })), mode:'pickup', pay_with_wallet:false }
      const fx = typeof fetchWithAuth === 'function' ? fetchWithAuth : fetch
      const r = await fx('/api/orders', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) })
      let d=null; try{ d=await r.json() }catch{}
      if (r.status===401){ setToast('Bitte einloggen'); setSubmitting(false); window.location.hash='#/login'; return }
      if (r.ok && d?.ok){ setToast(`✅ Bestellung #${d.order_id} erstellt`); cart.clear(); setShowCart(false) }
      else setToast(`❌ Bestellung fehlgeschlagen${d?.message?': '+d.message:''}`)
    }catch{ setToast('❌ Netzwerk-/Serverfehler') }
    finally{ setSubmitting(false) }
  }

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-md bg-slate-950/80 border-b border-slate-800">
        <div className="mx-auto max-w-screen-sm px-3 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="opacity-70" />
            <div className="font-bold text-lg">Menü</div>
            <div className="ml-auto flex gap-2">
              <button className="rounded-xl border border-slate-700 px-2 py-2" title="Ansicht" onClick={()=>setView(v=> v==='list' ? 'grid' : 'list')}>
                {view==='list' ? <LayoutGrid size={18}/> : <List size={18}/>}
              </button>
              <button className="rounded-xl border border-slate-700 px-2 py-2" title="Sale" onClick={()=>setSale(s=>!s)}>
                <Tag size={18} className={sale?'opacity-100':'opacity-50'} />
              </button>
            </div>
          </div>
          <input className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
                 placeholder="Suche…" value={q} onChange={e=>setQ(e.target.value)} />
          {/* Kategorie-Buttons */}
          <div className="flex gap-2 flex-wrap">
            {cats.map(c=>{
              const isActive = String(cat)===String(c.id)
              const glow = c.highlight ? 'glow-green' : ''
              return (
                <button key={c.id}
                        onClick={()=>setCat(c.id)}
                        className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-semibold whitespace-nowrap
                                    ${isActive
                                      ? 'bg-gradient-to-r from-sky-500 to-emerald-500 text-slate-950 border-transparent'
                                      : 'bg-slate-900 text-slate-100 border-slate-600 hover:border-slate-500'} ${glow}`}>
                  {c.name}
                </button>
              )
            })}
            <label className="inline-flex items-center rounded-full border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm font-semibold whitespace-nowrap">
              <input type="checkbox" className="mr-2" checked={feat} onChange={e=>setFeat(e.target.checked)} />
              Highlights
            </label>
          </div>
        </div>
      </div>

      {/* Liste */}
      <div className="mx-auto max-w-screen-sm px-3">
        {shown.length===0 && <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 mt-3">Keine Produkte gefunden.</div>}
        <div className={view==='grid' ? 'grid grid-cols-2 gap-2 mt-3' : 'space-y-2 mt-3'}>
          {shown.map(p=>{
            const list = (tiersMap.get(p.id) || [{ grams:1, price_cents: Number(p.price_cents||0)}]).slice(0,5)
            const g = selGrams[p.id] ?? list[0].grams
            const current = list.find(x=>x.grams===g) || list[0]
            const perG = (current.price_cents/100)/current.grams

            const Card =
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-2">
                <div className="flex gap-2">
                  <div className="h-12 w-12 rounded-xl bg-slate-800 overflow-hidden">
                    {p.image_url && <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm leading-tight line-clamp-2">{p.name}</div>
                    <div className="text-[11px] text-slate-400">{p.category_name || '—'}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {list.map(t=>{
                        const active = t.grams===g
                        return (
                          <button key={t.grams}
                                  className={`rounded-full border px-2 py-0.5 text-[11px] ${active ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'bg-slate-950 text-slate-200 border-slate-700'}`}
                                  onClick={()=>setSelGrams(s=>({...s, [p.id]: t.grams}))}>
                            {t.grams}g
                          </button>
                        )
                      })}
                    </div>
                    <div className="mt-1 text-[12px]">
                      <span className="font-extrabold">{(current.price_cents/100).toFixed(2)} €</span>
                      <span className="text-slate-400"> ({perG.toFixed(2)} €/g)</span>
                    </div>
                  </div>
                </div>
                <button className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 py-2 text-sm font-semibold hover:bg-slate-700"
                        onClick={()=>addToCart(p)}>
                  <span className="inline-flex items-center gap-2 justify-center"><ShoppingCart size={16}/> In den Warenkorb</span>
                </button>
              </div>

            return <div key={p.id}>{Card}</div>
          })}
        </div>
      </div>

      {/* Floating Cart Button */}
      
<button
  className="fixed left-3 right-3 bottom-24 z-30 rounded-2xl px-4 py-3 font-extrabold shadow-lg
             bg-gradient-to-r from-sky-500 to-emerald-500 text-slate-950 border border-emerald-600"
  onClick={()=>setShowCart(true)}>
  <span className="inline-flex items-center justify-center gap-2">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 3h2l.4 2M7 13h10l2-6H5.4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="19" r="2" stroke="currentColor" stroke-width="2"/><circle cx="17" cy="19" r="2" stroke="currentColor" stroke-width="2"/></svg>
    Warenkorb öffnen • {cart.count} • {(cart.total/100).toFixed(2)} €
  </span>
</button>


      {/* Bottom-Sheet Cart */}
      {showCart && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-end" onClick={(e)=>{ if (e.target===e.currentTarget) setShowCart(false) }}>
          <div className="w-full max-h-[82vh] overflow-auto rounded-t-2xl border border-slate-800 bg-slate-950 p-3">
            <div className="mx-auto h-1 w-12 rounded-full bg-slate-700 mb-3" />
            <div className="mx-auto max-w-screen-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-lg">Warenkorb</div>
                <button className="rounded-xl border border-slate-700 px-2 py-2" onClick={()=>setShowCart(false)}><X size={16}/></button>
              </div>
              {cart.cart.length===0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">Der Warenkorb ist leer.</div>
              ) : (
                <>
                  <div className="space-y-2">
                    {cart.cart.map(x=>{
                      const euroG = (x.price_cents/100)/x.grams
                      return (
                        <div key={x.id+'-'+x.grams} className="rounded-xl border border-slate-800 bg-slate-900 p-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {x.image_url && <div className="h-10 w-10 rounded-lg overflow-hidden bg-slate-800"><img src={x.image_url} alt="" className="h-full w-full object-cover"/></div>}
                            <div>
                              <div className="font-semibold text-[13px]">{x.name}</div>
                              <div className="text-[11px] text-slate-400">{x.grams}g • {(x.price_cents/100).toFixed(2)} € ({euroG.toFixed(2)} €/g)</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button className="h-7 w-7 rounded-md border border-slate-700 bg-slate-800 grid place-items-center" onClick={()=>cart.dec(x.id, x.grams)}><Minus size={14}/></button>
                            <div className="w-6 text-center text-sm">{x.qty}</div>
                            <button className="h-7 w-7 rounded-md border border-slate-700 bg-slate-800 grid place-items-center" onClick={()=>cart.inc(x.id, x.grams)}><Plus size={14}/></button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <div className="text-slate-400 text-sm">Zwischensumme</div>
                    <div className="text-xl font-extrabold">{(cart.total/100).toFixed(2)} €</div>
                  </div>

                  <div className="flex gap-2 mt-2">
                    <button className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2 font-semibold" onClick={()=>cart.clear()}>Leeren</button>
                    <button className="flex-1 rounded-xl border border-emerald-600 bg-emerald-500/20 py-2 font-semibold hover:bg-emerald-500/30 disabled:opacity-60"
                            disabled={submitting} onClick={doCheckout}>
                      {submitting ? 'Sende…' : 'Zur Kasse'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">{toast}</div>}
    </div>
  )
}
