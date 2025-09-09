import { Router } from 'express'
import { query } from '../db/index.js'
const r = Router()

function parseUser(req){
  if (req.user) return req.user
  const a = req.headers?.authorization||''
  if (!a.startsWith('Bearer ')) return null
  try{ const p = JSON.parse(Buffer.from(a.slice(7).split('.')[1], 'base64url').toString('utf8')); return { role:p.role||'user' } }catch{ return null }
}
const withAuth = (req,res,next)=>{ const u=parseUser(req); if(!u) return res.status(401).json({error:'unauth'}); req.user=u; next() }
const requireAdmin = (req,res,next)=> (req.user.role==='admin' ? next() : res.status(403).json({error:'forbidden'}))

// liest inkl. highlight
r.get('/admin/categories', withAuth, requireAdmin, async (_req,res)=>{
  const q = await query(`SELECT id, name, position, active, COALESCE(highlight,0) AS highlight, highlight_color FROM categories ORDER BY position ASC, id ASC`,[])
  res.json({ categories: q.rows||[] })
})

// create/update inkl. highlight
r.post('/admin/categories', withAuth, requireAdmin, async (req,res)=>{
  const { id, name, position=0, active=true, highlight=false, highlight_color=null } = req.body||{}
  if (id){
    await query(`UPDATE categories SET name=?, position=?, active=?, highlight=?, highlight_color=? WHERE id=?`,
      [name, Number(position||0), active?1:0, highlight?1:0, highlight_color||null, Number(id)])
    res.json({ ok:true, id:Number(id) })
  }else{
    const ins = await query(`INSERT INTO categories(name, position, active, highlight, highlight_color) VALUES(?,?,?,?,?) RETURNING id`,
      [name, Number(position||0), active?1:0, highlight?1:0, highlight_color||null])
    res.json({ ok:true, id: ins.rows?.[0]?.id })
  }
})

// löschen
r.delete('/admin/categories/:id', withAuth, requireAdmin, async (req,res)=>{
  await query(`DELETE FROM categories WHERE id=?`, [Number(req.params.id||0)])
  res.json({ ok:true })
})

export default r
