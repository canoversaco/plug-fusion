import fs from 'fs';
const f = '/root/plug-fusion/server/index.js';
let s = fs.readFileSync(f,'utf8');

// 1) Pfade, die komplett in Backticks stehen → in '...'
s = s.replace(/(\b(?:app|r)\.(?:get|post|put|delete)\()\`([^`]+?)\`/g, "$1'$2'");

// 2) Gemischt: startet mit ` und endet mit '  → beides zu '
s = s.replace(/(\b(?:app|r)\.(?:get|post|put|delete)\()\`([^']+?)'/g, "$1'$2'");

// 3) Gemischt: startet mit ' und endet mit `  → beides zu '
s = s.replace(/(\b(?:app|r)\.(?:get|post|put|delete)\('([^`]+?)\`/g, "$1'$2'");

// 4) Falls irgendwo noch ein ` in einem /api-Pfad hängt, ersetze ihn
s = s.replace(/`\/api/g, "'/api").replace(/\/api[^'")]*`/g, m => m.replace(/`/g,"'"));

fs.writeFileSync(f,s,'utf8');
console.log('[fix] route quotes normalized');
