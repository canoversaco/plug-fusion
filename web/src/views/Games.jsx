import React, { useEffect, useState } from 'react'
import { Sparkles, Dice5, Gamepad2, Rocket, ChevronLeft, Bomb, ChevronDown } from 'lucide-react'
import Roulette from './games/Roulette.jsx'
import Blackjack from './games/Blackjack.jsx'
import Crash from './games/Crash.jsx'
import Plinko from './games/Plinko.jsx'
import Mines from './games/Mines.jsx'

function useSubroute(){
  const parse=()=> {
    const h = (typeof window!=='undefined'?window.location.hash:'#') || '#'
    const m = h.replace(/^#\//,'').split('/')
    if (m[0] !== 'games') return { mode:'select' }
    const sub = (m[1]||'').toLowerCase()
    if (['roulette','blackjack','crash','plinko','mines'].includes(sub)) return { mode:sub }
    return { mode:'select' }
  }
  const [state,setState]=useState(parse())
  useEffect(()=>{
    const onHash=()=> setState(parse())
    window.addEventListener('hashchange', onHash)
    return ()=> window.removeEventListener('hashchange', onHash)
  },[])
  return state.mode
}

export default function Games(){
  const mode = useSubroute()
  const go = (sub)=>{ window.location.hash = sub ? '#/games/'+sub : '#/games' }

  if (mode!=='select'){
    const title = mode==='roulette'?'Roulette':mode==='blackjack'?'Blackjack':mode==='crash'?'Crash':mode==='plinko'?'Plinko':'Mines'
    return (
      <div className="pf-pt-safe pf-pb-safe p-3 space-y-3">
        <div className="rounded-2xl p-4 border border-slate-800 bg-gradient-to-r from-fuchsia-600/15 via-cyan-600/15 to-emerald-600/15">
          <div className="flex items-center gap-2">
            <button className="btn-ghost px-3 py-2 rounded-xl border border-slate-700" onClick={()=>go('')}>
              <ChevronLeft size={16}/> Zur Auswahl
            </button>
            <div className="text-xl font-extrabold">{title}</div>
            <div className="ml-auto text-xs opacity-80 flex items-center gap-1">
              <Sparkles size={14}/> Demo-Modus • Spaß mit Farbe & Animation
            </div>
          </div>
        </div>
        {mode==='roulette' && <Roulette/>}
        {mode==='blackjack' && <Blackjack/>}
        {mode==='crash' && <Crash/>}
        {mode==='plinko' && <Plinko/>}
        {mode==='mines' && <Mines/>}
      </div>
    )
  }

  return (
    <div className="pf-pt-safe pf-pb-safe p-3">
      <div className="max-w-4xl mx-auto space-y-4 pb-24">
        <div className="rounded-2xl p-5 bg-gradient-to-r from-fuchsia-600/20 via-cyan-600/20 to-emerald-600/20 border border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} className="opacity-80"/>
            <div className="text-sm font-semibold">Spiel-Auswahl</div>
          </div>
          <div className="text-2xl font-extrabold leading-tight">Wähle dein Spiel</div>
          <div className="text-sm opacity-80">Demo-Modus • Animationen, Farben & Mini-Effekte 🌈</div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <button onClick={()=>go('roulette')}
            className="group rounded-2xl p-4 border border-fuchsia-500/40 bg-gradient-to-br from-fuchsia-600/20 to-fuchsia-600/5 hover:to-fuchsia-600/25 transition-all active:scale-[0.99]">
            <div className="w-12 h-12 rounded-xl bg-fuchsia-600/30 flex items-center justify-center group-hover:rotate-12 transition">
              <Dice5 size={22}/>
            </div>
            <div className="mt-2 font-semibold">Roulette</div>
            <div className="text-xs opacity-80">Rot/Schwarz/Grün mit drehendem Rad</div>
          </button>

          <button onClick={()=>go('blackjack')}
            className="group rounded-2xl p-4 border border-emerald-500/40 bg-gradient-to-br from-emerald-600/20 to-emerald-600/5 hover:to-emerald-600/25 transition-all active:scale-[0.99]">
            <div className="w-12 h-12 rounded-xl bg-emerald-600/30 flex items-center justify-center group-hover:-rotate-6 transition">
              <Gamepad2 size={22}/>
            </div>
            <div className="mt-2 font-semibold">Blackjack</div>
            <div className="text-xs opacity-80">Hit/Stand mit hübschen Karten</div>
          </button>

          <button onClick={()=>go('crash')}
            className="group rounded-2xl p-4 border border-cyan-500/40 bg-gradient-to-br from-cyan-600/20 to-cyan-600/5 hover:to-cyan-600/25 transition-all active:scale-[0.99]">
            <div className="w-12 h-12 rounded-xl bg-cyan-600/30 flex items-center justify-center group-hover:scale-110 transition">
              <Rocket size={22}/>
            </div>
            <div className="mt-2 font-semibold">Crash</div>
            <div className="text-xs opacity-80">Cash Out bevor es crasht</div>
          </button>

          <button onClick={()=>go('plinko')}
            className="group rounded-2xl p-4 border border-amber-500/40 bg-gradient-to-br from-amber-500/20 to-amber-500/5 hover:to-amber-500/25 transition-all active:scale-[0.99]">
            <div className="w-12 h-12 rounded-xl bg-amber-500/30 flex items-center justify-center group-hover:translate-y-0.5 transition">
              <ChevronDown size={22}/>
            </div>
            <div className="mt-2 font-semibold">Plinko</div>
            <div className="text-xs opacity-80">Ball drop • Multiplikator-Slots</div>
          </button>

          <button onClick={()=>go('mines')}
            className="group rounded-2xl p-4 border border-rose-500/40 bg-gradient-to-br from-rose-600/20 to-rose-600/5 hover:to-rose-600/25 transition-all active:scale-[0.99]">
            <div className="w-12 h-12 rounded-xl bg-rose-600/30 flex items-center justify-center group-hover:scale-110 transition">
              <Bomb size={22}/>
            </div>
            <div className="mt-2 font-semibold">Mines</div>
            <div className="text-xs opacity-80">Minensuche • Safe-Tiles & Cashout</div>
          </button>
        </div>
      </div>
    </div>
  )
}
