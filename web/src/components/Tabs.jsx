import React from 'react'
export function Tabs({ active, onChange, showAdmin=false }){
  const Btn = ({id, label}) => (
    <button
      onClick={()=>onChange(id)}
      className={"px-3 py-2 rounded-lg border " + (active===id ? "border-emerald-400" : "border-slate-700 opacity-80")}
      style={{background: active===id ? "linear-gradient(90deg,#00E5A8,#7C4DFF)" : "transparent", color: active===id ? "#0a0a0a" : "inherit"}}
    >{label}</button>
  )
  return (
    <div className="max-w-6xl mx-auto flex gap-2 justify-around">
      <Btn id="menu" label="Menü" />
      <Btn id="orders" label="Bestellungen" />
      <Btn id="profile" label="Profil" />
      {showAdmin ? <Btn id="admin" label="Admin" /> : null}
    </div>
  )
}
