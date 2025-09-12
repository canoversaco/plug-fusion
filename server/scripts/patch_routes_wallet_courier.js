import fs from 'fs'
import path from 'path'
const file = path.join(process.argv[2], 'routes', 'plug-extended.js')
if (!fs.existsSync(file)) { console.log('[patch] routes/plug-extended.js fehlt'); process.exit(0) }
let s = fs.readFileSync(file,'utf8')
const has = (m)=> s.includes(m)
const inj = (code, marker)=>{
  if (has(marker)) return
  const needle = 'return r'
  const i = s.lastIndexOf(needle)
  s = (i===-1) ? (s + '\n' + code + '\n') : (s.slice(0,i) + code + '\n  ' + s.slice(i))
}

// ---- Helpers (falls publish nicht existiert, noop) ----
const helperBlock = `
  // helper: safe publish
  const safePublish = (channel, payload)=>{ try{ publish && publish(channel, payload) }catch(e){} }
`

if (!has('safePublish(')) {
  const i = s.indexOf('export function')
  s = s.slice(0, i>0?i:s.length) + helperBlock + (i>0? s.slice(i) : '')
}

// ---- WALLET ----
inj(`
  // Wallet: Balance + Ledger
  r.get('/wallet', requireAuth, async (req,res)=>{
    const u = req.user.username
    const bal = await query('SELECT wallet_balance_cents FROM users WHERE username=?',[u])
    const led = await query('SELECT * FROM wallet_ledger WHERE username=? ORDER BY id DESC LIMIT 50',[u])
    res.json({ balance_cents: bal.rows?.[0]?.wallet_balance_cents||0, ledger: led.rows||[] })
  })
  r.post('/wallet/topup', requireAuth, async (req,res)=>{
    const u = req.user.username; const amt = Number(req.body?.amount_cents||0)|0
    if (amt<=0) return res.status(400).json({ error:'bad_amount' })
    await query('UPDATE users SET wallet_balance_cents = COALESCE(wallet_balance_cents,0) + ? WHERE username=?',[amt,u])
    await query('INSERT INTO wallet_ledger(username,delta_cents,reason) VALUES (?,?,?)',[u, amt, 'topup'])
    const bal = await query('SELECT wallet_balance_cents FROM users WHERE username=?',[u])
    res.json({ ok:true, balance_cents: bal.rows?.[0]?.wallet_balance_cents||0 })
  })
  r.post('/wallet/spend', requireAuth, async (req,res)=>{
    const u = req.user.username; const amt = Number(req.body?.amount_cents||0)|0
    if (amt<=0) return res.status(400).json({ error:'bad_amount' })
    const cur = await query('SELECT wallet_balance_cents FROM users WHERE username=?',[u])
    const bal = cur.rows?.[0]?.wallet_balance_cents||0
    if (bal < amt) return res.status(400).json({ error:'insufficient_funds' })
    await query('UPDATE users SET wallet_balance_cents = wallet_balance_cents - ? WHERE username=?',[amt,u])
    await query('INSERT INTO wallet_ledger(username,delta_cents,reason) VALUES (?,?,?)',[u, -amt, 'spend'])
    const now = await query('SELECT wallet_balance_cents FROM users WHERE username=?',[u])
    res.json({ ok:true, balance_cents: now.rows?.[0]?.wallet_balance_cents||0 })
  })
`, "/wallet', requireAuth")

// ---- INVENTORY ----
inj(`
  // Inventory
  r.get('/inventory', requireAuth, async (req,res)=>{
    const u = req.user.username
    const inv = await query('SELECT * FROM user_inventory WHERE username=? ORDER BY id DESC',[u])
    res.json({ items: inv.rows||[] })
  })
`, "/inventory', requireAuth")

// ---- ORDERS LIST (user) ----
inj(`
  r.get('/my/orders', requireAuth, async (req,res)=>{
    const u = req.user.username
    const o = await query('SELECT * FROM orders WHERE user_username=? ORDER BY id DESC LIMIT 100',[u])
    res.json({ orders: o.rows||[] })
  })
`, "/my/orders', requireAuth")

