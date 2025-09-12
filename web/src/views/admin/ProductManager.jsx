import React, { useEffect, useState } from 'react'
import { Save, Plus, Trash2, Sparkles, Tag, Image as ImageIcon, Percent, RefreshCw } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext.jsx'

function cents(n){ if(n==null) return 0; if(typeof n==='number' && Number.isInteger(n)) return n; const v=String(n).replace(',','.'); const f=parseFloat(v); return Number.isFinite(f)? Math.round(f*100):0 }
function eur(c){ return ((c||0)/100).toFixed(2) }

async function tryJSON(fetcher, url, init){
  try{
    const r = await fetcher(url, init)
    const ok = r && (r.ok || [200,201,204].includes(r.status))
    const txt = await r.text().catch(()=>null)
    const data = txt ? (()=>{ try{ return JSON.parse(txt) }catch{ return {} }})() : {}
    return { ok, status: r?.status||0, data, text: txt }
  }catch(e){ return { ok:false, status:0, data:null, text:String(e) } }
}
async function loadCatalog(fetcher){
  const urls = ['/api/products','/api/menu','/api/catalog','/api/admin/products']
  for(const u of urls){ const r=await tryJSON(fetcher,u); if(r.ok){ const products=r.data?.products||r.data?.items||Array.isArray(r.data)?r.data:[]; const categories=r.data?.categories||r.data?.cats||[]; return {products,categories} } }
  return { products:[], categories:[] }
}
async function saveProduct(fetcher, p){
  const body = {
    id: p.id, name:p.name, description:p.description,
    price_cents: cents(p.price_cents ?? p.price),
    sale_price_cents: p.sale_price_cents!=null? cents(p.sale_price_cents): null,
    category_id: p.category_id ?? p.category,
    image_url: p.image_url, banner_image_url: p.banner_image_url,
    featured: !!p.featured, highlight_title: p.highlight_title,
    badge_text: p.badge_text, badge_color: p.badge_color,
  }
  const headers={'content-type':'application/json'}
  const t=(typeof localStorage!=='undefined'&&(localStorage.getItem('token')||localStorage.getItem('authToken')||localStorage.getItem('jwt')))||''
  if (t) headers['authorization']='Bearer '+t
  const payload=JSON.stringify(body)
  const endpoints=[`/api/admin/products/${p.id}`, `/api/products/${p.id}`, `/api/catalog/products/${p.id}`, `/api/admin/products/update`, `/api/products/update`, `/api/catalog/product`]
  for(const url of endpoints){ const method=(url.endsWith('/update')||url.endsWith('/product'))?'POST':'PATCH'; const r=await tryJSON(fetcher,url,{method,headers,body:payload}); if(r.ok) return r }
  return { ok:false }
}
async function createProduct(fetcher, p){
  const body = {
    name: p.name||'Neues Produkt', description:p.description||'',
    price_cents: cents(p.price_cents ?? p.price ?? 0),
    category_id: p.category_id ?? null,
    image_url: p.image_url||'', banner_image_url: p.banner_image_url||'',
    featured: !!p.featured, highlight_title: p.highlight_title||'',
    badge_text: p.badge_text||'', badge_color: p.badge_color||'',
    sale_price_cents: p.sale_price_cents!=null?cents(p.sale_price_cents):null
  }
  const headers={'content-type':'application/json'}
  const t=(typeof localStorage!=='undefined'&&(localStorage.getItem('token')||localStorage.getItem('authToken')||localStorage.getItem('jwt')))||''
  if (t) headers['authorization']='Bearer '+t
  const endpoints=['/api/admin/products','/api/products','/api/catalog/product','/api/catalog/products']
  for(const url of endpoints){ const r=await tryJSON(fetcher,url,{method:'POST',headers,body:JSON.stringify(body)}); if(r.ok) return r }
  return { ok:false }
}
async function deleteProduct(fetcher, id){
  const headers={'content-type':'application/json'}
  const t=(typeof localStorage!=='undefined'&&(localStorage.getItem('token')||localStorage.getItem('authToken')||localStorage.getItem('jwt')))||''
  if (t) headers['authorization']='Bearer '+t
  const endpoints=[`/api/admin/products/${id}`, `/api/products/${id}`, `/api/catalog/products/${id}`, `/api/catalog/product/${id}`]
  for(const url of endpoints){ const r=await tryJSON(fetcher,url,{method:'DELETE',headers}); if(r.ok) return r }
  return { ok:false }
}

