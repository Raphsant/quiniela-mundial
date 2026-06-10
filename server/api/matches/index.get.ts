import { User } from '../../models/User'
import { Match } from '../../models/Match'
import { Prediction } from '../../models/Prediction'
import { resolveRealBracket } from '../../utils/bracket'

export default defineEventHandler(async (event) => {
  const matches = await Match.find().sort({ kickoffAt: 1 }).lean()

  // Attach this user's predictions if logged in.
  const session = await getUserSession(event)
  const predByMatch = new Map<string, { outcome: string }>()
  if (session?.user) {
    const dbUser = await User.findById((session.user as any).id).lean()
    if (dbUser) {
      const preds = await Prediction.find({ user: dbUser._id }).lean()
      for (const p of preds) predByMatch.set(String(p.match), { outcome: (p as any).outcome })
    }
  }

  const now = Date.now()
  // Single global deadline: predictions stay editable until the FIRST match of the
  // tournament kicks off. Once that instant passes, every prediction locks.
  const firstKickoff = matches.length
    ? Math.min(...matches.map((m: any) => new Date(m.kickoffAt).getTime()))
    : Infinity
  const tournamentStarted = now >= firstKickoff

  // Real teams for the knockout slots, as far as entered results pin them down.
  const real = resolveRealBracket(
    matches.filter((m: any) => m.stage === 'group'),
    matches.filter((m: any) => m.stage !== 'group'),
  )

  return matches.map((m: any) => {
    const r = real.byId.get(String(m._id))
    return {
      _id: String(m._id),
      code: m.code,
      stage: m.stage,
      group: m.group,
      // Group fixtures carry their teams; knockout teams fill in from results.
      homeTeam: m.homeTeam ?? r?.home.team ?? null,
      awayTeam: m.awayTeam ?? r?.away.team ?? null,
      // Placeholder while a knockout side is still unknown ("1.º A", "Ganador R32-01"…).
      homeSlot: r && !r.home.team ? r.home.label : null,
      awaySlot: r && !r.away.team ? r.away.label : null,
      advancer: m.advancer ?? null,
      kickoffAt: m.kickoffAt,
      venue: m.venue || null,
      homeGoals: m.homeGoals,
      awayGoals: m.awayGoals,
      status: m.status,
      locked: tournamentStarted,
      prediction: predByMatch.get(String(m._id)) || null,
    }
  })
})
