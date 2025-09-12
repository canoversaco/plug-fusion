/** Fehlertolerante Admin-API (nur Frontend) */
const STATUS_MAP = {
  offen:['offen','open','pending','neu'],
  akzeptiert:['akzeptiert','angenommen','accepted','assigned','claimed'],
  in_arbeit:['in_arbeit','in-progress','in_progress','preparing'],
  unterwegs:['unterwegs','in_transit','on_the_way'],
  abgeschlossen:['abgeschlossen','completed','delivered','finished','done']
}

function headers(){
  const h={'content-type':'application/json'}
  try{
    const t = localStorage.getItem('token')||localStorage.getItem('authToken')||localStorage.getItem('jwt')
    if (t) h['authorization']='Bearer '+t
  }catch{}
  return h
}

async function tryJSON(fetcher, url, init){
  try{
    const r = await fetcher(url, { credentials:'include', ...init })
    const text = await r.text().catch(()=>null)
    let data={}; try{ data = text ? JSON.parse(text) : {} }catch{ data = {} }
    const ok = r.ok || [200,201,204].includes(r.status) || data?.ok || data?.success || data?.status==='ok'
    return { ok, status:r.status, data, text }
  }catch(e){ return { ok:false, status:0, data:null, text:String(e) } }
}

// Helfer zum Extrahieren
const pick = (d)=> Array.isArray(d?.orders)? d.orders
  : Array.isArray(d?.data)? d.data
  : Array.isArray(d)? d
  : Array.isArray(d?.items)? d.items
  : []

