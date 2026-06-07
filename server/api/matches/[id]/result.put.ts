import { z } from 'zod'
import { Match } from '../../../models/Match'

const schema = z.object({
  homeGoals: z.number().int().min(0).max(99),
  awayGoals: z.number().int().min(0).max(99),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  const body = await readValidatedBody(event, schema.parse)

  await connectDB()
  const match = await Match.findByIdAndUpdate(
    id,
    { homeGoals: body.homeGoals, awayGoals: body.awayGoals, status: 'finished' },
    { new: true },
  )
  if (!match) throw createError({ statusCode: 404, statusMessage: 'Match not found' })
  return { _id: String(match._id), homeGoals: match.homeGoals, awayGoals: match.awayGoals, status: match.status }
})
