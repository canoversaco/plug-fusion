const express = require('express')
const crypto = require('crypto')
const router = express.Router()

function DB(req){ return req.db || req.app?.locals?.db }
async function qall(db, sql, params=[]){
  if (!db) throw new Error('No DB')
  if (db.all) return await db.all(sql, params)   // sqlite
  const r = await db.query(sql, params)          // pg
  return r?.rows ?? r
}
async function qrun(db, sql, params=[]){
  if (!db) throw new Error('No DB')
  if (db.run) return await db.run(sql, params)   // sqlite
  return await db.query(sql, params)             // pg
}
async function tableExists(db, t){ try{ await qall(db, `SELECT 1 FROM ${t} LIMIT 1`); return true }catch{ return false } }
async function firstTable(db, names){ for (const t of names){ if (await tableExists(db,t)) return t } return null }

const cache = { products:null, categories:null, users:null }
async function ensure(req){
  const db = DB(req)
  if (!cache.products)   cache.products   = await firstTable(db, ['products','menu_products','catalog_products','items'])
  if (!cache.categories) cache.categories = await firstTable(db, ['categories','menu_categories','catalog_categories'])
  if (!cache.users)      cache.users      = await firstTable(db, ['users','app_users','auth_users'])
  return cache
}

async function colExists(db, table, col){
  try { await qall(db, `SELECT ${col} FROM ${table} LIMIT 0`); return true } catch { return false }
}
async function firstExistingCol(db, table, candidates){
  for (const c of candidates){ if (await colExists(db, table, c)) return c }
  return null
}
function pickDefined(o, keys){
  const out={}
  for(const k of keys){ if (o[k]!==undefined) out[k]=o[k] }
  return out
}
async function buildSet(db, table, spec, payload){
  // spec = [{inKey:'name', cols:['name','title']}, ...]
  const cols=[]; const vals=[]
  for (const m of spec){
    if (payload[m.inKey]===undefined) continue
    const col = await firstExistingCol(db, table, m.cols)
    if (!col) continue
    cols.push(col); vals.push(payload[m.inKey])
  }
  return { cols, vals }
}
function sqlSetPlaceholders(cols){ return cols.map(c=>`${c}=?`).join(', ') }
function sqlInsertPlaceholders(n){ return '('+Array(n).fill('?').join(',')+')' }

// ---------- PRODUCTS CRUD ----------
router.get('/admin/products', async (req,res)=>{
  try{
    await ensure(req)
    if(!cache.products) return res.json({ok:true, products: []})
    const rows = await qall(DB(req), `SELECT * FROM ${cache.products} ORDER BY id DESC LIMIT 500`)
    res.json({ok:true, products: rows})
  }catch(e){ res.status(500).json({ok:false, error:String(e)}) }
})
router.post('/admin/products', async (req,res)=>{
  try{
    await ensure(req); const db=DB(req); const t=cache.products
    if(!t) return res.status(400).json({ok:false})
    const spec = [
      {inKey:'name', cols:['name','title']},
      {inKey:'price_cents', cols:['price_cents','price']},
      {inKey:'sale_price_cents', cols:['sale_price_cents','sale_price']},
      {inKey:'category_id', cols:['category_id','cat_id','category']},
      {inKey:'image_url', cols:['image_url','image','img']},
      {inKey:'banner_image_url', cols:['banner_image_url','banner','hero_image']},
      {inKey:'badge_text', cols:['badge_text','badge']},
      {inKey:'badge_color', cols:['badge_color']},
      {inKey:'highlight_title', cols:['highlight_title']},
      {inKey:'featured', cols:['featured','is_featured']},
      {inKey:'active', cols:['active','is_active']},
      {inKey:'variants_json', cols:['variants_json','variants']},
    ]
    const p = req.body||{}
    const {cols, vals} = await buildSet(db, t, spec, p)
    if (cols.length===0) return res.status(400).json({ok:false, error:'no fields'})
    const sql = `INSERT INTO ${t} (${cols.join(',')}) VALUES ${sqlInsertPlaceholders(cols.length)}`
    await qrun(db, sql, vals)
    res.json({ok:true})
  }catch(e){ res.status(500).json({ok:false, error:String(e)}) }
})
router.put('/admin/products/:id', updProduct)
router.patch('/admin/products/:id', updProduct)
async function updProduct(req,res){
  try{
    await ensure(req); const db=DB(req); const t=cache.products
    if(!t) return res.status(400).json({ok:false})
    const id = Number(req.params.id)
    const spec = [
      {inKey:'name', cols:['name','title']},
      {inKey:'price_cents', cols:['price_cents','price']},
      {inKey:'sale_price_cents', cols:['sale_price_cents','sale_price']},
      {inKey:'category_id', cols:['category_id','cat_id','category']},
      {inKey:'image_url', cols:['image_url','image','img']},
      {inKey:'banner_image_url', cols:['banner_image_url','banner','hero_image']},
      {inKey:'badge_text', cols:['badge_text','badge']},
      {inKey:'badge_color', cols:['badge_color']},
      {inKey:'highlight_title', cols:['highlight_title']},
      {inKey:'featured', cols:['featured','is_featured']},
      {inKey:'active', cols:['active','is_active']},
      {inKey:'variants_json', cols:['variants_json','variants']},
    ]
    const p = req.body||{}
    const {cols, vals} = await buildSet(db, t, spec, p)
    if (cols.length===0) return res.status(400).json({ok:false, error:'no fields'})
    const sql = `UPDATE ${t} SET ${sqlSetPlaceholders(cols)} WHERE id=?`
    await qrun(db, sql, [...vals, id])
    res.json({ok:true})
  }catch(e){ res.status(500).json({ok:false, error:String(e)}) }
}
router.delete('/admin/products/:id', async (req,res)=>{
  try{
    await ensure(req); const db=DB(req); const t=cache.products; const id=Number(req.params.id)
    if(!t) return res.status(400).json({ok:false})
    await qrun(db, `DELETE FROM ${t} WHERE id=?`, [id])
    res.json({ok:true})
  }catch(e){ res.status(500).json({ok:false, error:String(e)}) }
})

