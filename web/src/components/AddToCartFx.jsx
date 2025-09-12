import React, { useEffect, useState } from 'react'

export default function AddToCartFx(){
  const [bursts, setBursts] = useState([])
  useEffect(()=>{
    const onAdd = ()=> {
      const id = Math.random().toString(36).slice(2)
      setBursts(b=>[...b, id])
      setTimeout(()=> setBursts(b=>b.filter(x=>x!==id)), 900)
      // zusätzliches Ereignis für Cart-Icon
      window.dispatchEvent(new Event('pf:cartPulse'))
    }
    window.addEventListener('pf:addToCart', onAdd)
    return ()=> window.removeEventListener('pf:addToCart', onAdd)
  },[])
  return (
    <div className="pf-cart-fx pointer-events-none">
      {bursts.map(id=>(
        <div key={id} className="pf-bubble"/>
      ))}
    </div>
  )
}
