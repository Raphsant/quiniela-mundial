// Shared knockout-bracket resolution. Two consumers:
//   • resolveUserBracket — fills the slots from ONE user's predictions: their
//     group picks build projected tables (utils/projection) and their knockout
//     picks propagate winners. Used by /api/bracket and the admin users view.
//   • resolveRealBracket — fills the slots from REAL results: actual group
//     tables (points → goal diff → goals scored) and actual knockout scores
//     (plus the admin-set `advancer` for matches decided on penalties).
import { project, type GroupMatch, type Outcome, type Projection } from './projection'

export const STAGE_RANK: Record<string, number> = { r32: 0, r16: 1, qf: 2, sf: 3, third: 4, final: 5 }

export interface SlotInfo {
  team: string | null
  label: string // shown while the team is unknown, e.g. "1.º A" / "3.º (A/B/F)" / "Ganador R32-01"
}

export interface ResolvedKo {
  match: any
  home: SlotInfo
  away: SlotInfo
  winner: string | null
  loser: string | null
}

// FIFA's official allocation of the eight best third-placed teams to the
// Round-of-32 slots is a fixed lookup keyed by WHICH groups' thirds qualify
// (one row per 8-of-12 combination). The generic Kuhn's matching below finds
// *a* valid assignment but not necessarily FIFA's, so for the combination
// actually in play we pin the official rows. Key: sorted qualifying-group
// letters → { R32 match code: source group }.
export const OFFICIAL_THIRD_SLOTS: Record<string, Record<string, string>> = {
  // 2026 finals: thirds of B,D,E,F,I,J,K,L advance (A,C,G,H eliminated).
  'B,D,E,F,I,J,K,L': {
    'R32-01': 'D', 'R32-02': 'F', 'R32-07': 'B', 'R32-08': 'I',
    'R32-11': 'E', 'R32-12': 'K', 'R32-15': 'J', 'R32-16': 'L',
  },
}

