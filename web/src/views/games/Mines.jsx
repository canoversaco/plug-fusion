import React, { useMemo, useState } from 'react'
import { Bomb, RotateCw, DollarSign } from 'lucide-react'

const GRID = 5
const HOUSE_EDGE = 0.015 // 1.5% – nur auf Gewinne

function genMines(count){
  const all = Array.from({length:GRID*GRID},(_,i)=>i)
  for(let i=all.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [all[i],all[j]]=[all[j],all[i]] }
  return new Set(all.slice(0,count))
}

function nextMultiplier(safeRevealed, mines){
  // einfache Progression: steigt pro safe Klick; mehr Minen => schnellerer Anstieg
  const base = 1.00 + safeRevealed * (0.08 + (mines-3)*0.01) // 3 Minen -> 1.08 pro Safe, 10 Minen -> ~1.15
  return Number(base.toFixed(3))
}

export default function Mines(){
  const [balance,setBalance]=useState(5000) // Cent
  const [bet,setBet]=useState(200)
  const [mines,setMines]=useState(5)
  const [mineSet,setMineSet]=useState(()=>genMines(5))
  const [revealed,setRevealed]=useState(new Set())
  const [busted,setBusted]=useState(false)
  const [cashed,setCashed]=useState(false)

  const multiplier = useMemo(()=> nextMultiplier(revealed.size, mines), [revealed.size, mines])

  function reset(newRound=false){
    if (newRound){ setMineSet(genMines(mines)); setRevealed(new Set()); setBusted(false); setCashed(false) }
    else { setRevealed(new Set()); setBusted(false); setCashed(false) }
  }

  function start(){
    if (bet<=0 || balance<bet) return
    setBalance(b=>b-bet)
    setRevealed(new Set())
    setBusted(false)
    setCashed(false)
    setMineSet(genMines(mines))
  }

  function clickCell(i){
    if (busted || cashed) return
    if (!revealed.size && (bet<=0 || balance+bet<bet)){ /* nothing */ }
    if (mineSet.has(i)){
      setBusted(true)
      return
    }
    if (revealed.has(i)) return
    const r = new Set(revealed); r.add(i); setRevealed(r)
  }

  function cashOut(){
    if (busted || cashed || revealed.size===0) return
    const payout = Math.floor(bet * multiplier * (1 - HOUSE_EDGE))
    setBalance(b=>b+payout)
    setCashed(true)
  }

  const cells = Array.from({length:GRID*GRID},(_,i)=>i)

  return (
    <div className="rounded-2xl border border-rose-500/40 bg-gradient-to-b from-rose-600/10 to-slate-900/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">Mines (Demo) • Hausvorteil {Math.round(HOUSE_EDGE*1000)/10}%</div>
        <div className="px-3 py-1 rounded-full bg-slate-800/70 text-xs">Guthaben: {(balance/100).toFixed(2)} €</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* Feld */}
        <div className="rounded-xl border border-rose-500/30 bg-slate-900/60 p-3">
          <div className="text-xs opacity-80 mb-2">Wähle sichere Felder – Cash Out bevor du eine Mine triffst.</div>
          <div className="grid gap-2" style={{gridTemplateColumns:`repeat(${GRID},1fr)`}}>
            {cells.map(i=>{
              const isOpen = revealed.has(i)
              const isMine = mineSet.has(i)
              const danger = busted && isMine
              return (
                <button key={i} onClick={()=>clickCell(i)}
                  className={`aspect-square rounded-xl border grid place-items-center text-lg font-bold select-none
                    ${isOpen? 'border-emerald-500/60 bg-emerald-500/15' : 'border-slate-700 bg-slate-800/60 hover:bg-slate-800'}
                    ${danger? 'animate-pulse border-rose-500 bg-rose-500/20 text-rose-300' : ''}`}>
                  {danger? <Bomb size={22}/> : (isOpen? '✓' : '')}
                </button>
              )
            })}
          </div>
          <div className="mt-2 text-xs opacity-70">Minen werden erst nach Verlust sichtbar. Anzahl Minen beeinflusst den Multiplikator-Zuwachs.</div>
        </div>

        {/* Controls */}
        <div className="rounded-xl border border-rose-500/30 bg-slate-900/60 p-3">
          <div className="text-sm font-semibold mb-2">Einsatz & Einstellungen</div>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            {[100,200,500,1000,2000,5000].map(v=>(
              <button key={v} onClick={()=>setBet(v)}
                className={`rounded-xl px-3 py-2 border ${bet===v?'border-rose-500 bg-rose-500/20':'border-slate-700 bg-slate-800/60'}`}>
                {(v/100).toFixed(2)} €
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <div className="text-[11px] uppercase opacity-70 mb-1">Einsatz</div>
              <input type="number" min="50" step="50" value={bet}
                     onChange={e=>setBet(Math.max(50,parseInt(e.target.value||0)))}
                     className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700"/>
            </div>
            <div>
              <div className="text-[11px] uppercase opacity-70 mb-1">Minen</div>
              <select value={mines} onChange={e=>{ const n=parseInt(e.target.value||5); setMines(n); setMineSet(genMines(n)); setRevealed(new Set()); setBusted(false); setCashed(false) }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700">
                {[3,5,7,10].map(n=><option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-3 p-3 rounded-xl border border-slate-700 bg-slate-800/60">
            <div className="text-xs opacity-80">Aktueller Multiplikator</div>
            <div className="text-2xl font-extrabold tracking-wide animate-pulse">×{multiplier.toFixed(2)}</div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn inline-flex items-center gap-2 disabled:opacity-50" onClick={start} disabled={busted || (revealed.size>0) || balance<bet}>
              <DollarSign size={16}/> Start
            </button>
            <button className="btn-ghost inline-flex items-center gap-2 disabled:opacity-50" onClick={cashOut} disabled={busted || cashed || revealed.size===0}>
              <DollarSign size={16}/> Cash Out
            </button>
            <button className="btn-ghost inline-flex items-center gap-2" onClick={()=>reset(true)}>
              <RotateCw size={16}/> Neue Runde
            </button>
          </div>

          {(busted || cashed) && (
            <div className="mt-3 p-3 rounded-xl border border-slate-700 bg-slate-800/60 animate-in fade-in">
              {busted ? <div className="text-rose-300">Boom 💥 – Einsatz verloren.</div> :
                <div className="text-emerald-300">Ausgezahlt: <b>{((bet*multiplier*(1 - HOUSE_EDGE))/100).toFixed(2)} €</b></div>}
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 text-xs opacity-70">Hinweis: Demo – Multiplikator steigt je sicherem Feld. Auszahlungen beinhalten einen kleinen Hausvorteil.</div>
    </div>
  )
}
