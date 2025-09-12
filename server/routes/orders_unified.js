const express = require('express')
const router = express.Router()

// ---------- Mini-DB-Helpers ----------
function DB(req){ return req.db || req.app?.locals?.db }
async function qall(db, sql, params=[]){
  if (!db) throw new Error('No DB on req')
  if (db.all) return await db.all(sql, params)             // sqlite
  const r = await db.query(sql, params)                    // pg
  return r?.rows ?? r
}
async function qrun(db, sql, params=[]){
  if (db.run) return await db.run(sql, params)             // sqlite
  return await db.query(sql, params)                       // pg
}
async function tableExists(db, t){
  try { await qall(db, `SELECT 1 FROM ${t} LIMIT 1`); return true } catch { return false }
}
async function findFirstTable(db, candidates){
  for (const t of candidates){ if (await tableExists(db, t)) return t }
  return null
}
const pick = (o, keys) => { for(const k of keys){ if (o[k]!=null) return o[k] } return null }
const norm = s => (s||'').toString().toLowerCase().replace(/\s+/g,'_')
const OPEN = new Set(['offen','pending','wartet_bestätigung','wartet_bestaetigung','neu','new'])

// ---------- Auto-Discovery (cached) ----------
const cache = { orders:null, products:null, categories:null, users:null }

async function ensureDiscovered(req){
  const db = DB(req)
  if (!cache.orders)     cache.orders     = await findFirstTable(db, ['orders','orders_ext','orders_core','orders_main','order','sales_orders'])
  if (!cache.products)   cache.products   = await findFirstTable(db, ['products','menu_products','catalog_products','items'])
  if (!cache.categories) cache.categories = await findFirstTable(db, ['categories','menu_categories','catalog_categories'])
  if (!cache.users)      cache.users      = await findFirstTable(db, ['users','app_users','auth_users'])

  return cache
}

// ---------- Mappings ----------
function mapOrder(row){
  const status = pick(row, ['status','order_status','state','stage','phase'])
  const cents  = pick(row, ['total_cents','amount_cents','sum_cents','grand_total_cents','price_cents'])
  const total  = pick(row, ['total','amount','sum','grand_total','price'])
  return {
    id: pick(row, ['id','order_id','oid']),
    status: norm(status) || 'offen',
    total_cents: cents!=null ? Number(cents) : (total!=null ? Math.round(Number(total)*100) : null),
    created_at: pick(row, ['created_at','createdAt','created','inserted_at','ts','timestamp']),
    courier_id: pick(row, ['courier_id','assigned_courier_id','courierId','assignedCourierId']),
    assigned_courier_id: pick(row, ['assigned_courier_id','courier_id']),
    eta_at: pick(row, ['eta_at','eta','estimated_at']),
    courier_lat: pick(row, ['courier_lat','lat','latitude']),
    courier_lng: pick(row, ['courier_lng','lng','longitude']),
    customer_name: pick(row, ['customer_name','name','user_name','buyer_name']),
    address: pick(row, ['address','delivery_address','addr'])
  }
}
function mapProduct(row){
  const cents  = pick(row, ['price_cents','sale_price_cents'])
  const price  = pick(row, ['price','amount'])
  return {
    id: pick(row,['id','product_id','pid']),
    name: pick(row,['name','title']),
    price_cents: cents!=null ? Number(cents) : (price!=null ? Math.round(Number(price)*100) : null),
    image_url: pick(row,['image_url','image','img','photo']),
    banner_image_url: pick(row,['banner_image_url','banner','hero_image'])
  }
}
function mapCategory(row){
  return { id: pick(row,['id','category_id','cid']), name: pick(row,['name','title','label']) }
}
function mapUser(row){
  return { id: pick(row,['id','user_id','uid']), username: pick(row,['username','name','login']), role: pick(row,['role','user_role']), created_at: pick(row,['created_at','created','ts']) }
}

// ---------- Endpoints ----------

// Debug: zeige gefundene Tabellennamen
router.get('/_debug/tables', async (req,res)=>{
  try{
    await ensureDiscovered(req)
    res.json({ ok:true, tables: cache })
  }catch(e){ res.status(500).json({ok:false, error:String(e)}) }
})

// Admin: alle Orders
router.get('/admin/orders', async (req,res)=>{
  try{
    const db = DB(req); await ensureDiscovered(req)
    if (!cache.orders) return res.json({ok:true, orders: []})
    const rows = await qall(db, `SELECT * FROM ${cache.orders} ORDER BY created_at DESC NULLS LAST, id DESC LIMIT 500`)
    res.json({ ok:true, orders: (rows||[]).map(mapOrder) })
  }catch(e){ console.error('[admin/orders]', e); res.status(500).json({ok:false, orders: []}) }
})

// Courier: eingehend + eigene
router.get('/courier/orders', async (req,res)=>{
  try{
    const db = DB(req); await ensureDiscovered(req)
    if (!cache.orders) return res.json({ok:true, orders: []})
    const me = (req.user||req.session?.user||{}).id ?? null
    const rows = await qall(db, `SELECT * FROM ${cache.orders} ORDER BY created_at DESC NULLS LAST, id DESC LIMIT 500`)
    const inc=[], mine=[]
    for (const r of rows||[]){
      const o = mapOrder(r)
      const cid = o.courier_id ?? o.assigned_courier_id
      if (!cid && OPEN.has(o.status)) inc.push(o)
      if (me!=null && cid==me) mine.push(o)
    }
    res.json({ ok:true, orders: [...inc, ...mine] })
  }catch(e){ console.error('[courier/orders]', e); res.status(500).json({ok:false, orders: []}) }
})

