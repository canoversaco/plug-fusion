const express = require('express')
const router = express.Router()

// ---- helpers ----
function getDB(req){ return req.db || req.app?.locals?.db }
async function allEither(db, sqlQ, sqlPg, params=[]){
  try{ const r = db.all ? await db.all(sqlQ, params) : await db.query(sqlQ, params); return r?.rows ?? r }catch(e){
    const r = db.all ? await db.all(sqlPg, params) : await db.query(sqlPg, params); return r?.rows ?? r
  }
}
async function runEither(db, sqlQ, sqlPg, params=[]){
  try{ return db.run ? await db.run(sqlQ, params) : await db.query(sqlQ, params) }catch(e){
    return db.run ? await db.run(sqlPg, params) : await db.query(sqlPg, params)
  }
}
function normStatus(s){
  if(!s) return 'offen'
  const x = String(s).toLowerCase().replace(/\s+/g,'_')
  if (x==='in arbeit') return 'in_arbeit'
  if (x==='waiting' || x==='wait_confirm') return 'offen'
  return x
}
function getCourierId(o){
  return o?.courier_id ?? o?.assigned_courier_id ?? o?.courierId ?? o?.assignedCourierId ?? null
}

// ---- READ (public) ----
router.get('/public/list', async (req,res)=>{
  try{
    const db = getDB(req)
    const rows = await allEither(
      db,
      `SELECT * FROM orders ORDER BY created_at DESC LIMIT 300`,
      `SELECT * FROM orders ORDER BY created_at DESC LIMIT 300`, []
    )
    res.json({ ok:true, orders: rows || [] })
  }catch(e){
    console.error('[courier-panel] public list error', e)
    res.status(500).json({ ok:false, orders: [] })
  }
})

// ---- READ (protected helpers) ----
router.get('/mine', async (req,res)=>{
  try{
    const db = getDB(req)
    const uid = req.user?.id ?? parseInt(req.query.courier_id||0,10)
    if(!uid) return res.status(401).json({ok:false, error:'unauthorized'})
    const rows = await allEither(
      db,
      `SELECT * FROM orders WHERE courier_id=? OR assigned_courier_id=? ORDER BY created_at DESC LIMIT 200`,
      `SELECT * FROM orders WHERE courier_id=$1 OR assigned_courier_id=$1 ORDER BY created_at DESC LIMIT 200`,
      [uid]
    )
    res.json({ ok:true, orders: rows||[] })
  }catch(e){
    console.error('[courier-panel] mine error', e)
    res.status(500).json({ ok:false, orders: [] })
  }
})

router.get('/incoming', async (req,res)=>{
  try{
    const db = getDB(req)
    const rows = await allEither(
      db,
      `SELECT * FROM orders WHERE (courier_id IS NULL AND assigned_courier_id IS NULL)
         AND LOWER(COALESCE(status,'')) IN ('offen','pending','new','wartet_bestätigung','wartet_bestaetigung')
       ORDER BY created_at DESC LIMIT 200`,
      `SELECT * FROM orders WHERE (courier_id IS NULL AND assigned_courier_id IS NULL)
         AND LOWER(COALESCE(status,'')) IN ('offen','pending','new','wartet_bestätigung','wartet_bestaetigung')
       ORDER BY created_at DESC LIMIT 200`,
      []
    )
    res.json({ ok:true, orders: rows||[] })
  }catch(e){
    console.error('[courier-panel] incoming error', e)
    res.status(500).json({ ok:false, orders: [] })
  }
})

