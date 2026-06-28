// READ-ONLY: verify how the app's matchThirds heuristic assigns the 8 real
// qualifying thirds to the R32 "third" slots, vs FIFA's official assignment.
// No DB, no writes.
import { matchThirds } from '../server/utils/bracket'

// The 8 real qualifying thirds (groups), per the live FIFA bracket:
// B Bosnia, D Paraguay, E Ecuador, F Suecia, I Senegal, K RD Congo, L Ghana,
// + Group J's third (Austria or Algeria, decided by the live J-5 match).
const thirds = [
  { group: 'B', name: 'Bosnia y Herzegovina' },
  { group: 'D', name: 'Paraguay' },
  { group: 'E', name: 'Ecuador' },
  { group: 'F', name: 'Suecia' },
  { group: 'I', name: 'Senegal' },
  { group: 'J', name: '3ºJ (Austria/Argelia)' },
  { group: 'K', name: 'RD Congo' },
  { group: 'L', name: 'Ghana' },
]

// Slots exactly as seed.ts defines them (code + allowed groups), in R32 code order.
const slots = [
  { key: 'R32-01:away', groups: ['A', 'B', 'C', 'D', 'F'] },
  { key: 'R32-02:away', groups: ['C', 'D', 'F', 'G', 'H'] },
  { key: 'R32-07:away', groups: ['B', 'E', 'F', 'I', 'J'] },
  { key: 'R32-08:away', groups: ['A', 'E', 'H', 'I', 'J'] },
  { key: 'R32-11:away', groups: ['C', 'E', 'F', 'H', 'I'] },
  { key: 'R32-12:away', groups: ['E', 'H', 'I', 'J', 'K'] },
  { key: 'R32-15:away', groups: ['E', 'F', 'G', 'I', 'J'] },
  { key: 'R32-16:away', groups: ['D', 'E', 'I', 'J', 'L'] },
]

const got = matchThirds(thirds, slots)

// FIFA's real assignment (from the live Sky Sports / official bracket):
const real: Record<string, string> = {
  'R32-01:away': 'D', // Paraguay
  'R32-02:away': 'F', // Suecia
  'R32-07:away': 'B', // Bosnia
  'R32-08:away': 'I', // Senegal
  'R32-11:away': 'E', // Ecuador
  'R32-12:away': 'K', // RD Congo
  'R32-15:away': 'J', // Group J third
  'R32-16:away': 'L', // Ghana
}

const groupOf = new Map(thirds.map((t) => [t.name, t.group]))
console.log('slot         app-assigns           (grp)  real(grp)  match?')
for (const s of slots) {
  const name = got[s.key]
  const g = name ? groupOf.get(name) : '—'
  const r = real[s.key]
  const ok = g === r ? 'OK' : '*** MISMATCH ***'
  console.log(`${s.key.padEnd(12)} ${(name||'—').padEnd(22)} ${String(g).padEnd(5)}  ${r.padEnd(8)}  ${ok}`)
}
