const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', '..')
const pageSource = fs.readFileSync(path.join(root, 'app', 'pfd', 'page.tsx'), 'utf8')
const stylesSource = fs.readFileSync(path.join(root, 'src', 'features', 'pfd', 'pfd-page-styles.ts'), 'utf8')
const paletteSource = fs.readFileSync(path.join(root, 'src', 'features', 'pfd', 'pfd-symbol-palette.tsx'), 'utf8')

assert.match(stylesSource, /export const SURFACE_RADIUS = 8/, 'PFD surface radius must remain standardized.')
assert.match(stylesSource, /export const SURFACE_BG = 'rgba\(255,255,255,0\.08\)'/, 'PFD surface background must be preserved.')
assert.match(stylesSource, /export const baseBtn/, 'PFD base button style must be exported.')
assert.match(stylesSource, /export function th/, 'PFD mini PFMEA table header style helper must be exported.')
assert.match(stylesSource, /export function td/, 'PFD mini PFMEA table cell style helper must be exported.')

assert.match(paletteSource, /export function PaletteButton/, 'PFD palette button must be exported.')
assert.match(paletteSource, /SURFACE_BG_STRONG/, 'PFD palette button must preserve strong surface background.')
assert.match(paletteSource, /export function ThumbOperation/, 'PFD operation thumbnail must be available for later palette extraction.')

assert.match(pageSource, /from '@\/features\/pfd\/pfd-page-styles'/, 'PFD page must import shared PFD styles.')
assert.match(pageSource, /from '@\/features\/pfd\/pfd-symbol-palette'/, 'PFD page must import palette button.')
assert.doesNotMatch(pageSource, /function PaletteButton/, 'PFD page should not define PaletteButton after extraction.')
assert.doesNotMatch(pageSource, /const baseBtn: React\.CSSProperties/, 'PFD page should not define base button style after extraction.')

console.log('pfd page style extraction smoke passed')