// ---------- CATEGORIES CRUD ----------
router.get('/admin/categories', async (req,res)=>{
  try{
    await ensure(req); const t=cache.categories
    if(!t) return res.json({ok:true, categories: []})
    const rows = await qall(DB(req), `SELECT * FROM ${t} ORDER BY id DESC LIMIT 500`)
    res.json({ok:true, categories: rows})
  }catch(e){ res.status(500).json({ok:false, error:String(e)}) }
})
router.post('/admin/categories', async (req,res)=>{
  try{
    await ensure(req); const db=DB(req); const t=cache.categories
    if(!t) return res.status(400).json({ok:false})
    const spec = [
      {inKey:'name', cols:['name','title','label']},
      {inKey:'sort_order', cols:['sort_order','position','sort']},
      {inKey:'color', cols:['color']},
      {inKey:'icon', cols:['icon']},
      {inKey:'featured', cols:['featured','is_featured']},
      {inKey:'banner_image_url', cols:['banner_image_url','banner']},
      {inKey:'badge_text', cols:['badge_text','badge']},
    ]
    const p = req.body||{}
    const {cols, vals} = await buildSet(db, t, spec, p)
    if (cols.length===0) return res.status(400).json({ok:false, error:'no fields'})
    const sql = `INSERT INTO ${t} (${cols.join(',')}) VALUES ${sqlInsertPlaceholders(cols.length)}`
    await qrun(db, sql, vals)
    res.json({ok:true})
  }catch(e){ res.status(500).json({ok:false, error:String(e)}) }
})
router.put('/admin/categories/:id', updCat)
router.patch('/admin/categories/:id', updCat)
async function updCat(req,res){
  try{
    await ensure(req); const db=DB(req); const t=cache.categories
    if(!t) return res.status(400).json({ok:false})
    const id=Number(req.params.id)
    const spec = [
      {inKey:'name', cols:['name','title','label']},
      {inKey:'sort_order', cols:['sort_order','position','sort']},
      {inKey:'color', cols:['color']},
      {inKey:'icon', cols:['icon']},
      {inKey:'featured', cols:['featured','is_featured']},
      {inKey:'banner_image_url', cols:['banner_image_url','banner']},
      {inKey:'badge_text', cols:['badge_text','badge']},
    ]
    const p=req.body||{}
    const {cols, vals} = await buildSet(db, t, spec, p)
    if (cols.length===0) return res.status(400).json({ok:false, error:'no fields'})
    const sql = `UPDATE ${t} SET ${sqlSetPlaceholders(cols)} WHERE id=?`
    await qrun(db, sql, [...vals,id])
    res.json({ok:true})
  }catch(e){ res.status(500).json({ok:false, error:String(e)}) }
}
router.delete('/admin/categories/:id', async (req,res)=>{
  try{
    await ensure(req); const db=DB(req); const t=cache.categories; const id=Number(req.params.id)
    if(!t) return res.status(400).json({ok:false})
    await qrun(db, `DELETE FROM ${t} WHERE id=?`, [id])
    res.json({ok:true})
  }catch(e){ res.status(500).json({ok:false, error:String(e)}) }
})