export default function ProductManager(){
  const { fetchWithAuth } = useAuth()
  const fetcher = fetchWithAuth || fetch
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [products,setProducts]=useState([])
  const [categories,setCategories]=useState([])

  useEffect(()=>{ (async()=>{
    setLoading(true); const d=await loadCatalog(fetcher)
    setProducts(Array.isArray(d.products)?d.products:[])
    setCategories(Array.isArray(d.categories)?d.categories:[])
    setLoading(false)
  })() },[])

  function onField(p,k,v){ setProducts(list=>list.map(x=>x.id===p.id?{...x,[k]:v}:x)) }
  async function onSave(p){ setBusy(true); const r=await saveProduct(fetcher,p); setBusy(false); if(!r.ok) return alert('Speichern fehlgeschlagen.'); }
  async function onCreate(){ setBusy(true); const r=await createProduct(fetcher,{}); setBusy(false); if(!r.ok) return alert('Erstellen fehlgeschlagen.'); location.reload() }
  async function onDelete(p){ if(!confirm('Produkt wirklich löschen?'))return; setBusy(true); const r=await deleteProduct(fetcher,p.id); setBusy(false); if(!r.ok) return alert('Löschen fehlgeschlagen.'); setProducts(list=>list.filter(x=>x.id!==p.id)) }

  return (
    <div className="space-y-2">
      <div className="px-3 py-2 text-sm font-semibold border-b border-slate-800 flex items-center justify-between">
        <div>Produkte</div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost inline-flex items-center gap-1" onClick={()=>location.reload()}><RefreshCw size={14}/> Neu laden</button>
          <button className="btn inline-flex items-center gap-1" onClick={onCreate}><Plus size={16}/> Neu</button>
        </div>
      </div>
      {loading ? <div className="p-3 text-sm opacity-70">Lade…</div> : (
        <div className="p-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {products.map(p=>(
            <div key={p.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
              <div className="text-sm font-semibold">#{p.id} {p.name}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="space-y-1 col-span-2">
                  <span className="opacity-70">Name</span>
                  <input className="w-full px-2 py-1 rounded-lg border border-slate-700 bg-slate-900"
                         value={p.name||''} onChange={e=>onField(p,'name',e.target.value)}/>
                </label>
                <label className="space-y-1 col-span-2">
                  <span className="opacity-70">Beschreibung</span>
                  <textarea rows={2} className="w-full px-2 py-1 rounded-lg border border-slate-700 bg-slate-900"
                            value={p.description||''} onChange={e=>onField(p,'description',e.target.value)}/>
                </label>

                <label className="space-y-1">
                  <span className="opacity-70">Preis (€)</span>
                  <input type="number" step="0.01" className="w-full px-2 py-1 rounded-lg border border-slate-700 bg-slate-900"
                         value={eur(p.price_cents??0)} onChange={e=>onField(p,'price_cents',cents(e.target.value))}/>
                </label>
                <label className="space-y-1">
                  <span className="opacity-70">Sale (€)</span>
                  <div className="flex items-center gap-2">
                    <Percent size={14} className="opacity-70"/>
                    <input type="number" step="0.01" placeholder="z.B. 19.99"
                           className="flex-1 px-2 py-1 rounded-lg border border-slate-700 bg-slate-900"
                           value={p.sale_price_cents!=null ? eur(p.sale_price_cents) : ''}
                           onChange={e=>onField(p,'sale_price_cents', e.target.value===''? null : cents(e.target.value))}/>
                  </div>
                </label>

                <label className="space-y-1">
                  <span className="opacity-70">Kategorie</span>
                  <select className="w-full px-2 py-1 rounded-lg border border-slate-700 bg-slate-900"
                          value={p.category_id ?? ''} onChange={e=>onField(p,'category_id', e.target.value)}>
                    <option value="">–</option>
                    {categories.map(c=><option key={c.id} value={c.id}>{c.name||c.title||c.slug}</option>)}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="opacity-70">Bild URL</span>
                  <div className="flex items-center gap-2">
                    <ImageIcon size={14} className="opacity-70"/>
                    <input className="flex-1 px-2 py-1 rounded-lg border border-slate-700 bg-slate-900"
                           value={p.image_url||''} onChange={e=>onField(p,'image_url', e.target.value)}/>
                  </div>
                </label>

                <label className="space-y-1">
                  <span className="opacity-70">Banner URL</span>
                  <input className="w-full px-2 py-1 rounded-lg border border-slate-700 bg-slate-900"
                         value={p.banner_image_url||''} onChange={e=>onField(p,'banner_image_url', e.target.value)}/>
                </label>

                <div className="col-span-2 mt-1 border-t border-slate-800 pt-2">
                  <div className="text-xs font-semibold mb-1 flex items-center gap-1"><Sparkles size={14}/> Highlights & Aktionen</div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={!!p.featured} onChange={e=>onField(p,'featured', e.target.checked)}/>
                      <span className="opacity-80">Featured</span>
                    </label>
                    <label className="space-y-1">
                      <span className="opacity-70">Highlight Titel</span>
                      <input className="w-full px-2 py-1 rounded-lg border border-slate-700 bg-slate-900"
                             value={p.highlight_title||''} onChange={e=>onField(p,'highlight_title', e.target.value)}/>
                    </label>
                    <label className="space-y-1">
                      <span className="opacity-70">Badge Text</span>
                      <div className="flex items-center gap-2">
                        <Tag size={14} className="opacity-70"/>
                        <input className="flex-1 px-2 py-1 rounded-lg border border-slate-700 bg-slate-900"
                               value={p.badge_text||''} onChange={e=>onField(p,'badge_text', e.target.value)}/>
                      </div>
                    </label>
                    <label className="space-y-1">
                      <span className="opacity-70">Badge Farbe</span>
                      <input className="w-full px-2 py-1 rounded-lg border border-slate-700 bg-slate-900"
                             placeholder="#22c55e" value={p.badge_color||''} onChange={e=>onField(p,'badge_color', e.target.value)}/>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button className="btn inline-flex items-center gap-1" disabled={busy} onClick={()=>onSave(p)}><Save size={16}/> Speichern</button>
                <button className="btn-ghost text-rose-400 inline-flex items-center gap-1" disabled={busy} onClick={()=>onDelete(p)}><Trash2 size={16}/> Löschen</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
