import React, { useEffect, useMemo, useState } from 'react'
import { HandMetal, Play, Square, RotateCw, DollarSign } from 'lucide-react'

const HOUSE_EDGE = 0.015 // 1.5% Abzug nur auf Gewinne

const SUITS = ['♠','♥','♦','♣']
const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']

function newDeck(){
  const d=[]
  for(const s of SUITS) for(const v of VALUES) d.push({s,v})
  for(let i=d.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [d[i],d[j]]=[d[j],d[i]] }
  return d
}
const val=(v)=> v==='A'?11 : (['K','Q','J'].includes(v)?10:parseInt(v,10))
function score(hand){
  let total=0, aces=0
  for(const c of hand){ total+=val(c.v); if(c.v==='A') aces++ }
  while(total>21 && aces>0){ total-=10; aces-- }
  return total
}
const isBlackjack = (hand) => hand.length===2 && score(hand)===21

function Card({c,delay=0}){
  const red = c.s==='♥'||c.s==='♦'
  return (
    <div className="w-16 h-24 rounded-xl border border-slate-700 bg-white text-slate-900 shadow-md
                    grid place-items-center font-semibold select-none"
         style={{ animation:'flip-in 300ms ease both', animationDelay:`${delay}ms`,
                  color:red?'#ef4444':'#111827' }}>
      <div className="text-xl leading-none">{c.v}</div>
      <div className="text-lg leading-none">{c.s}</div>
      <style>{`
        @keyframes flip-in { from{ transform: rotateY(90deg); opacity:.0 } to{ transform: rotateY(0) opacity:1 } }
      `}</style>
    </div>
  )
}

export default function Blackjack(){
  const [balance,setBalance]=useState(5000) // Cent
  const [bet,setBet]=useState(200)          // Cent
  const [deck,setDeck]=useState(()=>newDeck())
  const [dealer,setDealer]=useState([])
  const [player,setPlayer]=useState([])
  const [stand,setStand]=useState(false)
  const [done,setDone]=useState(false)
  const [result,setResult]=useState('')

  function reset(full=false){
    if (full){ setBalance(5000) }
    setDeck(newDeck()); setDealer([]); setPlayer([]); setStand(false); setDone(false); setResult('')
  }

  function deal(){
    if (player.length) return
    if (bet<=0 || balance<bet){ alert('Nicht genug Guthaben / Einsatz fehlt.'); return }
    setBalance(b=>b-bet) // Einsatz abziehen
    const d=[...deck]; const p=[], q=[]
    p.push(d.pop()); q.push(d.pop()); p.push(d.pop()); q.push(d.pop())
    setDeck(d); setPlayer(p); setDealer(q)
  }

  function hit(){
    if (done||!player.length||stand) return
    const d=[...deck]; const p=[...player]; p.push(d.pop())
    setDeck(d); setPlayer(p)
    if (score(p)>21){ setDone(true); setResult('Bust – Dealer gewinnt 😵') }
  }

  function doStand(){
    if(done||!player.length) return
    setStand(true)
    // Dealer zieht bis >=17
    let d=[...deck]; let q=[...dealer]
    while(score(q)<17){ q.push(d.pop()) }
    setDeck(d); setDealer(q)
    const ps=score(player), ds=score(q)
    if (ds>21 || ps>ds){
      // Gewinn: Stake zurück + Gewinn (abzgl. House-Edge)
      const profit = Math.floor(bet * (isBlackjack(player) ? 1.5 : 1) * (1 - HOUSE_EDGE))
      setBalance(b=>b + bet + profit)
      setResult(isBlackjack(player)?'Blackjack! 🎉 3:2 (mit kleinem Hausvorteil)':'Du gewinnst 🎉')
    } else if (ps<ds){
      // Verlust: Einsatz bereits abgezogen
      setResult('Dealer gewinnt 😬')
    } else {
      // Push: Einsatz zurück
      setBalance(b=>b + bet)
      setResult('Push 🤝')
    }
    setDone(true)
  }

  useEffect(()=>{
    // Autodeal beim ersten Render (falls gewünscht)
    if (!player.length && !dealer.length) {
      // kein Autodeal – User setzt erst den Einsatz
    }
    // eslint-disable-next-line
  },[])

  return (
    <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-emerald-600/10 to-slate-900/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">Blackjack (Demo) • Hausvorteil {Math.round(HOUSE_EDGE*1000)/10}%</div>
        <div className="px-3 py-1 rounded-full bg-slate-800/70 text-xs">Guthaben: {(balance/100).toFixed(2)} €</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-semibold mb-2">Dealer</div>
          <div className="flex gap-2 flex-wrap">
            {dealer.map((c,i)=><Card key={i} c={c} delay={i*120}/>)}
          </div>
          <div className="mt-1 text-xs opacity-80">Punkte: {score(dealer)}</div>
        </div>
        <div>
          <div className="text-sm font-semibold mb-2">Du</div>
          <div className="flex gap-2 flex-wrap">
            {player.map((c,i)=><Card key={i} c={c} delay={i*120}/>)}
          </div>
          <div className="mt-1 text-xs opacity-80">Punkte: {score(player)}</div>
        </div>
      </div>

      {/* Einsatz */}
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <div className="text-sm font-semibold mb-2 flex items-center gap-2"><DollarSign size={16}/> Einsatz</div>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
          {[100,200,500,1000,2000,5000].map(v=>(
            <button key={v} onClick={()=>setBet(v)}
              className={`rounded-xl px-3 py-2 border ${bet===v?'border-emerald-500 bg-emerald-500/20':'border-slate-700 bg-slate-800/60'}`}>
              {(v/100).toFixed(2)} €
            </button>
          ))}
          <div className="col-span-2 sm:col-span-6">
            <input type="number" min="50" step="50" value={bet}
                   onChange={e=>setBet(Math.max(50,parseInt(e.target.value||0)))}
                   className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700" />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn inline-flex items-center gap-2" onClick={deal} disabled={!!player.length || balance<bet}><Play size={16}/> Geben</button>
        <button className="btn-ghost inline-flex items-center gap-2" onClick={hit} disabled={done||!player.length||stand}><HandMetal size={16}/> Hit</button>
        <button className="btn-ghost inline-flex items-center gap-2" onClick={doStand} disabled={done||!player.length||stand}><Square size={16}/> Stand</button>
        <button className="btn-ghost inline-flex items-center gap-2" onClick={()=>reset(false)}><RotateCw size={16}/> Neu (gleiches Guthaben)</button>
      </div>

      {result && (
        <div className="mt-3 p-3 rounded-xl border border-slate-700 bg-slate-800/60 animate-in fade-in">
          {result}
        </div>
      )}
    </div>
  )
}
