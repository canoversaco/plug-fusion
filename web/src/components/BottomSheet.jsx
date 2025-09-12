import React from 'react'
export default function BottomSheet({ open, title, onClose, children }){
  if(!open) return null
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-slate-800 bg-slate-900 p-4 safe-bottom">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">{title}</div>
          <button className="btn-ghost" onClick={onClose}>Schließen</button>
        </div>
        {children}
      </div>
    </div>
  )
}
