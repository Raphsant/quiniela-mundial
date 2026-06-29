import { Match } from '../models/Match'
import { User } from '../models/User'
import { KnockoutPrediction } from '../models/KnockoutPrediction'
import { realGroupTables, resolveKnockout, realAdvanceSide } from '../utils/bracket'
import { sideFromScore } from '../utils/scoring'

// The logged-in user's NEW knockout bracket. The Round of 32 is filled with the
// ACTUAL qualified teams. Each tie then advances by REAL result once it's played
// (so already-decided ties show the real winner to everyone and never block the
// rounds below them), and by the user's predicted scoreline for ties not yet
// played — letting anyone complete the whole bracket regardless of what they
// caught in time.
export default defineEventHandler(async (event) => {
  const rc = useRuntimeConfig()
  if (!rc.public.newKo) {
    throw createError({ statusCode: 404, statusMessage: 'No disponible' })
  }
  const voidCodes = new Set(
    String(rc.scoring.koVoid || '').split(',').map((s) => s.trim()).filter(Boolean),
  )

  const session = await getUserSession(event)
  let dbUser: any = null
  if (session?.user) dbUser = await User.findById((session.user as any).id).lean()

  const matches = await Match.find().lean()
  const groupMatches = matches.filter((m: any) => m.stage === 'group')
  const koMatches = matches.filter((m: any) => m.stage !== 'group')

  // Real qualified teams. `qualifiedThirds` is null until every group is settled.
  const tables = realGroupTables(groupMatches)
  const ready = tables.qualifiedThirds !== null

  // This user's scoreline predictions, indexed by match id.
  const predByMatch = new Map<string, any>()
  if (dbUser) {
    const preds = await KnockoutPrediction.find({ user: dbUser._id }).lean()
    for (const p of preds as any[]) predByMatch.set(String(p.match), p)
  }

  // Fill the bracket from reality. Played ties advance by their REAL winner (so
  // they never block the rounds below); unplayed ties advance by the user's
  // predicted score.
  const resolved = resolveKnockout({
    koMatches,
    groupSettled: (g) => !!tables.settled[g],
    groupPos: tables.pos,
    qualifiedThirds: tables.qualifiedThirds,
    advance: (m) => {
      const real = realAdvanceSide(m)
      if (real) return real
      const p = predByMatch.get(String(m._id))
      return p ? sideFromScore(p.homeGoals, p.awayGoals, p.advancer) : null
    },
    refLabels: true,
  })

  const now = Date.now()
  const rows = resolved.map((r) => {
    const m: any = r.match
    const p = predByMatch.get(String(m._id))
    const finished = m.status === 'finished' && m.homeGoals != null && m.awayGoals != null
    const realSide = finished ? realAdvanceSide(m) : null
    return {
      _id: String(m._id),
      code: m.code,
      stage: m.stage,
      kickoffAt: m.kickoffAt,
      venue: m.venue || null,
      home: r.home, // { team, label }
      away: r.away,
      winner: r.winner, // real winner once played, else propagated from the prediction
      pred: p ? { homeGoals: p.homeGoals, awayGoals: p.awayGoals, advancer: p.advancer ?? null } : null,
      locked: now >= new Date(m.kickoffAt).getTime(),
      voided: voidCodes.has(m.code), // excluded from scoring
      // Real result once the tie is played, so locked ties can show what happened.
      result: finished
        ? { homeGoals: m.homeGoals, awayGoals: m.awayGoals, winner: realSide === 'H' ? r.home.team : realSide === 'A' ? r.away.team : null }
        : null,
    }
  })

  return {
    loggedIn: !!dbUser,
    ready, // are all groups settled (real R32 known)?
    champion: rows.find((r) => r.stage === 'final')?.winner ?? null,
    predictedCount: rows.filter((r) => r.pred).length,
    totalGames: rows.length,
    rows,
  }
})
