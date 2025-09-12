import React, { useMemo, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import { useCart } from '../cart/CartContext.jsx'

/**
 * Robuste Varianten-Extraktion.
 * Unterstützt u.a.:
 * - product.variants: [{id?, label, grams?, price_cents}]
 * - product.meta?.variants / product.meta?.tiers / product.price_map / product.grams_prices
 * - String-Tabellen: "1g=10,2g=15,3g=25" (Euro) oder "1g:1000;2g:1500" (Cent)
 */
function extractVariants(product){
  const meta = product?.meta || product?.product_meta || {}
  const direct = product?.variants || meta?.variants || meta?.tiers || product?.price_tiers || product?.tiers || product?.options
  const mapLike = meta?.price_map || product?.price_map || product?.grams_prices || meta?.grams_prices
  const str = meta?.variant_str || product?.variant_str || meta?.price_table || product?.price_table

  const out = []

  // (A) Array-Varianten
  if (Array.isArray(direct)){
    direct.forEach((v,idx)=>{
      if (!v) return
      const grams = v.grams ?? v.g ?? v.qty_g ?? v.amount_g ?? null
      let priceCents = v.price_cents ?? v.cents ?? null
      if (priceCents==null && v.price!=null){
        // euro->cent heuristik
        priceCents = Math.round(Number(v.price)*100)
      }
      const label = v.label || (grams?`${grams} g`:'Variante')
      out.push({
        key: v.id ?? v.key ?? `${product.id}-var-${idx}`,
        label,
        grams,
        price_cents: priceCents,
      })
    })
  }

  // (B) Objekt-Map: { "1g": 10, "2g": 15 } (Euro) ODER { "1g": 1000 } (Cent)
  if (mapLike && typeof mapLike==='object' && !Array.isArray(mapLike)){
    Object.entries(mapLike).forEach(([k,val],i)=>{
      const grams = String(k).toLowerCase().replace(/[^0-9.]/g,'')
      const isEuro = Number(val) < 500 // heuristik
      const cents = isEuro ? Math.round(Number(val)*100) : Number(val)
      out.push({
        key: `${product.id}-map-${i}`,
        label: grams ? `${grams} g` : (k || 'Variante'),
        grams: grams?Number(grams):null,
        price_cents: cents,
      })
    })
  }

  // (C) String-Tabellen: "1g=10,2g=15" oder "1g:1000;2g:1500"
  if (typeof str==='string' && str.trim()){
    const parts = str.split(/[,;]\s*/)
    parts.forEach((p,i)=>{
      const mEq = p.match(/^\s*([\d,.]+)\s*g\s*[=:]\s*([\d,.]+)\s*(€|eur)?\s*$/i)
      const mC  = p.match(/^\s*([\d,.]+)\s*g\s*[=:]\s*([\d]+)\s*(c|cent|cents)?\s*$/i)
      if (mEq){
        const g = Number(String(mEq[1]).replace(',','.'))
        const euro = Number(String(mEq[2]).replace(',','.'))
        out.push({ key:`${product.id}-str-eq-${i}`, label:`${g} g`, grams:g, price_cents:Math.round(euro*100) })
      }else if(mC){
        const g = Number(String(mC[1]).replace(',','.'))
        const cents = Number(mC[2])
        out.push({ key:`${product.id}-str-c-${i}`, label:`${g} g`, grams:g, price_cents:cents })
      }else{
        // Fallback: "15/2" => 2g 15€
        const m = p.match(/^\s*([\d]+)\s*\/\s*([\d,.]+)\s*$/)
        if (m){
          const euro = Number(String(m[1]).replace(',','.'))
          const g = Number(String(m[2]).replace(',','.'))
          out.push({ key:`${product.id}-str-fb-${i}`, label:`${g} g`, grams:g, price_cents:Math.round(euro*100) })
        }
      }
    })
  }

  // Dedup + Sort (nach Gramm, dann Preis)
  const seen=new Set()
  const clean = out.filter(v=>{
    if (v.price_cents==null) return false
    const key = `${v.label}-${v.price_cents}`
    if (seen.has(key)) return false
    seen.add(key); return true
  }).sort((a,b)=>{
    if (a.grams!=null && b.grams!=null && a.grams!==b.grams) return a.grams-b.grams
    return (a.price_cents||0)-(b.price_cents||0)
  })

  return clean
}

export default function ProductCard({ product }){
  const [open, setOpen] = useState(false)
  const variants = useMemo(()=>extractVariants(product), [product])
  const img = product?.banner_image_url || product?.image_url
  const priceCents = product?.sale_price_cents ?? product?.price_cents ?? null
  const priceText = priceCents!=null ? (priceCents/100).toFixed(2)+' €' : ''
  const { addItem, add, addToCart, addProduct } = (typeof useCart==='function' ? (useCart()||{}) : {})

  function addVariant(v){
    const item = {
      // Basis
      product_id: product.id,
      id: `${product.id}::${v.key}`,
      name: `${product.name} • ${v.label}`,
      base_name: product.name,
      variant_label: v.label,
      grams: v.grams ?? null,
      price_cents: v.price_cents,
      image_url: img || null,
      // optional bekannte Felder
      category_id: product.category_id,
      category_name: product.category_name,
      qty: 1
    }
    // möglichst viele mögliche Cart-APIs unterstützen
    const fns = [addItem, add, addToCart, addProduct]
    for (const fn of fns){
      if (typeof fn === 'function'){
        try { fn(item) } catch { try{ fn(item,1) }catch{} }
        return
      }
    }
    // Notfall: globales Event (falls Context eine Brücke hat)
    try{ window.dispatchEvent(new CustomEvent('cart:add', { detail: { item } })) }catch{}
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/60">
      {/* Bild */}
      <div className="relative w-full aspect-[4/3] bg-slate-800">
        {img ? <img src={img} alt={product?.name||'Produkt'} className="absolute inset-0 w-full h-full object-cover" loading="lazy"/> : null}
      </div>

      {/* Text */}
      <div className="p-3">
        <div className="font-semibold text-sm line-clamp-1">{product?.name}</div>
        <div className="text-xs opacity-70 line-clamp-2">{product?.short_description || product?.description || ''}</div>

        {/* Preis (Basis) */}
        {priceText ? <div className="mt-1 text-sm font-medium">{priceText}</div> : null}

        {/* Varianten */}
        {variants.length>0 ? (
          <div className="mt-2">
            <button
              className="w-full inline-flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm"
              onClick={()=>setOpen(v=>!v)}
              aria-expanded={open}
            >
              <span>Varianten auswählen</span>
              <ChevronDown size={16} className={`transition-transform ${open?'rotate-180':''}`} />
            </button>

            {open && (
              <div className="mt-2 grid grid-cols-1 gap-2">
                {variants.map(v=>(
                  <button
                    key={v.key}
                    className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm hover:bg-slate-800/80 active:scale-[0.99]"
                    onClick={()=>addVariant(v)}
                  >
                    <div className="text-left">
                      <div className="font-medium">{v.label}</div>
                      {v.grams!=null ? <div className="text-[11px] opacity-70">{v.grams} g</div> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="font-semibold">{(v.price_cents/100).toFixed(2)} €</div>
                      <Plus size={16} className="opacity-80"/>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
