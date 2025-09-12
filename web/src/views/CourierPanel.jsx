import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import {
  RotateCcw, Bike, Clock, MapPin, Navigation, CheckCircle2,
  ChevronDown, ChevronUp, Ban, Loader2
} from 'lucide-react'

/** ===================== Helpers / Normalizer ===================== */
const DONE_STATES    = new Set(['abgeschlossen','completed','done','fertig'])
const CANCEL_STATES  = new Set(['storniert','cancelled','canceled'])
const OPEN_STATES    = new Set(['wartet_bestätigung','offen','open','pending','neu'])

const STATUS_ALIASES = new Map([
  ['accepted','angenommen'], ['accept','angenommen'],
  ['in_transit','unterwegs'], ['on_the_way','unterwegs'],
  ['arrived','angekommen'], ['delivered','abgeschlossen'],
  ['finished','abgeschlossen'], ['complete','abgeschlossen'],
  ['canceled','storniert'], ['cancelled','storniert']
])

function stdStatus(s){
  if(!s) return ''
  const k = String(s).toLowerCase().trim()
  return STATUS_ALIASES.get(k) || k
}

function pickArray(obj) {
  if (!obj || typeof obj!=='object') return []
  if (Array.isArray(obj)) return obj
  return obj.orders || obj.results || obj.rows || obj.data || []
}

function norm(o) {
  if (!o || typeof o!=='object') return { id: undefined }
  const id        = o.id ?? o.order_id ?? o.orderId
  const status    = stdStatus(o.status ?? o.state ?? o.order_status ?? '')
  const customer  = o.customer_name ?? o.customer ?? o.username ?? o.user_name ?? ''
  const address   = o.address ?? o.delivery_address ?? (o.location && o.location.address) ?? ''
  const total     = o.total ?? o.total_price ?? o.amount_total ?? o.sum ?? null
  const created   = o.created_at ?? o.createdAt ?? o.time_created ?? ''
  const eta_at    = o.eta_at ?? o.etaAt ?? null
  const courier   = o.courier_username ?? o.courier ?? null
  return { id, status, customer, address, total, created, eta_at, courier, raw:o }
}

async function j(fetchWithAuth, url, opts={}){
  const res = await (fetchWithAuth||fetch)(url, { headers:{'accept':'application/json', ...(opts.headers||{})}, ...opts })
  if (!res.ok) {
    let msg='HTTP_'+res.status
    try { const e=await res.json(); msg=e?.error||e?.message||msg } catch {}
    throw new Error(msg)
  }
  try { return await res.json() } catch { return {} }
}
async function firstOK(fetchWithAuth, list){
  for (const u of list) {
    try { const d = await j(fetchWithAuth,u); return {ok:true,url:u,data:d} } catch {}
  }
  return {ok:false}
}
async function tryPOST(fetchWithAuth, urls, body){ for (const u of urls){ try{ const r=await (fetchWithAuth||fetch)(u,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body||{})}); if(r.ok) return true }catch{} } return false }
async function tryPUT (fetchWithAuth, urls, body){ for (const u of urls){ try{ const r=await (fetchWithAuth||fetch)(u,{method:'PUT', headers:{'content-type':'application/json'}, body:JSON.stringify(body||{})}); if(r.ok) return true }catch{} } return false }

/** ===================== Small UI bits ===================== */
function Section({ title, children, right=null }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="font-semibold">{title}</div>
        <div className="ml-auto">{right}</div>
      </div>
      {children}
    </section>
  )
}

