import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { Package, Tag, Users, Wrench, Search, Truck, Trash2, Check, Clock, ChevronRight, Plus, Edit3, Save } from 'lucide-react'

const norm = s=> (s||'').toString().toLowerCase().replace(/\s+/g,'_')
const cents = v => typeof v==='number' ? (v/100).toFixed(2)+' €' : ''

async function send(fetchWithAuth, url, method, body){
  const hdr = {'Content-Type':'application/json'}
  const res = await fetchWithAuth(url,{method,headers:hdr,body: body?JSON.stringify(body):undefined}).catch(()=>null)
  return res && res.ok
}

const HeaderTabs = ({tab,setTab})=>{
  const Btn = ({id,label,Icon})=>(
    <button onClick={()=>setTab(id)}
      className={`px-3 py-2 rounded-2xl border text-sm flex items-center gap-2 transition
      ${tab===id?'border-emerald-500 bg-emerald-500/15 shadow-[0_0_0_1px_rgba(16,185,129,.25)]':'border-slate-800 bg-slate-900/60 hover:bg-slate-900/80'}`}>
      <Icon size={14}/> <span>{label}</span>
    </button>
  )
  return (
    <div className="flex flex-wrap gap-2">
      <Btn id="orders" label="Bestellungen" Icon={Truck}/>
      <Btn id="products" label="Produkte" Icon={Tag}/>
      <Btn id="categories" label="Kategorien" Icon={Package}/>
      <Btn id="users" label="Nutzer" Icon={Users}/>
      <Btn id="tools" label="Tools" Icon={Wrench}/>
    </div>
  )
}

