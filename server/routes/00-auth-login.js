import { Router } from 'express'
import { query } from '../db/index.js'
import * as JWTNS from 'jsonwebtoken'
import * as B from 'bcryptjs'
const jwt = JWTNS.default || JWTNS
const SECRET = process.env.JWT_SECRET || 'plug_fusion_dev'

const r = Router()

// /api/login — vergleicht bcrypt password_hash (Fallback: Plaintext 'password' falls vorhanden)
r.post('/login', async (req,res)=>{
  const { username, password } = req.body||{}
  if (!username || !password) return res.status(400).json({ error:'missing_credentials' })
  try{
    const ures = await query(`SELECT id, username, role, password_hash, wallet_balance_cents FROM users WHERE username=? LIMIT 1`, [username])
    const u = ures.rows?.[0]
    if (!u) return res.status(401).json({ error:'invalid_login' })

    let ok = false;
if (u.password_hash) { ok = await B.compare(password, u.password_hash) }
if (!ok) return res.status(401).json({ error:'invalid_login' })

    const token = jwt.sign({ sub:u.id, username:u.username, role:u.role }, SECRET, { algorithm:'HS256', expiresIn:'7d' })
    res.json({ token, user: { id:u.id, username:u.username, role:u.role, wallet_balance_cents:u.wallet_balance_cents||0 } })
  }catch(e){
    console.error('[login]', e?.message||e)
    res.status(500).json({ error:'login_failed' })
  }
})

// /api/_whoami — nützlich zum Debug
r.get('/_whoami', (req,res)=>{
  const hdr = req.headers?.authorization || ''
  if (!hdr.startsWith('Bearer ')) return res.status(401).json({error:'unauth'})
  try{
    const p = jwt.verify(hdr.slice(7), SECRET)
    res.json({ user: { id:p.sub, username:p.username, role:p.role } })
  }catch{
    res.status(401).json({ error:'unauth' })
  }
})

export default r
