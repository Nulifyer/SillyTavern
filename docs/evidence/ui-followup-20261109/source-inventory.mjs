import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parse } from 'acorn';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const files = [];
function visit(dir) { for (const item of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) { const file = path.posix.join(dir, item.name); if (item.isDirectory()) visit(file); else if (/\.(js|css|html)$/.test(file)) files.push(file); } }
visit('public');
const findings = [];
for (const file of files.sort()) {
 const text = fs.readFileSync(path.join(root, file), 'utf8');
 const row = { file, bytes: Buffer.byteLength(text), lines: text.split('\n').length, sha256: crypto.createHash('sha256').update(text).digest('hex'), kind: path.extname(file).slice(1), review: 'source inventory only; no claim of manual implementation review' };
 const vendor = /\/(?:lib|vendor|dist)\//.test(file) || /\.min\.(?:js|css)$/.test(file);
 row.vendor = vendor;
 if (!vendor && row.kind === 'js') {
  row.bindings = []; row.imports = [];
  try {
   const ast = parse(text, { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowAwaitOutsideFunction: true });
   const source = n => n ? text.slice(n.start, n.end) : '';
   const walk = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ImportDeclaration') row.imports.push(node.source.value);
    if (node.type === 'CallExpression' && ['addEventListener','on','one','once','makeFirst','makeLast'].includes(node.callee.property?.name)) {
     const args = node.arguments;
     row.bindings.push({ line: node.loc.start.line, endLine: node.loc.end.line, registration: node.callee.property.name, target: source(node.callee.object), event: source(args[0]), selector: args[1]?.type === 'Literal' ? args[1].value : null, callback: source(args.at(-1)).slice(0,180), reviewed: false });
    }
    if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && /^on[a-z]+$/.test(node.left.property?.name || '')) {
     row.bindings.push({ line: node.loc.start.line, endLine: node.loc.end.line, registration: 'DOM handler assignment', target: source(node.left.object), event: node.left.property.name.slice(2), callback: source(node.right).slice(0,180), cleanup: node.right.type === 'Literal' && node.right.value === null, reviewed: false });
    }
    if (node.type === 'CallExpression' && ['click','change','input','keydown','keyup','keypress','submit','focus','blur','focusout','focusin','mousedown','mouseup','mousemove','mouseenter','mouseleave','scroll','resize'].includes(node.callee.property?.name) && node.arguments.some(n => ['FunctionExpression','ArrowFunctionExpression','Identifier'].includes(n.type))) {
     row.bindings.push({ line: node.loc.start.line, endLine: node.loc.end.line, registration: 'event shorthand candidate', target: source(node.callee.object), event: node.callee.property.name, callback: source(node.arguments.at(-1)).slice(0,180), reviewed: false });
    }
    for (const value of Object.values(node)) { if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === 'object' && value.type) walk(value); }
   };
   walk(ast); row.syntax = 'parsed';
  } catch (error) { row.syntax = error.message; }
 } else if (!vendor && row.kind === 'html') {
  row.ids = [...text.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  row.inlineHandlers = [...text.matchAll(/\bon[a-z]+\s*=\s*"([^"]+)"/gi)].map(match => match[0]);
 } else if (!vendor && row.kind === 'css') {
  row.variables = [...new Set([...text.matchAll(/(--[\w-]+)\s*:/g)].map(match => match[1]))];
 }
 findings.push(row);
}
const summary = { files: findings.length, applicationJS: findings.filter(row=>!row.vendor&&row.kind==='js').length, bindings: findings.reduce((n,row)=>n+(row.bindings?.length||0),0), css: findings.filter(row=>!row.vendor&&row.kind==='css').length, templates: findings.filter(row=>!row.vendor&&row.kind==='html').length, syntaxFailures: findings.filter(row=>row.syntax&&row.syntax!=='parsed').map(row=>({file:row.file,error:row.syntax})), claim: 'Complete public JS/CSS/HTML file inventory and static registration candidates. Dynamic/computed registrations may be absent; extraction is not manual review or interaction execution.' };
fs.writeFileSync(path.join(root,'docs/evidence/ui-followup-20261109/frontend-source-inventory.json'), JSON.stringify({ summary, files: findings }, null, 2)+'\n');
console.log(JSON.stringify(summary));