function Row({ label, children }){
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="w-28 opacity-70">{label}</div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function OrderCard({
  o, expanded, busy, onToggle,
  onClaim, onNext, onSetStatus, onSetEta, onSendLoc
}){
  const [eta, setEta] = useState('')
  const disabled = !!busy

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
      <button onClick={onToggle} className="w-full text-left flex items-center gap-2">
        <div className="font-semibold">#{o.id}</div>
        <div className="text-xs opacity-70 pf-pill bg-slate-700/60">{o.status || '—'}</div>
        {o.total!=null && <div className="text-xs opacity-80 ml-2">💶 {(Number(o.total)/100).toFixed(2)} €</div>}
        {o.eta_at && <div className="text-xs opacity-80 ml-2"><Clock size={14} className="inline -mt-0.5"/> {new Date(o.eta_at).toLocaleTimeString().slice(0,5)}</div>}
        <div className="ml-auto opacity-70">{expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {o.address && <Row label="Adresse">📍 {o.address}</Row>}
          {o.customer && <Row label="Kunde">👤 {o.customer}</Row>}
          {o.courier  && <Row label="Kurier">🚴 {o.courier}</Row>}

          <div className="pt-1 border-t border-slate-800 mt-2" />

          {/* Actions */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {onClaim && (
              <button disabled={disabled} onClick={onClaim}
                className={'px-3 py-2 rounded-lg border ' + (disabled?'border-slate-700 opacity-60':'border-emerald-600 text-emerald-300 hover:bg-emerald-600/10')}>
                {busy==='claim' ? <Loader2 className="inline mr-2 animate-spin" size={16}/> : <CheckCircle2 className="inline mr-2" size={16}/> }
                Annehmen
              </button>
            )}

            {/* Guided next step */}
            {onNext && (
              <button disabled={disabled} onClick={onNext} className={'px-3 py-2 rounded-lg border ' + (disabled?'border-slate-700 opacity-60':'border-slate-700 hover:bg-slate-800')}>
                {busy==='status' ? <Loader2 className="inline mr-2 animate-spin" size={16}/> : null}
                Nächster Schritt
              </button>
            )}

            {/* Direct status shortcuts */}
            <button disabled={disabled} onClick={()=>onSetStatus('angenommen')}  className={'px-3 py-2 rounded-lg border ' + (disabled?'border-slate-700 opacity-60':'border-slate-700 hover:bg-slate-800')}>Angenommen</button>
            <button disabled={disabled} onClick={()=>onSetStatus('unterwegs')}   className={'px-3 py-2 rounded-lg border ' + (disabled?'border-slate-700 opacity-60':'border-slate-700 hover:bg-slate-800')}>Unterwegs</button>
            <button disabled={disabled} onClick={()=>onSetStatus('angekommen')}  className={'px-3 py-2 rounded-lg border ' + (disabled?'border-slate-700 opacity-60':'border-slate-700 hover:bg-slate-800')}>Angekommen</button>
            <button disabled={disabled} onClick={()=>onSetStatus('abgeschlossen')} className={'px-3 py-2 rounded-lg border ' + (disabled?'border-slate-700 opacity-60':'border-slate-700 hover:bg-slate-800')}>Abgeschlossen</button>
            <button disabled={disabled} onClick={()=>onSetStatus('storniert')}    className={'px-3 py-2 rounded-lg border ' + (disabled?'border-rose-900/60 opacity-60':'border-rose-700 text-rose-300 hover:bg-rose-900/20')}>
              <Ban size={14} className="inline mr-1"/> Stornieren
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="flex gap-2 items-center">
              <input value={eta} onChange={e=>setEta(e.target.value.replace(/[^0-9]/g,''))}
                inputMode="numeric" placeholder="ETA (Min.)"
                className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"/>
              <button disabled={disabled} onClick={()=>onSetEta(eta)} className={'px-3 py-2 rounded-lg border ' + (disabled?'border-slate-700 opacity-60':'border-slate-700 hover:bg-slate-800')}>
                {busy==='eta' ? <Loader2 className="inline mr-2 animate-spin" size={16}/> : <Clock className="inline mr-2" size={14}/> }
                Setzen
              </button>
            </div>
            <div className="flex gap-2">
              <button disabled={disabled} onClick={()=>onSendLoc('gps')} className={'px-3 py-2 rounded-lg border ' + (disabled?'border-slate-700 opacity-60':'border-slate-700 hover:bg-slate-800')}>
                {busy==='loc' ? <Loader2 className="inline mr-2 animate-spin" size={16}/> : <Navigation className="inline mr-1" size={14}/>}
                GPS senden
              </button>
              <button disabled={disabled} onClick={()=>onSendLoc('prompt')} className={'px-3 py-2 rounded-lg border ' + (disabled?'border-slate-700 opacity-60':'border-slate-700 hover:bg-slate-800')}>
                <MapPin className="inline mr-1" size={14}/> Koordinaten
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** ===================== Main View ===================== */
export default function CourierPanel(){
  const { fetchWithAuth, user } = useAuth()

  // Daten
  const [openOrders, setOpenOrders] = useState([])
  const [mineOrders, setMineOrders] = useState([])

  // UI
  const [expanded, setExpanded] = useState({})     // {id:true}
  const [busy, setBusy]           = useState({})   // {id: 'claim'|'status'|'eta'|'loc'}
  const [loading, setLoading]     = useState(true)
  const [info, setInfo]           = useState('')
  const [err, setErr]             = useState('')

  // Endpoints
  const OPEN_URLS = useMemo(()=>[
    '/api/courier/orders?mine=0',
    '/api/courier/orders/open',
    '/api/courier/orders/all',
    '/api/courier/queue'
  ],[])
  const MINE_URLS = useMemo(()=>[
    '/api/courier/orders?mine=1',
    '/api/courier/orders/mine',
    '/api/courier/my'
  ],[])

  function toggle(id){ setExpanded(e=>({...e, [id]: !e[id]})) }

  /** -------- load lists -------- */
  async function load(){
    setLoading(true); setErr(''); setInfo('')
    const [a,b] = await Promise.all([ firstOK(fetchWithAuth, OPEN_URLS), firstOK(fetchWithAuth, MINE_URLS) ])
    if (!a.ok && !b.ok) { setErr('Konnte Kurier-Endpoints nicht erreichen (Login/Rolle?).'); setLoading(false); return }

    const open = a.ok ? pickArray(a.data).map(norm).filter(x=>x.id!==undefined) : []
    const mine = b.ok ? pickArray(b.data).map(norm).filter(x=>x.id!==undefined) : []

    // defensive: falls "open" leer ist, deduziere "offen" aus mine/all
    const openDef = open.filter(o => !o.courier || OPEN_STATES.has(o.status))
    setOpenOrders(openDef.length ? openDef : open)
    setMineOrders(mine)
    setLoading(false)
  }

  useEffect(()=>{ load() },[])
  useEffect(()=>{ const t=setInterval(load, 10000); return ()=>clearInterval(t) },[])

  /** -------- classification -------- */
  const mineActive = useMemo(
    ()=> mineOrders.filter(o => !DONE_STATES.has(o.status) && !CANCEL_STATES.has(o.status)),
    [mineOrders]
  )
  const mineDone = useMemo(
    ()=> mineOrders.filter(o => DONE_STATES.has(o.status)),
    [mineOrders]
  )

  /** -------- optimistic helpers -------- */
  function setBusyFor(id, kind, on=false){
    setBusy(b => ({...b, [id]: on ? kind : undefined}))
  }
  function upsertMine(o){
    setMineOrders(list=>{
      const i=list.findIndex(x=>x.id===o.id); const copy=[...list]
      if (i>=0) copy[i]=o; else copy.unshift(o)
      return copy
    })
  }
  function removeFromOpen(id){
    setOpenOrders(list => list.filter(x=>x.id!==id))
  }

  /** -------- Actions -------- */
  async function doClaim(id){
    setBusyFor(id,'claim',true); setInfo('Übernehme Bestellung …')
    const ok = await tryPOST(fetchWithAuth, [
      `/api/courier/orders/${id}/claim`,
      `/api/orders/${id}/claim`,
      `/api/courier/claim/${id}`,
      `/api/courier/orders/${id}/claim` // fallback auch per PUT s.u.
    ], {})
    if (!ok) { setBusyFor(id,'claim',false); setInfo(''); alert('Annehmen fehlgeschlagen (evtl. schon vergeben).'); await load(); return }

    // optimistic: verschiebe nach "zu erledigen"
    const found = openOrders.find(x=>x.id===id) || {}
    const o = {...found, status:'angenommen', courier: (user && user.username) || found.courier}
    upsertMine(o); removeFromOpen(id); setExpanded(e=>({...e, [id]:true}))
    setBusyFor(id,'claim',false); setInfo('Übernommen ✓'); setTimeout(()=>setInfo(''),1200)
  }

  function nextStatusOf(s){
    const cur = stdStatus(s)
    if (cur==='angenommen' || cur==='' || OPEN_STATES.has(cur)) return 'unterwegs'
    if (cur==='unterwegs') return 'angekommen'
    if (cur==='angekommen') return 'abgeschlossen'
    return 'abgeschlossen'
  }

  async function doStatus(id, status){
    setBusyFor(id,'status',true); setInfo('Status aktualisieren …')
    const ok = await tryPOST(fetchWithAuth, [
      `/api/courier/orders/${id}/status`,
      `/api/orders/${id}/status`
    ], { status })
    if (!ok) { setBusyFor(id,'status',false); setInfo(''); alert('Status-Update fehlgeschlagen.'); await load(); return }

    // optimistic update in mine/open je nach Zugehörigkeit
    setOpenOrders(list => list.map(o => o.id===id ? {...o, status} : o))
    setMineOrders(list => list.map(o => o.id===id ? {...o, status} : o))
    setExpanded(e=>({...e,[id]:true}))
    setBusyFor(id,'status',false); setInfo('Status gesetzt ✓'); setTimeout(()=>setInfo(''),1200)
  }

  async function doEta(id, minutes){
    const m = parseInt(String(minutes||'').trim(),10)
    if (!Number.isFinite(m) || m<0) { alert('Bitte ETA in Minuten eingeben.'); return }
    setBusyFor(id,'eta',true); setInfo('ETA setzen …')
    const ok = await tryPUT(fetchWithAuth, [
      `/api/courier/orders/${id}/eta`,
      `/api/orders/${id}/eta`
    ], { minutes:m })
    if (!ok) { setBusyFor(id,'eta',false); setInfo(''); alert('ETA-Update fehlgeschlagen.'); await load(); return }

    // optimistic: nur Visual
    setExpanded(e=>({...e,[id]:true}))
    setBusyFor(id,'eta',false); setInfo('ETA gesetzt ✓'); setTimeout(()=>setInfo(''),1200)
  }

  async function doLocation(id, mode){
    async function send(lat,lng){
      const ok = await tryPUT(fetchWithAuth, [
        `/api/courier/orders/${id}/location`,
        `/api/orders/${id}/location`
      ], { lat, lng })
      if (!ok) { setBusyFor(id,'loc',false); setInfo(''); alert('Standort senden fehlgeschlagen.'); await load(); return }
      setBusyFor(id,'loc',false); setInfo('Standort gesendet ✓'); setTimeout(()=>setInfo(''),1200)
    }
    setBusyFor(id,'loc',true); setInfo('Standort ermitteln …')
    if (mode==='gps' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos)=> send(pos.coords.latitude, pos.coords.longitude),
        ()=> { setBusyFor(id,'loc',false); setInfo(''); alert('GPS fehlgeschlagen (Erlaubnis/HTTPS?).') }
      )
    } else {
      const inp = prompt('Koordinaten eingeben: "lat,lng"')
      if (!inp) { setBusyFor(id,'loc',false); setInfo(''); return }
      const [a,b] = String(inp).split(',').map(s=>s.trim())
      const lat = parseFloat(a), lng = parseFloat(b)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) { setBusyFor(id,'loc',false); setInfo(''); alert('Ungültige Koordinaten.'); return }
      await send(lat,lng)
    }
  }

  /** -------- Render -------- */
  const canSee = !!user && (user.role==='courier' || user.role==='admin')
  if (!canSee) return <div className="p-3">Kein Zugriff. (Rolle „courier“ oder „admin“ erforderlich.)</div>

  return (
    <div className="mx-auto max-w-screen-sm space-y-6">
      <div className="sticky top-0 z-20 backdrop-blur-md bg-slate-950/80 border-b border-slate-800 px-2 py-3 flex items-center gap-2">
        <div className="font-extrabold text-lg flex items-center gap-2"><Bike size={18}/> Kurier</div>
        <button className="ml-auto rounded-xl border border-slate-700 px-3 py-2 text-sm inline-flex items-center gap-2" onClick={load}>
          <RotateCcw size={16}/> Aktualisieren
        </button>
        {loading && <span className="text-sm opacity-70">Lade…</span>}
        {info && <span className="text-sm text-emerald-400">{info}</span>}
        {err &&  <span className="text-sm text-rose-400">{err}</span>}
      </div>

      {/* OFFEN */}
      <Section title="Offene Bestellungen (noch niemand zugewiesen)">
        {openOrders.length===0 && <div className="text-sm opacity-70">Keine offenen Bestellungen.</div>}
        <div className="space-y-2">
          {openOrders.map(o=>{
            const b = busy[o.id]
            return (
              <OrderCard
                key={o.id} o={o} busy={b}
                expanded={!!expanded[o.id]}
                onToggle={()=>toggle(o.id)}
                onClaim={()=>doClaim(o.id)}
                onNext={()=>doStatus(o.id, nextStatusOf(o.status))}
                onSetStatus={(s)=>doStatus(o.id,s)}
                onSetEta={(m)=>doEta(o.id,m)}
                onSendLoc={(mode)=>doLocation(o.id,mode)}
              />
            )
          })}
        </div>
      </Section>

      {/* ACTIVE */}
      <Section title="Zu erledigende Bestellungen (meine aktiv)">
        {mineActive.length===0 && <div className="text-sm opacity-70">Keine aktiven Bestellungen.</div>}
        <div className="space-y-2">
          {mineActive.map(o=>{
            const b = busy[o.id]
            return (
              <OrderCard
                key={o.id} o={o} busy={b}
                expanded={!!expanded[o.id]}
                onToggle={()=>toggle(o.id)}
                onNext={()=>doStatus(o.id, nextStatusOf(o.status))}
                onSetStatus={(s)=>doStatus(o.id,s)}
                onSetEta={(m)=>doEta(o.id,m)}
                onSendLoc={(mode)=>doLocation(o.id,mode)}
              />
            )
          })}
        </div>
      </Section>

      {/* DONE */}
      <Section title="Erledigte Bestellungen">
        {mineDone.length===0 && <div className="text-sm opacity-70">Noch keine erledigten Bestellungen.</div>}
        <div className="space-y-2">
          {mineDone.map(o=>{
            const b = busy[o.id]
            return (
              <OrderCard
                key={o.id} o={o} busy={b}
                expanded={!!expanded[o.id]}
                onToggle={()=>toggle(o.id)}
                onNext={null}
                onSetStatus={(s)=>doStatus(o.id,s)}
                onSetEta={(m)=>doEta(o.id,m)}
                onSendLoc={(mode)=>doLocation(o.id,mode)}
              />
            )
          })}
        </div>
      </Section>
    </div>
  )
}