// Match qualifying 3rd-placed teams to the eight Round-of-32 "third" slots. Uses
// FIFA's official table for the qualifying combination when known; otherwise a
// deterministic perfect matching (Kuhn's) honouring each slot's allowed groups
// (valid and stable, but a third's exact slot may differ from FIFA's).
export function matchThirds(
  thirds: { group: string; name: string }[],
  slots: { key: string; groups: string[] }[],
): Record<string, string> {
  // Official FIFA assignment for this exact qualifying-group combination, if known.
  const official = OFFICIAL_THIRD_SLOTS[[...new Set(thirds.map((t) => t.group))].sort().join(',')]
  if (official) {
    const nameByGroup = new Map(thirds.map((t) => [t.group, t.name]))
    const out: Record<string, string> = {}
    for (const s of slots) {
      const name = nameByGroup.get(official[s.key.split(':')[0]] ?? '')
      if (name) out[s.key] = name
    }
    if (Object.keys(out).length === slots.length) return out // every slot filled → trust it
  }

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

export function sortKnockout<T>(matches: T[]): T[] {
  return [...matches].sort(
    (a: any, b: any) => STAGE_RANK[a.stage] - STAGE_RANK[b.stage] || a.code.localeCompare(b.code),
  )
}

interface KnockoutOpts {
  koMatches: any[]
  groupSettled: (g: string) => boolean // may this group's pos-slots be read yet?
  groupPos: Record<string, string[]> // group → final team order (1st first)
  qualifiedThirds: { group: string; name: string }[] | null // null until knowable
  // Which side goes through; called only once both teams are known.
  advance: (m: any, home: string, away: string) => 'H' | 'A' | null
  refLabels?: boolean // "Ganador R32-01" instead of plain "Ganador"
}

// Core engine: fill every slot from its feeder descriptor, then walk the rounds
// in order propagating winners (and losers, for the 3rd-place play-off).
export function resolveKnockout({ koMatches, groupSettled, groupPos, qualifiedThirds, advance, refLabels }: KnockoutOpts): ResolvedKo[] {
  const ordered = sortKnockout(koMatches)

  // Third-slot → team, only once the set of qualifying thirds is known.
  let thirdByKey: Record<string, string> = {}
  if (qualifiedThirds) {
    const slots: { key: string; groups: string[] }[] = []
    for (const m of ordered) {
      for (const side of ['home', 'away'] as const) {
        const f = side === 'home' ? (m as any).feedHome : (m as any).feedAway
        if (f?.t === 'third') slots.push({ key: `${(m as any).code}:${side}`, groups: f.g })
      }
    }
    thirdByKey = matchThirds(qualifiedThirds, slots)
  }

  const winnerByCode: Record<string, string | null> = {}
  const loserByCode: Record<string, string | null> = {}

  function resolveSlot(feed: any, code: string, side: string): SlotInfo {
    if (!feed) return { team: null, label: 'Por definir' }
    if (feed.t === 'pos') {
      const team = groupSettled(feed.g) ? groupPos[feed.g]?.[feed.n - 1] ?? null : null
      return { team, label: `${feed.n}.º ${feed.g}` }
    }
    if (feed.t === 'third') {
      return { team: thirdByKey[`${code}:${side}`] ?? null, label: `3.º (${feed.g.join('/')})` }
    }
    if (feed.t === 'win') return { team: winnerByCode[feed.c] ?? null, label: refLabels ? `Ganador ${feed.c}` : 'Ganador' }
    if (feed.t === 'lose') return { team: loserByCode[feed.c] ?? null, label: refLabels ? `Perdedor ${feed.c}` : 'Perdedor' }
    return { team: null, label: 'Por definir' }
  }

  return ordered.map((m: any) => {
    const home = resolveSlot(m.feedHome, m.code, 'home')
    const away = resolveSlot(m.feedAway, m.code, 'away')
    let winner: string | null = null
    let loser: string | null = null
    if (home.team && away.team) {
      const side = advance(m, home.team, away.team)
      if (side === 'H') { winner = home.team; loser = away.team }
      else if (side === 'A') { winner = away.team; loser = home.team }
    }
    winnerByCode[m.code] = winner
    loserByCode[m.code] = loser
    return { match: m, home, away, winner, loser }
  })
}

// ── Per-user bracket (predictions) ───────────────────────────────────────────

export interface UserBracket {
  proj: Projection
  canResolve: boolean
  resolved: ResolvedKo[]
  champion: string | null
}

export function resolveUserBracket(opts: {
  groupMatches: any[]
  koMatches: any[]
  groupPickByMatch: Map<string, Outcome> // group match _id → 1/X/2 pick
  koPickByCode: Map<string, Outcome> // knockout code → 'H' | 'A'
  tiebreaks: Record<string, string[]>
}): UserBracket {
  const input: GroupMatch[] = opts.groupMatches.map((m: any) => ({
    group: m.group,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    pick: opts.groupPickByMatch.get(String(m._id)) || null,
  }))
  const proj = project(input, opts.tiebreaks)

  const groupComplete: Record<string, boolean> = {}
  const groupPos: Record<string, string[]> = {}
  for (const g of proj.groups) {
    groupComplete[g.group] = g.complete
    groupPos[g.group] = g.teams.map((t) => t.name)
  }
  // The bracket only fills once every group is predicted AND every points tie is
  // settled — an unresolved tie means we don't know who finishes where.
  const canResolve = proj.complete && proj.tiesResolved

  const resolved = resolveKnockout({
    koMatches: opts.koMatches,
    groupSettled: (g) => canResolve && !!groupComplete[g],
    groupPos,
    qualifiedThirds: canResolve
      ? proj.thirds.filter((t) => t.qualifies).map((t) => ({ group: t.group, name: t.name }))
      : null,
    advance: (m) => {
      const pick = opts.koPickByCode.get(m.code)
      return pick === 'H' || pick === 'A' ? pick : null
    },
  })

  const champion = resolved.find((r) => r.match.stage === 'final')?.winner ?? null
  return { proj, canResolve, resolved, champion }
}

// ── Real bracket (results entered by the admin) ──────────────────────────────

// Actual advancing side of a finished match: goals decide; a level knockout
// score falls back to the admin-set `advancer` (penalty shoot-out winner).
export function realAdvanceSide(m: any): 'H' | 'A' | null {
  if (m.status !== 'finished' || m.homeGoals == null || m.awayGoals == null) return null
  if (m.homeGoals > m.awayGoals) return 'H'
  if (m.awayGoals > m.homeGoals) return 'A'
  return m.advancer === 'H' || m.advancer === 'A' ? m.advancer : null
}

export interface RealGroupTables {
  settled: Record<string, boolean> // group → all 6 matches finished
  pos: Record<string, string[]> // group → current team order
  qualifiedThirds: { group: string; name: string }[] | null // null until every group is done
}

// Actual group tables from entered results. Sort: points → goal difference →
// goals scored → name. FIFA's deeper criteria (head-to-head, fair play, lots)
// aren't modelled — they only matter when teams are level on all three keys.
export function realGroupTables(groupMatches: any[]): RealGroupTables {
  const byGroup = new Map<string, any[]>()
  for (const m of groupMatches) {
    if (!m.group) continue
    const arr = byGroup.get(m.group) || []
    arr.push(m)
    byGroup.set(m.group, arr)
  }

  const settled: Record<string, boolean> = {}
  const pos: Record<string, string[]> = {}
  const thirdRows: { group: string; name: string; pts: number; gd: number; gf: number }[] = []

  for (const [g, ms] of byGroup) {
    const acc = new Map<string, { name: string; pts: number; gd: number; gf: number }>()
    const team = (n: string) => {
      if (!acc.has(n)) acc.set(n, { name: n, pts: 0, gd: 0, gf: 0 })
      return acc.get(n)!
    }
    for (const m of ms) {
      team(m.homeTeam)
      team(m.awayTeam)
    }

    let finished = 0
    for (const m of ms) {
      if (m.status !== 'finished' || m.homeGoals == null || m.awayGoals == null) continue
      finished++
      const h = team(m.homeTeam)
      const a = team(m.awayTeam)
      h.gf += m.homeGoals
      h.gd += m.homeGoals - m.awayGoals
      a.gf += m.awayGoals
      a.gd += m.awayGoals - m.homeGoals
      if (m.homeGoals > m.awayGoals) h.pts += 3
      else if (m.awayGoals > m.homeGoals) a.pts += 3
      else { h.pts++; a.pts++ }
    }

    const rows = [...acc.values()].sort(
      (x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.name.localeCompare(y.name),
    )
    settled[g] = ms.length > 0 && finished === ms.length
    pos[g] = rows.map((r) => r.name)
    if (settled[g] && rows[2]) thirdRows.push({ group: g, ...rows[2] })
  }

  // The eight best thirds only exist once EVERY group has finished.
  const allSettled = byGroup.size > 0 && [...byGroup.keys()].every((g) => settled[g])
  const qualifiedThirds = allSettled
    ? [...thirdRows]
        .sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.name.localeCompare(y.name))
        .slice(0, 8)
        .map((t) => ({ group: t.group, name: t.name }))
    : null

  return { settled, pos, qualifiedThirds }
}

// Bracket as reality dictates, from the results entered so far. pos-slots
// resolve as soon as their group is fully played; third-slots once all groups
// are done; win/lose-slots as knockout results (or `advancer`) land.
export function resolveRealBracket(groupMatches: any[], koMatches: any[]) {
  const tables = realGroupTables(groupMatches)
  const resolved = resolveKnockout({
    koMatches,
    groupSettled: (g) => !!tables.settled[g],
    groupPos: tables.pos,
    qualifiedThirds: tables.qualifiedThirds,
    advance: realAdvanceSide,
    refLabels: true,
  })
  const byId = new Map(resolved.map((r) => [String(r.match._id), r]))
  return { ...tables, resolved, byId }
}
