import { Router } from 'express'
import { query } from '../db/index.js'
const r = Router()

function parseUser(req){
  if (req.user) return req.user
  const a=req.headers?.authorization||''
  if(!a.startsWith('Bearer ')) return null
  try{ const p=JSON.parse(Buffer.from(a.slice(7).split('.')[1],'base64url').toString('utf8')); return {id:p.sub??p.id, username:p.username, role:p.role||'user'} }catch{return null}
}
const withAuth=(req,res,next)=>{const u=parseUser(req); if(!u) return res.status(401).json({error:'unauth'}); req.user=u; next()}
const requireAdmin=(req,res,next)=>{ if(req.user?.role!=='admin') return res.status(403).json({error:'forbidden'}); next() }

async function one(sql, params=[]){ const q=await query(sql,params); return q.rows?.[0]||{} }

r.get('/admin/analytics/summary', withAuth, requireAdmin, async (_req,res)=>{
  const total=await one(`SELECT COALESCE(SUM(total_cents),0) AS c FROM orders WHERE IFNULL(status,'')!='storniert'`)
  const orders=await one(`SELECT COUNT(*) AS n FROM orders`)
  const customers=await one(`SELECT COUNT(DISTINCT user_username) AS n FROM orders WHERE user_username IS NOT NULL AND user_username!=''`)
  const today=await one(`SELECT COALESCE(SUM(total_cents),0) AS c FROM orders WHERE strftime('%Y-%m-%d',created_at)=strftime('%Y-%m-%d','now') AND IFNULL(status,'')!='storniert'`)
  const d7=await one(`SELECT COALESCE(SUM(total_cents),0) AS c FROM orders WHERE created_at>=datetime('now','-7 days') AND IFNULL(status,'')!='storniert'`)
  const d30=await one(`SELECT COALESCE(SUM(total_cents),0) AS c FROM orders WHERE created_at>=datetime('now','-30 days') AND IFNULL(status,'')!='storniert'`)
  const avg=(Number(total.c)||0)/Math.max(1, Number(orders.n)||0)
  res.json({revenue_cents:Number(total.c)||0, orders:Number(orders.n)||0, customers:Number(customers.n)||0, revenue_today_cents:Number(today.c)||0, revenue_7d_cents:Number(d7.c)||0, revenue_30d_cents:Number(d30.c)||0, avg_order_cents:Math.round(avg)})
})

r.get('/admin/analytics/revenue_daily', withAuth, requireAdmin, async (req,res)=>{
  const days=Math.max(1,Math.min(60,Number(req.query.days||14)))
  const q=await query(
`SELECT strftime('%Y-%m-%d', created_at) AS day,
        COALESCE(SUM(total_cents),0) AS revenue_cents,
        COUNT(*) AS orders
   FROM orders
  WHERE created_at>=datetime('now', ?) AND IFNULL(status,'')!='storniert'
  GROUP BY day ORDER BY day ASC`, [`-${days-1} days`])
  res.json({days, series:q.rows||[]})
})

r.get('/admin/analytics/top_products', withAuth, requireAdmin, async (req,res)=>{
  const limit=Math.max(1,Math.min(20,Number(req.query.limit||5)))
  const q=await query(
`SELECT name, COALESCE(SUM(qty),0) AS qty, COALESCE(SUM(price_cents*qty),0) AS revenue_cents
   FROM order_items GROUP BY name ORDER BY revenue_cents DESC LIMIT ?`, [limit])
  res.json({items:q.rows||[]})
})

export default r
