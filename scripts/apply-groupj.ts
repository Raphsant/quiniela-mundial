// Write the CONFIRMED FINAL Group J results (real scores from FIFA/Wikipedia).
// Touches ONLY J-5 and J-6, only if they are group matches. Mirrors the
// result.put.ts semantics (status=finished; advancer=null for group draws).
import 'dotenv/config'
import mongoose from 'mongoose'
import { Match } from '../server/models/Match'

const WRITES = [
  { code: 'J-5', homeGoals: 3, awayGoals: 3 }, // Argelia 3-3 Austria
  { code: 'J-6', homeGoals: 1, awayGoals: 3 }, // Jordania 1-3 Argentina
]

async function run() {
  const uri =
    process.env.NUXT_MONGOOSE_URI || process.env.NUXT_MONGO_URI || process.env.NUXT_MONGODB_URI || process.env.MONGODB_URI
  if (!uri) throw new Error('no mongo uri')
  await mongoose.connect(uri)
  console.log('[db]', mongoose.connection.host + '/' + mongoose.connection.name)

  for (const w of WRITES) {
    const before = (await Match.findOne({ code: w.code }).lean()) as any
    if (!before) { console.log(`  ${w.code}: NOT FOUND — skipping`); continue }
    if (before.stage !== 'group') { console.log(`  ${w.code}: stage=${before.stage} (not group) — skipping for safety`); continue }
    console.log(
      `  ${w.code} ${before.homeTeam} vs ${before.awayTeam}: was [${before.status} ${before.homeGoals}-${before.awayGoals}] -> [finished ${w.homeGoals}-${w.awayGoals}]`,
    )
    const res = await Match.updateOne(
      { code: w.code, stage: 'group' },
      { $set: { homeGoals: w.homeGoals, awayGoals: w.awayGoals, status: 'finished', advancer: null } },
    )
    console.log(`     matched=${res.matchedCount} modified=${res.modifiedCount}`)
  }
  await mongoose.disconnect()
}
run().catch((e) => { console.error(e); process.exit(1) })
