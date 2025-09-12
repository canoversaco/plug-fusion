const express = require('express')
const crypto = require('crypto')
const router = express.Router()

/* ----------------------------- DB Helpers ----------------------------- */
function DB(req){ return req.db || req.app?.locals?.db }
const isSqlite = (db)=> !!db?.all
const isPg     = (db)=> !!db?.query && !db?.all

function rewritePg(sql){
  let i=0
  return sql.replace(/\?/g, ()=>'$'+(++i))
}
async function qAll(db, sql, params=[]){
  if (isSqlite(db)) return await db.all(sql, params)
  return (await db.query(rewritePg(sql), params))?.rows ?? []
}
async function qRun(db, sql, params=[]){
  if (isSqlite(db)) return await db.run(sql, params)
  return await db.query(rewritePg(sql), params)
}

async function tableExists(db, t){
  try{ await qAll(db, `SELECT 1 FROM ${t} LIMIT 1`); return true }catch{ return false }
}
async function findFirstTable(db, candidates){
  for(const t of candidates){ if(await tableExists(db,t)) return t }
  return null
}
async function getColumns(db, table){
  try{
    if (isSqlite(db)){
      const rows = await qAll(db, `PRAGMA table_info(${table})`)
      return rows.map(r=> String(r.name).toLowerCase())
    } else {
      const rows = await qAll(db,
        `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=? ORDER BY ordinal_position`,
        [table.replace(/^.*\./,'')])
      return rows.map(r=> String(r.column_name).toLowerCase())
    }
  }catch{ return [] }
}

const pick = (o, keys) => { for(const k of keys){ if (o?.[k]!=null) return o[k] } return null }
const norm = s => (s||'').toString().toLowerCase().replace(/\s+/g,'_')

/* ----------------------------- Discovery Cache ----------------------------- */
const cache = { orders:null, products:null, categories:null, users:null, cols:{} }

async function ensureDiscovered(req){
  const db = DB(req)
  if (!cache.orders)     cache.orders     = await findFirstTable(db, ['orders','orders_ext','orders_core','orders_main','sales_orders'])
  if (!cache.products)   cache.products   = await findFirstTable(db, ['products','menu_products','catalog_products','items'])
  if (!cache.categories) cache.categories = await findFirstTable(db, ['categories','menu_categories','catalog_categories'])
  if (!cache.users)      cache.users      = await findFirstTable(db, ['users','app_users','auth_users'])

  for (const [key, t] of Object.entries({orders:cache.orders, products:cache.products, categories:cache.categories, users:cache.users})){
    if (t && !cache.cols[t]) cache.cols[t] = await getColumns(db, t)
  }
  return cache
}

/* ------------------------------- Mappings -------------------------------- */
function mapOrder(row){
  const status = pick(row, ['status','order_status','state','stage','phase'])
  const cents  = pick(row, ['total_cents','amount_cents','sum_cents','grand_total_cents','price_cents'])
  const total  = pick(row, ['total','amount','sum','grand_total','price'])
  const itemJson = pick(row, ['items_json','order_items_json'])
  let items = pick(row, ['items']) || null
  if (!items && typeof itemJson==='string'){ try{ items = JSON.parse(itemJson) }catch{} }
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
    address: pick(row, ['address','delivery_address','addr']),
    items
  }
}
function mapProduct(row){
  const cents  = pick(row, ['price_cents','sale_price_cents'])
  const price  = pick(row, ['price','amount'])
  return {
    id: pick(row,['id','product_id','pid']),
    name: pick(row,['name','title']),
    price_cents: cents!=null ? Number(cents) : (price!=null ? Math.round(Number(price)*100) : null),
    sale_price_cents: pick(row,['sale_price_cents', 'sale_cents']),
    image_url: pick(row,['image_url','image','img','photo']),
    banner_image_url: pick(row,['banner_image_url','banner','hero_image']),
    badge_text: pick(row,['badge_text','badge']),
    badge_color: pick(row,['badge_color','badge_colour','badge_hex']),
    highlight_title: pick(row,['highlight_title','headline','promo_title']),
    category_id: pick(row,['category_id','cat_id'])
  }
}
function mapCategory(row){
  return {
    id: pick(row,['id','category_id','cid']),
    name: pick(row,['name','title','label']),
    badge_text: pick(row,['badge_text']),
    badge_color: pick(row,['badge_color']),
    highlight_title: pick(row,['highlight_title','headline']),
    is_featured: pick(row,['is_featured','featured']) ? true : false
  }
}
function mapUser(row){
  return {
    id: pick(row,['id','user_id','uid']),
    username: pick(row,['username','name','login']),
    role: pick(row,['role','user_role']),
    created_at: pick(row,['created_at','created','ts'])
  }
}

