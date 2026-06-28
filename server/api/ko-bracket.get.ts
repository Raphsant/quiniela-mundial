import { Match } from '../models/Match'
import { User } from '../models/User'
import { KnockoutPrediction } from '../models/KnockoutPrediction'
import { realGroupTables, resolveKnockout } from '../utils/bracket'
import { sideFromScore } from '../utils/scoring'

// The logged-in user's NEW knockout bracket: the Round of 32 is filled with the
// ACTUAL qualified teams (from real group results), and the user's predicted
// SCORELINES propagate their predicted winners forward round by round.
export default defineEventHandler(async (event) => {
  if (!useRuntimeConfig().public.newKo) {
    throw createError({ statusCode: 404, statusMessage: 'No disponible' })
  }

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

  // Fill the bracket from reality; propagate each tie by the user's predicted score.
  const resolved = resolveKnockout({
    koMatches,
    groupSettled: (g) => !!tables.settled[g],
    groupPos: tables.pos,
    qualifiedThirds: tables.qualifiedThirds,
    advance: (m) => {
      const p = predByMatch.get(String(m._id))
      return p ? sideFromScore(p.homeGoals, p.awayGoals, p.advancer) : null
    },
    refLabels: true,
  })

  const now = Date.now()
  const rows = resolved.map((r) => {
    const p = predByMatch.get(String(r.match._id))
    return {
      _id: String(r.match._id),
      code: r.match.code,
      stage: r.match.stage,
      kickoffAt: r.match.kickoffAt,
      venue: r.match.venue || null,
      home: r.home, // { team, label }
      away: r.away,
      winner: r.winner, // propagated from the predicted scorelines
      pred: p ? { homeGoals: p.homeGoals, awayGoals: p.awayGoals, advancer: p.advancer ?? null } : null,
      locked: now >= new Date(r.match.kickoffAt).getTime(),
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
