import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { Grid3X3, ShoppingCart } from 'lucide-react'

/* Kleines, robustes Overlay direkt über der Navbar */
function CheckoutBar(){
  return (
    <div className="pf-cart-bar">
      <button
        className="btn btn-primary inline-flex items-center justify-center gap-2 rounded-2xl"
        onClick={()=>{ if (window.goTo) { try{ window.goTo('checkout') }catch{} } window.location.hash='#/checkout' }}
        aria-label="Zur Kasse">
        <ShoppingCart size={18}/> Zur Kasse
      </button>
    </div>
  )
}


// Universeller Add-to-Cart Bridge-Handler:
// - ruft window.cart.add(product) falls vorhanden
// - ruft window.cartAdd(product) falls vorhanden
// - feuert Events: 'cart:add', 'pf:addToCart' mit detail.product
function handleAdd(product){
  try{
    if (window.cart && typeof window.cart.add === 'function') { window.cart.add(product) }
  }catch{}
  try{
    if (typeof window.cartAdd === 'function') { window.cartAdd(product) }
  }catch{}
  try{
    window.dispatchEvent(new CustomEvent('cart:add', { detail: product }))
  }catch{}
  try{
    window.dispatchEvent(new CustomEvent('pf:addToCart', { detail: { product } }))
  }catch{}
}

export default function Menu(){

  const { fetchWithAuth } = useAuth()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [q, setQ] = useState('')

  useEffect(()=>{ (async()=>{
    try{
      const r = await fetch('/api/products')
      const j = await r.json()
      setProducts(j.products||[])
      setCategories(j.categories||[])
    }catch(e){}
  })() },[])

  const list = useMemo(()=>{
    const t = q.trim().toLowerCase()
    return (products||[]).filter(p=>{
      if(!t) return true
      return String(p.name||'').toLowerCase().includes(t) ||
             String(p.category_name||'').toLowerCase().includes(t)
    })
  },[products,q])

  return (
    <div className="pf-pt-safe pf-pb-safe pf-pb-for-cart">
      <PageHeader icon={Grid3X3} title="Menü" subtitle="Produkte wählen & direkt zur Kasse" />
      <div className="max-w-screen-md mx-auto p-3 space-y-3">

        {/* Suche */}
        <input
          value={q}
          onChange={e=>setQ(e.target.value)}
          placeholder="Suche…"
          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm"
        />

        {/* Produkte (kompakte Cards) */}
        <div className="grid grid-cols-1 gap-2">
          {list.map(p=>(
            <div key={p.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <div className="w-14 h-14 rounded-xl bg-slate-800 overflow-hidden flex items-center justify-center">
                  { (p.image_url||p.banner_image_url)
                    ? <img src={p.image_url||p.banner_image_url} alt={p.name} className="w-full h-full object-cover"/>
                    : <div className="text-xs opacity-60">Bild</div> }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{p.name}</div>
                  <div className="text-xs opacity-70 truncate">{p.category_name||'—'}</div>
                </div>
                <div className="text-sm font-semibold">{((p.sale_price_cents ?? p.price_cents)/100).toFixed(2)} €</div>
              </div>
              <div className="p-3 pt-0">
                <button
                  className="btn btn-primary w-full"
                  onClick={()=>{ /* vorhandenen Add-to-Cart Mechanismus triggern */
                    const ev = new CustomEvent('pf:addToCart', { detail: { productId: p.id, product: p } })
                    window.dispatchEvent(ev)
                  }}>
                  In den Warenkorb
                </button>
              </div>
            </div>
          ))}
          {list.length===0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-center text-sm opacity-80">
              Keine Produkte gefunden.
            </div>
          )}
        </div>

        {/* Abstand falls sehr wenig Items (zusätzlich zur pf-pb-for-cart) */}
        <div className="h-24" />
      </div>

      {/* Fixierte Checkout-Leiste über der Navbar */}
      <CheckoutBar />
    </div>
  )
}
