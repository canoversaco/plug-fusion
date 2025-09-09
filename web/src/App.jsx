
import Games from './views/Games.jsx';


import Courier from './views/Courier.jsx'
import Chat from './views/Chat.jsx'
import React, {
  if (hash && hash.startsWith('#/games')) { return <Games/> }
 useEffect, useState } from 'react'
import { useAuth } from './auth/AuthContext.jsx'
import MobileShell from './components/MobileShell.jsx'
import Home from './views/Home.jsx'
import Menu from './views/Menu.jsx'
import OrdersView from './views/Orders.jsx'
import Checkout from './views/Checkout.jsx'
import Track from './views/Track.jsx'
import Profile from './views/Profile.jsx'
import Admin from './views/Admin.jsx'
import CourierPanel from './views/CourierPanel.jsx'

export default function App(){ 
  const { user } = useAuth()
  const [tab, setTab] = useState('home')
  const [screen, setScreen] = useState(null) // null | 'checkout' | {track:id}
  const isAdmin = user?.role === 'admin'
  const isCourier = user?.role === 'courier'

  const goTo = (t)=> setTab(t)

  const content = ()=>{
    if (screen==='checkout') return <Checkout onBack={()=>setScreen(null)} onDone={(id)=>{ setScreen({track:id}); setTab('orders') }} />
    if (screen && screen.track) return <Track orderId={screen.track} onBack={()=>setScreen(null)} />
    if (tab==='home') return <Home goTo={goTo} />
    if (tab==='menu') return <Menu onCheckout={()=>setScreen('checkout')} />
    if (tab==='orders') return <OrdersView onTrack={(id)=>setScreen({track:id})} />
    if (tab==='profile') return <Profile />
    if (tab==='courier' && (isCourier||isAdmin)) return <CourierPanel gotoTrack={(id)=>{ setScreen({track:id}); setTab('orders') }} />
    if (tab==='admin' && isAdmin) return <Admin />
    return <Home goTo={goTo}/>
  }

  return (
    <MobileShell active={tab} onTab={setTab} showAdmin={isAdmin} showCourier={isCourier||isAdmin} right={<span className="text-sm opacity-80">{user?.username}</span>}>
      {content()}
    </MobileShell>
  )
}
// auto-mount Chat FAB