// ---- COURIER ----
inj(`
  r.get('/courier/queue', requireRole('courier','admin'), async (_req,res)=>{
    const q = await query("SELECT * FROM orders WHERE (courier_username IS NULL OR courier_username='') AND status IN ('wartet_bestätigung','bestätigt') ORDER BY id ASC",[])
    res.json({ orders: q.rows||[] })
  })
  r.get('/courier/my', requireRole('courier','admin'), async (req,res)=>{
    const u = req.user.username
    const q = await query('SELECT * FROM orders WHERE courier_username=? ORDER BY id DESC',[u])
    res.json({ orders: q.rows||[] })
  })
  r.post('/orders/:id/claim', requireRole('courier','admin'), async (req,res)=>{
    const id = req.params.id|0; const u = req.user.username
    await query("UPDATE orders SET courier_username=? WHERE id=? AND (courier_username IS NULL OR courier_username='')",[u,id])
    safePublish('order:'+id,{ type:'courier', courier_username:u })
    res.json({ ok:true })
  })
`, "/courier/queue'")

// ---- CHAT pro Bestellung ----
inj(`
  r.get('/orders/:id/chat', requireAuth, async (req,res)=>{
    const id = req.params.id|0
    const q = await query('SELECT * FROM order_chat WHERE order_id=? ORDER BY id ASC',[id])
    res.json({ messages: q.rows||[] })
  })
  r.post('/orders/:id/chat', requireAuth, async (req,res)=>{
    const id = req.params.id|0
    const { ciphertext, iv='-', recipient_username=null } = req.body||{}
    if (!ciphertext) return res.status(400).json({ error:'missing_ciphertext' })
    await query('INSERT INTO order_chat(order_id,sender_username,recipient_username,ciphertext,iv) VALUES (?,?,?,?,?)',
      [id, req.user.username, recipient_username, ciphertext, iv])
    safePublish('order:'+id, { type:'chat', by:req.user.username })
    res.json({ ok:true })
  })
  r.get('/orders/:id/chat/stream', (_req,res)=>{
    res.setHeader('content-type','text/event-stream'); res.setHeader('cache-control','no-cache'); res.flushHeaders?.()
    const ping = setInterval(()=>{ try{ res.write('event: ping\\n'+'data: {}\\n\\n') }catch(e){} }, 15000)
    const onMsg = (m)=>{ try{ res.write('data: '+JSON.stringify(m)+'\\n\\n') }catch(e){} }
    const ch = 'order:'+ (Number(_req.params.id|0))
    const unsub = subscribe ? subscribe(ch, onMsg) : ()=>{}
    req.on('close', ()=>{ clearInterval(ping); try{ unsub() }catch(e){} })
  })
`, "/orders/:id/chat', requireAuth")

// ---- ADMIN extra: orders & users ----
inj(`
  r.get('/admin/orders', requireRole('admin'), async (_req,res)=>{
    const q = await query('SELECT * FROM orders ORDER BY id DESC LIMIT 200',[])
    res.json({ orders: q.rows||[] })
  })
  r.get('/admin/users', requireRole('admin'), async (_req,res)=>{
    const q = await query('SELECT id, username, role, wallet_balance_cents FROM users ORDER BY username ASC',[])
    res.json({ users: q.rows||[] })
  })
  r.post('/admin/users/wallet', requireRole('admin'), async (req,res)=>{
    const { username, delta_cents=0, reason=null } = req.body||{}
    if (!username || !Number.isFinite(delta_cents)) return res.status(400).json({ error:'bad_fields' })
    await query('UPDATE users SET wallet_balance_cents = COALESCE(wallet_balance_cents,0) + ? WHERE username=?',[delta_cents|0, username])
    await query('INSERT INTO wallet_ledger(username,delta_cents,reason) VALUES (?,?,?)',[username, delta_cents|0, reason||'admin'])
    res.json({ ok:true })
  })
  r.post('/admin/users/grant-item', requireRole('admin'), async (req,res)=>{
    const { username, item_name, qty=1, meta={} } = req.body||{}
    if (!username || !item_name) return res.status(400).json({ error:'bad_fields' })
    await query('INSERT INTO user_inventory(username,item_name,qty,meta_json) VALUES (?,?,?,?)',[username, item_name, qty|0, JSON.stringify(meta||{})])
    res.json({ ok:true })
  })
`, "/admin/users', requireRole('admin')")
fs.writeFileSync(file, s)
console.log('[patch] wallet/courier/chat/admin routes OK')
