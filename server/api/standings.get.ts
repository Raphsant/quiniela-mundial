import { User } from '../models/User'
import { Match } from '../models/Match'
import { Prediction } from '../models/Prediction'
import { KnockoutPrediction } from '../models/KnockoutPrediction'
import { outcome, sideFromScore, type Outcome } from '../utils/scoring'
import { realAdvanceSide, resolveRealBracket, resolveKnockout } from '../utils/bracket'

// Leaderboard. Group matches score on the exact 1/X/2 outcome. Knockout scoring
// depends on the `newKo` feature flag:
//   • OFF (legacy): old "who advances" picks (Prediction.outcome H/A) → `hit` pt.
//   • ON (new bracket): each user's scoreline predictions, scored after resolving
//     their OWN bracket so we know which teams they had in each slot:
//       – koExact  if their predicted teams AND the exact score match the real tie;
//       – koWinner if the team they sent through is the one that really advanced
//                  (the opponent may differ);
//       – 0        if the team they backed isn't the one that advanced.
//     R32 teams are fixed, so they always match there; later rounds depend on the
//     user's predicted path. Old knockout picks are ignored; group points retained.
// A level knockout score with no advancer isn't scoreable yet and is skipped.
export default defineEventHandler(async () => {
  const rc = useRuntimeConfig()
  const hit = Number(rc.scoring.hit)
  const koCfg = { exact: Number(rc.scoring.koExact), winner: Number(rc.scoring.koWinner) }
  const newKo = !!rc.public.newKo

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

  // New knockout bracket: score each user's scorelines against finished results.
  // We resolve every user's predicted bracket (real R32 teams; their predicted
  // winners propagate) so we know the teams they had in each slot, then award by
  // team identity — not just slot position.
  if (newKo) {
    const groupMatches = matches.filter((m: any) => m.stage === 'group')
    const koMatchesArr = matches.filter((m: any) => m.stage !== 'group')
    const real = resolveRealBracket(groupMatches, koMatchesArr)
    const realByCode = new Map(real.resolved.map((r) => [r.match.code, r]))

    // Each user's scoreline predictions, grouped by match id.
    const koByUser = new Map<string, Map<string, any>>()
    for (const p of koPreds as any[]) {
      if (!koByUser.has(String(p.user))) koByUser.set(String(p.user), new Map())
      koByUser.get(String(p.user))!.set(String(p.match), p)
    }

    for (const [uid, mine] of koByUser) {
      const row = table.get(uid)
      if (!row) continue
      // Resolve THIS user's bracket: real R32 teams + their predicted winners.
      const myResolved = resolveKnockout({
        koMatches: koMatchesArr,
        groupSettled: (g) => !!real.settled[g],
        groupPos: real.pos,
        qualifiedThirds: real.qualifiedThirds,
        advance: (m) => {
          const p = mine.get(String(m._id))
          return p ? sideFromScore(p.homeGoals, p.awayGoals, p.advancer) : null
        },
      })
      const myByCode = new Map(myResolved.map((r) => [r.match.code, r]))

      for (const [mid, p] of mine) {
        const m: any = matchById.get(mid)
        if (!m || m.stage === 'group') continue
        if (m.status !== 'finished' || m.homeGoals == null || m.awayGoals == null) continue
        if (m.homeGoals === m.awayGoals && !m.advancer) continue // penalties not entered yet
        row.played += 1

        const rr = realByCode.get(m.code) // real teams + winner for this tie
        const pr = myByCode.get(m.code) // user's predicted teams + winner
        if (!rr || !pr) continue

        const exactTeams = pr.home.team === rr.home.team && pr.away.team === rr.away.team
        let gained = 0
        if (exactTeams && p.homeGoals === m.homeGoals && p.awayGoals === m.awayGoals) {
          gained = koCfg.exact // both teams + exact score
        } else if (pr.winner && rr.winner && pr.winner === rr.winner) {
          gained = koCfg.winner // the team they sent through actually advanced
        }
        if (gained > 0) {
          row.aciertos += 1
          row.points += gained
        }
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
    config: { hit, newKo, koExact: koCfg.exact, koWinner: koCfg.winner },
    matchesScored: winningPick.size,
    totalMatches: matches.length,
    standings,
  }
})
