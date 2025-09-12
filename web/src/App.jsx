import React, { useEffect, useMemo, useState } from 'react'
import MobileShell from './components/MobileShell.jsx'
import Home from './views/Home.jsx'
import Menu from './views/Menu.jsx'
import Orders from './views/Orders.jsx'
import Profile from './views/Profile.jsx'
import Checkout from './views/Checkout.jsx'
import Admin from './views/Admin.jsx'
import Courier from './views/Courier.jsx'
import Chat from './views/Chat.jsx'
import Games from './views/Games.jsx'
import AdminUploads from './views/AdminUploads.jsx'

function getRoute(){
  const raw = (typeof window!=='undefined' ? window.location.hash : '#') || '#'
  const cleaned = raw.replace(/^#\/?/, '')
  const parts = cleaned.split('/').filter(Boolean)
  const path = (parts[0]||'').toLowerCase()
  const rest = parts.slice(1)
  return { path, rest, raw: cleaned }
}

export default function App(){
  const [route, setRoute] = useState(getRoute())
  useEffect(()=>{
    const onHash = ()=> setRoute(getRoute())
    window.addEventListener('hashchange', onHash)
    return ()=> window.removeEventListener('hashchange', onHash)
  },[])

  const routes = useMemo(()=>({
    '': Home,
    'home': Home,
    'menu': Menu,
    'orders': Orders,
    'profile': Profile,
    'checkout': Checkout,
    'admin': Admin,
    'courier': Courier,
    'chat': Chat,
    'support': Chat,
    'games': Games,
    'admin-uploads': AdminUploads
  }),[])

  const Active = routes[route.path] || Home
  const goTo = (p='')=>{ const hash = String(p||''); window.location.hash = hash ? `#/${hash}` : '#/' }

  // aktive ID für die untere Nav (nur Haupttabs)
  const mainTabs = ['','home','menu','checkout','profile','admin','courier']
  const activeNav = mainTabs.includes(route.path) ? (route.path||'') : ''

  return (
    <MobileShell active={activeNav} goTo={goTo}>
      <Active goTo={goTo} route={route}/>
    </MobileShell>
  )
}
