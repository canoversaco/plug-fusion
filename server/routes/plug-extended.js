import express from 'express'
import { query, tx } from '../db/index.js'
import { requireAuth, requireRole } from '../mw/authz.js'
import { subscribe, publish } from '../lib/sse.js'
import { sendFcm } from '../lib/notify.js'

export default function buildRoutes(JWT_SECRET){
  const r = express.Router()

  // --- FCM Token registrieren ---
  r.post('/register-fcm', requireAuth, async (req, res)=>{
    const { token, platform } = req.body||{}
  // --- Admin: Produkt-Highlights upsert + list ---
  r.get(/admin/product-meta, requireRole(admin), async (_req,res)=>{
    const q = await query(`SELECT p.id, p.name, m.* FROM products p LEFT JOIN product_meta m ON m.product_id=p.id ORDER BY p.id DESC`, [])
    res.json({ items: q.rows })
  })

  r.post(/admin/product-meta, requireRole(admin), async (req,res)=>{
    const { product_id, featured=0, badge_text=null, badge_color=null, highlight_title=null, highlight_desc=null, promo_until=null, sale_price_cents=null, banner_image_url=null, featured_order=0 } = req.body||{}
    if(!product_id) return res.status(400).json({ error:missing_product_id })
    await query(`INSERT INTO product_meta(product_id,featured,badge_text,badge_color,highlight_title,highlight_desc,promo_until,sale_price_cents,banner_image_url,featured_order,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?, datetime(\now))
                ON CONFLICT(product_id) DO UPDATE SET
                  featured=excluded.featured, badge_text=excluded.badge_text, badge_color=excluded.badge_color,
                  highlight_title=excluded.highlight_title, highlight_desc=excluded.highlight_desc, promo_until=excluded.promo_until,
                  sale_price_cents=excluded.sale_price_cents, banner_image_url=excluded.banner_image_url, featured_order=excluded.featured_order, updated_at=datetime(\now)`,
      [product_id|0, featured?1:0, badge_text, badge_color, highlight_title, highlight_desc, promo_until, sale_price_cents, banner_image_url, featured_order|0])
    res.json({ ok:true })
  })

    if (!token) return res.status(400).json({ error:'missing_token' })
    // user_id aus req.user.sub
    await query('INSERT INTO fcm_tokens(user_id, token, platform) VALUES (?,?,?) ON CONFLICT(token) DO NOTHING', [req.user.sub, token, platform||null])
    res.json({ ok:true })
  })

  // --- Broadcasts (Admin) ---
  r.post('/broadcasts', requireRole('admin'), async (req,res)=>{
    const { title, body, payload={} } = req.body||{}
    if (!title || !body) return res.status(400).json({ error:'missing_fields' })
    await query('INSERT INTO broadcasts(title, body, payload_json, created_by) VALUES (?,?,?,?)',
      [title, body, JSON.stringify(payload||{}), req.user.username])
    // Tokens sammeln
    const tks = await query('SELECT token FROM fcm_tokens', [])
    const serverKey = process.env.FCM_SERVER_KEY || ''
    let sent=0
    for (const row of tks.rows||[]) {
      const r = await sendFcm(serverKey, row.token, { title, body }, payload)
      if (r.ok) sent++
    }
    res.json({ ok:true, sent })
  })

  // --- Order-Status ändern + History + Push ---
  r.post('/orders/:id/status', requireAuth, async (req,res)=>{
    const id = req.params.id|0
    const { status, note } = req.body||{}
    if (!status) return res.status(400).json({ error:'missing_status' })

    // Optional: Transition-Regeln (einfach gehalten)
    const allowedByRole = {
      admin: ['wartet_bestätigung','bestätigt','unterwegs','zugestellt','abgebrochen'],
      courier: ['unterwegs','zugestellt'],
      kunde: [] // Kunde darf hier nicht
    }
    const role = req.user.role
    if (!allowedByRole[role] || !allowedByRole[role].includes(status)) return res.status(403).json({ error:'forbidden_status' })

    await tx(async (dbx)=>{
      await dbx.query('UPDATE orders SET status=?, updated_at=(datetime(\'now\')) WHERE id=?', [status, id])
      await dbx.query('INSERT INTO order_status_history(order_id,status,note,by_username) VALUES (?,?,?,?)',
        [id, status, note||null, req.user.username])
    })

    // Notify (vereinfachter Broadcast auf Chat-Channel + FCM an alle Token)
    publish(`order:${id}`, { type:'status', status, note, by:req.user.username })
    const tks = await query('SELECT token FROM fcm_tokens', [])
    const serverKey = process.env.FCM_SERVER_KEY || ''
    for (const row of tks.rows||[]) {
      await sendFcm(serverKey, row.token, { title:`Bestellung #${id}`, body:`Status: ${status}` }, { orderId:id, status })
    }

    res.json({ ok:true })
  })

  // --- Bestellung (Admin/Kurier) claimen ---
  r.post('/orders/:id/claim', requireRole('admin','courier'), async (req,res)=>{
    const id = req.params.id|0
    const courier = req.user.username
    await query('UPDATE orders SET courier_username=? WHERE id=? AND (courier_username IS NULL OR courier_username="")', [courier, id])
    res.json({ ok:true, courier })
  })

  // --- Kurier-Standort setzen + lesen ---
  r.post('/courier/location', requireRole('courier'), async (req,res)=>{
    const { lat, lng } = req.body||{}
    if (typeof lat!=='number' || typeof lng!=='number') return res.status(400).json({ error:'bad_coords' })
    await query('INSERT INTO courier_locations(courier_username,lat,lng,updated_at) VALUES (?,?,?,datetime(\'now\'))', [req.user.username, lat, lng])
    res.json({ ok:true })
  })
  r.get('/courier/location/:username', requireAuth, async (req,res)=>{
    const u = req.params.username
    const r2 = await query('SELECT courier_username, lat, lng, updated_at FROM courier_locations WHERE courier_username=? ORDER BY id DESC LIMIT 1', [u])
    res.json({ location: r2.rows?.[0]||null })
  })

  // --- CHAT: SSE Stream + Post (bestehendes /POST behalten) ---
  r.get('/orders/:id/chat/stream', requireAuth, async (req,res)=>{
    const id = req.params.id|0
    res.writeHead(200, {
      'cache-control': 'no-cache',
      'content-type': 'text/event-stream',
      'connection': 'keep-alive',
      'access-control-allow-origin': '*'
    })
    res.write('\n')
    subscribe(`order:${id}`, res)
  })

  // --- Payments: Intent + Webhook (Stub, erweiterbar) ---
  r.post('/payments/intent', requireAuth, async (req,res)=>{
    const { order_id, provider='crypto_stub', currency='EUR', amount_cents } = req.body||{}
    if (!order_id || !amount_cents) return res.status(400).json({ error:'missing_fields' })
    const r2 = await query(
      'INSERT INTO payments(order_id,provider,currency,amount_cents,status,meta_json) VALUES (?,?,?,?,?,?)',
      [order_id, provider, currency, amount_cents|0, 'pending', JSON.stringify({})]
    )
    // SQLite: keinen RETURNING → letzten Datensatz ziehen
    const p = await query('SELECT * FROM payments ORDER BY id DESC LIMIT 1', [])
    res.json({ payment: p.rows?.[0] })
  })

  r.post('/payments/webhook', async (req,res)=>{
    // Hier könnte BTCPay/Provider die Zahlung bestätigen.
    const { payment_id, status='confirmed', txid=null, meta={} } = req.body||{}
    if (!payment_id) return res.status(400).json({ error:'missing_payment_id' })
    await tx(async (dbx)=>{
      await dbx.query('UPDATE payments SET status=?, txid=?, meta_json=?, updated_at=(datetime(\'now\')) WHERE id=?',
        [status, txid, JSON.stringify(meta||{}), payment_id|0])
      await dbx.query('INSERT INTO payment_events(payment_id,type,payload_json) VALUES (?,?,?)',
        [payment_id|0, 'webhook', JSON.stringify({ status, txid, meta })])
    })
    res.json({ ok:true })
  })

  
  // --- Admin: Kategorien ---
  r.get('/admin/categories', requireRole('admin'), async (_req,res)=>{
    const q = await query('SELECT * FROM categories ORDER BY position ASC, id ASC', [])
    res.json({ categories: q.rows })
  })
  r.post('/admin/categories', requireRole('admin'), async (req,res)=>{
    const { id=null, name, position=0, active=1 } = req.body||{}
    if(!name) return res.status(400).json({ error:'missing_name' })
    if(id){
      await query('UPDATE categories SET name=?, position=?, active=? WHERE id=?',[name, position|0, active?1:0, id|0])
      const r2 = await query('SELECT * FROM categories WHERE id=?',[id|0])
      return res.json({ category: r2.rows?.[0] })
    }
    await query('INSERT INTO categories(name,position,active) VALUES (?,?,?)',[name, position|0, active?1:0])
    const r3 = await query('SELECT * FROM categories ORDER BY id DESC LIMIT 1', [])
    res.json({ category: r3.rows?.[0] })
  })
  r.delete('/admin/categories/:id', requireRole('admin'), async (req,res)=>{
    await query('DELETE FROM categories WHERE id=?',[req.params.id|0])
    res.json({ ok:true })
  })

  // --- Admin: Produkte ---
  r.get('/admin/products', requireRole('admin'), async (_req,res)=>{
    const q = await query(
      `SELECT p.*, c.name AS category_name,
              m.featured, m.badge_text, m.badge_color, m.sale_price_cents,
              m.highlight_title, m.highlight_desc, m.banner_image_url, m.featured_order
         FROM products p
         LEFT JOIN categories c ON c.id=p.category_id
         LEFT JOIN product_meta m ON m.product_id=p.id
         ORDER BY p.id DESC`, []
    )
    res.json({ products: q.rows })
  })
  r.post('/admin/products', requireRole('admin'), async (req,res)=>{
    const { id=null, category_id=null, name, price_cents=0, active=1, image_url=null, description=null } = req.body||{}
    if(!name) return res.status(400).json({ error:'missing_name' })
    if(id){
      await query('UPDATE products SET category_id=?, name=?, price_cents=?, active=?, image_url=?, description=?, updated_at=(datetime(\'now\')) WHERE id=?',
        [category_id, name, price_cents|0, active?1:0, image_url, description, id|0])
      const r2 = await query('SELECT * FROM products WHERE id=?',[id|0])
      return res.json({ product: r2.rows?.[0] })
    }
    await query('INSERT INTO products(category_id,name,price_cents,active,image_url,description) VALUES (?,?,?,?,?,?)',
      [category_id, name, price_cents|0, active?1:0, image_url, description])
    const r3 = await query('SELECT * FROM products ORDER BY id DESC LIMIT 1', [])
    res.json({ product: r3.rows?.[0] })
  })
  r.delete('/admin/products/:id', requireRole('admin'), async (req,res)=>{
    await query('DELETE FROM products WHERE id=?',[req.params.id|0])
    res.json({ ok:true })
  })

  
// --- Order-Detail + ETA + Order-spezifische Location ---
r.get('/orders/:id', requireAuth, async (req,res)=>{
  const id = req.params.id|0
  const o = await query('SELECT * FROM orders WHERE id=?', [id])
  const items = await query('SELECT * FROM order_items WHERE order_id=? ORDER BY id ASC', [id])
  res.json({ order: o.rows?.[0]||null, items: items.rows||[] })
})

r.post('/orders/:id/eta', requireRole('admin','courier'), async (req,res)=>{
  const id = req.params.id|0
  const { eta_minutes=null, eta_at=null } = req.body||{}
  let etaISO = eta_at
  if (!etaISO && typeof eta_minutes === 'number') {
    etaISO = new Date(Date.now() + eta_minutes*60000).toISOString()
  }
  await query('UPDATE orders SET eta_minutes=?, eta_at=?, updated_at=(datetime('now')) WHERE id=?',
    [eta_minutes, etaISO, id])
  publish('order:'+id, { type:'eta', eta_minutes, eta_at: etaISO })
  res.json({ ok:true, eta_at: etaISO })
})

r.post('/orders/:id/location', requireRole('admin','courier'), async (req,res)=>{
  const id = req.params.id|0
  const { lat, lng } = req.body||{}
  if (typeof lat!=='number' || typeof lng!=='number') return res.status(400).json({ error:'bad_coords' })
  await query('INSERT INTO courier_locations(courier_username,lat,lng,updated_at) VALUES (?,?,?,datetime('now'))',
    [req.user.username, lat, lng])
  publish('order:'+id, { type:'location', lat, lng, by: req.user.username, at: new Date().toISOString() })
  res.json({ ok:true })
})

  
// --- Admin: Produkt-Detail (inkl. Meta) ---
r.get('/admin/products/:id', requireRole('admin'), async (req,res)=>{
  const id = req.params.id|0
  const q = await query(
    `SELECT p.*, c.name AS category_name,
            m.featured, m.badge_text, m.badge_color, m.sale_price_cents,
            m.highlight_title, m.highlight_desc, m.banner_image_url, m.featured_order, m.promo_until
       FROM products p
       LEFT JOIN categories c ON c.id=p.category_id
       LEFT JOIN product_meta m ON m.product_id=p.id
       WHERE p.id=?`, [id]
  )
  res.json({ product: q.rows?.[0]||null })
})

  
// --- Admin: Gesamter Katalog (Produkte + Kategorien) ---
r.get('/admin/catalog', requireRole('admin'), async (_req,res)=>{
  const cats = await query('SELECT * FROM categories ORDER BY position ASC, id ASC', [])
  const prods = await query(
    `SELECT p.*, c.name AS category_name,
            m.featured, m.badge_text, m.badge_color, m.sale_price_cents,
            m.highlight_title, m.highlight_desc, m.banner_image_url, m.featured_order, m.promo_until
       FROM products p
       LEFT JOIN categories c ON c.id=p.category_id
       LEFT JOIN product_meta m ON m.product_id=p.id
       ORDER BY p.id DESC`, []
  )
  res.json({ categories: cats.rows || [], products: prods.rows || [] })
})

  
// --- Direct Messages (Kunde -> Admin/Kurier) ---
r.get('/dm/recipients', requireAuth, async (_req,res)=>{
  const q = await query("SELECT username, role FROM users WHERE role IN ('admin','courier') ORDER BY role ASC, username ASC", [])
  res.json({ recipients: q.rows || [] })
})

r.get('/dm/inbox', requireAuth, async (req,res)=>{
  const u = req.user.username
  const q = await query(
    "SELECT * FROM dm_messages WHERE sender_username = ? OR recipient_username = ? ORDER BY id DESC LIMIT 100",
    [u, u]
  )
  res.json({ messages: q.rows || [] })
})

r.post('/dm/send', requireAuth, async (req,res)=>{
  const { recipient_username, body } = req.body || {}
  const sender = req.user.username
  if (!recipient_username || !body) return res.status(400).json({ error:'missing_fields' })
  const a = [ sender, recipient_username, body ]
  await query(
    "INSERT INTO dm_messages(sender_username,recipient_username,body,created_at) VALUES (?,?,?,datetime('now'))",
    a
  )
  res.json({ ok:true })
})

  
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

  
  // Inventory
  r.get('/inventory', requireAuth, async (req,res)=>{
    const u = req.user.username
    const inv = await query('SELECT * FROM user_inventory WHERE username=? ORDER BY id DESC',[u])
    res.json({ items: inv.rows||[] })
  })

  
  r.get('/my/orders', requireAuth, async (req,res)=>{
    const u = req.user.username
    const o = await query('SELECT * FROM orders WHERE user_username=? ORDER BY id DESC LIMIT 100',[u])
    res.json({ orders: o.rows||[] })
  })

  
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
    const ping = setInterval(()=>{ try{ res.write('event: ping\n'+'data: {}\n\n') }catch(e){} }, 15000)
    const onMsg = (m)=>{ try{ res.write('data: '+JSON.stringify(m)+'\n\n') }catch(e){} }
    const ch = 'order:'+ (Number(_req.params.id|0))
    const unsub = subscribe ? subscribe(ch, onMsg) : ()=>{}
    req.on('close', ()=>{ clearInterval(ping); try{ unsub() }catch(e){} })
  })

  
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

  return r
}

  // helper: safe publish
  const safePublish = (channel, payload)=>{ try{ publish && publish(channel, payload) }catch(e){} }
