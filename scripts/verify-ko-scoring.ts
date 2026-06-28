/**
 * Verifies the new knockout scoring rule (credit-the-advancer) end to end on a
 * throwaway local DB. Sets real results for R32-01, R32-02 and R16-01, then
 * creates three fresh users (no group predictions) whose R16-01 prediction hits
 * each branch:
 *   • exact      — right teams + exact score          → +2 on R16-01
 *   • rightTeam  — right advancer, WRONG opponent      → +1 on R16-01
 *   • wrongTeam  — backed the team that did NOT advance → 0 on R16-01
 *
 *   NUXT_MONGOOSE_URI=mongodb://127.0.0.1:28028/quiniela-local npx tsx scripts/verify-ko-scoring.ts
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

  const groupMatches = await Match.find({ stage: 'group' }).lean()
  // Settle groups (2-0 along alphabetical order) so the real R32 teams resolve.
  const teamsByGroup = new Map<string, string[]>()
  for (const m of groupMatches as any[]) {
    const s = new Set(teamsByGroup.get(m.group) || []); s.add(m.homeTeam); s.add(m.awayTeam)
    teamsByGroup.set(m.group, [...s])
  }
  const order = new Map([...teamsByGroup].map(([g, t]) => [g, [...t].sort()]))
  for (const m of groupMatches as any[]) {
    const ord = order.get(m.group)!
    const homeUp = ord.indexOf(m.homeTeam) < ord.indexOf(m.awayTeam)
    await Match.updateOne({ _id: m._id }, { $set: { homeGoals: homeUp ? 2 : 0, awayGoals: homeUp ? 0 : 2, status: 'finished' } })
  }

  // Reset knockout, then finish R32-01 (home 2-1), R32-02 (home 4-2), R16-01 (home 3-1).
  const ko = await Match.find({ stage: { $ne: 'group' } }).lean()
  for (const m of ko as any[]) await Match.updateOne({ _id: m._id }, { $set: { homeGoals: null, awayGoals: null, status: 'scheduled', advancer: null } })
  const byCode = new Map(ko.map((m: any) => [m.code, m]))
  const fin = (c: string, h: number, a: number) => Match.updateOne({ _id: (byCode.get(c) as any)._id }, { $set: { homeGoals: h, awayGoals: a, status: 'finished', advancer: null } })
  await fin('R32-01', 2, 1) // home advances
  await fin('R32-02', 4, 2) // home advances
  await fin('R16-01', 3, 1) // R16-01 = [winner R32-01 (home), winner R32-02 (home)], home wins
  const id = (c: string) => (byCode.get(c) as any)._id

  // Three fresh users (dummy hash; standings needs no auth).
  const scrypt = new Scrypt({})
  const hash = await scrypt.make('test1234')
  async function user(username: string, r32_01: [number, number], r32_02: [number, number], r16_01: [number, number]) {
    await User.updateOne({ username }, { $set: { passwordHash: hash }, $setOnInsert: { username, displayName: username } }, { upsert: true })
    const u = await User.findOne({ username }).lean()
    const uid = (u as any)._id
    await KnockoutPrediction.deleteMany({ user: uid })
    await KnockoutPrediction.insertMany([
      { user: uid, match: id('R32-01'), homeGoals: r32_01[0], awayGoals: r32_01[1], advancer: null },
      { user: uid, match: id('R32-02'), homeGoals: r32_02[0], awayGoals: r32_02[1], advancer: null },
      { user: uid, match: id('R16-01'), homeGoals: r16_01[0], awayGoals: r16_01[1], advancer: null },
    ])
  }

  // exact:     R32-01 home, R32-02 home → R16-01 teams match real; score 3-1 = exact.
  await user('koexact', [2, 1], [2, 1], [3, 1])
  // rightTeam: R32-01 home (→ R16 home = real winner X), R32-02 AWAY (→ wrong opponent);
  //            R16-01 home wins 2-0 → right team advanced, wrong opponent, score off → +1.
  await user('koright', [2, 1], [1, 2], [2, 0])
  // wrongTeam: R32-01 AWAY (→ R16 home = the team that did NOT advance), R32-02 home;
  //            R16-01 home wins 3-1 → backed the wrong advancer → 0.
  await user('kowrong', [1, 2], [2, 1], [3, 1])

  console.log('Scoring fixture ready. Expected R16-01: koexact +2, koright +1, kowrong 0.')
  console.log('Expected totals (R32-01 + R32-02 + R16-01):')
  console.log('  koexact  = 2 + 1 + 2 = 5  (R32-01 exact, R32-02 winner, R16-01 exact)')
  console.log('  koright  = 2 + 0 + 1 = 3  (R32-01 exact, R32-02 wrong, R16-01 credit-advancer)')
  console.log('  kowrong  = 0 + 1 + 0 = 1  (R32-01 wrong, R32-02 winner, R16-01 wrong team)')
  await mongoose.disconnect()
}

run().catch((e) => { console.error(e); process.exit(1) })
