import React, { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { Wallet, PlusCircle } from 'lucide-react'

export default function Profile({ goTo }){
  const { fetchWithAuth, user } = useAuth()
  const [me, setMe] = useState(null)
  const [stats, setStats] = useState({ orders:0, inventory:0 })
  const [inv, setInv] = useState([])
  const [amount, setAmount] = useState(1000) // 10 €
  const [msg, setMsg] = useState('')

  const load = async ()=>{
    try{
      const p = await fetchWithAuth('/api/profile').then(r=>r.json())
      setMe(p.user); setStats(p.stats||{orders:0,inventory:0})
      const i = await fetchWithAuth('/api/inventory').then(r=>r.json()).catch(()=>({items:[]}))
      setInv(i.items||[])
    }catch{ setMsg('Fehler beim Laden') }
  }
  useEffect(()=>{ load() },[])

  const topup = async (cents)=>{
    setMsg('')
    const r = await fetchWithAuth('/api/wallet/topup', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ amount_cents: Number(cents||0) }) })
    const d = await r.json()
    if (!r.ok) return setMsg('❌ Aufladen fehlgeschlagen')
    setMe(m=>({...m, wallet_balance_cents: d.wallet_balance_cents||0 }))
    setMsg('✅ Wallet aufgeladen')
  }

  const preset = [500,1000,2000,5000] // 5, 10, 20, 50 €

  return (
    <div className="space-y-4 pf-pb-safe pf-pt-safe">
      <div className="card">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-emerald-600/30 flex items-center justify-center"><Wallet size={20} /></div>
          <div>
            <div className="font-semibold">{user?.username}</div>
            <div className="text-xs opacity-70">{user?.role}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs opacity-70">Wallet</div>
            <div className="text-xl font-extrabold">{((me?.wallet_balance_cents||0)/100).toFixed(2)} €</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="font-semibold mb-2">Wallet aufladen</div>
        <div className="grid grid-cols-4 gap-2">
          {preset.map(v=>(
            <button key={v} className="btn-ghost" onClick={()=>topup(v)}>{(v/100).toFixed(0)} €</button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input className="input flex-1" type="number" min="100" step="100" value={amount} onChange={e=>setAmount(Number(e.target.value||0))} placeholder="Betrag (Cent)" />
          <button className="btn" onClick={()=>topup(amount)}><PlusCircle size={16} className="mr-1" />Aufladen</button>
        </div>
        {msg && <div className="text-sm opacity-80 mt-2">{msg}</div>}
      </div>

      <div className="card">
        <div className="font-semibold mb-2">Inventar</div>
        {inv.length===0 ? (
          <div className="text-sm opacity-70">Noch nichts im Inventar.</div>
        ) : (
          <div className="space-y-2">
            {inv.map(x=>(
              <div key={x.id} className="flex items-center justify-between">
                <div>{x.item_name}</div>
                <div className="text-sm opacity-80">×{x.qty}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="font-semibold">Bestellungen</div>
        <div className="text-sm opacity-70">Insgesamt: {stats.orders}</div>
        <button className="btn w-full mt-2" onClick={()=>goTo?.('orders')}>Zur Bestellübersicht</button>
      </div>
    </div>
  )
}
