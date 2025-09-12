const express = require('express')
const router = express.Router()

function getDb(req){ return req.db || req.app?.locals?.db }
async function allEither(db, sqlQ, sqlPg, params=[]){
  try{ const r = db.all ? await db.all(sqlQ, params) : await db.query(sqlQ, params); return r?.rows ?? r }
  catch{ const r = db.all ? await db.all(sqlPg, params) : await db.query(sqlPg, params); return r?.rows ?? r }
}

// Produkte
router.get('/admin/products', async (req,res)=>{
  try{
    const db = getDb(req)
    const rows = await allEither(db, `SELECT * FROM products ORDER BY id DESC LIMIT 500`,
                                     `SELECT * FROM products ORDER BY id DESC LIMIT 500`, [])
    res.json({ ok:true, products: rows||[] })
  }catch(e){ res.status(500).json({ ok:false, products: [] }) }
})

// Kategorien
router.get('/admin/categories', async (req,res)=>{
  try{
    const db = getDb(req)
    const rows = await allEither(db, `SELECT * FROM categories ORDER BY id DESC LIMIT 500`,
                                     `SELECT * FROM categories ORDER BY id DESC LIMIT 500`, [])
    res.json({ ok:true, categories: rows||[] })
  }catch(e){ res.status(500).json({ ok:false, categories: [] }) }
})

// Nutzer
router.get('/admin/users', async (req,res)=>{
  try{
    const db = getDb(req)
    const rows = await allEither(db,
      `SELECT id, username, role, created_at FROM users ORDER BY id DESC LIMIT 500`,
      `SELECT id, username, role, created_at FROM users ORDER BY id DESC LIMIT 500`, [])
    res.json({ ok:true, users: rows||[] })
  }catch(e){ res.status(500).json({ ok:false, users: [] }) }
})

module.exports = router