// ---------- USERS CRUD (inkl. Passwort) ----------
router.get('/admin/users', async (req,res)=>{
  try{
    await ensure(req); const t=cache.users
    if(!t) return res.json({ok:true, users: []})
    const rows = await qall(DB(req), `SELECT * FROM ${t} ORDER BY id DESC LIMIT 500`)
    res.json({ok:true, users: rows})
  }catch(e){ res.status(500).json({ok:false, error:String(e)}) }
})

async function setPassword(db, table, id, password){
  if (!password) return
  const hasPlain = await colExists(db, table, 'password')
  const hasHash  = await colExists(db, table, 'password_hash')
  if (hasPlain){
    await qrun(db, `UPDATE ${table} SET password=? WHERE id=?`, [password, id])
    return
  }
  if (hasHash){
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.createHash('sha256').update(salt + password).digest('hex')
    const hasSalt = await colExists(db, table, 'password_salt')
    if (hasSalt){
      await qrun(db, `UPDATE ${table} SET password_hash=?, password_salt=? WHERE id=?`, [hash, salt, id])
    }else{
      await qrun(db, `UPDATE ${table} SET password_hash=? WHERE id=?`, [hash, id])
    }
  }
}

router.post('/admin/users', async (req,res)=>{
  try{
    await ensure(req); const db=DB(req); const t=cache.users
    if(!t) return res.status(400).json({ok:false})
    const spec = [
      {inKey:'username', cols:['username','name','login']},
      {inKey:'role', cols:['role','user_role']},
      {inKey:'email', cols:['email']},
    ]
    const p=req.body||{}
    const {cols, vals} = await buildSet(db, t, spec, p)
    if (cols.length===0) return res.status(400).json({ok:false, error:'no fields'})
    const sql = `INSERT INTO ${t} (${cols.join(',')}) VALUES ${sqlInsertPlaceholders(cols.length)}`
    await qrun(db, sql, vals)
    // last insert id (sqlite) – best effort
    let id = null
    try{ const row = await qall(db, 'SELECT last_insert_rowid() as id'); id=row?.[0]?.id }catch{}
    if (!id){
      try{ const row = await qall(db, `SELECT id FROM ${t} ORDER BY id DESC LIMIT 1`); id=row?.[0]?.id }catch{}
    }
    if (id && p.password){ await setPassword(db, t, id, p.password) }
    res.json({ok:true, id})
  }catch(e){ res.status(500).json({ok:false, error:String(e)}) }
})
router.put('/admin/users/:id', updUser)
router.patch('/admin/users/:id', updUser)
async function updUser(req,res){
  try{
    await ensure(req); const db=DB(req); const t=cache.users; const id=Number(req.params.id)
    if(!t) return res.status(400).json({ok:false})
    const p=req.body||{}
    const spec = [
      {inKey:'username', cols:['username','name','login']},
      {inKey:'role', cols:['role','user_role']},
      {inKey:'email', cols:['email']},
    ]
    const {cols, vals} = await buildSet(db, t, spec, p)
    if (cols.length>0){
      const sql = `UPDATE ${t} SET ${sqlSetPlaceholders(cols)} WHERE id=?`
      await qrun(db, sql, [...vals, id])
    }
    if (p.password){ await setPassword(db, t, id, p.password) }
    res.json({ok:true})
  }catch(e){ res.status(500).json({ok:false, error:String(e)}) }
}
router.delete('/admin/users/:id', async (req,res)=>{
  try{
    await ensure(req); const db=DB(req); const t=cache.users; const id=Number(req.params.id)
    if(!t) return res.status(400).json({ok:false})
    await qrun(db, `DELETE FROM ${t} WHERE id=?`, [id])
    res.json({ok:true})
  }catch(e){ res.status(500).json({ok:false, error:String(e)}) }
})

module.exports = router
