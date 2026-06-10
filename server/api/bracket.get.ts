import { User } from '../models/User'
import { Match } from '../models/Match'
import { Prediction } from '../models/Prediction'
import { Tiebreak } from '../models/Tiebreak'
import { resolveUserBracket, STAGE_RANK } from '../utils/bracket'
import type { Outcome } from '../utils/projection'

export default defineEventHandler(async (event) => {
  // --- user's group predictions → projection (who finishes 1st/2nd/3rd) ---
  const session = await getUserSession(event)
  let dbUser: any = null
  if (session?.user) dbUser = await User.findById((session.user as any).id).lean()

  const groupMatches = await Match.find({ stage: 'group' }).lean()
  const koMatches = await Match.find({ stage: { $in: Object.keys(STAGE_RANK) } }).lean()

  // Same global lock as elsewhere: everything closes when the first match starts.
  const firstKickoff = groupMatches.length
    ? Math.min(...groupMatches.map((m: any) => new Date(m.kickoffAt).getTime()))
    : Infinity
  const locked = Date.now() >= firstKickoff

  const groupPickByMatch = new Map<string, Outcome>()
  const koPickByCode = new Map<string, Outcome>()
  const tiebreaks: Record<string, string[]> = {}
  if (dbUser) {
    const [preds, ties] = await Promise.all([
      Prediction.find({ user: dbUser._id }).lean(),
      Tiebreak.find({ user: dbUser._id }).lean(),
    ])
    const codeById = new Map(koMatches.map((m: any) => [String(m._id), m.code]))
    for (const p of preds as any[]) {
      if (!p.outcome) continue
      const code = codeById.get(String(p.match))
      if (code) koPickByCode.set(code, p.outcome)
      else groupPickByMatch.set(String(p.match), p.outcome)
    }
    for (const t of ties as any[]) tiebreaks[t.scope] = t.order || []
  }

  // --- resolve the bracket, propagating each pick to the next round ---
  const { proj, canResolve, resolved, champion } = resolveUserBracket({
    groupMatches,
    koMatches,
    groupPickByMatch,
    koPickByCode,
    tiebreaks,
  })

  const matches = resolved.map((r) => ({
    _id: String(r.match._id),
    code: r.match.code,
    stage: r.match.stage,
    kickoffAt: r.match.kickoffAt,
    venue: r.match.venue || null,
    home: r.home,
    away: r.away,
    pick: koPickByCode.get(r.match.code) || null,
    winner: r.winner,
  }))

  return {
    loggedIn: !!dbUser,
    locked,
    complete: proj.complete,
    blocked: !canResolve,
    tiesPending: proj.complete && !proj.tiesResolved, // complete but ties unresolved
    pendingTies: proj.pendingTies,
    predictedCount: proj.predictedCount,
    totalGames: proj.totalGames,
    champion,
    matches,
  }
})
