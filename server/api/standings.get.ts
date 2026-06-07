import { Match } from '../models/Match'
import { Prediction } from '../models/Prediction'
import { scorePrediction, type ScoreConfig } from '../utils/scoring'

interface Row {
  userId: string
  name: string
  played: number
  aciertos: number
  points: number
}

export default defineEventHandler(async () => {
  await connectDB()

  const rc = useRuntimeConfig()
  const cfg: ScoreConfig = { hit: Number(rc.scoring.hit) }

  const finished = await Match.find({
    status: 'finished',
    homeGoals: { $ne: null },
    awayGoals: { $ne: null },
  }).lean()

  const actualByMatch = new Map(
    finished.map((m: any) => [String(m._id), { homeGoals: m.homeGoals, awayGoals: m.awayGoals }]),
  )
  const finishedIds = finished.map((m: any) => m._id)

  const preds = await Prediction.find({ match: { $in: finishedIds } })
    .populate('user')
    .lean()

  const table = new Map<string, Row>()
  for (const p of preds as any[]) {
    if (!p.user) continue
    const actual = actualByMatch.get(String(p.match))
    if (!actual) continue

    if (!p.outcome) continue
    const s = scorePrediction(p.outcome, actual, cfg)
    const key = String(p.user._id)
    const row =
      table.get(key) ||
      {
        userId: String(p.user._id),
        name: p.user.displayName || p.user.username,
        played: 0,
        aciertos: 0,
        points: 0,
      }
    row.played += 1
    if (s.correctOutcome) row.aciertos += 1
    row.points += s.points
    table.set(key, row)
  }

  // Winner = most aciertos (= most points); name as a stable tiebreak.
  const rows = [...table.values()].sort(
    (a, b) => b.aciertos - a.aciertos || b.points - a.points || a.name.localeCompare(b.name),
  )

  return {
    config: cfg,
    matchesScored: finished.length,
    standings: rows.map((r, i) => ({ rank: i + 1, ...r })),
  }
})
