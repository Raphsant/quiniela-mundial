import { User } from '../models/User'
import { Match } from '../models/Match'
import { Prediction } from '../models/Prediction'
import { KnockoutPrediction } from '../models/KnockoutPrediction'
import { outcome, sideFromScore, type Outcome } from '../utils/scoring'
import { realAdvanceSide, resolveRealBracket } from '../utils/bracket'

// Leaderboard. Group matches score on the exact 1/X/2 outcome. Knockout scoring
// depends on the `newKo` feature flag:
//   • OFF (legacy): old "who advances" picks (Prediction.outcome H/A) → `hit` pt.
//   • ON (new bracket): each user's scoreline vs the REAL result of that tie
//     (the bracket fills with the real teams as results come in):
//       – koExact  for the exact score;
//       – koWinner for the correct winner;
//       – 0        otherwise.
//     Old knockout picks are ignored; group points retained. Codes listed in
//     NUXT_SCORING_KO_VOID score for nobody and aren't counted as played.
// A level knockout score with no advancer isn't scoreable yet and is skipped.
export default defineEventHandler(async () => {
  const rc = useRuntimeConfig()
  const hit = Number(rc.scoring.hit)
  const koCfg = { exact: Number(rc.scoring.koExact), winner: Number(rc.scoring.koWinner) }
  const newKo = !!rc.public.newKo
  // Match codes the organizer has excluded from scoring entirely (e.g. a match
  // nobody could fairly predict). No points, not counted as played.
  const voidCodes = new Set(
    String(rc.scoring.koVoid || '').split(',').map((s) => s.trim()).filter(Boolean),
  )

  const [users, matches, preds, koPreds] = await Promise.all([
    User.find().lean(),
    Match.find().lean(),
    Prediction.find().lean(),
    newKo ? KnockoutPrediction.find().lean() : Promise.resolve([] as any[]),
  ])

  const matchById = new Map(matches.map((m: any) => [String(m._id), m]))

  // Per scoreable match: the pick ('H' | 'D' | 'A') that earns the legacy point.
  // When the new bracket is on, knockout matches are scored separately below and
  // are intentionally excluded here so old picks no longer raise scores.
  const winningPick = new Map<string, Outcome>()
  for (const m of matches as any[]) {
    if (voidCodes.has(m.code)) continue // organizer-excluded match
    if (m.status !== 'finished' || m.homeGoals == null || m.awayGoals == null) continue
    if (m.stage === 'group') winningPick.set(String(m._id), outcome(m.homeGoals, m.awayGoals))
    else if (!newKo) {
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

  // New knockout bracket: score each user's scoreline against the real tie. The
  // bracket fills with the real teams as results land, so a scoreline is judged
  // against the actual fixture at that slot — exact score, else correct winner.
  if (newKo) {
    const real = resolveRealBracket(
      matches.filter((m: any) => m.stage === 'group'),
      matches.filter((m: any) => m.stage !== 'group'),
    )
    const realByCode = new Map(real.resolved.map((r) => [r.match.code, r]))

    for (const p of koPreds as any[]) {
      const row = table.get(String(p.user))
      const m: any = matchById.get(String(p.match))
      if (!row || !m || m.stage === 'group') continue
      if (voidCodes.has(m.code)) continue // organizer-excluded match — scores for nobody
      if (m.status !== 'finished' || m.homeGoals == null || m.awayGoals == null) continue
      if (m.homeGoals === m.awayGoals && !m.advancer) continue // penalties not entered yet
      const rr = realByCode.get(m.code) // real teams + winner for this tie
      if (!rr) continue
      row.played += 1

      const predSide = sideFromScore(p.homeGoals, p.awayGoals, p.advancer)
      const predWinnerTeam = predSide === 'H' ? rr.home.team : predSide === 'A' ? rr.away.team : null
      let gained = 0
      if (p.homeGoals === m.homeGoals && p.awayGoals === m.awayGoals) {
        gained = koCfg.exact // exact score of the real fixture
      } else if (predWinnerTeam && rr.winner && predWinnerTeam === rr.winner) {
        gained = koCfg.winner // correct winner of the real fixture
      }
      if (gained > 0) {
        row.aciertos += 1
        row.points += gained
      }
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
    config: { hit, newKo, koExact: koCfg.exact, koWinner: koCfg.winner, koVoid: [...voidCodes] },
    matchesScored: winningPick.size,
    totalMatches: matches.length,
    standings,
  }
})
