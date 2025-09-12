import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown, RotateCw, DollarSign } from 'lucide-react'

const HOUSE_EDGE = 0.015 // 1.5% – nur auf Gewinne angewendet

function makeMultipliers(rows){
  // Slots = rows+1, symmetrische Multiplikatoren (Demo)
  const n = rows+1
  const mid = (n-1)/2
  const arr = Array.from({length:n}, (_,i)=>{
    const d = Math.abs(i - mid)
    // Ränder höher, Mitte niedriger (klassisches Plinko)
    const base = d>mid*0.8 ? 9 : d>mid*0.6 ? 4 : d>mid*0.3 ? 2 : 1.3
    return Number(base.toFixed(2))
  })
  return arr
}

export default function Plinko(){
  const [rows,setRows]=useState(8)
  const [multipliers,setMultipliers]=useState(()=>makeMultipliers(8))
  const [balance,setBalance]=useState(5000) // Cent
  const [bet,setBet]=useState(200)
  const [running,setRunning]=useState(false)
  const [result,setResult]=useState(null)
  const [pos,setPos]=useState(Math.floor((8+1)/2)) // Spaltenindex
  const [step,setStep]=useState(0)
  const timerRef=useRef(0)

  useEffect(()=>{ setMultipliers(makeMultipliers(rows)); setPos(Math.floor((rows+1)/2)); setStep(0); setResult(null) },[rows])
  useEffect(()=>()=> clearInterval(timerRef.current||0),[])

  function start(){
    if (running || bet<=0 || balance<bet) return
    setBalance(b=>b-bet)
    setResult(null)
    setRunning(true)
    setStep(0)
    setPos(Math.floor((rows+1)/2))
    clearInterval(timerRef.current)
    timerRef.current = setInterval(()=>{
      setStep(s=>{
        if (s>=rows){
          clearInterval(timerRef.current)
          setRunning(false)
          setResult(p=>{
            const idx = p
            const multi = multipliers[idx]||1
            const payout = Math.floor(bet*multi*(1 - HOUSE_EDGE))
            setBalance(b=>b+payout)
            return { idx, multi, payout }
          })
          return s
        }
        // Schritt nach links oder rechts (50/50)
        const dir = Math.random()<0.5 ? -1 : 1
        setPos(p=>{
          let nx = p + dir
          if (nx<0) nx=0
          if (nx>rows) nx=rows
          return nx
        })
        return s+1
      })
    }, 220)
  }

  function reset(){
    clearInterval(timerRef.current)
    setRunning(false)
    setResult(null)
    setStep(0)
    setPos(Math.floor((rows+1)/2))
  }

  const cols = rows+1
  const pins = Array.from({length:rows},(_,r)=> Array.from({length:cols},(_,c)=> (c>0 && c<cols && c-1<=r && c>=0)))
  // simple grid rendering: pins as small dots; ball animates row by row using step/pos

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-slate-900/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">Plinko (Demo) • Hausvorteil {Math.round(HOUSE_EDGE*1000)/10}%</div>
        <div className="px-3 py-1 rounded-full bg-slate-800/70 text-xs">Guthaben: {(balance/100).toFixed(2)} €</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
        {/* Board */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="text-xs opacity-80 mb-2 flex items-center gap-1"><ChevronDown size={14}/> Ball fällt durch {rows} Reihen</div>
          <div className="relative mx-auto overflow-hidden rounded-xl bg-slate-900/60 border border-slate-800" style={{width:300, height:360}}>
            {/* Pins */}
            <div className="absolute inset-0 p-3">
              {Array.from({length:rows}).map((_,r)=>(
                <div key={r} className="flex justify-between" style={{marginTop: (r===0?0: (300/(rows+2)))}}>
                  {Array.from({length:cols}).map((__,c)=>(
                    <div key={c} className="w-2 h-2 rounded-full" style={{ background:'rgba(255,255,255,.25)' }}/>
                  ))}
                </div>
              ))}
              {/* Ball */}
              <div className="absolute transition-all duration-200"
                   style={{
                     left: ( (pos/(cols-1)) * (300-24) ) + 12,
                     top: ((step/(rows+0.6)) * (360-24)),
                     transform:'translate(-50%,-50%)'
                   }}>
                <div className={`w-5 h-5 rounded-full bg-amber-400 shadow-lg ${running?'animate-bounce':''}`}></div>
              </div>
            </div>
            {/* Multipliers bottom */}
            <div className="absolute left-0 right-0 bottom-0 grid" style={{gridTemplateColumns:`repeat(${cols},1fr)`}}>
              {multipliers.map((m,i)=>(
                <div key={i} className={`py-2 text-center text-xs font-semibold ${i===pos && step>=rows ? 'bg-amber-400/30' : 'bg-slate-900/70'} border-t border-slate-800`}>
                  ×{m.toFixed(2)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="rounded-xl border border-amber-500/30 bg-slate-900/60 p-3">
          <div className="text-sm font-semibold mb-2">Einsatz & Einstellungen</div>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            {[100,200,500,1000,2000,5000].map(v=>(
              <button key={v} onClick={()=>setBet(v)}
                className={`rounded-xl px-3 py-2 border ${bet===v?'border-amber-500 bg-amber-500/20':'border-slate-700 bg-slate-800/60'}`}>
                {(v/100).toFixed(2)} €
              </button>
            ))}
            <div className="col-span-2 sm:col-span-6 grid grid-cols-2 gap-2">
              <div>
                <div className="text-[11px] uppercase opacity-70 mb-1">Einsatz</div>
                <input type="number" min="50" step="50" value={bet}
                       onChange={e=>setBet(Math.max(50,parseInt(e.target.value||0)))}
                       className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700"/>
              </div>
              <div>
                <div className="text-[11px] uppercase opacity-70 mb-1">Reihen</div>
                <select value={rows} onChange={e=>setRows(parseInt(e.target.value||8))}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700">
                  {[6,8,10,12].map(n=><option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn inline-flex items-center gap-2 disabled:opacity-50" onClick={start} disabled={running || balance<bet}>
              <ChevronDown size={16}/> Drop
            </button>
            <button className="btn-ghost inline-flex items-center gap-2" onClick={reset}>
              <RotateCw size={16}/> Reset
            </button>
          </div>

          <div className="mt-3 min-h-[48px]">
            {result && (
              <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 animate-in fade-in">
                <div className="text-sm">
                  Gelandet in Slot <b>#{result.idx+1}</b> • Multiplikator <b>×{result.multi.toFixed(2)}</b><br/>
                  Auszahlung: <b>{(result.payout/100).toFixed(2)} €</b> (inkl. kleinem Hausvorteil)
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2 text-xs opacity-70">Hinweis: Demo – Multiplikatoren sind simuliert, Auszahlungen berücksichtigen einen kleinen Hausvorteil.</div>
    </div>
  )
}
