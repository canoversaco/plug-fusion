const express = require('express')
const router = express.Router()

function getDb(req){ return req.db || req.app?.locals?.db }
async function allEither(db, sql1, sql2, p=[]){
  try{ const r = db.all ? await db.all(sql1,p) : await db.query(sql1,p); return r?.rows ?? r }
  catch{ const r = db.all ? await db.all(sql2,p) : await db.query(sql2,p); return r?.rows ?? r }
}

// Nur zum Anzeigen im Kurier-FE, KEINE sensiblen Daten
router.get('/public/orders', async (req,res)=>{
  try{
    const db = getDb(req)
    const rows = await allEither(db,
      `SELECT id, status, total_cents, created_at, courier_id, assigned_courier_id, eta_at, courier_lat, courier_lng
       FROM orders ORDER BY created_at DESC LIMIT 300`,
      `SELECT id, status, total_cents, created_at, courier_id, assigned_courier_id, eta_at, courier_lat, courier_lng
       FROM orders ORDER BY created_at DESC LIMIT 300`)
    res.json({ ok:true, orders: rows || [] })
  }catch(e){
    console.error('[orders_readonly] list error', e)
    res.status(500).json({ ok:false, orders: [] })
  }
})

module.exports = router
