/**
 * Throwaway local-DB fixture for eyeballing /comparar.
 *
 *   NUXT_MONGOOSE_URI=mongodb://127.0.0.1:28028/quiniela-local \
 *     npx tsx scripts/verify-compare-setup.ts
 *
 * Assumes matches are already seeded (run scripts/seed.ts first). Creates a
 * "tester" user with a COMPLETE, tie-resolved set of group + knockout
 * predictions, then enters REAL results that deliberately diverge from those
 * predictions so the comparison page shows hits, misses and matchup changes.
 * Never point this at the live Atlas DB.
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { User } from '../server/models/User'
import { Match } from '../server/models/Match'
import { Prediction } from '../server/models/Prediction'
import { Tiebreak } from '../server/models/Tiebreak'

async function run() {
  const uri = process.env.NUXT_MONGOOSE_URI
  if (!uri || /mongodb\.net/.test(uri)) throw new Error('Refusing to run without a local NUXT_MONGOOSE_URI')
  await mongoose.connect(uri)

  // tester / test1234
  const scrypt = new Scrypt({})
  const passwordHash = await scrypt.make('test1234')
  await User.updateOne(
    { username: 'tester' },
    { $set: { passwordHash }, $setOnInsert: { username: 'tester', displayName: 'Tester' } },
    { upsert: true },
  )
  const user = await User.findOne({ username: 'tester' }).lean()
  const uid = (user as any)._id

  const matches = await Match.find().lean()
  const groupMatches = matches.filter((m: any) => m.stage === 'group')
  const koMatches = matches.filter((m: any) => m.stage !== 'group')

  // Group membership + a deterministic predicted order (alphabetical).
  const teamsByGroup = new Map<string, string[]>()
  for (const m of groupMatches as any[]) {
    const s = new Set(teamsByGroup.get(m.group) || [])
    s.add(m.homeTeam); s.add(m.awayTeam)
    teamsByGroup.set(m.group, [...s])
  }
  const letters = [...teamsByGroup.keys()].sort()
  const predOrder = new Map<string, string[]>()
  const realOrder = new Map<string, string[]>()
  letters.forEach((g, i) => {
    const ord = [...teamsByGroup.get(g)!].sort()
    predOrder.set(g, ord)
    realOrder.set(g, i % 2 === 1 ? [...ord].reverse() : ord) // reverse odd groups → divergence
  })

  // Wipe this user's prior fixture data, then rebuild.
  await Prediction.deleteMany({ user: uid })
  await Tiebreak.deleteMany({ user: uid })

  // Group predictions: transitive (higher predicted rank beats lower) → distinct
  // 9/6/3/0 points, so no group needs a manual tie-break.
  const preds: any[] = []
  for (const m of groupMatches as any[]) {
    const ord = predOrder.get(m.group)!
    const outcome = ord.indexOf(m.homeTeam) < ord.indexOf(m.awayTeam) ? 'H' : 'A'
    preds.push({ user: uid, match: m._id, outcome })
  }
  // Knockout predictions: back the home side everywhere.
  for (const m of koMatches as any[]) preds.push({ user: uid, match: m._id, outcome: 'H' })
  await Prediction.insertMany(preds)

  // All 12 predicted thirds sit level on 3 pts → resolve the cutoff by hand.
  const thirds = letters.map((g) => predOrder.get(g)![2]).sort()
  await Tiebreak.create({ user: uid, scope: 'THIRDS', order: thirds })

  // Real group results: 2–0 along each group's REAL order (clean standings).
  for (const m of groupMatches as any[]) {
    const ord = realOrder.get(m.group)!
    const homeUp = ord.indexOf(m.homeTeam) < ord.indexOf(m.awayTeam)
    await Match.updateOne({ _id: m._id }, {
      $set: { homeGoals: homeUp ? 2 : 0, awayGoals: homeUp ? 0 : 2, status: 'finished' },
    })
  }

  // Real knockout results through the quarter-finals (home side wins 2–0); leave
  // semis / final / third place unplayed so pending states are visible too.
  const played = new Set(['r32', 'r16', 'qf'])
  for (const m of koMatches as any[]) {
    if (played.has(m.stage)) {
      await Match.updateOne({ _id: m._id }, { $set: { homeGoals: 2, awayGoals: 0, status: 'finished' } })
    } else {
      await Match.updateOne({ _id: m._id }, { $set: { homeGoals: null, awayGoals: null, status: 'scheduled', advancer: null } })
    }
  }

  console.log(`Fixture ready: user "tester" / pass "test1234" — ${preds.length} predictions, real results through QF.`)
  await mongoose.disconnect()
}

run().catch((e) => { console.error(e); process.exit(1) })
