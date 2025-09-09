import { Router } from 'express'
import { query } from '../db/index.js'
import bcrypt from 'bcryptjs'
const r = Router()

function parseUser(req){
  if (req.user) return req.user
  const a=req.headers?.authorization||''
  if(!a.startsWith('Bearer ')) return null
  try{ const p=JSON.parse(Buffer.from(a.slice(7).split('.')[1],'base64url').toString('utf8')); return {id:p.sub??p.id, username:p.username, role:p.role||'user'} }catch{return null}
}
const withAuth=(req,res,next)=>{const u=parseUser(req); if(!u) return res.status(401).json({error:'unauth'}); req.user=u; next()}
const requireAdmin=(req,res,next)=>{ if(req.user?.role!=='admin') return res.status(403).json({error:'forbidden'}); next() }

r.get('/admin/users', withAuth, requireAdmin, async (_req,res)=>{
  const q=await query(`SELECT id, username, role, COALESCE(wallet_balance_cents,0) AS wallet_balance_cents FROM users ORDER BY id DESC`,[])
  res.json({users:q.rows||[]})
})

r.post('/admin/users', withAuth, requireAdmin, async (req,res)=>{
  const {username,password,role}=req.body||{}
  if(!username||!password||!role) return res.status(400).json({error:'missing_fields'})
  const hash=bcrypt.hashSync(password,10)
  await query(`INSERT INTO users(username,password_hash,role,wallet_balance_cents) VALUES(?,?,?,0)`,[username,hash,role])
  const row=(await query(`SELECT id, username, role, COALESCE(wallet_balance_cents,0) AS wallet_balance_cents FROM users WHERE username=?`,[username])).rows?.[0]
  res.json({ok:true, user:row})
})

r.put('/admin/users/:id', withAuth, requireAdmin, async (req,res)=>{
  const id=Number(req.params.id)
  if(!Number.isFinite(id)) return res.status(400).json({error:'bad_id'})
  const {role, wallet_balance_cents, password}=req.body||{}
  if(password){ const hash=bcrypt.hashSync(password,10); await query(`UPDATE users SET password_hash=? WHERE id=?`,[hash,id]) }
  if(role){ await query(`UPDATE users SET role=? WHERE id=?`,[role,id]) }
  if(wallet_balance_cents!=null && wallet_balance_cents!==''){
    await query(`UPDATE users SET wallet_balance_cents=? WHERE id=?`,[Number(wallet_balance_cents)||0,id])
  }
  const row=(await query(`SELECT id, username, role, COALESCE(wallet_balance_cents,0) AS wallet_balance_cents FROM users WHERE id=?`,[id])).rows?.[0]
  res.json({ok:true, user:row})
})

export default r
