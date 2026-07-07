import { Match } from '../models/Match'
import { User } from '../models/User'
import { KnockoutPrediction } from '../models/KnockoutPrediction'
import { realGroupTables, resolveRealBracket, resolveUserScorelineBracket } from '../utils/bracket'
import { sideFromScore } from '../utils/scoring'

// The logged-in user's NEW knockout bracket, as a CLASSIC bracket: the Round of
// 32 is the ACTUAL qualified teams, and every later round shows the teams the
// USER predicted to advance (their own winners propagate all the way up, so their
// champion is always their pick and never changes when a real favourite is
// knocked out). Real results are used only for FEEDBACK per tie: a tie the user
// predicted scores (team-based) only when the matchup they drew actually happened;
// once the real teams for a slot differ from theirs, that slot is "busted".
export default defineEventHandler(async (event) => {
  const rc = useRuntimeConfig()
  if (!rc.public.newKo) {
    throw createError({ statusCode: 404, statusMessage: 'No disponible' })
  }
  const voidCodes = new Set(
    String(rc.scoring.koVoid || '').split(',').map((s) => s.trim()).filter(Boolean),
  )
  const koCfg = { exact: Number(rc.scoring.koExact), winner: Number(rc.scoring.koWinner) }

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

  // The user's OWN bracket: their predicted winners propagate all the way up.
  const userBracket = resolveUserScorelineBracket(tables, koMatches, predByMatch)
  // The REAL bracket (actual teams/results), used only to judge each tie.
  const real = resolveRealBracket(groupMatches, koMatches)
  const realByCode = new Map(real.resolved.map((r) => [r.match.code, r]))

  const now = Date.now()
  const rows = userBracket.resolved.map((r) => {
    const m: any = r.match
    const p = predByMatch.get(String(m._id))
    const voided = voidCodes.has(m.code)
    const rr = realByCode.get(m.code) // real teams + winner for this slot

    const scoreable = m.status === 'finished' && m.homeGoals != null && m.awayGoals != null
    const finished = scoreable && !(m.homeGoals === m.awayGoals && !m.advancer) // pens not entered → not final yet

    // Does the matchup the user drew for this slot actually occur in reality?
    const realHome = rr?.home.team ?? null
    const realAway = rr?.away.team ?? null
    const realTeamsKnown = !!(realHome && realAway)
    const matchupMatches = realTeamsKnown && r.home.team === realHome && r.away.team === realAway
    // Their bracket has diverged here — the tie they predicted can never happen —
    // once the real teams for this slot are known and differ from theirs.
    const busted = realTeamsKnown && !!(r.home.team && r.away.team) && !matchupMatches

    // Team-based points: only when the predicted matchup actually took place.
    let points: number | null = null
    if (finished && p && !voided) {
      if (matchupMatches) {
        const ph = Number(p.homeGoals), pa = Number(p.awayGoals)
        const predSide = sideFromScore(ph, pa, p.advancer)
        const predWinner = predSide === 'H' ? r.home.team : predSide === 'A' ? r.away.team : null
        points = ph === Number(m.homeGoals) && pa === Number(m.awayGoals)
          ? koCfg.exact
          : predWinner && rr!.winner && predWinner === rr!.winner ? koCfg.winner : 0
      } else {
        points = 0 // the tie they predicted didn't happen → no points
      }
    }

    return {
      _id: String(m._id),
      code: m.code,
      stage: m.stage,
      kickoffAt: m.kickoffAt,
      venue: m.venue || null,
      home: r.home, // { team, label } — the USER's predicted teams
      away: r.away,
      winner: r.winner, // the USER's predicted winner (their champion path)
      pred: p ? { homeGoals: Number(p.homeGoals), awayGoals: Number(p.awayGoals), advancer: p.advancer ?? null } : null,
      locked: now >= new Date(m.kickoffAt).getTime(),
      voided, // excluded from scoring
      points, // earned points (null until scoreable / no prediction / voided)
      busted, // the user's predicted matchup can no longer happen
      // The real teams that actually took this slot (for "este cruce no se dio").
      realTeams: realTeamsKnown ? { home: realHome, away: realAway } : null,
      // Real score shown inline only when the matchup matches (so it lines up with
      // the user's own two teams); a busted slot has no comparable score.
      result: finished && matchupMatches
        ? { homeGoals: m.homeGoals, awayGoals: m.awayGoals, winner: rr!.winner }
        : null,
    }
  })

  return {
    loggedIn: !!dbUser,
    ready, // are all groups settled (real R32 known)?
    champion: rows.find((r) => r.stage === 'final')?.winner ?? null, // the user's pick
    predictedCount: rows.filter((r) => r.pred).length,
    totalGames: rows.length,
    rows,
  }
})
