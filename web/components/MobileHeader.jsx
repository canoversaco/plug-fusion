import React from 'react'
export default function MobileHeader({ title, right=null }){
  return (
    <div className="sticky top-0 z-20 pt-safe bg-slate-950/80 backdrop-blur border-b border-slate-800">
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="text-lg font-bold text-center w-full">{title}</div>
        {right}
      </div>
    </div>
  )
}
