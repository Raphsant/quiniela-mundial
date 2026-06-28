// READ-ONLY inspection of the live bracket state. No writes whatsoever.
import 'dotenv/config'
import mongoose from 'mongoose'
import { Match } from '../server/models/Match'
import { resolveRealBracket, sortKnockout, STAGE_RANK } from '../server/utils/bracket'

async function run() {
  const uri = process.env.NUXT_MONGOOSE_URI || process.env.NUXT_MONGO_URI || process.env.MONGODB_URI
  if (!uri) throw new Error('no uri')
  await mongoose.connect(uri)

  const all = await Match.find().lean()
  const group = all.filter((m: any) => m.stage === 'group')
  const ko = all.filter((m: any) => m.stage !== 'group')

  // ---- Group stage status ----
  const byGroup = new Map<string, any[]>()
  for (const m of group) {
    const a = byGroup.get(m.group) || []
    a.push(m); byGroup.set(m.group, a)
  }
  console.log('\n===== GROUP STAGE (finished / total per group) =====')
  for (const g of [...byGroup.keys()].sort()) {
    const ms = byGroup.get(g)!
    const fin = ms.filter((m) => m.status === 'finished').length
    console.log(`Group ${g}: ${fin}/${ms.length} finished`)
  }
  // Any group match NOT finished:
  const groupUnfinished = group.filter((m: any) => m.status !== 'finished')
  console.log(`\nGroup matches NOT finished: ${groupUnfinished.length}`)
  for (const m of groupUnfinished.sort((a: any, b: any) => +new Date(a.kickoffAt) - +new Date(b.kickoffAt))) {
    console.log(`  ${m.code} ${m.homeTeam} vs ${m.awayTeam}  [${new Date(m.kickoffAt).toISOString()}] status=${m.status} ${m.homeGoals}-${m.awayGoals}`)
  }

  // ---- Knockout: raw stored results ----
  console.log('\n===== KNOCKOUT — raw stored results =====')
  for (const m of sortKnockout(ko) as any[]) {
    const score = m.status === 'finished' ? `${m.homeGoals}-${m.awayGoals}` : '(no result)'
    const adv = m.advancer ? ` advancer=${m.advancer}` : ''
    console.log(`  ${m.code.padEnd(7)} ${m.stage.padEnd(5)} ${score.padEnd(12)} status=${(m.status||'').padEnd(9)}${adv}  KO=${new Date(m.kickoffAt).toISOString()}`)
  }

  // ---- Real bracket resolution ----
  const real = resolveRealBracket(group, ko)
  console.log('\n===== KNOCKOUT — resolved teams (resolveRealBracket) =====')
  for (const r of real.resolved as any[]) {
    const m = r.match
    const h = r.home.team ? r.home.team : `<${r.home.label}>`
    const a = r.away.team ? r.away.team : `<${r.away.label}>`
    const sc = m.status === 'finished' ? `  result ${m.homeGoals}-${m.awayGoals}${m.advancer ? ' adv=' + m.advancer : ''}` : ''
    const win = r.winner ? `  -> WINNER: ${r.winner}` : (m.status === 'finished' ? '  -> WINNER: (none!)' : '')
    console.log(`  ${m.code.padEnd(7)} ${h.padEnd(26)} vs ${a.padEnd(26)}${sc}${win}`)
  }

  // ---- Diagnostic: which slots are empty and why ----
  console.log('\n===== EMPTY SLOTS (next-round spots not auto-filled) =====')
  const byCode = new Map((real.resolved as any[]).map((r) => [r.match.code, r]))
  for (const r of real.resolved as any[]) {
    const m = r.match
    for (const side of ['home', 'away'] as const) {
      const slot = r[side]
      const feed = side === 'home' ? m.feedHome : m.feedAway
      if (!slot.team) {
        let why = ''
        if (feed?.t === 'win' || feed?.t === 'lose') {
          const src = byCode.get(feed.c)
          const srcM = src?.match
          if (!srcM) why = `feeder ${feed.c} missing`
          else if (srcM.status !== 'finished') why = `feeder ${feed.c} not finished`
          else if (!src.winner && feed.t === 'win') why = `feeder ${feed.c} finished but NO WINNER (level score w/o advancer?) score=${srcM.homeGoals}-${srcM.awayGoals} adv=${srcM.advancer}`
          else if (!src.loser && feed.t === 'lose') why = `feeder ${feed.c} finished but NO LOSER`
        } else if (feed?.t === 'pos') {
          why = `group ${feed.g} not settled`
        } else if (feed?.t === 'third') {
          why = `thirds not all settled`
        }
        console.log(`  ${m.code} ${side} = <${slot.label}>  :: ${why}`)
      }
    }
  }

  // ---- Group tables (real) for settled groups, to verify standings ----
  console.log('\n===== REAL GROUP TABLES (settled groups) =====')
  for (const g of [...byGroup.keys()].sort()) {
    if (real.settled[g]) {
      console.log(`  Group ${g}: ${real.pos[g].join(' > ')}`)
    } else {
      console.log(`  Group ${g}: (not settled)`)
    }
  }
  console.log('\nQualified thirds:', real.qualifiedThirds ? real.qualifiedThirds.map((t: any) => `${t.name}(${t.group})`).join(', ') : '(not yet known)')

  await mongoose.disconnect()
}
run().catch((e) => { console.error(e); process.exit(1) })
