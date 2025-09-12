import React from 'react'
export default function FeaturedHero({ item, onAdd }){
  if(!item) return null
  const bg = item.banner_image_url
  return (
    <div className="rounded-2xl border border-slate-800 overflow-hidden relative">
      {bg ? (
        <div className="h-40 w-full bg-cover bg-center" style={{ backgroundImage:`linear-gradient(0deg,rgba(0,0,0,.35),rgba(0,0,0,.35)),url(${bg})` }} />
      ) : <div className="h-40 w-full bg-gradient-to-r from-emerald-400/30 to-fuchsia-500/30" />}
      <div className="absolute inset-0 p-4 flex flex-col justify-end">
        <div className="text-xs opacity-80">Highlight</div>
        <div className="text-xl font-extrabold leading-tight drop-shadow">{item.highlight_title || item.name}</div>
        {item.highlight_desc ? <div className="text-sm opacity-90 drop-shadow">{item.highlight_desc}</div> : null}
        <div className="mt-2">
          <button className="btn" onClick={()=>onAdd?.(item)}>Jetzt probieren</button>
        </div>
      </div>
    </div>
  )
}
