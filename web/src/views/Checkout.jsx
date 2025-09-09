import React, { useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import { useCart } from '../cart/CartContext.jsx'

export default function Checkout({ onBack, onDone }){
  const { user, fetchWithAuth } = useAuth()
  const { items, total, sub, add, clear } = useCart()
  const [type, setType] = useState('abholen') // abholen | liefern | senden
  const [addr, setAddr] = useState('')
  const [recipient, setRecipient] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')

  const canSubmit = useMemo(()=> items.length>0 && (type==='abholen' || addr.trim().length>3 || type==='senden'), [items, type, addr])

  const submit = async ()=>{
    const delivery = { type, address: addr||null, recipient: recipient||null, phone: phone||null, note: note||null }
    const r = await fetchWithAuth('/api/orders', {
      method:'POST', headers:{ 'content-type':'application/json' },
      body: JSON.stringify({
        user_username: user?.username||null,
        items: items.map(it => ({ product_id: it.product_id, name: it.name, price_cents: it.price_cents, qty: it.qty })),
        notes: note||null,
        fulfillment_type: type,
        delivery_details: delivery
      })
    })
    const data = await r.json()
    if(!r.ok){ alert('Bestellung fehlgeschlagen'); return }
    clear()
    onDone?.(data.order?.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button className="btn-ghost" onClick={onBack}>← Zurück</button>
        <h3 className="font-semibold">Bestellübersicht</h3>
      </div>

      <div className="card">
        <div className="grid grid-cols-3 gap-2">
          {['abholen','liefern','senden'].map(t=>(
            <button key={t} onClick={()=>setType(t)}
              className={"btn-ghost " + (type===t?'border-emerald-400':'')}>
              {t[0].toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>
        {type!=='abholen' && (
          <>
            <input className="input mt-2" placeholder="Adresse (für Lieferung/Versand)" value={addr} onChange={e=>setAddr(e.target.value)} />
            <div className="grid sm:grid-cols-2 gap-2 mt-2">
              <input className="input" placeholder="Empfänger (optional)" value={recipient} onChange={e=>setRecipient(e.target.value)} />
              <input className="input" placeholder="Telefon (optional)" value={phone} onChange={e=>setPhone(e.target.value)} />
            </div>
          </>
        )}
        <input className="input mt-2" placeholder="Hinweis (optional)" value={note} onChange={e=>setNote(e.target.value)} />
      </div>

      <div className="card">
        <div className="font-semibold mb-2">Warenkorb</div>
        {items.length===0 ? <div className="opacity-70">Leer</div> :
          <div className="space-y-2">
            {items.map(it=>(
              <div key={it.id} className="flex items-center justify-between">
                <div>{it.name} × {it.qty}</div>
                <div className="flex items-center gap-2">
                  <button className="btn-ghost" onClick={()=>sub(it.id)}>-</button>
                  <button className="btn-ghost" onClick={()=>add({id:it.id, name:it.name, price_cents:it.price_cents})}>+</button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div className="font-semibold">Summe</div>
              <div className="font-semibold">{(total/100).toFixed(2)} €</div>
            </div>
          </div>
        }
      </div>

      <button className="btn w-full" disabled={!canSubmit} onClick={submit}>Bestellung abschicken</button>
    </div>
  )
}