/* ---------- Orders Tab ---------- */
function OrdersAdmin(){
  const { fetchWithAuth } = useAuth()
  const [list,setList]=useState([]); const [q,setQ]=useState(''); const [open,setOpen]=useState(null); const [loading,setLoading]=useState(true)
  async function load(){ setLoading(true); try{ const j=await fetchWithAuth('/api/admin/orders').then(r=>r.json()); setList(j?.orders||[]) }catch{ setList([]) } setLoading(false) }
  useEffect(()=>{ load() },[])
  const filtered = useMemo(()=>{ const t=q.trim().toLowerCase(); return list.filter(o=>!t || String(o.id).includes(t) || String(o.customer_name||'').toLowerCase().includes(t) || String(o.address||'').toLowerCase().includes(t)) },[list,q])
  async function post(url, body){ return send(fetchWithAuth,url,'POST',body) }

  const Card = ({o}) => {
    const cid = o.courier_id ?? o.assigned_courier_id ?? null
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <button className="w-full p-3 flex items-center gap-3" onClick={()=>setOpen(open===o.id?null:o.id)}>
          <div className="w-10 h-10 rounded-xl bg-slate-800/60 grid place-items-center"><Truck size={18}/></div>
          <div className="text-left">
            <div className="font-semibold">#{o.id} • {cents(o.total_cents)}</div>
            <div className="text-xs opacity-70">{o.created_at ? new Date(o.created_at).toLocaleString() : ''}</div>
          </div>
          <div className="ml-auto text-xs opacity-70 capitalize">{norm(o.status).replace('_',' ')}</div>
          <ChevronRight size={16} className={`ml-2 transition ${open===o.id?'rotate-90':''}`}/>
        </button>

        {open===o.id && (
          <div className="p-3 pt-0 space-y-3">
            <div className="flex flex-wrap gap-2">
              {['offen','akzeptiert','in_arbeit','unterwegs','abgeschlossen'].map(s=>(
                <button key={s}
                  onClick={async()=>{ if(await post(`/api/admin/orders/${o.id}/status`,{status:s})) load() }}
                  className={`px-3 py-1 rounded-xl border ${norm(o.status)===s?'border-emerald-500 bg-emerald-500/20':'border-slate-700 bg-slate-800/50'}`}>
                  {s.replace('_',' ')}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Clock size={14} className="opacity-70"/>
              <input type="datetime-local" className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm"
                     onChange={async e=>{ const iso=new Date(e.target.value).toISOString(); if(await post(`/api/admin/orders/${o.id}/eta`,{eta_at:iso})) load() }} />
            </div>
            <div className="flex items-center gap-2">
              <Truck size={14} className="opacity-70"/>
              <input type="number" placeholder="Kurier-ID" defaultValue={cid||''}
                     onKeyDown={async e=>{ if(e.key==='Enter'){ const v=parseInt(e.currentTarget.value||'0',10)||null; if(await post(`/api/admin/orders/${o.id}/assign`,{courier_id:v})) load() }}}
                     className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm"/>
              <button className="btn-ghost inline-flex items-center gap-1"><Check size={14}/> Enter</button>
            </div>
            <div className="pt-2">
              <button className="btn-ghost text-rose-300 inline-flex items-center gap-2"
                      onClick={async()=>{ if(confirm('Bestellung löschen?')){ if(await post(`/api/admin/orders/${o.id}/delete`)) load() } }}>
                <Trash2 size={16}/> Löschen
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60"/>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Suche (ID, Kunde, Adresse)…" className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm"/>
        </div>
        <button className="btn-ghost border border-slate-700" onClick={load}>Neu laden</button>
      </div>

      {loading && <div className="rounded-xl h-12 bg-slate-800/50 animate-pulse"/>}
      {!loading && filtered.length===0 && <div className="text-xs opacity-70">Keine Bestellungen.</div>}
      {filtered.map(o => <Card key={o.id} o={o} />)}
    </div>
  )
}

/* ---------- Reusable CRUD Grid ---------- */
function CrudGrid({title, items, icon:Icon, imageKey, fields, onCreate, onUpdate, onDelete}){
  const [creating,setCreating]=useState(false)
  const [draft,setDraft]=useState({})

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold opacity-80">{title} <span className="ml-1 text-xs opacity-60">({items?.length||0})</span></div>
        <button className="btn inline-flex items-center gap-2" onClick={()=>{setDraft({});setCreating(true)}}><Plus size={16}/> Neu</button>
      </div>

      {creating && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 space-y-2">
          <div className="text-xs opacity-80">Neu erstellen</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {fields.map(f=>(
              <input key={f.key} placeholder={f.label} value={(draft[f.key]??'')}
                     onChange={e=>setDraft({...draft,[f.key]: e.target.value})}
                     className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm"/>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={()=>onCreate(draft).then(ok=> ok && setCreating(false))}><Save size={16}/> Speichern</button>
            <button className="btn-ghost" onClick={()=>setCreating(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      {(!items || items.length===0) ? <div className="text-xs opacity-70">Keine Daten.</div> :
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {items.map(it=><Row key={it.id} it={it} icon={Icon} imageKey={imageKey} fields={fields} onUpdate={onUpdate} onDelete={onDelete}/>)}
        </div>}
    </div>
  )
}

function Row({it, icon:Icon, imageKey, fields, onUpdate, onDelete}){
  const [edit,setEdit]=useState(false)
  const [local,setLocal]=useState(it)
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
      <div className="flex items-center gap-3">
        {imageKey ? (it[imageKey] ? <img src={it[imageKey]} alt="" className="w-12 h-12 rounded-xl object-cover"/> : <div className="w-12 h-12 rounded-xl bg-slate-800"/>) : <div className="w-12 h-12 rounded-xl bg-slate-800 grid place-items-center"><Icon size={16}/></div>}
        <div className="font-semibold truncate flex-1">{it.name || it.username || ('#'+it.id)}</div>
        {!edit ? (
          <div className="flex gap-2">
            <button className="btn-ghost inline-flex items-center gap-1" onClick={()=>setEdit(true)}><Edit3 size={16}/> Bearb.</button>
            <button className="btn-ghost text-rose-300 inline-flex items-center gap-1" onClick={()=>{ if(confirm('Eintrag löschen?')) onDelete(it.id) }}><Trash2 size={16}/> Löschen</button>
          </div>
        ) : null}
      </div>

      {edit && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {fields.map(f=>(
              <input key={f.key} placeholder={f.label} value={(local[f.key]??'')}
                     onChange={e=>setLocal({...local,[f.key]: e.target.value})}
                     className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm"/>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn inline-flex items-center gap-2" onClick={()=>onUpdate(it.id,local).then(ok=> ok && setEdit(false))}><Save size={16}/> Speichern</button>
            <button className="btn-ghost" onClick={()=>{setLocal(it);setEdit(false)}}>Abbrechen</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- Produkte / Kategorien / Nutzer Tabs ---------- */
function ProductsTab(){
  const { fetchWithAuth } = useAuth()
  const [items,setItems]=useState([])
  async function load(){ try{ const j=await fetch('/api/products').then(r=>r.json()).catch(()=>({})); if(Array.isArray(j?.products)) setItems(j.products); else { const a=await fetchWithAuth('/api/admin/products').then(r=>r.json()); setItems(a?.products||[]) } }catch{ setItems([]) } }
  useEffect(()=>{ load() },[])
  const fields=[
    {key:'name',label:'Name'},
    {key:'price_cents',label:'Preis (cents)'},
    {key:'sale_price_cents',label:'Sale-Preis (cents)'},
    {key:'category_id',label:'Kategorie-ID'},
    {key:'highlight_title',label:'Highlight Titel'},
    {key:'badge_text',label:'Badge Text'},
    {key:'badge_color',label:'Badge Farbe (hex)'},
    {key:'image_url',label:'Bild URL'},
    {key:'banner_image_url',label:'Banner URL'}
  ]
  const create = async(data)=> await send(fetchWithAuth,'/api/admin/products','POST',data).then(ok=>{ if(ok) load(); return ok})
  const update = async(id,data)=>{ const ok = await send(fetchWithAuth,`/api/admin/products/${id}`,'PUT',data) || await send(fetchWithAuth,`/api/admin/products/${id}`,'PATCH',data); if(ok) load(); return ok }
  const del = async(id)=>{ const ok = await send(fetchWithAuth,`/api/admin/products/${id}`,'DELETE'); if(ok) load(); return ok }
  return <CrudGrid title="Produkte" items={items} icon={Tag} imageKey="image_url" fields={fields} onCreate={create} onUpdate={update} onDelete={del}/>
}

function CategoriesTab(){
  const { fetchWithAuth } = useAuth()
  const [items,setItems]=useState([])
  async function load(){ try{ const a=await fetchWithAuth('/api/admin/categories').then(r=>r.json()); setItems(a?.categories||[]) }catch{ setItems([]) } }
  useEffect(()=>{ load() },[])
  const fields=[
    {key:'name',label:'Name'},
    {key:'highlight_title',label:'Highlight Titel'},
    {key:'badge_text',label:'Badge Text'},
    {key:'badge_color',label:'Badge Farbe (hex)'},
    {key:'is_featured',label:'Featured (true/false)'}
  ]
  const coerceBool = (v)=> (String(v).toLowerCase()==='true' ? true : (String(v).toLowerCase()==='false' ? false : v))
  const create = async(data)=> { data.is_featured=coerceBool(data.is_featured); const ok=await send(fetchWithAuth,'/api/admin/categories','POST',data); if(ok) load(); return ok }
  const update = async(id,data)=>{ data.is_featured=coerceBool(data.is_featured); const ok = await send(fetchWithAuth,`/api/admin/categories/${id}`,'PUT',data) || await send(fetchWithAuth,`/api/admin/categories/${id}`,'PATCH',data); if(ok) load(); return ok }
  const del = async(id)=>{ const ok = await send(fetchWithAuth,`/api/admin/categories/${id}`,'DELETE'); if(ok) load(); return ok }
  return <CrudGrid title="Kategorien" items={items} icon={Package} fields={fields} onCreate={create} onUpdate={update} onDelete={del}/>
}

function UsersTab(){
  const { fetchWithAuth } = useAuth()
  const [items,setItems]=useState([])
  async function load(){ try{ const a=await fetchWithAuth('/api/admin/users').then(r=>r.json()); setItems(a?.users||[]) }catch{ setItems([]) } }
  useEffect(()=>{ load() },[])
  const fields=[
    {key:'username',label:'Username'},
    {key:'role',label:'Rolle (admin/courier/user)'},
    {key:'password',label:'Passwort'} // wird serverseitig gehasht, wenn password_hash vorhanden
  ]
  const create = async(data)=> await send(fetchWithAuth,'/api/admin/users','POST',data).then(ok=>{ if(ok) load(); return ok})
  const update = async(id,data)=>{ const ok = await send(fetchWithAuth,`/api/admin/users/${id}`,'PUT',data) || await send(fetchWithAuth,`/api/admin/users/${id}`,'PATCH',data); if(ok) load(); return ok }
  const del = async(id)=>{ const ok = await send(fetchWithAuth,`/api/admin/users/${id}`,'DELETE'); if(ok) load(); return ok }
  return <CrudGrid title="Nutzer" items={items} icon={Users} fields={fields} onCreate={create} onUpdate={update} onDelete={del}/>
}

/* ---------- Tools ---------- */
function ToolsTab(){
  const { fetchWithAuth } = useAuth()
  const [id,setId]=useState(''); const [status,setStatus]=useState('akzeptiert')
  const opt = ['offen','akzeptiert','in_arbeit','unterwegs','abgeschlossen']
  async function setOrderStatus(){
    const sid = parseInt(id,10); if(!sid) return alert('Order-ID?')
    const ok = await send(fetchWithAuth,`/api/admin/orders/${sid}/status`,'POST',{status})
    alert(ok?'Status gesetzt.':'Fehler beim Setzen.')
  }
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 w-full max-w-md">
      <div className="font-semibold mb-3">Bestellstatus setzen</div>
      <div className="flex gap-2">
        <input value={id} onChange={e=>setId(e.target.value)} placeholder="Order-ID" className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm"/>
        <select value={status} onChange={e=>setStatus(e.target.value)} className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm">
          {opt.map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </select>
        <button className="btn" onClick={setOrderStatus}>Setzen</button>
      </div>
    </div>
  )
}

/* ---------- Root ---------- */
export default function Admin(){
  const [tab,setTab]=useState('orders')
  return (
    <div className="pf-pt-safe pf-pb-safe">
      <PageHeader title="Admin" subtitle="Verwaltung von Bestellungen, Produkten, Kategorien und Nutzern" />
      <div className="max-w-screen-lg mx-auto p-3 space-y-4">
        <HeaderTabs tab={tab} setTab={setTab}/>
        {tab==='orders' && <OrdersAdmin/>}
        {tab==='products' && <ProductsTab/>}
        {tab==='categories' && <CategoriesTab/>}
        {tab==='users' && <UsersTab/>}
        {tab==='tools' && <ToolsTab/>}
      </div>
    </div>
  )
}
