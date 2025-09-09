import React from 'react'
import { Home as IcHome, UtensilsCrossed, ShoppingBag, User, ShieldCheck, Bike } from 'lucide-react'

export default function MobileShell({ active='home', onTab, right=null, children, showAdmin=false, showCourier=false }){
  const tabs = [
    { id:'home',   label:'Home',    Icon:IcHome },
    { id:'menu',   label:'Menü',    Icon:UtensilsCrossed },
    { id:'orders', label:'Orders',  Icon:ShoppingBag },
    { id:'profile',label:'Profil',  Icon:User },
  ]
  if (showCourier) tabs.push({ id:'courier', label:'Kurier', Icon:Bike })
  if (showAdmin)   tabs.push({ id:'admin',   label:'Admin',  Icon:ShieldCheck })

  const TabBtn = ({id, label, Icon}) => (
    <button
      onClick={()=>onTab(id)}
      className={"flex flex-col items-center justify-center flex-1 py-2 " + (active===id ? "text-slate-900" : "text-slate-300")}
      style={active===id ? { background: "linear-gradient(90deg,#00E5A8,#7C4DFF)" } : {}}
      aria-label={label}>
      <Icon size={22} />
      <span className="text-xs mt-0.5">{label}</span>
    </button>
  )
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="top-bar safe-top">
        <div className="max-w-3xl mx-auto px-4 py-3 relative flex items-center justify-center">
          <div className="font-semibold text-base">Plug Fusion</div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm opacity-80">{right}</div>
        </div>
      </header>
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 pt-4 pb-32">{children}</main>
      <nav className="fixed bottom-0 inset-x-0 border-t border-slate-800 bg-slate-900/90 backdrop-blur safe-bottom">
        <div className="max-w-3xl mx-auto grid" style={{gridTemplateColumns:`repeat(${tabs.length}, minmax(0,1fr))`}}>
          {tabs.map(t => <TabBtn key={t.id} {...t} />)}
        </div>
      
  <a href="#/chat" className="flex-1 text-center p-2 flex flex-col items-center gap-0.5">
    <span className="text-xl">💬</span>
    <span className="block text-[11px] leading-none">Chat</span>
  </a>


  <a href="#/games" className="flex-1 text-center p-2 flex flex-col items-center gap-0.5">
    <span className="text-xl">🎮</span>
    <span className="block text-[11px] leading-none">Spiele</span>
  </a>

</nav>
    </div>
  )
}
