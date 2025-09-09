import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { UtensilsCrossed, ShoppingBag, Wallet, MessageSquare, ChevronRight, Sparkles } from 'lucide-react'

function QuickButton({ icon:Icon, label, sub, onClick }){
  return (
    
      <section className="p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-emerald-700/40 bg-emerald-900/20 p-4">
            <div className="text-xs text-emerald-300 mb-1">Neu</div>
            <div className="text-lg font-extrabold">Spiele</div>
            <div className="text-sm opacity-80 mb-3">Roulette, Blackjack & Crash – mit deiner Wallet spielen.</div>
            <a href="#/games" className="inline-flex items-center gap-2 rounded-xl border border-emerald-600 bg-emerald-500/15 px-4 py-2">🎮 Jetzt spielen</a>
          </div>
        </div>
      </section>
    <button onClick={onClick} className="card flex items-center gap-3 p-3 active:scale-[0.99]">
      <div className="w-11 h-11 rounded-xl bg-emerald-600/30 flex items-center justify-center">
        <Icon size={22} />
      </div>
      <div className="text-left">
        <div className="font-semibold">{label}</div>
        {sub && <div className="text-xs opacity-70">{sub}</div>}
      </div>
      <ChevronRight className="ml-auto opacity-60" size={18} />
    </button>
  )
}

export default function Home({ goTo }){
  const { user, fetchWithAuth } = useAuth()
  const [menu, setMenu] = useState({ products:[], categories:[] })
  const [myOrders, setMyOrders] = useState([])
  const [dmRecipients, setDmRecipients] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{ (async()=>{
    try {
      const p = await fetch('/api/products').then(r=>r.json())
      setMenu({ products: p.products||[], categories: p.categories||[] })
    } catch {}
    try {
      const o = await fetchWithAuth('/api/my/orders').then(r=>r.json())
      setMyOrders(o.orders||[])
    } catch {}
    try {
      const r = await fetchWithAuth('/api/dm/recipients').then(r=>r.json()).catch(()=>({}))
      if (r?.recipients) setDmRecipients(r.recipients)
    } catch {}
    setLoading(false)
  })() },[])

  const featured = useMemo(()=>{
    const f = (menu.products||[]).filter(p => p.featured || p.sale_price_cents!=null)
    return f.slice(0,12)
  }, [menu.products])

  const lastOrder = myOrders?.[0] || null
  const role = user?.role || 'user'
  const isCustomer = !(role==='admin' || role==='courier')

  return (
    <div className="space-y-4 pf-pb-safe pf-pt-safe">
      {/* Top-Gruß & Balance */}
      <div className="rounded-2xl overflow-hidden bg-gradient-to-r from-emerald-500/20 to-fuchsia-500/20 border border-slate-800">
        <div className="p-4">
          <div className="text-xs opacity-80">Willkommen zurück</div>
          <div className="text-2xl font-extrabold leading-tight">Hi {user?.username || 'Gast'} 👋</div>
          <div className="mt-2 text-sm opacity-80">Schnell bestellen. Einfach bezahlen.</div>
        </div>
      </div>

      {/* Quick Actions – große Touch-Flächen */}
      <div className="grid grid-cols-1 gap-2">
        <QuickButton icon={UtensilsCrossed} label="Menü ansehen" sub={`${menu.products.length} Produkte • ${new Set(menu.products.map(p=>p.category_name)).size} Kategorien`} onClick={()=>goTo?.('menu')} />
        <QuickButton icon={ShoppingBag} label="Bestellungen" sub="Status & Live-Tracking" onClick={()=>goTo?.('orders')} />
        {isCustomer && <QuickButton icon={Wallet} label="Wallet" sub="Aufladen & bezahlen" onClick={()=>goTo?.('profile')} />}
        {isCustomer && <QuickButton icon={MessageSquare} label="Anfrage an Plug" sub={dmRecipients?.length? `${dmRecipients.length} Empfänger`:'Direktnachricht an Admin/Kurier'} onClick={()=>goTo?.('support')}/>}
      </div>

      {/* Featured / Angebote – horizontales Karussell */}
      <div className="card">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={16} className="opacity-80" />
          <div className="font-semibold">Highlights & Angebote</div>
        </div>
        <div className="pf-scroll-x hide-scroll">
          {(featured.length===0 && !loading) && <div className="text-sm opacity-70">Aktuell keine Highlights.</div>}
          {featured.map(p=>{
            const price = (p.sale_price_cents ?? p.price_cents)/100
            const struck = p.sale_price_cents!=null
            return (
              <div key={p.id} className="min-w-[200px] max-w-[220px] card p-0 overflow-hidden">
                {p.banner_image_url || p.image_url ? (
                  <img src={p.banner_image_url || p.image_url} alt={p.name} className="w-full h-28 object-cover" loading="lazy" />
                ) : <div className="w-full h-28 bg-slate-800" />}
                <div className="p-3">
                  <div className="font-semibold text-sm line-clamp-2">{p.highlight_title || p.name}</div>
                  {p.badge_text && <div className="pf-pill mt-1" style={{background:p.badge_color||'#22c55e'}}>{p.badge_text}</div>}
                  <div className="text-sm mt-1">
                    {struck && <span className="opacity-60 line-through mr-1">{(p.price_cents/100).toFixed(2)} €</span>}
                    <span className="font-semibold">{price.toFixed(2)} €</span>
                  </div>
                </div>
              </div>
            )
          })}
          {loading && Array.from({length:4}).map((_,i)=>(<div key={i} className="min-w-[200px] h-[160px] rounded-2xl bg-slate-800/60 animate-pulse" />))}
        </div>
      </div>

      {/* Letzte Bestellung – kompakte Karte */}
      {lastOrder && (
        <div className="card">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Letzte Bestellung #{lastOrder.id}</div>
            <div className="pf-pill bg-slate-700/60">{lastOrder.status}</div>
          </div>
          <div className="text-sm opacity-80 mt-1">
            Summe {(lastOrder.total_cents/100).toFixed(2)} € {lastOrder.eta_at ? `• ETA ${new Date(lastOrder.eta_at).toLocaleTimeString().slice(0,5)}` : ''}
          </div>
          <div className="mt-2 flex gap-2">
            <button className="btn" onClick={()=>goTo?.('orders')}>Tracking öffnen</button>
            <button className="btn-ghost" onClick={()=>goTo?.('menu')}>Noch einmal bestellen</button>
          </div>
        </div>
      )}
    </div>
  )
}
