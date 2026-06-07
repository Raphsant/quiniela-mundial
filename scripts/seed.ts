/**
 * Seeds the 72 group-stage matches of the 2026 World Cup.
 * Run with:  npx tsx scripts/seed.ts
 *
 * Teams reflect the final draw. Fixtures, dates, kickoff times and venues are
 * the official FIFA schedule (June 11–27, 2026), sourced from published
 * schedules. Kickoff times are entered in US Eastern Time (ET = EDT/UTC−4 in
 * June) and converted to an absolute UTC instant; each venue also carries its
 * IANA timezone so the UI can show the true local kickoff.
 *
 * Note: a handful of exact minute values may still be refined by FIFA — verify
 * against fifa.com before launch, since the prediction lock keys off kickoffAt.
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { Match } from '../server/models/Match'

const GROUPS: Record<string, string[]> = {
  A: ['México', 'Corea del Sur', 'Sudáfrica', 'Chequia'],
  B: ['Canadá', 'Suiza', 'Catar', 'Bosnia y Herzegovina'],
  C: ['Brasil', 'Marruecos', 'Escocia', 'Haití'],
  D: ['Estados Unidos', 'Australia', 'Paraguay', 'Turquía'],
  E: ['Alemania', 'Ecuador', 'Costa de Marfil', 'Curazao'],
  F: ['Países Bajos', 'Japón', 'Túnez', 'Suecia'],
  G: ['Bélgica', 'Irán', 'Egipto', 'Nueva Zelanda'],
  H: ['España', 'Uruguay', 'Arabia Saudita', 'Cabo Verde'],
  I: ['Francia', 'Senegal', 'Noruega', 'Irak'],
  J: ['Argentina', 'Austria', 'Argelia', 'Jordania'],
  K: ['Portugal', 'Colombia', 'Uzbekistán', 'RD Congo'],
  L: ['Inglaterra', 'Croacia', 'Panamá', 'Ghana'],
}

// The 16 host venues, keyed; each with its IANA timezone (June 2026).
// Mexico abolished DST (2022) → UTC−6 year-round; US/Canada are on summer time.
const V = {
  Azteca: { stadium: 'Estadio Azteca', city: 'Ciudad de México', tz: 'America/Mexico_City' },
  Akron: { stadium: 'Estadio Akron', city: 'Guadalajara', tz: 'America/Mexico_City' },
  BBVA: { stadium: 'Estadio BBVA', city: 'Monterrey', tz: 'America/Monterrey' },
  BMO: { stadium: 'BMO Field', city: 'Toronto', tz: 'America/Toronto' },
  BCPlace: { stadium: 'BC Place', city: 'Vancouver', tz: 'America/Vancouver' },
  MetLife: { stadium: 'MetLife Stadium', city: 'Nueva York / Nueva Jersey', tz: 'America/New_York' },
  SoFi: { stadium: 'SoFi Stadium', city: 'Los Ángeles', tz: 'America/Los_Angeles' },
  ATT: { stadium: 'AT&T Stadium', city: 'Dallas', tz: 'America/Chicago' },
  MercedesBenz: { stadium: 'Mercedes-Benz Stadium', city: 'Atlanta', tz: 'America/New_York' },
  NRG: { stadium: 'NRG Stadium', city: 'Houston', tz: 'America/Chicago' },
  Arrowhead: { stadium: 'Arrowhead Stadium', city: 'Kansas City', tz: 'America/Chicago' },
  HardRock: { stadium: 'Hard Rock Stadium', city: 'Miami', tz: 'America/New_York' },
  Lincoln: { stadium: 'Lincoln Financial Field', city: 'Filadelfia', tz: 'America/New_York' },
  Levis: { stadium: "Levi's Stadium", city: 'Bahía de San Francisco', tz: 'America/Los_Angeles' },
  Lumen: { stadium: 'Lumen Field', city: 'Seattle', tz: 'America/Los_Angeles' },
  Gillette: { stadium: 'Gillette Stadium', city: 'Boston', tz: 'America/New_York' },
}
type VenueKey = keyof typeof V

// Official fixtures, in matchday order (2 per matchday → "Jornada" = ceil(n/2)).
// Tuple: [group, dayInJune, kickoffET ("HH:MM", 24h Eastern), home, away, venue]
const FIXTURES: [string, number, string, string, string, VenueKey][] = [
  // Group A
  ['A', 11, '15:00', 'México', 'Sudáfrica', 'Azteca'],
  ['A', 11, '22:00', 'Corea del Sur', 'Chequia', 'Akron'],
  ['A', 18, '12:00', 'Chequia', 'Sudáfrica', 'MercedesBenz'],
  ['A', 18, '21:00', 'México', 'Corea del Sur', 'Akron'],
  ['A', 24, '21:00', 'Chequia', 'México', 'Azteca'],
  ['A', 24, '21:00', 'Sudáfrica', 'Corea del Sur', 'BBVA'],
  // Group B
  ['B', 12, '15:00', 'Canadá', 'Bosnia y Herzegovina', 'BMO'],
  ['B', 13, '15:00', 'Catar', 'Suiza', 'Levis'],
  ['B', 18, '15:00', 'Suiza', 'Bosnia y Herzegovina', 'SoFi'],
  ['B', 18, '18:00', 'Canadá', 'Catar', 'BCPlace'],
  ['B', 24, '15:00', 'Suiza', 'Canadá', 'BCPlace'],
  ['B', 24, '15:00', 'Bosnia y Herzegovina', 'Catar', 'Lumen'],
  // Group C
  ['C', 13, '18:00', 'Brasil', 'Marruecos', 'MetLife'],
  ['C', 13, '21:00', 'Haití', 'Escocia', 'Gillette'],
  ['C', 19, '18:00', 'Escocia', 'Marruecos', 'Gillette'],
  ['C', 19, '20:30', 'Brasil', 'Haití', 'Lincoln'],
  ['C', 24, '18:00', 'Escocia', 'Brasil', 'HardRock'],
  ['C', 24, '18:00', 'Marruecos', 'Haití', 'MercedesBenz'],
  // Group D
  ['D', 12, '21:00', 'Estados Unidos', 'Paraguay', 'SoFi'],
  ['D', 13, '00:00', 'Australia', 'Turquía', 'BCPlace'],
  ['D', 19, '15:00', 'Estados Unidos', 'Australia', 'Lumen'],
  ['D', 19, '00:00', 'Turquía', 'Paraguay', 'Levis'],
  ['D', 24, '22:00', 'Turquía', 'Estados Unidos', 'SoFi'],
  ['D', 24, '22:00', 'Paraguay', 'Australia', 'Levis'],
  // Group E
  ['E', 14, '13:00', 'Alemania', 'Curazao', 'NRG'],
  ['E', 14, '19:00', 'Costa de Marfil', 'Ecuador', 'Lincoln'],
  ['E', 20, '16:00', 'Alemania', 'Costa de Marfil', 'BMO'],
  ['E', 20, '20:00', 'Ecuador', 'Curazao', 'Arrowhead'],
  ['E', 24, '16:00', 'Ecuador', 'Alemania', 'MetLife'],
  ['E', 24, '16:00', 'Curazao', 'Costa de Marfil', 'Lincoln'],
  // Group F
  ['F', 14, '16:00', 'Países Bajos', 'Japón', 'ATT'],
  ['F', 14, '22:00', 'Suecia', 'Túnez', 'BBVA'],
  ['F', 20, '13:00', 'Países Bajos', 'Suecia', 'NRG'],
  ['F', 20, '00:00', 'Túnez', 'Japón', 'BBVA'],
  ['F', 24, '19:00', 'Japón', 'Suecia', 'ATT'],
  ['F', 24, '19:00', 'Túnez', 'Países Bajos', 'Arrowhead'],
  // Group G
  ['G', 15, '15:00', 'Bélgica', 'Egipto', 'Lumen'],
  ['G', 15, '21:00', 'Irán', 'Nueva Zelanda', 'SoFi'],
  ['G', 21, '15:00', 'Bélgica', 'Irán', 'SoFi'],
  ['G', 21, '21:00', 'Nueva Zelanda', 'Egipto', 'BCPlace'],
  ['G', 26, '23:00', 'Egipto', 'Irán', 'Lumen'],
  ['G', 26, '23:00', 'Nueva Zelanda', 'Bélgica', 'BCPlace'],
  // Group H
  ['H', 15, '12:00', 'España', 'Cabo Verde', 'MercedesBenz'],
  ['H', 15, '18:00', 'Arabia Saudita', 'Uruguay', 'HardRock'],
  ['H', 21, '12:00', 'España', 'Arabia Saudita', 'MercedesBenz'],
  ['H', 21, '18:00', 'Uruguay', 'Cabo Verde', 'HardRock'],
  ['H', 26, '20:00', 'Cabo Verde', 'Arabia Saudita', 'NRG'],
  ['H', 26, '20:00', 'Uruguay', 'España', 'Akron'],
  // Group I
  ['I', 16, '15:00', 'Francia', 'Senegal', 'MetLife'],
  ['I', 16, '18:00', 'Irak', 'Noruega', 'Gillette'],
  ['I', 22, '17:00', 'Francia', 'Irak', 'Lincoln'],
  ['I', 22, '20:00', 'Noruega', 'Senegal', 'MetLife'],
  ['I', 26, '15:00', 'Noruega', 'Francia', 'Gillette'],
  ['I', 26, '15:00', 'Senegal', 'Irak', 'BMO'],
  // Group J  (Austria–Jordan is the night of Jun 16 → 00:00 ET Jun 17)
  ['J', 16, '21:00', 'Argentina', 'Argelia', 'Arrowhead'],
  ['J', 17, '00:00', 'Austria', 'Jordania', 'Levis'],
  ['J', 22, '13:00', 'Argentina', 'Austria', 'ATT'],
  ['J', 22, '23:00', 'Jordania', 'Argelia', 'Levis'],
  ['J', 27, '22:00', 'Argelia', 'Austria', 'Arrowhead'],
  ['J', 27, '22:00', 'Jordania', 'Argentina', 'ATT'],
  // Group K
  ['K', 17, '13:00', 'Portugal', 'RD Congo', 'NRG'],
  ['K', 17, '22:00', 'Uzbekistán', 'Colombia', 'Azteca'],
  ['K', 23, '13:00', 'Portugal', 'Uzbekistán', 'NRG'],
  ['K', 23, '22:00', 'Colombia', 'RD Congo', 'Akron'],
  ['K', 27, '19:30', 'Colombia', 'Portugal', 'HardRock'],
  ['K', 27, '19:30', 'RD Congo', 'Uzbekistán', 'MercedesBenz'],
  // Group L
  ['L', 17, '16:00', 'Inglaterra', 'Croacia', 'ATT'],
  ['L', 17, '19:00', 'Ghana', 'Panamá', 'BMO'],
  ['L', 23, '16:00', 'Inglaterra', 'Ghana', 'Gillette'],
  ['L', 23, '19:00', 'Panamá', 'Croacia', 'BMO'],
  ['L', 27, '17:00', 'Panamá', 'Inglaterra', 'MetLife'],
  ['L', 27, '17:00', 'Croacia', 'Ghana', 'Lincoln'],
]

// ET (EDT in June = UTC−4) → absolute UTC instant.
function kickoffUTC(dayInJune: number, etHHMM: string): Date {
  const [h, m] = etHHMM.split(':').map(Number)
  return new Date(Date.UTC(2026, 5, dayInJune, h + 4, m))
}

function buildMatches() {
  const perGroupCount: Record<string, number> = {}
  const docs = FIXTURES.map(([g, day, et, home, away, vk]) => {
    perGroupCount[g] = (perGroupCount[g] || 0) + 1
    const idx = perGroupCount[g]
    // Validate both teams really belong to this group (guards typos).
    for (const t of [home, away]) {
      if (!GROUPS[g]?.includes(t)) throw new Error(`Fixture ${g}-${idx}: "${t}" is not in group ${g}`)
    }
    return {
      code: `${g}-${idx}`,
      stage: 'group',
      group: g,
      homeTeam: home,
      awayTeam: away,
      kickoffAt: kickoffUTC(day, et),
      venue: V[vk],
    }
  })

  // Integrity: every group has 6 matches and every team plays exactly 3.
  for (const [g, teams] of Object.entries(GROUPS)) {
    const gm = docs.filter((d) => d.group === g)
    if (gm.length !== 6) throw new Error(`Group ${g} has ${gm.length} matches (expected 6)`)
    for (const t of teams) {
      const n = gm.filter((d) => d.homeTeam === t || d.awayTeam === t).length
      if (n !== 3) throw new Error(`${t} plays ${n} matches in group ${g} (expected 3)`)
    }
  }
  return docs
}

// ── Knockout bracket (official 2026 structure, matches #73–104) ──────────────
// Feeder shapes: pos(n,group) · third([groups]) · win(code) · lose(code).
// Codes are in BRACKET order so the UI lays the tree out top-to-bottom.
const pos = (n: 1 | 2, g: string) => ({ t: 'pos', n, g })
const third = (...g: string[]) => ({ t: 'third', g })
const win = (c: string) => ({ t: 'win', c })
const lose = (c: string) => ({ t: 'lose', c })

// [code, stage, month(5=Jun,6=Jul), day, venue, feedHome, feedAway]
const KNOCKOUT: [string, string, number, number, VenueKey, any, any][] = [
  // Round of 32
  ['R32-01', 'r32', 5, 29, 'Gillette', pos(1, 'E'), third('A', 'B', 'C', 'D', 'F')],
  ['R32-02', 'r32', 5, 30, 'MetLife', pos(1, 'I'), third('C', 'D', 'F', 'G', 'H')],
  ['R32-03', 'r32', 5, 28, 'SoFi', pos(2, 'A'), pos(2, 'B')],
  ['R32-04', 'r32', 5, 29, 'BBVA', pos(1, 'F'), pos(2, 'C')],
  ['R32-05', 'r32', 6, 2, 'BMO', pos(2, 'K'), pos(2, 'L')],
  ['R32-06', 'r32', 6, 2, 'SoFi', pos(1, 'H'), pos(2, 'J')],
  ['R32-07', 'r32', 6, 1, 'Levis', pos(1, 'D'), third('B', 'E', 'F', 'I', 'J')],
  ['R32-08', 'r32', 6, 1, 'Lumen', pos(1, 'G'), third('A', 'E', 'H', 'I', 'J')],
  ['R32-09', 'r32', 5, 29, 'NRG', pos(1, 'C'), pos(2, 'F')],
  ['R32-10', 'r32', 5, 30, 'ATT', pos(2, 'E'), pos(2, 'I')],
  ['R32-11', 'r32', 5, 30, 'Azteca', pos(1, 'A'), third('C', 'E', 'F', 'H', 'I')],
  ['R32-12', 'r32', 6, 1, 'MercedesBenz', pos(1, 'L'), third('E', 'H', 'I', 'J', 'K')],
  ['R32-13', 'r32', 6, 3, 'HardRock', pos(1, 'J'), pos(2, 'H')],
  ['R32-14', 'r32', 6, 3, 'ATT', pos(2, 'D'), pos(2, 'G')],
  ['R32-15', 'r32', 6, 2, 'BCPlace', pos(1, 'B'), third('E', 'F', 'G', 'I', 'J')],
  ['R32-16', 'r32', 6, 3, 'Arrowhead', pos(1, 'K'), third('D', 'E', 'I', 'J', 'L')],
  // Round of 16
  ['R16-01', 'r16', 6, 4, 'Lincoln', win('R32-01'), win('R32-02')],
  ['R16-02', 'r16', 6, 4, 'NRG', win('R32-03'), win('R32-04')],
  ['R16-03', 'r16', 6, 6, 'ATT', win('R32-05'), win('R32-06')],
  ['R16-04', 'r16', 6, 6, 'Lumen', win('R32-07'), win('R32-08')],
  ['R16-05', 'r16', 6, 5, 'MetLife', win('R32-09'), win('R32-10')],
  ['R16-06', 'r16', 6, 5, 'Azteca', win('R32-11'), win('R32-12')],
  ['R16-07', 'r16', 6, 7, 'MercedesBenz', win('R32-13'), win('R32-14')],
  ['R16-08', 'r16', 6, 7, 'BCPlace', win('R32-15'), win('R32-16')],
  // Quarter-finals
  ['QF-01', 'qf', 6, 9, 'Gillette', win('R16-01'), win('R16-02')],
  ['QF-02', 'qf', 6, 10, 'SoFi', win('R16-03'), win('R16-04')],
  ['QF-03', 'qf', 6, 11, 'HardRock', win('R16-05'), win('R16-06')],
  ['QF-04', 'qf', 6, 11, 'Arrowhead', win('R16-07'), win('R16-08')],
  // Semi-finals
  ['SF-01', 'sf', 6, 14, 'ATT', win('QF-01'), win('QF-02')],
  ['SF-02', 'sf', 6, 15, 'MercedesBenz', win('QF-03'), win('QF-04')],
  // Third-place play-off & Final
  ['3P-01', 'third', 6, 18, 'HardRock', lose('SF-01'), lose('SF-02')],
  ['F-01', 'final', 6, 19, 'MetLife', win('SF-01'), win('SF-02')],
]

function buildKnockout() {
  return KNOCKOUT.map(([code, stage, month, day, vk, feedHome, feedAway]) => ({
    code,
    stage,
    group: null,
    homeTeam: null,
    awayTeam: null,
    // Nominal 20:00 UTC (early-afternoon Americas) — exact KO times are TBD, but
    // this keeps the calendar date correct in every venue timezone.
    kickoffAt: new Date(Date.UTC(2026, month, day, 20, 0)),
    venue: V[vk],
    feedHome,
    feedAway,
  }))
}

async function run() {
  const uri = process.env.NUXT_MONGO_URI || process.env.MONGODB_URI
  if (!uri) throw new Error('Set NUXT_MONGO_URI (or MONGODB_URI) before seeding')
  await mongoose.connect(uri)

  const docs = [...buildMatches(), ...buildKnockout()]
  for (const d of docs) {
    await Match.updateOne({ code: d.code }, { $set: d }, { upsert: true })
  }
  console.log(`Seeded ${docs.length} matches (72 group + 32 knockout).`)
  await mongoose.disconnect()
}

run()
