import React, { useEffect, useRef, useState } from 'react'
import { Rocket, DollarSign, RotateCw } from 'lucide-react'

/** Kleiner Hausvorteil (nur auf Gewinne) */
const HOUSE_EDGE = 0.015  // 1.5%

/** Verteilung der Crash-Ziele (schwerpunkt 1.3–3.0) */
function rndCrash(){
  const r = Math.random()
  if (r < 0.72) return 1.3 + Math.random()*1.8   // 1.3–3.1
  if (r < 0.92) return 3.1 + Math.random()*2.2   // 3.1–5.3
  return 5.3 + Math.random()*4.7                  // 5.3–10.0
}

export default function Crash(){
  const [balance,setBalance]=useState(5000) // Cent
  const [bet,setBet]=useState(200)          // Cent
  const [mult,setMult]=useState(0.7)        // Start bei 0.7x
  const [target,setTarget]=useState(()=>rndCrash())
  const [running,setRunning]=useState(false)
  const [busted,setBusted]=useState(false)
  const [cashed,setCashed]=useState(false)
  const rafRef=useRef(0)
  const startTs=useRef(0)

  useEffect(()=>()=> cancelAnimationFrame(rafRef.current||0),[])

  function loop(t){
    if (!startTs.current) startTs.current=t
    const dt = (t - startTs.current)/1000
    // sanftes exponentielles Wachstum ab 0.7x
    // 0.7 * 1.02^(dt*20) -> ~1.7x nach ca. 4–5s
    const m = 0.7 * Math.pow(1.02, dt*20)
    setMult(m)
    if (m >= target){
      setRunning(false); setBusted(true)
      cancelAnimationFrame(rafRef.current||0)
    }else{
      rafRef.current = requestAnimationFrame(loop)
    }
  }

  function start(){
    if (running || bet<=0 || balance<bet) return
    setBalance(b=>b-bet)
    setCashed(false); setBusted(false)
    setTarget(rndCrash())
    setMult(0.7)
    setRunning(true)
    startTs.current = 0
    rafRef.current = requestAnimationFrame(loop)
  }

  function cashOut(){
    if (!running || cashed) return
    // Auszahlung enthält Hausvorteil
    const payout = Math.floor(bet * mult * (1 - HOUSE_EDGE))
    setBalance(b=>b+payout)
    setCashed(true)
    setRunning(false)
    cancelAnimationFrame(rafRef.current||0)
  }

  function reset(){
    setMult(0.7); setTarget(rndCrash()); setRunning(false); setBusted(false); setCashed(false)
    cancelAnimationFrame(rafRef.current||0)
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-cyan-600/10 to-slate-900/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">Crash (Demo) • Hausvorteil {Math.round(HOUSE_EDGE*1000)/10}%</div>
        <div className="px-3 py-1 rounded-full bg-slate-800/70 text-xs">Guthaben: {(balance/100).toFixed(2)} €</div>
      </div>

      <div className="relative h-48 rounded-xl border border-cyan-500/40 bg-cyan-500/10 overflow-hidden">
        <div className="absolute inset-0 grid grid-rows-4 grid-cols-8 opacity-20">
          {[...Array(32)].map((_,i)=><div key={i} className="border border-cyan-500/20"/> )}
        </div>
        <div className="absolute left-4 top-4 text-2xl font-extrabold drop-shadow animate-pulse">{mult.toFixed(2)}x</div>
        <div className={`absolute -right-4 bottom-6 w-10 h-10 rounded-full bg-cyan-400 shadow-lg ${running?'animate-bounce':''}`}></div>
        {busted && <div className="absolute inset-0 grid place-items-center text-3xl font-black text-red-400 animate-pulse">CRASH!</div>}
        {cashed && !busted && <div className="absolute inset-0 grid place-items-center text-xl font-bold text-emerald-400 animate-in fade-in">Ausgezahlt: {((bet*mult*(1 - HOUSE_EDGE))/100).toFixed(2)} €</div>}
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[100,200,500,1000].map(v=>(
          <button key={v} onClick={()=>setBet(v)}
            className={`rounded-xl px-3 py-2 border ${bet===v?'border-emerald-500 bg-emerald-500/20':'border-slate-700 bg-slate-800/60'}`}>
            {(v/100).toFixed(2)} €
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn inline-flex items-center gap-2 disabled:opacity-50" onClick={start} disabled={running||balance<bet}>
          <Rocket size={16}/> Start
        </button>
        <button className="btn-ghost inline-flex items-center gap-2 disabled:opacity-50" onClick={cashOut} disabled={!running}>
          <DollarSign size={16}/> Cash Out
        </button>
        <button className="btn-ghost inline-flex items-center gap-2" onClick={reset}><RotateCw size={16}/> Reset</button>
      </div>

      <div className="mt-2 text-xs opacity-70">Hinweis: Demo – Gewinne werden mit kleinem Hausvorteil berechnet.</div>
    </div>
  )
}
