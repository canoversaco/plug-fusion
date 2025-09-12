const express = require('express')
const router = express.Router()

// ----- Helpers -----
function getDb(req){ return req.db || req.app?.locals?.db }
function getUser(req){
  const u = req.user || req.session?.user || {}
  return { id: u.id ?? null, role: (u.role||'user').toLowerCase() }
}
async function allEither(db, q1, q2, p=[]){
  try{ const r = db.all? await db.all(q1,p) : await db.query(q1,p); return r?.rows ?? r }
  catch{ const r = db.all? await db.all(q2,p) : await db.query(q2,p); return r?.rows ?? r }
}
async function runEither(db, q1, q2, p=[]){
  try{ return db.run? await db.run(q1,p) : await db.query(q1,p) }
  catch{ return db.run? await db.run(q2,p) : await db.query(q2,p) }
}
const norm = s => (s||'').toString().toLowerCase().replace(/\s+/g,'_')

// ---------- LISTEN ----------
router.get('/admin/orders', async (req,res)=>{
  try{
    const db = getDb(req)
    const rows = await allEither(db, `SELECT * FROM orders ORDER BY created_at DESC LIMIT 500`, `SELECT * FROM orders ORDER BY created_at DESC LIMIT 500`)
    res.json({ ok:true, orders: rows||[] })
  }catch(e){ console.error('[orders-unified] admin list',e); res.status(500).json({ ok:false, orders: [] }) }
})

// Kurier: eingehend + eigene (kompakt)
router.get('/courier/orders', async (req,res)=>{
  try{
    const db = getDb(req); const me = getUser(req).id
    const rows = await allEither(db, `SELECT * FROM orders ORDER BY created_at DESC LIMIT 500`, `SELECT * FROM orders ORDER BY created_at DESC LIMIT 500`)
    const OPEN = new Set(['offen','pending','wartet_bestätigung','wartet_bestaetigung','neu','new'])
    const courierIdOf = o => o.courier_id ?? o.assigned_courier_id ?? o.courierId ?? o.assignedCourierId ?? null
    const incoming=[], mine=[]
    for(const o of rows||[]){
      const s = norm(o.status); const cid = courierIdOf(o)
      if (!cid && OPEN.has(s)) incoming.push(o)
      if (me!=null && cid==me) mine.push(o)
    }
    res.json({ ok:true, orders:[...incoming, ...mine] })
  }catch(e){ console.error('[orders-unified] courier list',e); res.status(500).json({ ok:false, orders: [] }) }
})

// NEU: Kurier sieht ALLE
router.get('/courier/orders/all', async (req,res)=>{
  try{
    const { role } = getUser(req)
    if (role!=='courier' && role!=='admin') return res.status(403).json({ ok:false, error:'forbidden' })
    const db = getDb(req)
    const rows = await allEither(db, `SELECT * FROM orders ORDER BY created_at DESC LIMIT 500`, `SELECT * FROM orders ORDER BY created_at DESC LIMIT 500`)
    res.json({ ok:true, orders: rows||[] })
  }catch(e){ console.error('[orders-unified] courier all',e); res.status(500).json({ ok:false, orders: [] }) }
})

// ---------- AKTIONEN ----------
const ALLOWED = new Set(['offen','akzeptiert','in_arbeit','unterwegs','abgeschlossen'])

router.post(['/admin/orders/:id/status','/courier/orders/:id/status','/orders/:id/status'], async (req,res)=>{
  try{
    const id = parseInt(req.params.id,10), status = norm(req.body?.status)
    if (!ALLOWED.has(status)) return res.status(400).json({ ok:false, error:'invalid_status' })
    const db=getDb(req)
    await runEither(db, `UPDATE orders SET status=? WHERE id=?`, `UPDATE orders SET status=$1 WHERE id=$2`, [status,id])
    res.json({ ok:true, id, status })
  }catch(e){ console.error('[orders-unified] status',e); res.status(500).json({ ok:false, error:'status_failed' }) }
})

