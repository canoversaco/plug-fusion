import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'

const Ctx = createContext(null)

const centsOf = (v) => {
  if (v == null) return 0
  if (typeof v === 'number') return Math.round(v * 100)
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}
const normItem = (it) => {
  if (!it) return null
  const id = it.product_id ?? it.id
  if (!id) return null
  return {
    id,
    product_id: id,
    name: it.name || it.title || `#${id}`,
    price_cents: it.price_cents ?? centsOf(it.price) ?? 0,
    qty: Math.max(1, Math.min(99, it.qty ?? it.quantity ?? 1)),
    image_url: it.image_url || it.banner_image_url || null,
  }
}

async function tryJSON(fetcher, url, init){
  try{
    const r = await fetcher(url, init)
    if (r && (r.ok || [200,201,204].includes(r.status))) {
      const txt = (r.status===204) ? null : await r.text()
      try { return { ok:true, data: txt ? JSON.parse(txt) : {} } } catch { return { ok:true, data:{} } }
    }
  }catch(_){}
  return { ok:false, data:null }
}

async function loadFromServer(fetcher){
  const urls = ['/api/cart','/api/my/cart','/api/user/cart','/api/cart/items']
  for (const u of urls){
    const r = await tryJSON(fetcher, u)
    if (r.ok) {
      const arr = r.data?.items || r.data?.cart_items || r.data?.products || r.data
      if (Array.isArray(arr)) return arr.map(normItem).filter(Boolean)
    }
  }
  return null
}

async function syncAdd(fetcher, product_id, qty){
  const body = JSON.stringify({ product_id, qty })
  const headers = {'content-type':'application/json'}
  const urls = ['/api/cart/add','/api/my/cart/add','/api/cart']
  for (const u of urls){
    const method = u.endsWith('/cart') ? 'POST' : 'POST'
    const r = await tryJSON(fetcher, u, { method, headers, body })
    if (r.ok) return true
  }
  return false
}
async function syncRemove(fetcher, product_id){
  const body = JSON.stringify({ product_id })
  const headers = {'content-type':'application/json'}
  const urls = ['/api/cart/remove', `/api/cart/${product_id}`, '/api/my/cart/remove']
  for (const u of urls){
    const method = u.includes('/cart/') ? 'DELETE' : 'POST'
    const init = method==='POST' ? {method, headers, body} : {method}
    const r = await tryJSON(fetcher, u, init)
    if (r.ok) return true
  }
  return false
}
async function syncSetQty(fetcher, product_id, qty){
  const body = JSON.stringify({ product_id, qty })
  const headers = {'content-type':'application/json'}
  const urls = ['/api/cart/set','/api/my/cart/set']
  for (const u of urls){
    const r = await tryJSON(fetcher, u, { method:'POST', headers, body })
    if (r.ok) return true
  }
  return false
}
async function syncClear(fetcher){
  const headers = {'content-type':'application/json'}
  const urls = ['/api/cart/clear','/api/my/cart/clear','/api/cart']
  for (const u of urls){
    const method = u.endsWith('/cart') ? 'DELETE' : 'POST'
    const r = await tryJSON(fetcher, u, { method, headers })
    if (r.ok) return true
  }
  return false
}

export function CartProvider({ children }){
  const { fetchWithAuth } = useAuth?.() || {}
  const fetcher = fetchWithAuth || fetch

  const [items, setItems] = useState([])

  // 1) LocalStorage laden
  useEffect(()=>{
    try{
      const raw = localStorage.getItem('pf_cart')
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) setItems(arr.map(normItem).filter(Boolean))
      }
    }catch{}
  }, [])

  // 2) Server laden (falls vorhanden) und local überschreiben
  useEffect(()=>{ (async()=>{
    const server = await loadFromServer(fetcher)
    if (server) setItems(server)
  })() }, [])

  // 3) Persistenz
  useEffect(()=>{
    try { localStorage.setItem('pf_cart', JSON.stringify(items)) } catch {}
  }, [items])

  const totalCents = useMemo(()=> items.reduce((s,it)=> s + (it.price_cents||0)*(it.qty||1), 0), [items])
  const count      = useMemo(()=> items.reduce((n,it)=> n + (it.qty||1), 0), [items])

  const addItem = async (prod, qty=1) => {
    const p = normItem({ ...prod, qty })
    if (!p) return
    setItems(prev=>{
      const arr=[...prev]; const idx = arr.findIndex(x=>String(x.id)===String(p.id))
      if (idx>=0) arr[idx] = { ...arr[idx], qty: Math.min(99,(arr[idx].qty||1)+qty) }
      else arr.push(p)
      return arr
    })
    syncAdd(fetcher, p.id, qty).catch(()=>{})
  }
  const removeItem = async (product_id) => {
    setItems(prev=> prev.filter(x=>String(x.id)!==String(product_id)))
    syncRemove(fetcher, product_id).catch(()=>{})
  }
  const setQty   = async (product_id, qty) => {
    setItems(prev=> prev.map(x=> String(x.id)===String(product_id) ? { ...x, qty: Math.max(1,Math.min(99,qty)) } : x))
    syncSetQty(fetcher, product_id, qty).catch(()=>{})
  }
  const clearCart = async () => {
    setItems([]); syncClear(fetcher).catch(()=>{})
  }
  const reload = async () => {
    const server = await loadFromServer(fetcher)
    if (server) setItems(server)
  }

  return (
    <Ctx.Provider value={{ items, totalCents, count, addItem, removeItem, setQty, clearCart, reload }}>
      {children}
    </Ctx.Provider>
  )
}

export function useCart(){ return useContext(Ctx) }
