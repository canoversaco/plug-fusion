import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
const Ctx = createContext(null)
export function CartProvider({ children }){
  const [items, setItems] = useState(()=> {
    try{ return JSON.parse(localStorage.getItem('cart_v1')||'[]') }catch{ return [] }
  })
  useEffect(()=> localStorage.setItem('cart_v1', JSON.stringify(items)), [items])
  const add = (p) => setItems(prev=>{
    const i = prev.findIndex(x => x.id===p.id)
    const price_cents = p.sale_price_cents ?? p.price_cents ?? p.price ?? 0
    if (i>=0){ const cp=[...prev]; cp[i]={...cp[i], qty:(cp[i].qty||1)+1}; return cp }
    return [...prev, { id:p.id, name:p.name, price_cents, qty:1, product_id:p.id }]
  })
  const sub = (id) => setItems(prev=>{
    const i = prev.findIndex(x => x.id===id); if(i<0) return prev
    const it = prev[i]; const q=(it.qty||1)-1
    if(q<=0) return prev.filter((_,idx)=>idx!==i)
    const cp=[...prev]; cp[i]={...it, qty:q}; return cp
  })
  const clear = ()=> setItems([])
  const total = useMemo(()=> items.reduce((s, it)=> s + (it.price_cents||0)*(it.qty||1), 0), [items])
  return <Ctx.Provider value={{items, add, sub, clear, total}}>{children}</Ctx.Provider>
}
export const useCart = ()=> useContext(Ctx)
