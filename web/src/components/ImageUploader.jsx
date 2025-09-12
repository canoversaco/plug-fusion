import React, { useRef, useState } from 'react'
import { Upload, Check, Copy, Loader2 } from 'lucide-react'

export default function ImageUploader(){
  const [files,setFiles]=useState([])
  const [uploads,setUploads]=useState([])
  const [busy,setBusy]=useState(false)
  const inputRef=useRef(null)

  const onPick=()=> inputRef.current?.click()
  const onFiles=(e)=>{
    const list = Array.from(e.target.files||[])
    setFiles(list)
  }
  async function uploadAll(){
    if (!files.length || busy) return
    setBusy(true)
    const out=[]
    for(const f of files){
      const fd = new FormData(); fd.append('file', f)
      try{
        const r = await fetch('/api/admin/upload', { method:'POST', body:fd, credentials:'include' })
        const j = await r.json().catch(()=>({}))
        if (j?.ok && j?.url) out.push({ name:f.name, url:j.url, ok:true })
        else out.push({ name:f.name, url:'', ok:false })
      }catch{ out.push({ name:f.name, url:'', ok:false }) }
    }
    setUploads(out)
    setBusy(false)
  }

  const copy=(t)=> navigator.clipboard?.writeText(t).catch(()=>{})

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="text-sm font-semibold mb-2">Bilder hochladen</div>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles}/>
        <div className="flex flex-wrap gap-2">
          <button className="btn inline-flex items-center gap-2" onClick={onPick}><Upload size={16}/> Aus Galerie wählen</button>
          <button className="btn-ghost inline-flex items-center gap-2 disabled:opacity-50" onClick={uploadAll} disabled={!files.length || busy}>
            {busy? <Loader2 size={16} className="animate-spin"/> : <Check size={16}/>} Upload starten
          </button>
        </div>
        {!!files.length && <div className="mt-2 text-xs opacity-70">{files.length} Dateien ausgewählt</div>}
      </div>

      {!!uploads.length && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
          <div className="text-sm font-semibold mb-2">Ergebnisse</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {uploads.map((u,i)=>(
              <div key={i} className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
                <div className="aspect-[4/3] bg-slate-800">
                  {u.ok && <img src={u.url} alt={u.name} className="w-full h-full object-cover"/>}
                </div>
                <div className="p-2 text-xs break-all">
                  {u.ok? <span className="text-emerald-400">{u.url}</span> : <span className="text-rose-400">Fehler</span>}
                </div>
                {u.ok && (
                  <button className="w-full text-xs py-1 border-t border-slate-800 hover:bg-slate-900 flex items-center justify-center gap-1"
                          onClick={()=>copy(u.url)}>
                    <Copy size={12}/> URL kopieren
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs opacity-70">Tipp: Kopiere die Bild-URL und füge sie bei deinen Produkten als <code>image_url</code> oder <code>banner_image_url</code> ein.</div>
        </div>
      )}
    </div>
  )
}
