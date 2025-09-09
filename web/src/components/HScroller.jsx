import React from 'react'
export default function HScroller({ children }){
  return (
    <div className="-mx-4 px-4 overflow-x-auto">
      <div className="flex gap-3">{children}</div>
    </div>
  )
}
