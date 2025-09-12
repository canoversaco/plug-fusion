import React from 'react'

export default function PageHeader({ icon:Icon, title, subtitle, right=null }){
  return (
    <div className="max-w-screen-md mx-auto">
      <div className="rounded-2xl p-4 border border-slate-800 bg-gradient-to-r from-emerald-600/15 via-cyan-600/15 to-fuchsia-600/15 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {Icon ? <div className="w-10 h-10 rounded-xl bg-slate-900/60 grid place-items-center"><Icon size={18}/></div> : null}
          <div>
            <div className="text-xl font-extrabold leading-tight">{title}</div>
            {subtitle ? <div className="text-xs opacity-80">{subtitle}</div> : null}
          </div>
        </div>
        {right}
      </div>
    </div>
  )
}
