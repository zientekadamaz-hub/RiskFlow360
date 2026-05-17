const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pfd', 'page.tsx'), 'utf8')
const navSource = fs.readFileSync(path.join(root, 'src', 'features', 'pfd', 'pfd-right-nav.tsx'), 'utf8')

assert.match(navSource, /export function PfdRightNav/, 'PFD right navigation component must be exported.')
assert.match(navSource, /href=\{`\/pfmea\?project=\$\{props\.projectId\}`\}/, 'PFD right navigation must preserve PFMEA link.')
assert.match(navSource, /href=\{`\/pcp\?project=\$\{props\.projectId\}`\}/, 'PFD right navigation must preserve PCP link.')
assert.match(navSource, /width: 180/, 'PFD right navigation must preserve button width.')

assert.match(pageSource, /import \{ PfdRightNav \}/, 'PFD page must import right navigation component.')
assert.match(pageSource, /<PfdRightNav projectId=\{projectId\} \/>/, 'PFD page must delegate right navigation rendering.')
assert.doesNotMatch(pageSource, /href=\{`\/pfmea\?project=\$\{projectId\}`\}/, 'PFD page should not own PFMEA right-nav link JSX after extraction.')

console.log('pfd right nav smoke passed')
