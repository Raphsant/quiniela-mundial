import { User } from '../models/User'
import { Match } from '../models/Match'
import { Prediction } from '../models/Prediction'
import { Tiebreak } from '../models/Tiebreak'
import { resolveUserBracket, resolveRealBracket } from '../utils/bracket'
import type { Outcome } from '../utils/projection'

// Side-by-side knockout comparison: a player's PREDICTED bracket (their group
// picks build the tables, their knockout picks propagate winners) against the
// REAL bracket that entered results are dictating — tie by tie, who they backed
// to advance vs who is actually going through.
//
// Anti-copy: only your own prediction is comparable until the tournament locks
// (first kickoff); after that any player can be selected, same rule as /comunidad.
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session?.user) return { loggedIn: false }
  const me = await User.findById((session.user as any).id).lean()
  if (!me) return { loggedIn: false }

  const [users, matches, preds, ties] = await Promise.all([
    User.find().lean(),
    Match.find().lean(),
    Prediction.find().lean(),
    Tiebreak.find().lean(),
  ])

  const groupMatches = matches.filter((m: any) => m.stage === 'group')
  const koMatches = matches.filter((m: any) => m.stage !== 'group')

  const firstKickoff = matches.length
    ? Math.min(...matches.map((m: any) => new Date(m.kickoffAt).getTime()))
    : Infinity
  const locked = Date.now() >= firstKickoff
  const reveal = locked // once locked, picks can't change → safe to compare anyone

  // Which player are we comparing? Default to me; others only after reveal.
  const requested = String(getQuery(event).player || '') || String(me._id)
  const targetId = reveal || requested === String(me._id) ? requested : String(me._id)
  const target = users.find((u: any) => String(u._id) === targetId) || me

  // Index the target player's picks + tie-breaks.
  const codeById = new Map(koMatches.map((m: any) => [String(m._id), m.code]))
  const groupPickByMatch = new Map<string, Outcome>()
  const koPickByCode = new Map<string, Outcome>()
  const tiebreaks: Record<string, string[]> = {}
  for (const p of preds as any[]) {
    if (String(p.user) !== String(target._id) || !p.outcome) continue
    const code = codeById.get(String(p.match))
    if (code) koPickByCode.set(code, p.outcome)
    else groupPickByMatch.set(String(p.match), p.outcome)
  }
  for (const t of ties as any[]) {
    if (String(t.user) === String(target._id)) tiebreaks[t.scope] = t.order || []
  }

  const pred = resolveUserBracket({ groupMatches, koMatches, groupPickByMatch, koPickByCode, tiebreaks })
  const real = resolveRealBracket(groupMatches, koMatches)
  const realByCode = new Map(real.resolved.map((r) => [r.match.code, r]))

  // One row per knockout match, predicted slots beside the real slots.
  const rows = pred.resolved.map((p) => {
    const r = realByCode.get(p.match.code)
    return {
      code: p.match.code,
      stage: p.match.stage,
      kickoffAt: p.match.kickoffAt,
      venue: p.match.venue || null,
      status: r?.match.status || 'scheduled',
      pick: koPickByCode.get(p.match.code) || null,
      predicted: { home: p.home, away: p.away, winner: p.winner },
      actual: r ? { home: r.home, away: r.away, winner: r.winner } : null,
    }
  })

  return {
    loggedIn: true,
    locked,
    reveal,
    me: { id: String(me._id), name: me.displayName || me.username },
    target: { id: String(target._id), name: target.displayName || target.username },
    players: (reveal ? users : [me])
      .map((u: any) => ({ id: String(u._id), name: u.displayName || u.username }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    predictedChampion: pred.champion,
    realChampion: real.resolved.find((r) => r.match.stage === 'final')?.winner ?? null,
    canResolve: pred.canResolve,
    predictedCount: pred.proj.predictedCount,
    totalGames: pred.proj.totalGames,
    rows,
  }
})
