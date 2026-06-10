import { User } from '../models/User'
import { Match } from '../models/Match'
import { Prediction } from '../models/Prediction'
import { outcome, type Outcome } from '../utils/scoring'
import { realAdvanceSide } from '../utils/bracket'

// Leaderboard. Group matches score on the exact 1/X/2 outcome. Knockout picks
// are "who advances" (H/A only), so there they score on the advancing side:
// goals decide, or the admin-set `advancer` when the match went to penalties.
// A level knockout score with no advancer isn't scoreable yet and is skipped.
export default defineEventHandler(async () => {
  const rc = useRuntimeConfig()
  const hit = Number(rc.scoring.hit)

  const [users, matches, preds] = await Promise.all([
    User.find().lean(),
    Match.find().lean(),
    Prediction.find().lean(),
  ])

  // Per scoreable match: the pick ('H' | 'D' | 'A') that earns the point.
  const winningPick = new Map<string, Outcome>()
  for (const m of matches as any[]) {
    if (m.status !== 'finished' || m.homeGoals == null || m.awayGoals == null) continue
    if (m.stage === 'group') winningPick.set(String(m._id), outcome(m.homeGoals, m.awayGoals))
    else {
      const side = realAdvanceSide(m)
      if (side) winningPick.set(String(m._id), side)
    }
  }

  interface Row {
    userId: string
    name: string
    played: number // predictions on matches already scored
    aciertos: number
    points: number
  }

  // Every registered user appears, even with nothing scored yet.
  const table = new Map<string, Row>()
  for (const u of users as any[]) {
    table.set(String(u._id), {
      userId: String(u._id),
      name: u.displayName || u.username,
      played: 0,
      aciertos: 0,
      points: 0,
    })
  }
  for (const p of preds as any[]) {
    const row = table.get(String(p.user))
    const win = winningPick.get(String(p.match))
    if (!row || !win || !p.outcome) continue
    row.played += 1
    if (p.outcome === win) {
      row.aciertos += 1
      row.points += hit
    }
  }

  // Most points → most aciertos → name (stable). Equal records share a rank.
  const rows = [...table.values()].sort(
    (a, b) => b.points - a.points || b.aciertos - a.aciertos || a.name.localeCompare(b.name),
  )
  let lastRank = 0
  const standings = rows.map((r, i) => {
    const prev = rows[i - 1]
    const rank = prev && prev.points === r.points && prev.aciertos === r.aciertos ? lastRank : i + 1
    lastRank = rank
    return { rank, ...r }
  })

  return {
    config: { hit },
    matchesScored: winningPick.size,
    totalMatches: matches.length,
    standings,
  }
})
