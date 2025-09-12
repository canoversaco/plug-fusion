const express = require('express')
const router = express.Router()

async function runEither(db, sqlQ, sqlPg, params){
  try { return db.query ? await db.query(sqlQ, params) : await db.run(sqlQ, params) }
  catch(e){ return db.query ? await db.query(sqlPg, params) : await db.run(sqlPg, params) }
}
async function allEither(db, sqlQ, sqlPg, params){
  try { const r = db.all ? await db.all(sqlQ, params) : await db.query(sqlQ, params); return r?.rows ?? r }
  catch(e){ const r = db.all ? await db.all(sqlPg, params) : await db.query(sqlPg, params); return r?.rows ?? r }
}

// Liste
router.get('/orders', async (req,res)=>{
  try{
    const db = req.db || req.app?.locals?.db
    const rows = await allEither(db,
      `SELECT * FROM orders ORDER BY created_at DESC LIMIT 200`,
      `SELECT * FROM orders ORDER BY created_at DESC LIMIT 200`, [])
    res.json({ ok:true, orders: rows || [] })
  }catch(e){
    console.error('[courier-edit] list error', e); res.status(500).json({ ok:false, orders: [] })
  }
})

// Assign
router.post('/orders/:id/assign', async (req,res)=>{
  try{
    const id = parseInt(req.params.id,10)
    const courierId = req.body?.courier_id ?? req.user?.id
    if (!courierId) return res.status(400).json({ ok:false, error:'missing_courier_id' })
    const db = req.db || req.app?.locals?.db
    try{
      await runEither(db,
        `UPDATE orders SET courier_id=?, status=CASE WHEN status='offen' OR status IS NULL THEN 'akzeptiert' ELSE status END WHERE id=?`,
        `UPDATE orders SET courier_id=$1, status=CASE WHEN status='offen' OR status IS NULL THEN 'akzeptiert' ELSE status END WHERE id=$2`,
        [courierId, id])
    }catch{
      await runEither(db,
        `UPDATE orders SET assigned_courier_id=?, status=CASE WHEN status='offen' OR status IS NULL THEN 'akzeptiert' ELSE status END WHERE id=?`,
        `UPDATE orders SET assigned_courier_id=$1, status=CASE WHEN status='offen' OR status IS NULL THEN 'akzeptiert' ELSE status END WHERE id=$2`,
        [courierId, id])
    }
    res.json({ ok:true, id, courier_id: courierId })
  }catch(e){
    console.error('[courier-edit] assign error', e); res.status(500).json({ ok:false, error:'assign_failed' })
  }
})

// ETA
router.post('/orders/:id/eta', async (req,res)=>{
  try{
    const id = parseInt(req.params.id,10)
    let { minutes, eta_at } = req.body || {}
    if (!eta_at && minutes!=null){
      eta_at = new Date(Date.now() + (parseInt(minutes,10)||0)*60000).toISOString()
    }
    if (!eta_at) return res.status(400).json({ ok:false, error:'missing_eta' })
    const db = req.db || req.app?.locals?.db
    await runEither(db,
      `UPDATE orders SET eta_at=?, status=CASE WHEN status IN ('offen','akzeptiert','in_arbeit') THEN 'unterwegs' ELSE status END WHERE id=?`,
      `UPDATE orders SET eta_at=$1, status=CASE WHEN status IN ('offen','akzeptiert','in_arbeit') THEN 'unterwegs' ELSE status END WHERE id=$2`,
      [eta_at, id])
    res.json({ ok:true, id, eta_at })
  }catch(e){
    console.error('[courier-edit] eta error', e); res.status(500).json({ ok:false, error:'eta_failed' })
  }
})

// Status
router.post('/orders/:id/status', async (req,res)=>{
  try{
    const id = parseInt(req.params.id,10)
    const { status } = req.body || {}
    if (!status) return res.status(400).json({ ok:false, error:'missing_status' })
    const db = req.db || req.app?.locals?.db
    await runEither(db,
      `UPDATE orders SET status=? WHERE id=?`,
      `UPDATE orders SET status=$1 WHERE id=$2`,
      [String(status), id])
    res.json({ ok:true, id, status })
  }catch(e){
    console.error('[courier-edit] status error', e); res.status(500).json({ ok:false, error:'status_failed' })
  }
})

// GPS
router.post('/orders/:id/loc', async (req,res)=>{
  try{
    const id = parseInt(req.params.id,10)
    const { lat, lng } = req.body || {}
    if (typeof lat!=='number' || typeof lng!=='number')
      return res.status(400).json({ ok:false, error:'missing_lat_lng' })
    const db = req.db || req.app?.locals?.db
    await runEither(db,
      `UPDATE orders SET courier_lat=?, courier_lng=? WHERE id=?`,
      `UPDATE orders SET courier_lat=$1, courier_lng=$2 WHERE id=$3`,
      [lat, lng, id])
    res.json({ ok:true, id, lat, lng })
  }catch(e){
    console.error('[courier-edit] loc error', e); res.status(500).json({ ok:false, error:'loc_failed' })
  }
})

module.exports = router