export function createAdminApi(fetcher){
  const H = headers
  const api = {
    // --- Orders ---
    async listOrders(){
      const tries=['/api/admin/orders?limit=500','/api/courier/orders/all','/api/orders']
      for(const u of tries){
        const r=await tryJSON(fetcher,u)
        if(r.ok){
          let arr = pick(r.data)
          // Fallback: /api/orders könnte {orders:[...]} liefern
          if (!arr.length && Array.isArray(r.data?.orders)) arr = r.data.orders
          if (arr.length || u.endsWith('/orders')) return arr
        }
      }
      return []
    },
    async assignCourier(id, courierId){
      const body=JSON.stringify({ courier_id: courierId })
      const tries=[
        {u:`/api/admin/orders/${id}/assign`, m:'POST', b:body},
        {u:`/api/courier/orders/${id}/assign`, m:'POST', b:body},
        {u:`/api/courier/orders/${id}/claim?courier_id=${encodeURIComponent(courierId)}`, m:'POST'},
        {u:`/api/orders/${id}`, m:'PATCH', b:JSON.stringify({courier_id:courierId, status:'akzeptiert'})},
      ]
      for(const t of tries){ const r=await tryJSON(fetcher,t.u,{method:t.m,headers:H(),body:t.b}); if(r.ok) return true }
      return false
    },
    async setOrderStatus(id, logical){
      const variants = STATUS_MAP[logical] || [logical]
      for(const v of variants){
        const payload = JSON.stringify({status:v})
        const tries=[
          {u:`/api/admin/orders/${id}/status`, m:'POST', b:payload},
          {u:`/api/courier/orders/${id}/status`, m:'POST', b:payload},
          {u:`/api/orders/${id}/status`, m:'POST', b:payload},
          {u:`/api/orders/${id}`, m:'PATCH', b:payload},
        ]
        for(const t of tries){ const r=await tryJSON(fetcher,t.u,{method:t.m,headers:H(),body:t.b}); if(r.ok) return true }
      }
      return false
    },
    async setOrderEta(id, minutes){
      minutes = Math.max(0, Math.round(Number(minutes)||0))
      const body=JSON.stringify({eta_minutes:minutes})
      const tries=[
        {u:`/api/admin/orders/${id}/eta`, m:'POST', b:body},
        {u:`/api/courier/orders/${id}/eta`, m:'POST', b:body},
        {u:`/api/orders/${id}/eta`, m:'POST', b:body},
      ]
      for(const t of tries){ const r=await tryJSON(fetcher,t.u,{method:t.m,headers:H(),body:t.b}); if(r.ok) return true }
      return false
    },
    async deleteOrder(id){
      const bodyId = JSON.stringify({id})
      const tries=[
        {u:`/api/admin/orders/${id}`, m:'DELETE'},
        {u:`/api/orders/${id}`, m:'DELETE'},
        {u:`/api/admin/orders/${id}/delete`, m:'POST'},
        {u:`/api/orders/${id}/delete`, m:'POST'},
        {u:`/api/admin/orders/delete`, m:'POST', b:bodyId},
        {u:`/api/orders/delete`, m:'POST', b:bodyId},
        {u:`/api/admin/orders?id=${encodeURIComponent(id)}`, m:'DELETE'},
        {u:`/api/orders?id=${encodeURIComponent(id)}`, m:'DELETE'},
        {u:`/api/orders/${id}`, m:'PATCH', b:JSON.stringify({deleted:true})},
      ]
      for(const t of tries){ const r=await tryJSON(fetcher,t.u,{method:t.m,headers:H(),body:t.b}); if(r.ok) return true }
      return false
    },

    // --- Products ---
    async listProducts(){
      // Admin-/Catalog-Routen
      for(const u of ['/api/admin/products','/api/admin/catalog/products']){
        const r=await tryJSON(fetcher,u); if(r.ok){ const arr=pick(r.data); if(arr.length) return arr }
      }
      // Public: /api/products -> { products, categories }
      {
        const r=await tryJSON(fetcher,'/api/products')
        if(r.ok){
          if (Array.isArray(r.data?.products)) return r.data.products
          const arr = pick(r.data); if(arr.length) return arr
        }
      }
      // Weitere Fallbacks
      for(const u of ['/api/catalog/products','/api/catalog']){
        const r=await tryJSON(fetcher,u); if(r.ok){
          if (Array.isArray(r.data?.products)) return r.data.products
          const arr = pick(r.data); if(arr.length) return arr
        }
      }
      return []
    },
    async saveProduct(p){
      const body=JSON.stringify(p)
      const id=p.id || p._id
      if (id){
        for(const t of [
          {u:`/api/admin/products/${id}`, m:'PATCH', b:body},
          {u:`/api/admin/catalog/products/${id}`, m:'PATCH', b:body},
        ]){ const r=await tryJSON(fetcher,t.u,{method:t.m,headers:H(),body:t.b}); if(r.ok) return true }
      }else{
        for(const t of [
          {u:'/api/admin/products', m:'POST', b:body},
          {u:'/api/admin/catalog/products', m:'POST', b:body},
        ]){ const r=await tryJSON(fetcher,t.u,{method:t.m,headers:H(),body:t.b}); if(r.ok) return true }
      }
      return false
    },
    async deleteProduct(id){
      for(const t of [
        {u:`/api/admin/products/${id}`, m:'DELETE'},
        {u:`/api/admin/catalog/products/${id}`, m:'DELETE'},
        {u:`/api/products/${id}`, m:'DELETE'},
        {u:`/api/admin/products/${id}/delete`, m:'POST'},
        {u:`/api/admin/catalog/products/${id}/delete`, m:'POST'},
      ]){ const r=await tryJSON(fetcher,t.u,{method:t.m,headers:H()}); if(r.ok) return true }
      return false
    },

    // --- Categories ---
    async listCategories(){
      for(const u of ['/api/admin/categories','/api/categories']){
        const r=await tryJSON(fetcher,u); if(r.ok){ const arr=pick(r.data); if(arr.length) return arr }
      }
      // Public: /api/products -> { categories: [...] }
      {
        const r=await tryJSON(fetcher,'/api/products')
        if (r.ok && Array.isArray(r.data?.categories)) return r.data.categories
      }
      return []
    },
    async saveCategory(c){
      const body=JSON.stringify(c)
      if (c.id){
        for(const t of [{u:`/api/admin/categories/${c.id}`, m:'PATCH', b:body}]){ const r=await tryJSON(fetcher,t.u,{method:t.m,headers:H(),body:t.b}); if(r.ok) return true }
      }else{
        for(const t of [{u:'/api/admin/categories', m:'POST', b:body}]){ const r=await tryJSON(fetcher,t.u,{method:t.m,headers:H(),body:t.b}); if(r.ok) return true }
      }
      return false
    },
    async deleteCategory(id){
      for(const t of [{u:`/api/admin/categories/${id}`, m:'DELETE'}]){ const r=await tryJSON(fetcher,t.u,{method:t.m,headers:H()}); if(r.ok) return true }
      return false
    },

    // --- Users ---
    async listUsers(){
      for(const u of ['/api/admin/users','/api/admin/users/list','/api/users','/api/users/list','/api/admin/user']){
        const r=await tryJSON(fetcher,u); if(r.ok){
          if (Array.isArray(r.data?.users)) return r.data.users
          const arr=pick(r.data); if(arr.length || u.endsWith('/users') || u.endsWith('/user')) return arr
        }
      }
      return []
    },
    async saveUser(u){
      const body=JSON.stringify(u)
      if (u.id){
        for(const t of [{u:`/api/admin/users/${u.id}`, m:'PATCH', b:body}]){ const r=await tryJSON(fetcher,t.u,{method:t.m,headers:H(),body:t.b}); if(r.ok) return true }
      }else{
        for(const t of [{u:'/api/admin/users', m:'POST', b:body}]){ const r=await tryJSON(fetcher,t.u,{method:t.m,headers:H(),body:t.b}); if(r.ok) return true }
      }
      return false
    },
    async deleteUser(id){
      for(const t of [{u:`/api/admin/users/${id}`, m:'DELETE'},{u:`/api/admin/users/${id}/delete`, m:'POST'}]){
        const r=await tryJSON(fetcher,t.u,{method:t.m,headers:H()}); if(r.ok) return true
      }
      return false
    }
  }
  return api
}
