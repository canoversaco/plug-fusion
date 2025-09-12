import 'dotenv/config'
import { query } from '../db/index.js'

const cats = [
  { name:'Snacks', position:1, active:1 },
  { name:'Getränke', position:2, active:1 },
  { name:'Specials', position:3, active:1 },
  { name:'Süßes', position:4, active:1 },
  { name:'Basics', position:5, active:1 }
]

const prod = [
  { name:'Crunchy Chips', category:'Snacks', price_cents:299, image_url:'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=1200&q=80', description:'Knusprig & salzig.' },
  { name:'Nuss-Mix', category:'Snacks', price_cents:399, image_url:'https://images.unsplash.com/photo-1604908176997-4310ba462e8f?w=1200&q=80', description:'Geröstet, leicht gesalzen.' },
  { name:'Cold Brew', category:'Getränke', price_cents:349, image_url:'https://images.unsplash.com/photo-1517705008128-361805f42e86?w=1200&q=80', description:'Sanft, koffeinreich.' },
  { name:'Matcha Latte', category:'Getränke', price_cents:399, image_url:'https://images.unsplash.com/photo-1515825838458-c93618b8200d?w=1200&q=80', description:'Erfrischend grün.' },
  { name:'Chef’s Bowl', category:'Specials', price_cents:899, image_url:'https://images.unsplash.com/photo-1550547660-d9450f859349?w=1200&q=80', description:'Saisonal & ausgewogen.' },
  { name:'Truffle Fries', category:'Specials', price_cents:649, image_url:'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=1200&q=80', description:'Mit Trüffelöl & Parmesan.' },
  { name:'Brownie', category:'Süßes', price_cents:299, image_url:'https://images.unsplash.com/photo-1606313564200-e75d5e30476b?w=1200&q=80', description:'Fudgy & reichhaltig.' },
  { name:'Cheesecake', category:'Süßes', price_cents:349, image_url:'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=1200&q=80', description:'Cremig, mit Keksboden.' },
  { name:'Baguette', category:'Basics', price_cents:199, image_url:'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=1200&q=80', description:'Frisch gebacken.' },
  { name:'Bio-Eier (6er)', category:'Basics', price_cents:399, image_url:'https://images.unsplash.com/photo-1517957741211-4aa3f3d7d4af?w=1200&q=80', description:'Regional und frei laufend.' }
]

async function run(){
  // Kategorien
  for(const c of cats){
    const ex = await query('SELECT id FROM categories WHERE name=? LIMIT 1',[c.name])
    if(!ex.rows?.length){
      await query('INSERT INTO categories(name,position,active) VALUES (?,?,?)',[c.name, c.position, c.active])
    }
  }
  const allc = await query('SELECT id, name FROM categories', [])
  const map = new Map(allc.rows.map(r => [r.name, r.id]))

  // Produkte
  for(const p of prod){
    const cid = map.get(p.category); if(!cid) continue
    const ex = await query('SELECT id FROM products WHERE name=? LIMIT 1',[p.name])
    if(!ex.rows?.length){
      await query('INSERT INTO products(category_id,name,price_cents,active,image_url,description) VALUES (?,?,?,?,?,?)',
        [cid, p.name, p.price_cents, 1, p.image_url, p.description])
    }
  }
  console.log('[seed] demo catalog OK')
}
run().then(()=>process.exit(0)).catch(e=>{ console.error(e?.message); process.exit(1) })