// ---- WRITE (protected) ----
router.post('/orders/:id/assign', async (req,res)=>{
  try{
    const db = getDB(req)
    const id = parseInt(req.params.id,10)
    const courierId = req.user?.id ?? req.body?.courier_id
    if(!courierId) return res.status(401).json({ok:false, error:'unauthorized'})
    // zuerst versuchen courier_id, dann assigned_courier_id
    try{
      await runEither(
        db,
        `UPDATE orders SET courier_id=?, status=CASE WHEN status IS NULL OR LOWER(status) IN ('offen','pending','new','wartet_bestätigung','wartet_bestaetigung') THEN 'akzeptiert' ELSE status END WHERE id=?`,
        `UPDATE orders SET courier_id=$1, status=CASE WHEN status IS NULL OR LOWER(status) IN ('offen','pending','new','wartet_bestätigung','wartet_bestaetigung') THEN 'akzeptiert' ELSE status END WHERE id=$2`,
        [courierId, id]
      )
    }catch(e){
      await runEither(
        db,
        `UPDATE orders SET assigned_courier_id=?, status=CASE WHEN status IS NULL OR LOWER(status) IN ('offen','pending','new','wartet_bestätigung','wartet_bestaetigung') THEN 'akzeptiert' ELSE status END WHERE id=?`,
        `UPDATE orders SET assigned_courier_id=$1, status=CASE WHEN status IS NULL OR LOWER(status) IN ('offen','pending','new','wartet_bestätigung','wartet_bestaetigung') THEN 'akzeptiert' ELSE status END WHERE id=$2`,
        [courierId, id]
      )
    }
    res.json({ ok:true, id, courier_id: courierId })
  }catch(e){
    console.error('[courier-panel] assign error', e)
    res.status(500).json({ ok:false, error:'assign_failed' })
  }
})

router.post('/orders/:id/status', async (req,res)=>{
  try{
    const db = getDB(req)
    const id = parseInt(req.params.id,10)
    const status = String(req.body?.status||'').toLowerCase()
    if(!status) return res.status(400).json({ok:false, error:'missing_status'})
    await runEither(
      db,
      `UPDATE orders SET status=? WHERE id=?`,
      `UPDATE orders SET status=$1 WHERE id=$2`,
      [status, id]
    )
    res.json({ ok:true, id, status })
  }catch(e){
    console.error('[courier-panel] status error', e)
    res.status(500).json({ ok:false, error:'status_failed' })
  }
})

router.post('/orders/:id/eta', async (req,res)=>{
  try{
    const db = getDB(req)
    const id = parseInt(req.params.id,10)
    let { minutes, eta_at } = req.body||{}
    if(!eta_at && minutes!=null){
      eta_at = new Date(Date.now() + (parseInt(minutes,10)||0)*60000).toISOString()
    }
    if(!eta_at) return res.status(400).json({ok:false, error:'missing_eta'})
    await runEither(
      db,
      `UPDATE orders SET eta_at=?, status=CASE WHEN LOWER(COALESCE(status,'')) IN ('offen','akzeptiert','in_arbeit','pending','new') THEN 'unterwegs' ELSE status END WHERE id=?`,
      `UPDATE orders SET eta_at=$1, status=CASE WHEN LOWER(COALESCE(status,'')) IN ('offen','akzeptiert','in_arbeit','pending','new') THEN 'unterwegs' ELSE status END WHERE id=$2`,
      [eta_at, id]
    )
    res.json({ ok:true, id, eta_at })
  }catch(e){
    console.error('[courier-panel] eta error', e)
    res.status(500).json({ ok:false, error:'eta_failed' })
  }
})

router.post('/orders/:id/loc', async (req,res)=>{
  try{
    const db = getDB(req)
    const id = parseInt(req.params.id,10)
    const lat = Number(req.body?.lat), lng = Number(req.body?.lng)
    if(!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ok:false, error:'missing_lat_lng'})
    await runEither(
      db,
      `UPDATE orders SET courier_lat=?, courier_lng=? WHERE id=?`,
      `UPDATE orders SET courier_lat=$1, courier_lng=$2 WHERE id=$3`,
      [lat, lng, id]
    )
    res.json({ ok:true, id, lat, lng })
  }catch(e){
    console.error('[courier-panel] loc error', e)
    res.status(500).json({ ok:false, error:'loc_failed' })
  }
})

module.exports = router
