import { z } from 'zod'
import { Match } from '../models/Match'
import { KnockoutPrediction } from '../models/KnockoutPrediction'

// Save one knockout SCORELINE prediction for the new bracket. Writes to the
// dedicated KnockoutPrediction collection — the old outcome-only `Prediction`
// data is never touched. Only active while the new-knockout feature is on.
const schema = z.object({
  matchId: z.string().length(24),
  homeGoals: z.number().int().min(0).max(99),
  awayGoals: z.number().int().min(0).max(99),
  // Who advances on a LEVEL predicted score (penalties). Ignored otherwise.
  advancer: z.enum(['H', 'A']).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  if (!useRuntimeConfig().public.newKo) {
    throw createError({ statusCode: 404, statusMessage: 'No disponible' })
  }
  const dbUser = await requireDbUser(event)
  const body = await readValidatedBody(event, schema.parse)

  const match = await Match.findById(body.matchId)
  if (!match) throw createError({ statusCode: 404, statusMessage: 'Match not found' })
  if (match.stage === 'group') {
    throw createError({ statusCode: 400, statusMessage: 'Solo se predicen marcadores de eliminatorias' })
  }

  // Per-match lock: a tie closes at its own kickoff (knockout hasn't begun yet,
  // so everything is open now and later rounds stay editable until they start).
  if (Date.now() >= new Date(match.kickoffAt).getTime()) {
    throw createError({ statusCode: 403, statusMessage: 'Este partido ya comenzó: marcador cerrado' })
  }

  // `advancer` only means something for a level score; store null otherwise so a
  // later edit can't leave a stale winner behind (mirrors result.put.ts).
  const advancer = body.homeGoals === body.awayGoals ? body.advancer ?? null : null

  const pred = await KnockoutPrediction.findOneAndUpdate(
    { user: dbUser._id, match: match._id },
    { homeGoals: body.homeGoals, awayGoals: body.awayGoals, advancer },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  return {
    matchId: String(match._id),
    homeGoals: pred.homeGoals,
    awayGoals: pred.awayGoals,
    advancer: pred.advancer,
  }
})
