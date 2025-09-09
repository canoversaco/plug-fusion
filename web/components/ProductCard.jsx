import React from 'react'
export default function ProductCard({ p, onAdd }){
  const price = (p.sale_price_cents ?? p.price_cents ?? 0)/100
  const regular = (p.price_cents ?? 0)/100
  const onSale = p.sale_price_cents != null && p.sale_price_cents < (p.price_cents||0)
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 relative overflow-hidden">
      {p.badge_text ? (
        <div className="absolute top-2 left-2 text-[11px] font-bold px-2 py-1 rounded-full"
             style={{ background: p.badge_color || '#22c55e', color: '#0a0a0a' }}>
          {p.badge_text}
        </div>
      ) : null}
      <div className="font-semibold pr-16">{p.name}</div>
      <div className="opacity-70 text-xs">{p.category_name || '—'}</div>
      <div className="mt-2 flex items-center gap-2">
        <div className="text-lg font-bold">{price.toFixed(2)} €</div>
        {onSale ? <div className="opacity-60 line-through">{regular.toFixed(2)} €</div> : null}
      </div>
      <button className="btn w-full mt-3" onClick={()=>onAdd?.(p)}>In den Warenkorb</button>
    </div>
  )
}
