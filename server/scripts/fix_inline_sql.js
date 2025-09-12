import fs from 'fs'
const file = '/root/plug-fusion/server/index.js'
let s = fs.readFileSync(file,'utf8')

// Ersetze mehrzeilige SQL-Strings der Produkte-Abfrage von '...' -> `...`
const re = /'SELECT[\s\S]*?FROM products p[\s\S]*?ORDER BY p\.id DESC[\s\S]*?'/m
if (re.test(s)) {
  s = s.replace(re, (m)=>'`'+m.slice(1,-1)+'`')
  fs.writeFileSync(file, s, 'utf8')
  console.log('[fix] Mehrzeiliger SQL-String auf Backticks umgestellt.')
} else {
  console.log('[info] Kein passender mehrzeiliger SQL-String gefunden – nichts geändert.')
}
