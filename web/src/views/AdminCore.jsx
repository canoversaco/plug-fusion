import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import {
  BarChart3, ClipboardList, Users, Megaphone, Settings, RefreshCcw,
  CheckCircle2, Truck, Flag, Archive, X, Search, Send, UserCog,
  Package, Wallet, MessageSquare
} from 'lucide-react'

/* ---------- Helpers (robust gegen unterschiedliche Backends) ---------- */
const MAP = new Map([
  ['accepted','angenommen'],['accept','angenommen'],
  ['in_transit','unterwegs'],['on_the_way','unterwegs'],
  ['arrived','angekommen'],['delivered','abgeschlossen'],
  ['finished','abgeschlossen'],['complete','abgeschlossen']
])
const normalize = s => (MAP.get(String(s||'').toLowerCase()) || String(s||'').toLowerCase())

async function tryJSON(fetcher, urls, opts) {
  for (const u of urls) {
    try {
      const r = await fetcher(u, opts)
      if (r && r.ok) { const d = await r.json().catch(()=>({})); return { ok:true, data:d, url:u } }
    } catch (_) {}
  }
  return { ok:false, data:null }
}

/* ---------------------------- UI-Atoms ---------------------------- */
function Pill({children, color='emerald'}) {
  const cl = `inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-${color}-500/15 border border-${color}-600/50`
  return <span className={cl}>{children}</span>
}
function Stat({icon:Icon, label, value, sub, color='emerald'}) {
  return (
    <div className="rounded-2xl p-3 border border-slate-800 bg-slate-900/60">
      <div className="flex items-center gap-2">
        <div className={`w-9 h-9 rounded-xl bg-${color}-600/20 flex items-center justify-center`}><Icon size={18}/></div>
        <div className="text-sm opacity-80">{label}</div>
      </div>
      <div className="mt-1 text-xl font-extrabold">{value}</div>
      {sub && <div className="text-xs opacity-70 mt-0.5">{sub}</div>}
    </div>
  )
}
function TabBtn({active, onClick, icon:Icon, children}) {
  return (
    <button onClick={onClick}
      className={'px-3 py-2 rounded-xl border transition flex items-center gap-2 '+
        (active ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 hover:border-slate-600')}>
      <Icon size={16}/><span className="text-sm">{children}</span>
    </button>
  )
}

/* ---------------------------- Haupt-View ---------------------------- */
export default function Admin(){
  const { fetchWithAuth, user } = useAuth()
  const fetcher = fetchWithAuth || fetch

  const [active, setActive] = useState('overview') // overview | orders | users | broadcast | tools
  const [orders, setOrders] = useState([])
  const [usersList, setUsersList] = useState([])
  const [loading, setLoading] = useState(true)
  const [qUser, setQUser] = useState('')
  const [reloadTick, setReloadTick] = useState(0)

  /* --------- Loaders --------- */
  async function loadOrders(){
    const r = await tryJSON(fetcher, [
      '/api/admin/orders',
      '/api/orders?admin=1',
      '/api/orders'
    ])
    if (r.ok) {
      const o = r.data.orders || r.data || []
      setOrders(Array.isArray(o)?o:[])
    }
  }
  async function loadUsers(){
    const r = await tryJSON(fetcher, [
      '/api/admin/users',
      '/api/users?admin=1',
      '/api/users'
    ])
    if (r.ok) {
      const u = r.data.users || r.data || []
      setUsersList(Array.isArray(u)?u:[])
    }
  }

  useEffect(()=>{ (async()=>{
    setLoading(true)
    await Promise.all([loadOrders(), loadUsers()])
    setLoading(false)
  })() }, [reloadTick])

  /* --------- Derived --------- */
  const lanes = useMemo(()=>{
    const open=[], accepted=[], delivering=[], done=[]
    for(const o of orders){
      const s = normalize(o.status)
      if (s==='abgeschlossen') done.push(o)
      else if (s==='unterwegs') delivering.push(o)
      else if (s==='angenommen') accepted.push(o)
      else open.push(o)
    }
    return { open, accepted, delivering, done }
  }, [orders])

  const revenue = useMemo(()=>{
    let cents = 0
    for(const o of orders) cents += (o.total_cents||0)
    return (cents/100).toFixed(2)+' €'
  }, [orders])

  /* --------- Actions --------- */
  async function setStatus(id, status){
    const body = JSON.stringify({ status })
    const headers = {'content-type':'application/json'}
    const r = await tryJSON(fetcher, [
      `/api/admin/orders/${id}/status`,
      `/api/orders/${id}/status`,
      `/api/orders/status?id=${id}&status=${encodeURIComponent(status)}`,
    ], { method:'POST', headers, body })
    if (!r.ok) alert('Status konnte nicht aktualisiert werden')
    await loadOrders()
  }
  async function assignCourier(id, courier_id){
    const body = JSON.stringify({ courier_id })
    const headers = {'content-type':'application/json'}
    const r = await tryJSON(fetcher, [
      `/api/admin/orders/${id}/assign`,
      `/api/orders/${id}/assign`,
      `/api/orders/assign?id=${id}&courier_id=${encodeURIComponent(courier_id)}`
    ], { method:'POST', headers, body })
    if (!r.ok) alert('Kurier-Zuweisung fehlgeschlagen')
    await loadOrders()
  }
  async function broadcastSend(payload){
    const headers={'content-type':'application/json'}
    const body = JSON.stringify(payload)
    const r = await tryJSON(fetcher, [
      '/api/admin/broadcast',
      '/api/notify/broadcast',
      '/api/admin/notify'
    ], { method:'POST', headers, body })
    if (!r.ok) alert('Broadcast fehlgeschlagen')
  }
  async function toolHit(urls){
    const r = await tryJSON(fetcher, urls)
    if (!r.ok) alert('Aktion fehlgeschlagen')
  }

  /* ---------------------------- UI Blocks ---------------------------- */
  function OrdersLane({title, color='emerald', list}){
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className={`px-3 py-2 text-sm font-semibold border-b border-slate-800 bg-${color}-600/20`}>
          {title} <span className="ml-1 opacity-80">({list.length})</span>
        </div>
        <div className="divide-y divide-slate-800">
          {list.length===0 && <div className="p-3 text-sm opacity-70">Keine Einträge</div>}
          {list.map(o=>{
            const itemsCount = (o.items?.length) || (o.lines?.length) || (o.order_items?.length) || 0
            const total = ((o.total_cents||0)/100).toFixed(2)+' €'
            const eta = o.eta_at ? new Date(o.eta_at).toLocaleTimeString().slice(0,5) : null
            const courier = o.courier_username || o.courier_name || (o.courier_id ? ('#'+o.courier_id) : '—')
            return (
              <details key={o.id}>
                <summary className="p-3 cursor-pointer flex items-center gap-2">
                  <Pill color={color}>#{o.id}</Pill>
                  <span className="text-sm">{itemsCount} Pos.</span>
                  <span className="text-sm font-semibold">{total}</span>
                  {eta && <span className="text-xs opacity-70">ETA {eta}</span>}
                  <span className="ml-auto text-xs opacity-70">{normalize(o.status)}</span>
                </summary>
                <div className="p-3 pt-0 space-y-3">
                  {/* Meta */}
                  <div className="text-xs opacity-80">
                    Kunde: <b>{o.user_username || o.user_name || ('#'+o.user_id)}</b> •
                    {' '}Kurier: <b>{courier}</b> •
                    {' '}Erstellt: {new Date(o.created_at||o.created||Date.now()).toLocaleString()}
                  </div>
                  {/* Items */}
                  {itemsCount>0 && (
                    <div className="rounded-xl border border-slate-800 p-2 bg-slate-950/60">
                      <div className="text-xs font-semibold mb-1 flex items-center gap-2"><Package size={14}/>Positionen</div>
                      <div className="text-sm opacity-80 space-y-0.5">
                        {(o.items||o.lines||o.order_items||[]).map((it,i)=>
                          <div key={i} className="flex justify-between">
                            <span>{it.name||it.title||('Artikel '+(i+1))}{it.qty?` ×${it.qty}`:''}</span>
                            <span>{it.price_cents?((it.price_cents/100).toFixed(2)+' €'):''}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Aktionen */}
                  <div className="flex flex-wrap gap-2">
                    {/* Status-Buttons je nach aktuellem Status */}
                    <button className="btn" onClick={()=>setStatus(o.id,'angenommen')}><CheckCircle2 size={14}/> Annehmen</button>
                    <button className="btn" onClick={()=>setStatus(o.id,'unterwegs')}><Truck size={14}/> Unterwegs</button>
                    <button className="btn" onClick={()=>setStatus(o.id,'abgeschlossen')}><Archive size={14}/> Abschließen</button>
                    <button className="btn-ghost" onClick={()=>setStatus(o.id,'storniert')}><X size={14}/> Stornieren</button>
                    {/* Kurier-Zuweisung */}
                    <div className="flex items-center gap-1 ml-auto">
                      <input placeholder="Kurier-ID" className="px-2 py-1 rounded-lg border border-slate-700 bg-slate-900 text-sm w-24"
                        onKeyDown={e=>{ if(e.key==='Enter'){ assignCourier(o.id, e.currentTarget.value.trim()); e.currentTarget.value='' }}} />
                      <button className="btn" onClick={(e)=>{
                        const inp = e.currentTarget.previousSibling; const v=inp?.value?.trim()
                        if(v) { assignCourier(o.id, v); inp.value='' }
                      }}>Zuweisen</button>
                    </div>
                  </div>
                </div>
              </details>
            )
          })}
        </div>
      </div>
    )
  }

  function UsersBlock(){
    const list = usersList.filter(u=>{
      const s=(qUser||'').toLowerCase()
      return !s || JSON.stringify(u).toLowerCase().includes(s)
    })
    async function changeRole(id, role){
      const body = JSON.stringify({ role })
      const headers = {'content-type':'application/json'}
      const r = await tryJSON(fetcher, [
        `/api/admin/users/${id}/role`,
        `/api/users/${id}/role`,
        `/api/users/role?id=${id}&role=${encodeURIComponent(role)}`
      ], { method:'POST', headers, body })
      if (!r.ok) alert('Rolle konnte nicht geändert werden')
      await loadUsers()
    }
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 opacity-70"/>
            <input value={qUser} onChange={e=>setQUser(e.target.value)} placeholder="User suchen…"
              className="pl-7 pr-2 py-2 rounded-xl border border-slate-700 bg-slate-900 text-sm w-full"/>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 divide-y divide-slate-800 bg-slate-900/50">
          {list.length===0 && <div className="p-3 text-sm opacity-70">Keine Nutzer gefunden.</div>}
          {list.map(u=>(
            <div key={u.id||u.user_id} className="p-3 flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-emerald-600/20 flex items-center justify-center"><UserCog size={16}/></div>
              <div className="text-sm">
                <div className="font-semibold">{u.username || u.name || ('#'+(u.id||u.user_id))}</div>
                <div className="opacity-70 text-xs">{u.email||u.phone||'—'}</div>
              </div>
              <div className="ml-auto">
                <select defaultValue={u.role||'user'} onChange={e=>changeRole(u.id||u.user_id, e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-900 text-sm">
                  <option value="user">user</option>
                  <option value="courier">courier</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function BroadcastBlock(){
    const [title,setTitle]=useState('')
    const [body,setBody]=useState('')
    const [sent,setSent]=useState(false)
    return (
      <div className="space-y-2">
        <div className="rounded-2xl border border-slate-800 p-3 bg-slate-900/60">
          <div className="flex items-center gap-2 mb-2"><Megaphone size={16}/><div className="font-semibold">Nachricht senden</div></div>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Titel"
                 className="w-full mb-2 px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 text-sm"/>
          <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Nachricht (Push/Telegram, falls konfiguriert)"
                    className="w-full h-28 px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 text-sm"/>
          <div className="mt-2 flex gap-2">
            <button className="btn inline-flex items-center gap-1" onClick={async()=>{
              await broadcastSend({ title, body }); setSent(true); setTimeout(()=>setSent(false), 1200)
            }}><Send size={14}/> Senden</button>
            {sent && <span className="text-emerald-400 text-sm">Gesendet ✓</span>}
          </div>
        </div>
      </div>
    )
  }

  function ToolsBlock(){
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="rounded-2xl border border-slate-800 p-3 bg-slate-900/60">
          <div className="font-semibold mb-1 flex items-center gap-2"><RefreshCcw size={16}/>Cache / Menü neu laden</div>
          <div className="text-xs opacity-70 mb-2">Aktualisiert Server-Caches und Menüdaten.</div>
          <button className="btn" onClick={()=>toolHit(['/api/admin/reload','/api/admin/refresh','/api/admin/rebuild-menu'])}>Aktualisieren</button>
        </div>
        <div className="rounded-2xl border border-slate-800 p-3 bg-slate-900/60">
          <div className="font-semibold mb-1 flex items-center gap-2"><Wallet size={16}/>Abrechnungen prüfen</div>
          <div className="text-xs opacity-70 mb-2">Ruft aggregierte Umsätze (falls verfügbar) ab.</div>
          <button className="btn" onClick={()=>toolHit(['/api/admin/settlements','/api/admin/revenue'])}>Abrufen</button>
        </div>
      </div>
    )
  }

  /* ---------------------------- Render ---------------------------- */
  if (!user || user.role!=='admin') {
    return (
      <div className="pf-pt-safe pf-pb-safe p-3">
        <div className="rounded-2xl border border-slate-800 p-4 bg-rose-500/10">
          <div className="font-bold mb-1">Kein Zugriff</div>
          <div className="text-sm opacity-80">Du benötigst Admin-Rechte.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="pf-pt-safe pf-pb-safe">
      {/* Header */}
      <div className="px-3">
        <div className="rounded-2xl p-4 bg-gradient-to-r from-emerald-600/20 via-fuchsia-600/20 to-cyan-600/20 border border-slate-800">
          <div className="text-xs opacity-80">Admin Panel</div>
          <div className="text-2xl font-extrabold flex items-center gap-2">
            Willkommen, {user.username || 'Admin'} <MessageSquare size={18} className="opacity-80"/>
          </div>
          <div className="mt-1 text-sm opacity-80">Überblick, Bestellungen, Nutzer, Broadcast & Tools</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-3 mt-3 flex gap-2 overflow-x-auto hide-scroll">
        <TabBtn active={active==='overview'} onClick={()=>setActive('overview')} icon={BarChart3}>Überblick</TabBtn>
        <TabBtn active={active==='orders'}   onClick={()=>setActive('orders')}   icon={ClipboardList}>Bestellungen</TabBtn>
        <TabBtn active={active==='users'}    onClick={()=>setActive('users')}    icon={Users}>Nutzer</TabBtn>
        <TabBtn active={active==='broadcast'}onClick={()=>setActive('broadcast')}icon={Megaphone}>Broadcast</TabBtn>
        <TabBtn active={active==='tools'}    onClick={()=>setActive('tools')}    icon={Settings}>Tools</TabBtn>
        <button className="ml-auto px-3 py-2 rounded-xl border border-slate-700 hover:border-slate-500"
                onClick={()=>setReloadTick(x=>x+1)}><RefreshCcw size={16}/></button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {loading && <div className="text-sm opacity-70">Lade Daten…</div>}

        {active==='overview' && !loading && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat icon={ClipboardList} label="Bestellungen ges." value={orders.length} color="emerald"/>
              <Stat icon={Flag} label="Offen" value={lanes.open.length} color="fuchsia"/>
              <Stat icon={Truck} label="Unterwegs" value={lanes.delivering.length} color="cyan"/>
              <Stat icon={Wallet} label="Umsatz" value={revenue} sub="Summe brutto" color="amber"/>
            </div>
            <div className="space-y-2">
              <OrdersLane title="Offene Bestellungen" color="fuchsia" list={lanes.open}/>
              <OrdersLane title="Angenommen" color="emerald" list={lanes.accepted}/>
              <OrdersLane title="Unterwegs" color="cyan" list={lanes.delivering}/>
              <OrdersLane title="Abgeschlossen" color="amber" list={lanes.done}/>
            </div>
          </>
        )}

        {active==='orders' && !loading && (
          <div className="space-y-2">
            <OrdersLane title="Offen" color="fuchsia" list={lanes.open}/>
            <OrdersLane title="Angenommen" color="emerald" list={lanes.accepted}/>
            <OrdersLane title="Unterwegs" color="cyan" list={lanes.delivering}/>
            <OrdersLane title="Abgeschlossen" color="amber" list={lanes.done}/>
          </div>
        )}

        {active==='users' && !loading && <UsersBlock/>}
        {active==='broadcast' && !loading && <BroadcastBlock/>}
        {active==='tools' && !loading && <ToolsBlock/>}
      </div>
    </div>
  )
}
