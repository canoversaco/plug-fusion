import React from 'react'
import ImageUploader from '../components/ImageUploader.jsx'
import { ChevronLeft, Image as ImageIcon } from 'lucide-react'

export default function AdminUploads({ goTo }){
  const go = (p)=> typeof goTo==='function' ? goTo(p) : (window.location.hash = p ? `#/${p}` : '#/')
  return (
    <div className="pf-pt-safe pf-pb-safe p-3 space-y-3">
      <div className="rounded-2xl p-4 border border-slate-800 bg-gradient-to-r from-emerald-600/15 via-cyan-600/15 to-fuchsia-600/15">
        <div className="flex items-center gap-2">
          <button className="btn-ghost px-3 py-2 rounded-xl border border-slate-700" onClick={()=>go('admin')}>
            <ChevronLeft size={16}/> Zurück zum Admin
          </button>
          <div className="text-xl font-extrabold flex items-center gap-2"><ImageIcon size={18}/> Galerie-Uploads</div>
        </div>
        <div className="text-xs opacity-80 mt-1">Lade Produktbilder hoch und verwende die generierten URLs in deinen Produkten.</div>
      </div>

      <ImageUploader/>
    </div>
  )
}