/* ----------------------------- Orders Endpoints ---------------------------- */
// we erweitern das Status-Lexikon um viele Varianten:
const OPEN_SET = new Set(['offen','pending','neu','wartet_bestätigung','wartet_bestaetigung','bestätigt','bestaetigt','angenommen'])
const WORK_SET = new Set(['offen','akzeptiert','in_arbeit','unterwegs','bestätigt','bestaetigt','angenommen'])
const DONE     = 'abgeschlossen'

router.get('/_debug/tables', async (req,res)=>{
  try { await ensureDiscovered(req); res.json({ok:true, tables:cache}) }
  catch(e){ res.status(500).json({ok:false, error:String(e)}) }
})

router.get('/admin/orders', async (req,res)=>{
  try{
    const db = DB(req); await ensureDiscovered(req)
    if (!cache.orders) return res.json({ok:true, orders: []})
    const rows = await qAll(db, `SELECT * FROM ${cache.orders} ORDER BY created_at DESC NULLS LAST, id DESC LIMIT 500`)
    res.json({ ok:true, orders: (rows||[]).map(mapOrder) })
  }catch(e){ console.error('[admin/orders]', e); res.status(500).json({ok:false, orders: []}) }
})

router.get('/courier/orders', async (req,res)=>{
  try{
    const db = DB(req); await ensureDiscovered(req)
    if (!cache.orders) return res.json({ok:true, orders: []})
    const me = (req.user||req.session?.user||{}).id ?? null
    const role = (req.user||req.session?.user||{}).role || 'user'
    const rows = await qAll(db, `SELECT * FROM ${cache.orders} ORDER BY created_at DESC NULLS LAST, id DESC LIMIT 500`)
    const inc=[], mine=[]
    for(const r of rows||[]){
      const o = mapOrder(r)
      const s = norm(o.status)
      const cid = o.courier_id ?? o.assigned_courier_id
      const isMine = me!=null && cid==me
      if (!cid && (OPEN_SET.has(s) || (role==='admin' && WORK_SET.has(s)))) inc.push(o)
      if (isMine) mine.push(o)
    }
    // Fallback: falls immer noch leer, gib die letzten 25 offener/stattgebender Bestellungen in "eingehend" aus.
    if (inc.length===0 && mine.length===0){
      for(const r of rows.slice(0,25)){
        const o = mapOrder(r)
        const s = norm(o.status)
        if (!o.courier_id && WORK_SET.has(s)) inc.push(o)
      }
    }
    res.json({ ok:true, orders: [...inc, ...mine] })
  }catch(e){ console.error('[courier/orders]', e); res.status(500).json({ok:false, orders: []}) }
})

