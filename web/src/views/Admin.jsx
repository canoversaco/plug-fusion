import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'

function Section({title, children, actions}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">{title}</h2>
        <div className="flex gap-2">{actions}</div>
      </div>
      {children}
    </div>
  )
}

export default function Admin(){
  const { fetchWithAuth } = useAuth()
  const [tab, setTab] = useState('orders')
  const [state, setState] = useState({ users:[], orders:[], categories:[], products:[] })
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  // Form-States
  const [uForm, setUForm] = useState({ id:null, username:'', password:'', role:'user', wallet_balance_cents:0 })
  const [pForm, setPForm] = useState({ id:null, name:'', price_cents:0, category_id:null, active:true, image_url:'', description:'' })
  const [cForm, setCForm] = useState({ id:null, name:'', position:0, active:true, highlight:false, highlight_color:'' })

  const loadAll = async ()=>{
    setLoading(true); setMsg('')
    try {
      const [users, orders, catalog] = await Promise.all([
        fetchWithAuth('/api/admin/users').then(r=>r.json()),
        fetchWithAuth('/api/admin/orders').then(r=>r.json()),
        fetch('/api/products').then(r=>r.json()), // public list für Kategorien (active)
      ])
      setState({
        users: users.users||[],
        orders: orders.orders||[],
        categories: catalog.categories||[],
        products: catalog.products||[],
      })
    } catch(e) {
      setMsg('Fehler beim Laden.')
    } finally { setLoading(false) }
  }

  useEffect(()=>{ loadAll() },[])

  const saveUser = async ()=>{
    setMsg('')
    const r = await fetchWithAuth('/api/admin/users', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(uForm) })
    const d = await r.json()
    setMsg(r.ok?'✅ User gespeichert':'❌ '+(d?.error||'fehler'))
    if (r.ok){ setUForm({ id:null, username:'', password:'', role:'user', wallet_balance_cents:0 }); loadAll() }
  }
  const editUser = (u)=> setUForm({ id:u.id, username:u.username, password:'', role:u.role, wallet_balance_cents:u.wallet_balance_cents||0 })
  const delUser = async (id)=>{
    if (!confirm('Diesen User wirklich löschen?')) return
    const r = await fetchWithAuth('/api/admin/users/'+id, { method:'DELETE' })
    setMsg(r.ok?'🗑️ User gelöscht':'❌ Löschen fehlgeschlagen'); if (r.ok) loadAll()
  }

  const saveProduct = async ()=>{
    const r = await fetchWithAuth('/api/admin/products', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(pForm) })
    const d = await r.json(); setMsg(r.ok?'✅ Produkt gespeichert':'❌ '+(d?.error||'fehler'))
    if (r.ok){ setPForm({ id:null, name:'', price_cents:0, category_id:null, active:true, image_url:'', description:'' }); loadAll() }
  }
  const editProduct = (p)=> setPForm({ id:p.id, name:p.name||'', price_cents:p.price_cents||0, category_id:p.category_id||null, active:!!p.active, image_url:p.image_url||'', description:p.description||'' })
  const delProduct = async (id)=>{
    if (!confirm('Produkt löschen?')) return
    const r = await fetchWithAuth('/api/admin/products/'+id, { method:'DELETE' })
    setMsg(r.ok?'🗑️ Produkt gelöscht':'❌ Löschen fehlgeschlagen'); if (r.ok) loadAll()
  }

  const saveCategory = async ()=>{
    const r = await fetchWithAuth('/api/admin/categories', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(cForm) })
    const d = await r.json(); setMsg(r.ok?'✅ Kategorie gespeichert':'❌ '+(d?.error||'fehler'))
    if (r.ok){ setCForm({ id:null, name:'', position:0, active:true }); loadAll() }
  }
  const editCategory = (c)=> setCForm({ id:c.id, name:c.name, position:c.position||0, active:!!c.active })
  const delCategory = async (id)=>{
    if (!confirm('Kategorie löschen?')) return
    const r = await fetchWithAuth('/api/admin/categories/'+id, { method:'DELETE' })
    setMsg(r.ok?'🗑️ Kategorie gelöscht':'❌ Löschen fehlgeschlagen'); if (r.ok) loadAll()
  }

  const updateOrder = async (o, patch)=>{
    const r = await fetchWithAuth('/api/admin/orders/'+o.id, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(patch) })
    const d = await r.json(); setMsg(r.ok?'✅ Bestellung aktualisiert':'❌ '+(d?.error||'fehler'))
    if (r.ok) loadAll()
  }

  const TabBtn = ({id, children})=>(
    <button onClick={()=>setTab(id)} className={'px-3 py-2 rounded-lg text-sm ' + (tab===id?'bg-emerald-600 text-white':'bg-slate-800')}>
      {children}
    </button>
  )

  return (
    <div className="space-y-4">
      <div className="flex gap-2 sticky top-0 bg-slate-950/70 backdrop-blur p-2 rounded-xl border border-slate-800">
        <TabBtn id="orders">Bestellungen</TabBtn>
        <TabBtn id="products">Produkte</TabBtn>
        <TabBtn id="categories">Kategorien</TabBtn>
        <TabBtn id="users">Benutzer</TabBtn>
        <div className="ml-auto text-sm opacity-80 self-center">{loading?'lädt…':msg}</div>
      </div>

      {tab==='orders' && (
        <Section title="Bestellübersicht" actions={<button className="btn-ghost" onClick={loadAll}>Neu laden</button>}>
          <div className="space-y-2">
            {(state.orders||[]).length===0 && <div className="text-sm opacity-70">Keine Bestellungen vorhanden.</div>}
            {(state.orders||[]).map(o=>(
              <div key={o.id} className="card">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="font-semibold">#{o.id} • {o.user_username||'—'}</div>
                  <div className="text-sm opacity-80">erstellt {o.created_at?.replace('T',' ').slice(0,16)||''}</div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                  <div><div className="text-xs opacity-70">Status</div>
                    <select className="input" defaultValue={o.status} onChange={e=>updateOrder(o,{status:e.target.value})}>
                      {['wartet_bestätigung','bestätigt','unterwegs','abholbereit','fertig','storniert'].map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><div className="text-xs opacity-70">Kurier</div>
                    <input className="input" defaultValue={o.courier_username||''} onBlur={e=>updateOrder(o,{courier_username:e.target.value})} placeholder="username"/>
                  </div>
                  <div><div className="text-xs opacity-70">ETA (Minuten)</div>
                    <input className="input" type="number" min="1" defaultValue={15} onBlur={e=>updateOrder(o,{eta_minutes:Number(e.target.value||15)})}/>
                  </div>
                  <div>
                    <div className="text-xs opacity-70">Summe</div>
                    <div className="font-semibold">{((o.total_cents||0)/100).toFixed(2)} €</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {tab==='products' && (
        <Section title="Produkte" actions={<button className="btn" onClick={()=>setPForm({ id:null, name:'', price_cents:0, category_id:null, active:true, image_url:'', description:'' })}>Neu</button>}>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <div className="space-y-2">
                {(state.products||[]).map(p=>(
                  <div key={p.id} className="card flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {p.image_url && <img src={p.image_url} alt="" className="w-16 h-16 object-cover rounded-lg" />}
                      <div>
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-xs opacity-70">{p.category_name||'—'} • {(p.price_cents/100).toFixed(2)} €</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-ghost" onClick={()=>editProduct(p)}>Bearbeiten</button>
                      <button className="btn-danger" onClick={()=>delProduct(p.id)}>Löschen</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="font-semibold mb-2">{pForm.id?'Produkt bearbeiten':'Neues Produkt'}</div>
              <div className="space-y-2">
                <input className="input" placeholder="Name" value={pForm.name} onChange={e=>setPForm({...pForm, name:e.target.value})}/>
                <input className="input" type="number" placeholder="Preis (Cent)" value={pForm.price_cents} onChange={e=>setPForm({...pForm, price_cents:Number(e.target.value||0)})}/>
                <select className="input" value={pForm.category_id??''} onChange={e=>setPForm({...pForm, category_id: e.target.value?Number(e.target.value):null})}>
                  <option value="">— Kategorie wählen —</option>
                  {(state.categories||[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={!!pForm.active} onChange={e=>setPForm({...pForm, active:e.target.checked})}/> Aktiv</label>
                <label className="text-sm flex items-center gap-2 mt-1"><input type="checkbox" checked={!!cForm.highlight} onChange={e=>setCForm({...cForm, highlight:e.target.checked})}/> Highlighten</label>
                <input className="input mt-1" placeholder="Highlight-Farbe (z.B. #22c55e)" value={cForm.highlight_color||""} onChange={e=>setCForm({...cForm, highlight_color:e.target.value})}/>
                <input className="input" placeholder="Bild-URL" value={pForm.image_url} onChange={e=>setPForm({...pForm, image_url:e.target.value})}/>
                <textarea className="input min-h-[80px]" placeholder="Beschreibung" value={pForm.description} onChange={e=>setPForm({...pForm, description:e.target.value})}/>
                <div className="flex gap-2">
                  <button className="btn" onClick={saveProduct}>Speichern</button>
                  {pForm.id && <button className="btn-ghost" onClick={()=>setPForm({ id:null, name:'', price_cents:0, category_id:null, active:true, image_url:'', description:'' })}>Neu</button>}
                </div>
              </div>
            </div>
          </div>
        </Section>
      )}

      {tab==='categories' && (
        <Section title="Kategorien" actions={<button className="btn" onClick={()=>setCForm({ id:null, name:'', position:0, active:true })}>Neu</button>}>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              {(state.categories||[]).map(c=>(
                <div key={c.id} className="card flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-xs opacity-70">Pos. {c.position||0} • {c.active?'aktiv':'inaktiv'}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-ghost" onClick={()=>editCategory(c)}>Bearbeiten</button>
                    <button className="btn-danger" onClick={()=>delCategory(c.id)}>Löschen</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="font-semibold mb-2">{cForm.id?'Kategorie bearbeiten':'Neue Kategorie'}</div>
              <div className="space-y-2">
                <input className="input" placeholder="Name" value={cForm.name} onChange={e=>setCForm({...cForm, name:e.target.value})}/>
                <input className="input" type="number" placeholder="Position" value={cForm.position} onChange={e=>setCForm({...cForm, position:Number(e.target.value||0)})}/>
                <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={!!cForm.active} onChange={e=>setCForm({...cForm, active:e.target.checked})}/> Aktiv</label>
                <label className="text-sm flex items-center gap-2 mt-1"><input type="checkbox" checked={!!cForm.highlight} onChange={e=>setCForm({...cForm, highlight:e.target.checked})}/> Highlighten</label>
                <input className="input mt-1" placeholder="Highlight-Farbe (z.B. #22c55e)" value={cForm.highlight_color||""} onChange={e=>setCForm({...cForm, highlight_color:e.target.value})}/>
                <div className="flex gap-2">
                  <button className="btn" onClick={saveCategory}>Speichern</button>
                  {cForm.id && <button className="btn-ghost" onClick={()=>setCForm({ id:null, name:'', position:0, active:true })}>Neu</button>}
                </div>
              </div>
            </div>
          </div>
        </Section>
      )}

      {tab==='users' && (
        <Section title="Benutzer" actions={<button className="btn" onClick={()=>setUForm({ id:null, username:'', password:'', role:'user', wallet_balance_cents:0 })}>Neu</button>}>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              {(state.users||[]).map(u=>(
                <div key={u.id} className="card flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{u.username}</div>
                    <div className="text-xs opacity-70">{u.role} • Wallet {(u.wallet_balance_cents/100).toFixed(2)} €</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-ghost" onClick={()=>editUser(u)}>Bearbeiten</button>
                    <button className="btn-danger" onClick={()=>delUser(u.id)}>Löschen</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="font-semibold mb-2">{uForm.id?'Benutzer bearbeiten':'Neuer Benutzer'}</div>
              <div className="space-y-2">
                <input className="input" placeholder="Username" value={uForm.username} onChange={e=>setUForm({...uForm, username:e.target.value})}/>
                <input className="input" type="password" placeholder={uForm.id?'Neues Passwort (optional)':'Passwort'} value={uForm.password} onChange={e=>setUForm({...uForm, password:e.target.value})}/>
                <select className="input" value={uForm.role} onChange={e=>setUForm({...uForm, role:e.target.value})}>
                  <option value="user">user</option>
                  <option value="courier">courier</option>
                  <option value="admin">admin</option>
                </select>
                <input className="input" type="number" placeholder="Wallet (Cent)" value={uForm.wallet_balance_cents} onChange={e=>setUForm({...uForm, wallet_balance_cents:Number(e.target.value||0)})}/>
                <div className="flex gap-2">
                  <button className="btn" onClick={saveUser}>Speichern</button>
                  {uForm.id && <button className="btn-ghost" onClick={()=>setUForm({ id:null, username:'', password:'', role:'user', wallet_balance_cents:0 })}>Neu</button>}
                </div>
              </div>
            </div>
          </div>
        </Section>
      )}
    </div>
  )
}
