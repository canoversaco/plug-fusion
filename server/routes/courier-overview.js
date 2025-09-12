const express = require('express')
const router = express.Router()

async function allEither(db, sqlQ, sqlPg, params=[]){
  try{
    const r = db.all ? await db.all(sqlQ, params) : await db.query(sqlQ, params)
    return r?.rows ?? r
  }catch(e){
    const r = db.all ? await db.all(sqlPg, params) : await db.query(sqlPg, params)
    return r?.rows ?? r
  }
}

router.get('/overview', async (req,res)=>{
  try{
    const db = req.db || req.app?.locals?.db
    const me = req.user?.id || req.session?.user?.id || null

    const rows = await allEither(
      db,
      `SELECT * FROM orders ORDER BY created_at DESC LIMIT 200`,
      `SELECT * FROM orders ORDER BY created_at DESC LIMIT 200`,
      []
    )

    const norm = s => (s||'').toString().toLowerCase().replace(/\s+/g,'_')
    const OPEN = new Set(['offen','pending','wartet_bestätigung','wartet_bestaetigung','neu','new'])
    const courierIdOf = o => o.courier_id ?? o.assigned_courier_id ?? o.courierId ?? o.assignedCourierId ?? null

    const incoming=[], mine=[], done=[]
    for(const o of (rows||[])){
      const s = norm(o.status)
      const cid = courierIdOf(o)
      if (!cid && OPEN.has(s)) { incoming.push(o); continue }
      if (me!=null && cid==me){
        if (s==='abgeschlossen') done.push(o); else mine.push(o)
      }
    }

    res.json({ ok:true, incoming, mine, done })
  }catch(e){
    console.error('[courier-overview]', e)
    res.json({ ok:false, incoming:[], mine:[], done:[] })
  }
})

module.exports = router
