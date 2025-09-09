import fs from 'fs';
const f='/root/plug-fusion/server/index.js';
let s=fs.readFileSync(f,'utf8');

// a) Falsch geschlossener Categories-Query:  `...`  statt  `...'`
s=s.replace(
  /(__pf_query\()\`SELECT \* FROM categories ORDER BY position ASC, id ASC',(\s*\[\]\))/,
  '$1`SELECT * FROM categories ORDER BY position ASC, id ASC`,$2'
);

// b) Falls die große Products-Abfrage noch in '...' steht und über mehrere Zeilen geht → in Backticks umwandeln
s=s.replace(
  /__pf_query\('SELECT([\s\S]*?)ORDER BY p\.id DESC([\s\S]*?)'\s*,\s*\[\]\)/g,
  (_m,a,b)=>"__pf_query(`SELECT"+a+"ORDER BY p.id DESC"+b+"`, [])"
);

fs.writeFileSync(f,s);
console.log('[fix] quotes normalized in server/index.js');