// Aktionen (assign/status/eta/loc/delete)
const ALLOWED = new Set(['offen','akzeptiert','in_arbeit','unterwegs','abgeschlossen'])

router.post(['/admin/orders/:id/assign','/courier/orders/:id/assign','/orders/:id/assign'], async (req,res)=>{
  try{
    const db=DB(req); await ensureDiscovered(req)
    const id = Number(req.params.id); const me = (req.user||req.session?.user||{}).id ?? null
    const courierId = req.body?.courier_id ?? me
    if (!cache.orders || !courierId) return res.status(400).json({ok:false})
    // versuche beide Spalten
    try{
      await qrun(db, `UPDATE ${cache.orders} SET courier_id=? , status=COALESCE(NULLIF(status,''),'akzeptiert') WHERE id=?`, [courierId,id])
    }catch {
      await qrun(db, `UPDATE ${cache.orders} SET assigned_courier_id=? , status=COALESCE(NULLIF(status,''),'akzeptiert') WHERE id=?`, [courierId,id])
    }
    res.json({ ok:true, id, courier_id:courierId })
  }catch(e){ console.error('[assign]',e); res.status(500).json({ok:false}) }
})

router.post(['/admin/orders/:id/status','/courier/orders/:id/status','/orders/:id/status'], async (req,res)=>{
  try{
    const db=DB(req); await ensureDiscovered(req)
    const id = Number(req.params.id); const s = norm(req.body?.status)
    if (!cache.orders || !ALLOWED.has(s)) return res.status(400).json({ok:false})
    await qrun(db, `UPDATE ${cache.orders} SET status=? WHERE id=?`, [s,id])
    res.json({ ok:true, id, status:s })
  }catch(e){ console.error('[status]',e); res.status(500).json({ok:false}) }
})

router.post(['/admin/orders/:id/eta','/courier/orders/:id/eta','/orders/:id/eta'], async (req,res)=>{
  try{
    const db=DB(req); await ensureDiscovered(req)
    const id = Number(req.params.id); let {eta_at, minutes} = req.body||{}
    if (!eta_at && minutes!=null) eta_at = new Date(Date.now()+(+minutes||0)*60000).toISOString()
    if (!cache.orders || !eta_at) return res.status(400).json({ok:false})
    await qrun(db, `UPDATE ${cache.orders} SET eta_at=? , status=CASE WHEN status IN ('offen','akzeptiert','in_arbeit') THEN 'unterwegs' ELSE status END WHERE id=?`, [eta_at,id])
    res.json({ ok:true, id, eta_at })
  }catch(e){ console.error('[eta]',e); res.status(500).json({ok:false}) }
})

router.post(['/admin/orders/:id/loc','/courier/orders/:id/loc','/orders/:id/loc'], async (req,res)=>{
  try{
    const db=DB(req); await ensureDiscovered(req)
    const id = Number(req.params.id); const {lat,lng}=req.body||{}
    if (!cache.orders || typeof lat!=='number' || typeof lng!=='number') return res.status(400).json({ok:false})
    try{ await qrun(db, `UPDATE ${cache.orders} SET courier_lat=?, courier_lng=? WHERE id=?`, [lat,lng,id]) }
    catch{ await qrun(db, `UPDATE ${cache.orders} SET lat=?, lng=? WHERE id=?`, [lat,lng,id]) }
    res.json({ ok:true, id, lat, lng })
  }catch(e){ console.error('[loc]',e); res.status(500).json({ok:false}) }
})

router.post(['/admin/orders/:id/delete','/courier/orders/:id/delete'], async (req,res)=>{
  try{
    const db=DB(req); await ensureDiscovered(req)
    const id = Number(req.params.id)
    if (!cache.orders) return res.status(400).json({ok:false})
    await qrun(db, `DELETE FROM ${cache.orders} WHERE id=?`, [id])
    res.json({ ok:true, id })
  }catch(e){ console.error('[delete]',e); res.status(500).json({ok:false}) }
})

// Admin-Lookups
router.get('/admin/products', async (req,res)=>{
  try{
    const db=DB(req); await ensureDiscovered(req)
    if (!cache.products) return res.json({ok:true, products: []})
    const rows = await qall(db, `SELECT * FROM ${cache.products} ORDER BY id DESC LIMIT 500`)
    res.json({ ok:true, products: (rows||[]).map(mapProduct) })
  }catch(e){ console.error('[admin/products]',e); res.status(500).json({ok:false,products:[]}) }
})
router.get('/admin/categories', async (req,res)=>{
  try{
    const db=DB(req); await ensureDiscovered(req)
    if (!cache.categories) return res.json({ok:true, categories: []})
    const rows = await qall(db, `SELECT * FROM ${cache.categories} ORDER BY id DESC LIMIT 500`)
    res.json({ ok:true, categories: (rows||[]).map(mapCategory) })
  }catch(e){ console.error('[admin/categories]',e); res.status(500).json({ok:false,categories:[]}) }
})
router.get('/admin/users', async (req,res)=>{
  try{
    const db=DB(req); await ensureDiscovered(req)
    if (!cache.users) return res.json({ok:true, users: []})
    const rows = await qall(db, `SELECT * FROM ${cache.users} ORDER BY id DESC LIMIT 500`)
    res.json({ ok:true, users: (rows||[]).map(mapUser) })
  }catch(e){ console.error('[admin/users]',e); res.status(500).json({ok:false,users:[]}) }
})

module.exports = router
