import { User } from '../models/User'
import { Match } from '../models/Match'
import { Prediction } from '../models/Prediction'
import { project, type GroupMatch, type Outcome } from '../utils/projection'

// Projects the logged-in user's group-stage picks into a Round-of-32 forecast.
export default defineEventHandler(async (event) => {
  await connectDB()

  const session = await getUserSession(event)
  const groupMatches = await Match.find({ stage: 'group' }).lean()

  const pickByMatch = new Map<string, Outcome>()
  if (session?.user) {
    const dbUser = await User.findById((session.user as any).id).lean()
    if (dbUser) {
      const preds = await Prediction.find({ user: dbUser._id }).lean()
      for (const p of preds as any[]) if (p.outcome) pickByMatch.set(String(p.match), p.outcome)
    }
  }

  const input: GroupMatch[] = groupMatches.map((m: any) => ({
    group: m.group,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    pick: pickByMatch.get(String(m._id)) || null,
  }))

  return project(input)
})
