import { initFcm } from './fcm.js'
setTimeout(()=>{
  try{
    const t = localStorage.getItem('pf_token') || ''
    if (t) initFcm(()=>t)
  }catch{}
}, 800)
