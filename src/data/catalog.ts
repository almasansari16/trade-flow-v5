import type { Brand, Product } from '@/types/domain'

/** Fictional brands — no relation to any real fragrance house. */
export const brands: Brand[] = [
  { id: 'b-velour', name: 'Maison Velour', origin: 'France', hue: 262 },
  { id: 'b-oud', name: 'Oud Atelier', origin: 'United Arab Emirates', hue: 28 },
  { id: 'b-noire', name: 'Lumière Noire', origin: 'France', hue: 330 },
  { id: 'b-cedar', name: 'Cedar & Saffron', origin: 'United Kingdom', hue: 160 },
  { id: 'b-aurelle', name: 'Aurelle', origin: 'Italy', hue: 205 },
]

type Seed = [id: string, sku: string, name: string, brandId: string, category: Product['category'], ml: number, usd: number, qty: number, casePack: number, bottle: Product['bottle'], notes: string, isNew?: boolean]

const seeds: Seed[] = [
  ['p-01', 'MV-EDP-100-AMB', 'Ambre Velours', 'b-velour', 'Eau de Parfum', 100, 68, 1840, 6, 'tall', 'Amber, vanilla, tonka'],
  ['p-02', 'MV-EDP-100-IRS', 'Iris Poudré', 'b-velour', 'Eau de Parfum', 100, 72, 960, 6, 'tall', 'Iris, violet leaf, musk'],
  ['p-03', 'MV-EXT-50-ROS', 'Rose Absolue Extrait', 'b-velour', 'Extrait de Parfum', 50, 94, 120, 6, 'square', 'Damask rose, oud, saffron', true],
  ['p-04', 'MV-BM-200-AMB', 'Ambre Velours Body Mist', 'b-velour', 'Body Mist', 200, 22, 3200, 12, 'round', 'Light amber veil'],
  ['p-05', 'OA-EDP-100-ROY', 'Royal Oud', 'b-oud', 'Eau de Parfum', 100, 82, 1420, 6, 'square', 'Agarwood, leather, rose'],
  ['p-06', 'OA-EXT-75-MSK', 'Musk Al Layl Extrait', 'b-oud', 'Extrait de Parfum', 75, 110, 0, 6, 'square', 'White musk, ambergris'],
  ['p-07', 'OA-EDP-100-SAF', 'Saffron Dunes', 'b-oud', 'Eau de Parfum', 100, 76, 640, 6, 'tall', 'Saffron, cedar, incense'],
  ['p-08', 'OA-HF-250-BKH', 'Bakhoor Home Diffuser', 'b-oud', 'Home Fragrance', 250, 38, 780, 6, 'jar', 'Oud, sandalwood, resin'],
  ['p-09', 'OA-GS-3PC-RYL', 'Royal Discovery Set', 'b-oud', 'Gift Set', 30, 54, 410, 4, 'box', '3 × 10 ml travel sprays'],
  ['p-10', 'LN-EDP-90-NOC', 'Nocturne', 'b-noire', 'Eau de Parfum', 90, 79, 1100, 6, 'round', 'Black plum, patchouli, cocoa'],
  ['p-11', 'LN-EDP-90-ECL', 'Éclat de Minuit', 'b-noire', 'Eau de Parfum', 90, 84, 85, 6, 'round', 'Bergamot, black pepper, vetiver'],
  ['p-12', 'LN-EDT-100-SOL', 'Solstice', 'b-noire', 'Eau de Toilette', 100, 52, 2100, 6, 'tall', 'Neroli, fig, sea salt'],
  ['p-13', 'LN-EXT-50-VEL', 'Velvet Smoke Extrait', 'b-noire', 'Extrait de Parfum', 50, 118, 260, 6, 'square', 'Birch tar, labdanum, vanilla', true],
  ['p-14', 'CS-EDP-100-CDR', 'Atlas Cedar', 'b-cedar', 'Eau de Parfum', 100, 64, 1320, 6, 'tall', 'Atlas cedar, cardamom'],
  ['p-15', 'CS-EDP-100-SFR', 'Saffron Tea', 'b-cedar', 'Eau de Parfum', 100, 66, 920, 6, 'tall', 'Black tea, saffron, honey'],
  ['p-16', 'CS-EDT-100-GRN', 'Green Fig Leaf', 'b-cedar', 'Eau de Toilette', 100, 48, 1750, 6, 'round', 'Fig leaf, galbanum, mint'],
  ['p-17', 'CS-HF-200-LIB', 'Library Candle', 'b-cedar', 'Home Fragrance', 200, 34, 0, 6, 'jar', 'Old paper, cedar, leather'],
  ['p-18', 'AU-EDP-100-BRG', 'Bergamotto di Capri', 'b-aurelle', 'Eau de Parfum', 100, 70, 1560, 6, 'round', 'Bergamot, lemon blossom'],
  ['p-19', 'AU-EDP-100-NRL', 'Neroli Riviera', 'b-aurelle', 'Eau de Parfum', 100, 74, 140, 6, 'round', 'Neroli, orange flower, musk'],
  ['p-20', 'AU-EDT-50-MAR', 'Acqua Marina', 'b-aurelle', 'Eau de Toilette', 50, 39, 2600, 12, 'tall', 'Marine accord, sage'],
  ['p-21', 'AU-GS-2PC-SUM', 'Summer Duo Gift Set', 'b-aurelle', 'Gift Set', 150, 88, 300, 4, 'box', 'EDP 100 ml + EDT 50 ml', true],
  ['p-22', 'MV-EDP-50-AMB', 'Ambre Velours 50 ml', 'b-velour', 'Eau de Parfum', 50, 46, 2200, 6, 'tall', 'Amber, vanilla, tonka'],
]

function stockStatus(qty: number, sku: string): Product['stockStatus'] {
  if (sku === 'OA-EXT-75-MSK') return 'Pre-order'
  if (qty === 0) return 'Out of Stock'
  if (qty < 300) return 'Low Stock'
  return 'In Stock'
}

export const products: Product[] = seeds.map(([id, sku, name, brandId, category, sizeMl, unitPriceUsd, availableQty, casePack, bottle, notes, isNew]) => ({
  id,
  sku,
  name,
  brandId,
  category,
  sizeMl,
  unitPriceUsd,
  availableQty,
  casePack,
  bottle,
  notes,
  isNew,
  stockStatus: stockStatus(availableQty, sku),
  /** Product ↔ SAP material mapping (deliberately not equal to the SKU). */
  sapMaterial: `FG${String(100000 + Number(id.slice(2)))}`,
  uom: category === 'Gift Set' ? 'SET' : 'EA',
  stockUom: category === 'Gift Set' ? 'SET' : 'EA',
  description: describe(category, sizeMl, notes),
}))

function describe(category: Product['category'], ml: number, notes: string) {
  const size = category === 'Gift Set' ? '' : ` · ${ml} ml`
  return `${category}${size}. Notes: ${notes}. Case pack applies; sold per ${category === 'Gift Set' ? 'set' : 'unit'}.`
}

export const CATEGORIES: Product['category'][] = [
  'Eau de Parfum',
  'Extrait de Parfum',
  'Eau de Toilette',
  'Body Mist',
  'Home Fragrance',
  'Gift Set',
]
