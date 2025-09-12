import React, { useMemo, useRef, useState } from 'react'
import { Dice5, RotateCw } from 'lucide-react'

const NUMBERS = [
  0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26
] // Europäisches Roulette
const COLORS = n => n===0 ? 'green' : ([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(n) ? 'red' : 'black')

export default function Roulette(){
  const [balance,setBalance] = useState(1000) // Demo Guthaben (Cent)
  const [bet,setBet] = useState(100)
  const [choice,setChoice] = useState('red') // 'red' | 'black' | 'green'
  const [spinning,setSpinning] = useState(false)
  const [result,setResult] = useState(null)
  const wheelRef = useRef(null)

  const segAngle = 360/NUMBERS.length
  const conic = useMemo(()=>{
    // conic-gradient mit Segmenten
    let stops=[]
    for (let i=0;i<NUMBERS.length;i++){
      const n=NUMBERS[i], col = COLORS(n)
      const a0 = i*segAngle, a1 = (i+1)*segAngle
      const color = col==='red'?'#ef4444':col==='black'?'#111827':'#10b981'
      stops.push(`${color} ${a0}deg ${a1}deg`)
    }
    return `conic-gradient(${stops.join(',')})`
  },[segAngle])

  function spin(){
    if (spinning || bet<=0 || balance<bet) return
    setSpinning(true)
    setResult(null)
    setBalance(b=>b-bet)

    // Zielzahl
    const idx = Math.floor(Math.random()*NUMBERS.length)
    const num = NUMBERS[idx]
    const finalAngle = 360*8 + (360 - (idx*segAngle + segAngle/2)) // 8 Umdrehungen + Ziel
    const wheel = wheelRef.current
    if (wheel){
      wheel.style.transition = 'transform 4s cubic-bezier(.15,.8,.25,1)'
      // reset first to avoid cumulative transforms quickly:
      wheel.style.transform = 'rotate(0deg)'
      // allow reflow
      setTimeout(()=>{ wheel.style.transform = `rotate(${finalAngle}deg)` }, 30)
      setTimeout(()=>{
        setSpinning(false)
        setResult({num, color:COLORS(num)})
        // Auszahlung
        if (choice==='green' && num===0) setBalance(b=>b + bet*14)        // 14:1 (Demo)
        else if (choice==='red' && COLORS(num)==='red') setBalance(b=>b + bet*2)
        else if (choice==='black' && COLORS(num)==='black') setBalance(b=>b + bet*2)
      }, 4100)
    }else{
      setSpinning(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="relative mx-auto w-[320px] h-[320px]">
          <div ref={wheelRef}
               className="absolute inset-0 rounded-full"
               style={{ background: conic, boxShadow:'inset 0 0 40px rgba(0,0,0,.5)' }} />
          <div className="absolute inset-3 rounded-full border border-slate-900/70"></div>
          {/* Zeiger */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-2 w-0 h-0 border-l-[10px] border-r-[10px] border-b-[18px] border-l-transparent border-r-transparent border-b-emerald-400 drop-shadow"></div>
          {/* Nummern-Markierungen (optional minimal) */}
        </div>
        <div className="mt-3 text-center text-sm opacity-80">Demo-Roulette • europäisches Rad</div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">Einsatz & Auswahl</div>
          <div className="px-3 py-1 rounded-full bg-slate-800/70 text-xs">Guthaben: {(balance/100).toFixed(2)} €</div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <button onClick={()=>setChoice('red')}
                  className={`p-3 rounded-xl border transition active:scale-[0.99] ${choice==='red'?'border-red-500 bg-red-500/20':'border-slate-700 bg-slate-800/60'}`}>🔴 Rot</button>
          <button onClick={()=>setChoice('black')}
                  className={`p-3 rounded-xl border transition active:scale-[0.99] ${choice==='black'?'border-slate-400 bg-slate-300/10':'border-slate-700 bg-slate-800/60'}`}>⚫ Schwarz</button>
          <button onClick={()=>setChoice('green')}
                  className={`p-3 rounded-xl border transition active:scale-[0.99] ${choice==='green'?'border-emerald-500 bg-emerald-500/20':'border-slate-700 bg-slate-800/60'}`}>🟢 Grün (0)</button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[50,100,200].map(v=>(
            <button key={v} onClick={()=>setBet(v)}
              className={`rounded-xl px-3 py-2 border ${bet===v?'border-emerald-500 bg-emerald-500/20':'border-slate-700 bg-slate-800/60'}`}>
              {(v/100).toFixed(2)} €
            </button>
          ))}
          <div className="col-span-3">
            <input type="number" min="10" step="10" value={bet}
                   onChange={e=>setBet(Math.max(10,parseInt(e.target.value||0)))}
                   className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button onClick={spin} disabled={spinning||balance<bet}
                  className="btn inline-flex items-center gap-2 disabled:opacity-50">
            <Dice5 size={16}/> Drehen
          </button>
          <button onClick={()=>setResult(null)} className="btn-ghost inline-flex items-center gap-2">
            <RotateCw size={16}/> Reset
          </button>
        </div>

        <div className="mt-3 min-h-[48px]">
          {result && (
            <div className="p-3 rounded-xl border border-slate-700 bg-slate-800/60 animate-in fade-in">
              <div className="text-sm">
                Ergebnis: <b>{result.num}</b> – {result.color==='red'?'Rot':result.color==='black'?'Schwarz':'Grün'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