router.post(['/admin/orders/:id/assign','/courier/orders/:id/assign','/orders/:id/assign'], async (req,res)=>{
  try{
    const id = parseInt(req.params.id,10)
    const me = getUser(req).id
    const courierId = req.body?.courier_id ?? me
    if (!courierId) return res.status(400).json({ ok:false, error:'missing_courier_id' })
    const db = getDb(req)
    try{
      await runEither(db,
        `UPDATE orders SET courier_id=?, status=CASE WHEN status IS NULL OR status='offen' THEN 'akzeptiert' ELSE status END WHERE id=?`,
        `UPDATE orders SET courier_id=$1, status=CASE WHEN status IS NULL OR status='offen' THEN 'akzeptiert' ELSE status END WHERE id=$2`,
        [courierId,id])
    }catch{
      await runEither(db,
        `UPDATE orders SET assigned_courier_id=?, status=CASE WHEN status IS NULL OR status='offen' THEN 'akzeptiert' ELSE status END WHERE id=?`,
        `UPDATE orders SET assigned_courier_id=$1, status=CASE WHEN status IS NULL OR status='offen' THEN 'akzeptiert' ELSE status END WHERE id=$2`,
        [courierId,id])
    }
    res.json({ ok:true, id, courier_id:courierId })
  }catch(e){ console.error('[orders-unified] assign',e); res.status(500).json({ ok:false, error:'assign_failed' }) }
})

router.post(['/admin/orders/:id/eta','/courier/orders/:id/eta','/orders/:id/eta'], async (req,res)=>{
  try{
    const id = parseInt(req.params.id,10)
    let { eta_at, minutes } = req.body || {}
    if (!eta_at && minutes!=null) eta_at = new Date(Date.now()+(+minutes||0)*60000).toISOString()
    if (!eta_at) return res.status(400).json({ ok:false, error:'missing_eta' })
    const db=getDb(req)
    await runEither(db,
      `UPDATE orders SET eta_at=?, status=CASE WHEN status IN ('offen','akzeptiert','in_arbeit') THEN 'unterwegs' ELSE status END WHERE id=?`,
      `UPDATE orders SET eta_at=$1, status=CASE WHEN status IN ('offen','akzeptiert','in_arbeit') THEN 'unterwegs' ELSE status END WHERE id=$2`,
      [eta_at,id])
    res.json({ ok:true, id, eta_at })
  }catch(e){ console.error('[orders-unified] eta',e); res.status(500).json({ ok:false, error:'eta_failed' }) }
})

router.post(['/admin/orders/:id/loc','/courier/orders/:id/loc','/orders/:id/loc'], async (req,res)=>{
  try{
    const id = parseInt(req.params.id,10)
    const { lat, lng } = req.body||{}
    if (typeof lat!=='number' || typeof lng!=='number') return res.status(400).json({ ok:false, error:'missing_lat_lng' })
    const db=getDb(req)
    await runEither(db, `UPDATE orders SET courier_lat=?, courier_lng=? WHERE id=?`, `UPDATE orders SET courier_lat=$1, courier_lng=$2 WHERE id=$3`, [lat,lng,id])
    res.json({ ok:true, id, lat, lng })
  }catch(e){ console.error('[orders-unified] loc',e); res.status(500).json({ ok:false, error:'loc_failed' }) }
})

router.post(['/admin/orders/:id/delete','/courier/orders/:id/delete'], async (req,res)=>{
  try{
    const id = parseInt(req.params.id,10)
    const db=getDb(req)
    await runEither(db, `DELETE FROM orders WHERE id=?`, `DELETE FROM orders WHERE id=$1`, [id])
    res.json({ ok:true, id })
  }catch(e){ console.error('[orders-unified] delete',e); res.status(500).json({ ok:false, error:'delete_failed' }) }
})

module.exports = router
