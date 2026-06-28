/**
 * Throwaway local-DB fixture for the NEW scoreline knockout bracket (/eliminatorias).
 *
 *   NUXT_MONGOOSE_URI=mongodb://127.0.0.1:28028/quiniela-local \
 *     npx tsx scripts/verify-ko-setup.ts
 *
 * Assumes matches are seeded (run scripts/seed.ts first). Enters all 72 group
 * results so the real Round of 32 resolves, creates a "tester" user with
 * KnockoutPrediction scorelines, and finishes a few R32 matches so leaderboard
 * scoring (2 exact / 1 winner / 0 miss) can be checked. Never point at live Atlas.
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { User } from '../server/models/User'
import { Match } from '../server/models/Match'
import { KnockoutPrediction } from '../server/models/KnockoutPrediction'

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

  // Real group results: 2–0 along alphabetical order → clean, settled standings.
  const teamsByGroup = new Map<string, string[]>()
  for (const m of groupMatches as any[]) {
    const s = new Set(teamsByGroup.get(m.group) || [])
    s.add(m.homeTeam); s.add(m.awayTeam)
    teamsByGroup.set(m.group, [...s])
  }
  const order = new Map([...teamsByGroup].map(([g, t]) => [g, [...t].sort()]))
  for (const m of groupMatches as any[]) {
    const ord = order.get(m.group)!
    const homeUp = ord.indexOf(m.homeTeam) < ord.indexOf(m.awayTeam)
    await Match.updateOne({ _id: m._id }, {
      $set: { homeGoals: homeUp ? 2 : 0, awayGoals: homeUp ? 0 : 2, status: 'finished' },
    })
  }

  // Reset any prior KO state for a clean run.
  await KnockoutPrediction.deleteMany({ user: uid })
  for (const m of koMatches as any[]) {
    await Match.updateOne({ _id: m._id }, { $set: { homeGoals: null, awayGoals: null, status: 'scheduled', advancer: null } })
  }

  const byCode = new Map(koMatches.map((m: any) => [m.code, m]))
  const r32 = koMatches.filter((m: any) => m.stage === 'r32')

  // Predict every R32 as a 2–1 home win → winners propagate the whole bracket.
  for (const m of r32 as any[]) {
    await KnockoutPrediction.create({ user: uid, match: m._id, homeGoals: 2, awayGoals: 1, advancer: null })
  }

  // Finish 3 R32 matches to exercise scoring vs the 2-1 predictions:
  //   R32-01 real 2-1  → exact            → +2
  //   R32-02 real 4-2  → home wins, off    → +1
  //   R32-03 real 0-1  → away wins (miss)  → 0
  const fin = async (code: string, h: number, a: number) => {
    const m: any = byCode.get(code)
    if (m) await Match.updateOne({ _id: m._id }, { $set: { homeGoals: h, awayGoals: a, status: 'finished', advancer: null } })
  }
  await fin('R32-01', 2, 1)
  await fin('R32-02', 4, 2)
  await fin('R32-03', 0, 1)

  console.log('KO fixture ready: user "tester" / pass "test1234".')
  console.log('Predicted all R32 as 2-1. Finished R32-01(2-1 →+2), R32-02(4-2 →+1), R32-03(0-1 →0).')
  await mongoose.disconnect()
}

run().catch((e) => { console.error(e); process.exit(1) })
