// READ-ONLY simulation: load real data, inject HYPOTHETICAL Group J results in
// memory (no DB writes), run resolveRealBracket, print the resolved R32.
// Usage: tsx scripts/simulate-groupj.ts [arg5Home arg5Away arg6Home arg6Away]
//   J-5 = Argelia(home) vs Austria(away);  J-6 = Jordania(home) vs Argentina(away)
import 'dotenv/config'
import mongoose from 'mongoose'
import { Match } from '../server/models/Match'
import { resolveRealBracket } from '../server/utils/bracket'

const [a = '2', b = '2', c = '0', d = '3'] = process.argv.slice(2)
const J5 = { h: +a, a: +b } // Argelia vs Austria
const J6 = { h: +c, a: +d } // Jordania vs Argentina

async function run() {
  const uri = process.env.NUXT_MONGOOSE_URI || process.env.NUXT_MONGO_URI || process.env.NUXT_MONGODB_URI || process.env.MONGODB_URI
  if (!uri) throw new Error('no mongo uri in env')
  await mongoose.connect(uri)
  console.log('[db]', mongoose.connection.host + '/' + mongoose.connection.name)
  const all = (await Match.find().lean()) as any[]

  // Inject hypothetical J results IN MEMORY only.
  for (const m of all) {
    if (m.code === 'J-5') Object.assign(m, { homeGoals: J5.h, awayGoals: J5.a, status: 'finished' })
    if (m.code === 'J-6') Object.assign(m, { homeGoals: J6.h, awayGoals: J6.a, status: 'finished' })
  }

  const group = all.filter((m) => m.stage === 'group')
  const ko = all.filter((m) => m.stage !== 'group')
  const real = resolveRealBracket(group, ko)

  console.log(`\nHYPOTHETICAL  J-5 Argelia ${J5.h}-${J5.a} Austria   |   J-6 Jordania ${J6.h}-${J6.a} Argentina`)
  console.log('\nGroup J final:', real.pos['J'].join(' > '), real.settled['J'] ? '(settled)' : '(NOT settled)')
  console.log('Qualified thirds:', real.qualifiedThirds?.map((t: any) => `${t.name}(${t.group})`).join(', '))

  console.log('\n===== RESOLVED ROUND OF 32 =====')
  for (const r of real.resolved.filter((x: any) => x.match.stage === 'r32') as any[]) {
    const h = r.home.team || `<${r.home.label}>`
    const a2 = r.away.team || `<${r.away.label}>`
    console.log(`  ${r.match.code}  ${h.padEnd(24)} vs  ${a2}`)
  }
  await mongoose.disconnect()
}
run().catch((e) => { console.error(e); process.exit(1) })
