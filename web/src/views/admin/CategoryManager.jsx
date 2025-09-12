import React, { useEffect, useState } from 'react'
import { Save, Plus, Trash2, RefreshCw } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext.jsx'

async function tryJSON(fetcher, url, init){
  try{
    const r = await fetcher(url, init)
    const ok = r && (r.ok || [200,201,204].includes(r.status))
    const txt = await r.text().catch(()=>null)
    const data = txt ? (()=>{ try{ return JSON.parse(txt) }catch{ return {} }})() : {}
    return { ok, status: r?.status||0, data, text: txt }
  }catch(e){ return { ok:false, status:0, data:null, text:String(e) } }
}
async function loadCategories(fetcher){
  const urls = ['/api/products','/api/menu','/api/catalog','/api/admin/categories']
  for(const u of urls){ const r=await tryJSON(fetcher,u); if(r.ok){ const cats=r.data?.categories||r.data?.cats||[]; return {categories:cats} } }
  return { categories:[] }
}
async function saveCategory(fetcher, c){
  const body = { id:c.id, name:c.name, slug:c.slug, description:c.description, color:c.color }
  const headers={'content-type':'application/json'}
  const t=(typeof localStorage!=='undefined'&&(localStorage.getItem('token')||localStorage.getItem('authToken')||localStorage.getItem('jwt')))||''
  if (t) headers['authorization']='Bearer '+t
  const payload=JSON.stringify(body)
  const endpoints=[`/api/admin/categories/${c.id}`, `/api/categories/${c.id}`, `/api/catalog/categories/${c.id}`, `/api/admin/categories/update`, `/api/categories/update`, `/api/catalog/category`]
  for(const url of endpoints){ const method=(url.endsWith('/update')||url.endsWith('/category'))?'POST':'PATCH'; const r=await tryJSON(fetcher,url,{method,headers,body:payload}); if(r.ok) return r }
  return { ok:false }
}
async function createCategory(fetcher, c){
  const body = { name:c.name||'Neue Kategorie', slug:c.slug||'', description:c.description||'', color:c.color||'' }
  const headers={'content-type':'application/json'}
  const t=(typeof localStorage!=='undefined'&&(localStorage.getItem('token')||localStorage.getItem('authToken')||localStorage.getItem('jwt')))||''
  if (t) headers['authorization']='Bearer '+t
  const endpoints=['/api/admin/categories','/api/categories','/api/catalog/category']
  for(const url of endpoints){ const r=await tryJSON(fetcher,url,{method:'POST',headers,body:JSON.stringify(body)}); if(r.ok) return r }
  return { ok:false }
}
async function deleteCategory(fetcher, id){
  const headers={'content-type':'application/json'}
  const t=(typeof localStorage!=='undefined'&&(localStorage.getItem('token')||localStorage.getItem('authToken')||localStorage.getItem('jwt')))||''
  if (t) headers['authorization']='Bearer '+t
  const endpoints=[`/api/admin/categories/${id}`, `/api/categories/${id}`, `/api/catalog/categories/${id}`, `/api/catalog/category/${id}`]
  for(const url of endpoints){ const r=await tryJSON(fetcher,url,{method:'DELETE',headers}); if(r.ok) return r }
  return { ok:false }
}

export default function CategoryManager(){
  const { fetchWithAuth } = useAuth()
  const fetcher = fetchWithAuth || fetch
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [cats,setCats]=useState([])

  useEffect(()=>{ (async()=>{
    setLoading(true); const d=await loadCategories(fetcher)
    setCats(Array.isArray(d.categories)?d.categories:[])
    setLoading(false)
  })() },[])

  function onField(c,k,v){ setCats(list=>list.map(x=>x.id===c.id?{...x,[k]:v}:x)) }
  async function onSave(c){ setBusy(true); const r=await saveCategory(fetcher,c); setBusy(false); if(!r.ok) return alert('Kategorie speichern fehlgeschlagen.') }
  async function onCreate(){ setBusy(true); const r=await createCategory(fetcher,{name:'Neue Kategorie'}); setBusy(false); if(!r.ok) return alert('Kategorie erstellen fehlgeschlagen.'); location.reload() }
  async function onDelete(c){ if(!confirm('Kategorie wirklich löschen?'))return; setBusy(true); const r=await deleteCategory(fetcher,c.id); setBusy(false); if(!r.ok) return alert('Kategorie löschen fehlgeschlagen.'); setCats(list=>list.filter(x=>x.id!==c.id)) }

  return (
    <div className="space-y-2">
      <div className="px-3 py-2 text-sm font-semibold border-b border-slate-800 flex items-center justify-between">
        <div>Kategorien</div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost inline-flex items-center gap-1" onClick={()=>location.reload()}><RefreshCw size={14}/> Neu laden</button>
          <button className="btn inline-flex items-center gap-1" onClick={onCreate}><Plus size={16}/> Neu</button>
        </div>
      </div>
      {loading ? <div className="p-3 text-sm opacity-70">Lade…</div> : (
        <div className="p-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {cats.map(c=>(
            <div key={c.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-2">
              <div className="text-sm font-semibold">#{c.id} {c.name||c.title||c.slug}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="space-y-1 col-span-2">
                  <span className="opacity-70">Name</span>
                  <input className="w-full px-2 py-1 rounded-lg border border-slate-700 bg-slate-900"
                         value={c.name||''} onChange={e=>onField(c,'name',e.target.value)}/>
                </label>
                <label className="space-y-1">
                  <span className="opacity-70">Slug</span>
                  <input className="w-full px-2 py-1 rounded-lg border border-slate-700 bg-slate-900"
                         value={c.slug||''} onChange={e=>onField(c,'slug',e.target.value)}/>
                </label>
                <label className="space-y-1">
                  <span className="opacity-70">Farbe</span>
                  <input className="w-full px-2 py-1 rounded-lg border border-slate-700 bg-slate-900"
                         placeholder="#64748b" value={c.color||''} onChange={e=>onField(c,'color',e.target.value)}/>
                </label>
                <label className="space-y-1 col-span-2">
                  <span className="opacity-70">Beschreibung</span>
                  <textarea rows={2} className="w-full px-2 py-1 rounded-lg border border-slate-700 bg-slate-900"
                            value={c.description||''} onChange={e=>onField(c,'description',e.target.value)}/>
                </label>
              </div>
              <div className="flex gap-2 pt-1">
                <button className="btn inline-flex items-center gap-1" disabled={busy} onClick={()=>onSave(c)}><Save size={16}/> Speichern</button>
                <button className="btn-ghost text-rose-400 inline-flex items-center gap-1" disabled={busy} onClick={()=>onDelete(c)}><Trash2 size={16}/> Löschen</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