const ALLOWED = new Set(['offen','akzeptiert','in_arbeit','unterwegs','abgeschlossen','bestätigt','bestaetigt','angenommen'])
router.post(['/admin/orders/:id/status','/courier/orders/:id/status','/orders/:id/status'], async (req,res)=>{
  try{
    const db=DB(req); await ensureDiscovered(req)
    const id = Number(req.params.id); const s = norm(req.body?.status)
    if (!cache.orders || !ALLOWED.has(s)) return res.status(400).json({ok:false})
    await qRun(db, `UPDATE ${cache.orders} SET status=? WHERE id=?`, [s,id])
    res.json({ ok:true, id, status:s })
  }catch(e){ console.error('[status]',e); res.status(500).json({ok:false}) }
})
router.post(['/admin/orders/:id/assign','/courier/orders/:id/assign','/orders/:id/assign'], async (req,res)=>{
  try{
    const db=DB(req); await ensureDiscovered(req)
    const id = Number(req.params.id); const me = (req.user||req.session?.user||{}).id ?? null
    const courierId = req.body?.courier_id ?? me
    if (!cache.orders || !courierId) return res.status(400).json({ok:false})
    try{
      await qRun(db, `UPDATE ${cache.orders} SET courier_id=?, status=CASE WHEN status IN ('offen','pending','neu','bestätigt','bestaetigt') THEN 'akzeptiert' ELSE status END WHERE id=?`, [courierId,id])
    }catch{
      await qRun(db, `UPDATE ${cache.orders} SET assigned_courier_id=?, status=CASE WHEN status IN ('offen','pending','neu','bestätigt','bestaetigt') THEN 'akzeptiert' ELSE status END WHERE id=?`, [courierId,id])
    }
    res.json({ ok:true, id, courier_id:courierId })
  }catch(e){ console.error('[assign]',e); res.status(500).json({ok:false}) }
})
router.post(['/admin/orders/:id/eta','/courier/orders/:id/eta','/orders/:id/eta'], async (req,res)=>{
  try{
    const db=DB(req); await ensureDiscovered(req)
    const id = Number(req.params.id); let {eta_at, minutes} = req.body||{}
    if (!eta_at && minutes!=null) eta_at = new Date(Date.now()+(+minutes||0)*60000).toISOString()
    if (!cache.orders || !eta_at) return res.status(400).json({ok:false})
    await qRun(db, `UPDATE ${cache.orders} SET eta_at=?, status=CASE WHEN status IN ('offen','akzeptiert','bestätigt','bestaetigt','in_arbeit') THEN 'unterwegs' ELSE status END WHERE id=?`, [eta_at,id])
    res.json({ ok:true, id, eta_at })
  }catch(e){ console.error('[eta]',e); res.status(500).json({ok:false}) }
})
router.post(['/admin/orders/:id/loc','/courier/orders/:id/loc','/orders/:id/loc'], async (req,res)=>{
  try{ const db=DB(req); await ensureDiscovered(req)
    const id = Number(req.params.id); const {lat,lng}=req.body||{}
    if (!cache.orders || typeof lat!=='number' || typeof lng!=='number') return res.status(400).json({ok:false})
    try{ await qRun(db, `UPDATE ${cache.orders} SET courier_lat=?, courier_lng=? WHERE id=?`, [lat,lng,id]) }
    catch{ await qRun(db, `UPDATE ${cache.orders} SET lat=?, lng=? WHERE id=?`, [lat,lng,id]) }
    res.json({ ok:true, id, lat, lng })
  }catch(e){ console.error('[loc]',e); res.status(500).json({ok:false}) }
})
router.post(['/admin/orders/:id/delete','/courier/orders/:id/delete'], async (req,res)=>{
  try{ const db=DB(req); await ensureDiscovered(req)
    const id = Number(req.params.id)
    if (!cache.orders) return res.status(400).json({ok:false})
    await qRun(db, `DELETE FROM ${cache.orders} WHERE id=?`, [id])
    res.json({ ok:true, id })
  }catch(e){ console.error('[delete]',e); res.status(500).json({ok:false}) }
})

