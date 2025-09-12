import { getApp } from 'firebase/app'
import { getMessaging, isSupported, getToken, onMessage } from 'firebase/messaging'

export async function initFcm(getAuthToken){
  try{
    if (!('Notification' in window)) return
    if (!(await isSupported())) return
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return

    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    const messaging = getMessaging(getApp())
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
    if (!vapidKey) { console.warn('[FCM] VAPID-Key fehlt'); return }

    const fcmToken = await getToken(messaging, { vapidKey, serviceWorkerRegistration: reg })
    if (fcmToken) {
      const auth = await getAuthToken?.()
      await fetch('/api/register-fcm', {
        method:'POST',
        headers:{ 'content-type':'application/json', ...(auth?{'authorization':'Bearer '+auth}:{}) },
        body: JSON.stringify({ token:fcmToken, platform:'web' })
      })
    }
    onMessage(messaging, (p)=> console.log('[FCM] foreground', p))
  }catch(e){ console.warn('[FCM] init failed', e?.message||e) }
}
