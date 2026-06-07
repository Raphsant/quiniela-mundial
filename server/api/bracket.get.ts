import { User } from '../models/User'
import { Match } from '../models/Match'
import { Prediction } from '../models/Prediction'
import { project, type GroupMatch, type Outcome } from '../utils/projection'

const STAGE_RANK: Record<string, number> = { r32: 0, r16: 1, qf: 2, sf: 3, third: 4, final: 5 }

// Deterministic perfect matching (Kuhn's) of qualifying 3rd-placed teams to the
// eight Round-of-32 "third" slots, honouring each slot's allowed group set.
// FIFA resolves this from a 495-row table; this produces a valid, stable
// assignment (a third's exact slot may differ from the official table).
function matchThirds(
  thirds: { group: string; name: string }[],
  slots: { key: string; groups: string[] }[],
): Record<string, string> {
  const left = [...thirds].sort((a, b) => a.group.localeCompare(b.group))
  const slotOf = new Array(slots.length).fill(-1) // slot index -> left index
  const can = (li: number, si: number) => slots[si].groups.includes(left[li].group)

  function augment(li: number, seen: boolean[]): boolean {
    for (let si = 0; si < slots.length; si++) {
      if (!can(li, si) || seen[si]) continue
      seen[si] = true
      if (slotOf[si] === -1 || augment(slotOf[si], seen)) {
        slotOf[si] = li
        return true
      }
    }
    return false
  }
  for (let li = 0; li < left.length; li++) augment(li, new Array(slots.length).fill(false))

  const out: Record<string, string> = {}
  slots.forEach((s, si) => {
    if (slotOf[si] !== -1) out[s.key] = left[slotOf[si]].name
  })
  return out
}

export default defineEventHandler(async (event) => {
  await connectDB()

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
  if (dbUser) {
    const preds = await Prediction.find({ user: dbUser._id }).lean()
    const codeById = new Map(koMatches.map((m: any) => [String(m._id), m.code]))
    for (const p of preds as any[]) {
      if (!p.outcome) continue
      const code = codeById.get(String(p.match))
      if (code) koPickByCode.set(code, p.outcome)
      else groupPickByMatch.set(String(p.match), p.outcome)
    }
  }

  const input: GroupMatch[] = groupMatches.map((m: any) => ({
    group: m.group,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    pick: groupPickByMatch.get(String(m._id)) || null,
  }))
  const proj = project(input)

  const groupComplete: Record<string, boolean> = {}
  const groupPos: Record<string, string[]> = {}
  for (const g of proj.groups) {
    groupComplete[g.group] = g.complete
    groupPos[g.group] = g.teams.map((t) => t.name)
  }
  const allComplete = proj.complete

  // --- resolve the bracket, propagating each pick to the next round ---
  const ordered = [...koMatches].sort(
    (a: any, b: any) => STAGE_RANK[a.stage] - STAGE_RANK[b.stage] || a.code.localeCompare(b.code),
  )

  // Third-slot → team, via the matching above (only meaningful once all groups done).
  let thirdByKey: Record<string, string> = {}
  if (allComplete) {
    const slots: { key: string; groups: string[] }[] = []
    for (const m of ordered) {
      for (const side of ['home', 'away'] as const) {
        const f = side === 'home' ? (m as any).feedHome : (m as any).feedAway
        if (f?.t === 'third') slots.push({ key: `${(m as any).code}:${side}`, groups: f.g })
      }
    }
    const qThirds = proj.thirds.filter((t) => t.qualifies).map((t) => ({ group: t.group, name: t.name }))
    thirdByKey = matchThirds(qThirds, slots)
  }

  const winnerByCode: Record<string, string | null> = {}
  const loserByCode: Record<string, string | null> = {}

  function resolveSlot(feed: any, code: string, side: string): { team: string | null; label: string } {
    if (!feed) return { team: null, label: 'Por definir' }
    if (feed.t === 'pos') {
      const label = `${feed.n}.º ${feed.g}`
      const team = groupComplete[feed.g] ? groupPos[feed.g]?.[feed.n - 1] ?? null : null
      return { team, label }
    }
    if (feed.t === 'third') {
      return { team: thirdByKey[`${code}:${side}`] ?? null, label: `3.º (${feed.g.join('/')})` }
    }
    if (feed.t === 'win') return { team: winnerByCode[feed.c] ?? null, label: 'Ganador' }
    if (feed.t === 'lose') return { team: loserByCode[feed.c] ?? null, label: 'Perdedor' }
    return { team: null, label: 'Por definir' }
  }

  const matches = ordered.map((m: any) => {
    const home = resolveSlot(m.feedHome, m.code, 'home')
    const away = resolveSlot(m.feedAway, m.code, 'away')
    const pick = koPickByCode.get(m.code) || null
    let winner: string | null = null
    if (home.team && away.team && pick) {
      winner = pick === 'H' ? home.team : away.team
      winnerByCode[m.code] = winner
      loserByCode[m.code] = pick === 'H' ? away.team : home.team
    } else {
      winnerByCode[m.code] = null
      loserByCode[m.code] = null
    }
    return {
      _id: String(m._id),
      code: m.code,
      stage: m.stage,
      kickoffAt: m.kickoffAt,
      venue: m.venue || null,
      home,
      away,
      pick,
      winner,
    }
  })

  return {
    loggedIn: !!dbUser,
    locked,
    complete: allComplete,
    predictedCount: proj.predictedCount,
    totalGames: proj.totalGames,
    champion: winnerByCode['F-01'] || null,
    matches,
  }
})
