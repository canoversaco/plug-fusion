const FCM_URL = 'https://fcm.googleapis.com/fcm/send'
export async function sendFcm(serverKey, token, notification={}, data={}){
  if (!serverKey || !token) return { ok:false, status:0 }
  const r = await fetch(FCM_URL, {
    method:'POST',
    headers:{
      'authorization': 'key=' + serverKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      to: token,
      priority: 'high',
      notification,
      data
    })
  })
  return { ok: r.ok, status: r.status, text: await r.text().catch(()=> '') }
}