/* ------------------------------- Admin: CRUD ------------------------------- */
async function sanitizeBodyFor(table, body){
  const cols = (cache.cols[table]||[]).map(s=>s.toLowerCase())
  const out = {}
  for (const [k,v] of Object.entries(body||{})){
    const kk = k.toLowerCase()
    if (cols.includes(kk)) out[kk]=v
  }
  // Spezials: Passwort
  if ('password' in (body||{})){
    if (cols.includes('password_hash')){
      try {
        const bcrypt = require('bcryptjs')
        out.password_hash = bcrypt.hashSync(String(body.password), 10)
      } catch {
        out.password_hash = crypto.createHash('sha256').update(String(body.password)).digest('hex')
      }
    } else if (cols.includes('password')) {
      out.password = body.password
    }
    // kein Klartextfeld? dann Passwort ignorieren
  }
  return out
}
function buildInsert(table, obj){
  const keys = Object.keys(obj)
  const qs = keys.map(()=>'?')
  return { sql:`INSERT INTO ${table} (${keys.join(',')}) VALUES (${qs.join(',')})`, params: keys.map(k=>obj[k]) }
}
function buildUpdate(table, obj, id){
  const keys = Object.keys(obj)
  const set = keys.map(k=>`${k}=?`)
  return { sql:`UPDATE ${table} SET ${set.join(',')} WHERE id=?`, params:[...keys.map(k=>obj[k]), id] }
}

/* ---- Products ---- */
router.get('/admin/products', async (req,res)=>{
  try{ const db=DB(req); await ensureDiscovered(req)
    if (!cache.products) return res.json({ok:true, products: []})
    const rows = await qAll(db, `SELECT * FROM ${cache.products} ORDER BY id DESC LIMIT 1000`)
    res.json({ ok:true, products:(rows||[]).map(mapProduct) })
  }catch(e){ console.error('[admin/products GET]',e); res.status(500).json({ok:false,products:[]}) }
})
router.post('/admin/products', async (req,res)=>{
  try{ const db=DB(req); await ensureDiscovered(req)
    if (!cache.products) return res.status(400).json({ok:false})
    const obj = await sanitizeBodyFor(cache.products, req.body)
    const {sql,params}=buildInsert(cache.products, obj)
    await qRun(db, sql, params)
    res.json({ok:true})
  }catch(e){ console.error('[admin/products POST]',e); res.status(500).json({ok:false}) }
})
router.put('/admin/products/:id', async (req,res)=>{ try{
  const db=DB(req); await ensureDiscovered(req); const id=Number(req.params.id);
  const obj = await sanitizeBodyFor(cache.products, req.body)
  const {sql,params}=buildUpdate(cache.products, obj, id)
  await qRun(db, sql, params); res.json({ok:true})
}catch(e){ console.error('[admin/products PUT]',e); res.status(500).json({ok:false}) }})
router.patch('/admin/products/:id', async (req,res)=>{ try{
  const db=DB(req); await ensureDiscovered(req); const id=Number(req.params.id);
  const obj = await sanitizeBodyFor(cache.products, req.body)
  const {sql,params}=buildUpdate(cache.products, obj, id)
  await qRun(db, sql, params); res.json({ok:true})
}catch(e){ console.error('[admin/products PATCH]',e); res.status(500).json({ok:false}) }})
router.delete('/admin/products/:id', async (req,res)=>{ try{
  const db=DB(req); await ensureDiscovered(req); const id=Number(req.params.id);
  await qRun(db, `DELETE FROM ${cache.products} WHERE id=?`, [id]); res.json({ok:true})
}catch(e){ console.error('[admin/products DELETE]',e); res.status(500).json({ok:false}) }})

