import { User } from '../../models/User'
import { Match } from '../../models/Match'
import { Prediction } from '../../models/Prediction'
import { Tiebreak } from '../../models/Tiebreak'
import { resolveUserBracket } from '../../utils/bracket'
import type { Outcome } from '../../utils/projection'

// Group stage first (by code), then knockout rounds in bracket order.
const STAGE_ORDER: Record<string, number> = { group: 0, r32: 1, r16: 2, qf: 3, sf: 4, third: 5, final: 6 }

// Admin-only, READ-ONLY: every registered user with the predictions they've made.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const [users, matches, preds, ties] = await Promise.all([
    User.find().lean(),
    Match.find().lean(),
    Prediction.find().lean(),
    Tiebreak.find().lean(),
  ])

  const matchById = new Map(matches.map((m: any) => [String(m._id), m]))
  const groupMatches = matches.filter((m: any) => m.stage === 'group')
  const koMatches = matches.filter((m: any) => m.stage !== 'group')

  const byUser = new Map<string, any[]>()
  for (const p of preds as any[]) {
    const arr = byUser.get(String(p.user)) || []
    arr.push(p)
    byUser.set(String(p.user), arr)
  }
  const tiesByUser = new Map<string, Record<string, string[]>>()
  for (const t of ties as any[]) {
    const rec = tiesByUser.get(String(t.user)) || {}
    rec[t.scope] = t.order || []
    tiesByUser.set(String(t.user), rec)
  }

  const rows = users
    .map((u: any) => {
      const userPreds = byUser.get(String(u._id)) || []

      // Resolve THIS user's predicted bracket so their knockout picks can be
      // shown with the team names their own group picks send to each match.
      const groupPickByMatch = new Map<string, Outcome>()
      const koPickByCode = new Map<string, Outcome>()
      for (const p of userPreds) {
        const m = matchById.get(String(p.match))
        if (!m || !p.outcome) continue
        if (m.stage === 'group') groupPickByMatch.set(String(m._id), p.outcome)
        else koPickByCode.set(m.code, p.outcome)
      }
      const bracket = resolveUserBracket({
        groupMatches,
        koMatches,
        groupPickByMatch,
        koPickByCode,
        tiebreaks: tiesByUser.get(String(u._id)) || {},
      })
      const slotByCode = new Map(bracket.resolved.map((r) => [r.match.code, r]))

      const predictions = userPreds
        .map((p: any) => {
          const m = matchById.get(String(p.match))
          if (!m) return null
          const slot = m.stage === 'group' ? null : slotByCode.get(m.code)
          return {
            code: m.code,
            stage: m.stage,
            // Group fixtures: fixed teams. Knockout: the teams THIS user's own
            // bracket puts here (null while their group picks are incomplete).
            home: m.homeTeam ?? slot?.home.team ?? null,
            away: m.awayTeam ?? slot?.away.team ?? null,
            outcome: p.outcome, // 'H' | 'D' | 'A'
          }
        })
        .filter(Boolean)
        .sort(
          (a: any, b: any) =>
            (STAGE_ORDER[a.stage] ?? 9) - (STAGE_ORDER[b.stage] ?? 9) ||
            String(a.code).localeCompare(String(b.code), undefined, { numeric: true }),
        )

      return {
        id: String(u._id),
        username: u.username,
        displayName: u.displayName || u.username,
        isAdmin: !!u.isAdmin,
        count: predictions.length,
        predictions,
      }
    })
    .sort((a, b) => b.count - a.count || a.username.localeCompare(b.username))

  return { totalMatches: matches.length, users: rows }
})