/* ---- Categories ---- */
router.get('/admin/categories', async (req,res)=>{
  try{ const db=DB(req); await ensureDiscovered(req)
    if (!cache.categories) return res.json({ok:true, categories: []})
    const rows = await qAll(db, `SELECT * FROM ${cache.categories} ORDER BY id DESC LIMIT 1000`)
    res.json({ ok:true, categories:(rows||[]).map(mapCategory) })
  }catch(e){ console.error('[admin/categories GET]',e); res.status(500).json({ok:false,categories:[]}) }
})
router.post('/admin/categories', async (req,res)=>{
  try{ const db=DB(req); await ensureDiscovered(req)
    if (!cache.categories) return res.status(400).json({ok:false})
    const obj = await sanitizeBodyFor(cache.categories, req.body)
    const {sql,params}=buildInsert(cache.categories, obj)
    await qRun(db, sql, params)
    res.json({ok:true})
  }catch(e){ console.error('[admin/categories POST]',e); res.status(500).json({ok:false}) }
})
router.put('/admin/categories/:id', async (req,res)=>{ try{
  const db=DB(req); await ensureDiscovered(req); const id=Number(req.params.id);
  const obj = await sanitizeBodyFor(cache.categories, req.body)
  const {sql,params}=buildUpdate(cache.categories, obj, id)
  await qRun(db, sql, params); res.json({ok:true})
}catch(e){ console.error('[admin/categories PUT]',e); res.status(500).json({ok:false}) }})
router.patch('/admin/categories/:id', async (req,res)=>{ try{
  const db=DB(req); await ensureDiscovered(req); const id=Number(req.params.id);
  const obj = await sanitizeBodyFor(cache.categories, req.body)
  const {sql,params}=buildUpdate(cache.categories, obj, id)
  await qRun(db, sql, params); res.json({ok:true})
}catch(e){ console.error('[admin/categories PATCH]',e); res.status(500).json({ok:false}) }})
router.delete('/admin/categories/:id', async (req,res)=>{ try{
  const db=DB(req); await ensureDiscovered(req); const id=Number(req.params.id);
  await qRun(db, `DELETE FROM ${cache.categories} WHERE id=?`, [id]); res.json({ok:true})
}catch(e){ console.error('[admin/categories DELETE]',e); res.status(500).json({ok:false}) }})

/* ---- Users ---- */
router.get('/admin/users', async (req,res)=>{
  try{ const db=DB(req); await ensureDiscovered(req)
    if (!cache.users) return res.json({ok:true, users: []})
    const rows = await qAll(db, `SELECT * FROM ${cache.users} ORDER BY id DESC LIMIT 1000`)
    res.json({ ok:true, users:(rows||[]).map(mapUser) })
  }catch(e){ console.error('[admin/users GET]',e); res.status(500).json({ok:false,users:[]}) }
})
router.post('/admin/users', async (req,res)=>{
  try{ const db=DB(req); await ensureDiscovered(req)
    if (!cache.users) return res.status(400).json({ok:false})
    const obj = await sanitizeBodyFor(cache.users, req.body)
    const {sql,params}=buildInsert(cache.users, obj)
    await qRun(db, sql, params)
    res.json({ok:true})
  }catch(e){ console.error('[admin/users POST]',e); res.status(500).json({ok:false}) }
})
router.put('/admin/users/:id', async (req,res)=>{ try{
  const db=DB(req); await ensureDiscovered(req); const id=Number(req.params.id);
  const obj = await sanitizeBodyFor(cache.users, req.body)
  const {sql,params}=buildUpdate(cache.users, obj, id)
  await qRun(db, sql, params); res.json({ok:true})
}catch(e){ console.error('[admin/users PUT]',e); res.status(500).json({ok:false}) }})
router.patch('/admin/users/:id', async (req,res)=>{ try{
  const db=DB(req); await ensureDiscovered(req); const id=Number(req.params.id);
  const obj = await sanitizeBodyFor(cache.users, req.body)
  const {sql,params}=buildUpdate(cache.users, obj, id)
  await qRun(db, sql, params); res.json({ok:true})
}catch(e){ console.error('[admin/users PATCH]',e); res.status(500).json({ok:false}) }})
router.delete('/admin/users/:id', async (req,res)=>{ try{
  const db=DB(req); await ensureDiscovered(req); const id=Number(req.params.id);
  await qRun(db, `DELETE FROM ${cache.users} WHERE id=?`, [id]); res.json({ok:true})
}catch(e){ console.error('[admin/users DELETE]',e); res.status(500).json({ok:false}) }})

module.exports = router
