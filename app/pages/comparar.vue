<script setup lang="ts">
import { getTeam } from '~/utils/teams'

const { loggedIn } = useUserSession()
const selected = ref<string>('')
const { data, refresh } = await useFetch('/api/compare', {
  query: { player: selected },
})
// Re-fetch when the chosen player changes (server gates others until reveal).
watch(selected, () => refresh())

const onlyDiffs = ref(false)

const ROUNDS = [
  { key: 'r32', label: '16avos' },
  { key: 'r16', label: 'Octavos' },
  { key: 'qf', label: 'Cuartos' },
  { key: 'sf', label: 'Semis' },
  { key: 'final', label: 'Final' },
] as const

const players = computed(() => data.value?.players || [])
const meId = computed(() => data.value?.me?.id || '')
const targetId = computed(() => data.value?.target?.id || '')
const isMe = computed(() => targetId.value === meId.value)
const targetName = computed(() => data.value?.target?.name || '')

// Keep the chip selection in sync with what the server actually returned.
watchEffect(() => {
  if (!selected.value && targetId.value) selected.value = targetId.value
})

const rows = computed(() => data.value?.rows || [])

// ── Per-match comparison helpers ──────────────────────────────────────────────
// One side of a match: prefer the REAL team; fall back to the prediction while
// reality is still unknown; otherwise the structural slot label.
function cell(row: any, side: 'home' | 'away') {
  const a = row.actual?.[side]
  const p = row.predicted?.[side]
  if (a?.team) return { team: a.team, mode: 'real', label: a.label }
  if (p?.team) return { team: p.team, mode: 'pred', label: p.label }
  return { team: null, mode: 'tbd', label: a?.label || p?.label || 'Por definir' }
}
// Did the player's predicted advancer match who actually went through?
function winnerVerdict(row: any): 'hit' | 'miss' | null {
  if (!row.actual?.winner || !row.predicted?.winner) return null
  return row.predicted.winner === row.actual.winner ? 'hit' : 'miss'
}
// Mark on a real-team row: ✓ player nailed the pass, ✗ they backed this team but
// it's out, ➜ this team advanced (player picked someone else), '' otherwise.
function sideMark(row: any, side: 'home' | 'away') {
  const c = cell(row, side)
  if (c.mode !== 'real' || !row.actual?.winner) return ''
  const backed = row.predicted?.winner && row.predicted.winner === c.team
  if (row.actual.winner === c.team) return backed ? '✓' : '➜'
  return backed ? '✗' : ''
}
function sideClass(row: any, side: 'home' | 'away') {
  const c = cell(row, side)
  const adv = c.mode === 'real' && row.actual?.winner === c.team
  const backed = row.predicted?.winner && row.predicted.winner === c.team
  return {
    pred: c.mode === 'pred',
    tbd: c.mode === 'tbd',
    adv,
    hit: adv && backed,
    miss: backed && row.actual?.winner && row.actual.winner !== c.team,
  }
}
// The two teams the player sent here differ from who actually arrived?
function matchupDiffers(row: any) {
  if (!row.actual?.home?.team || !row.actual?.away?.team) return false
  const real = [row.actual.home.team, row.actual.away.team].sort()
  const pred = [row.predicted?.home?.team, row.predicted?.away?.team].filter(Boolean).sort()
  if (pred.length < 2) return false
  return real[0] !== pred[0] || real[1] !== pred[1]
}
function rowHasDiff(row: any) {
  return matchupDiffers(row) || winnerVerdict(row) === 'miss'
}

const columns = computed(() =>
  ROUNDS.map((r) => {
    let games = rows.value.filter((m: any) => m.stage === r.key)
    if (onlyDiffs.value) games = games.filter(rowHasDiff)
    return { ...r, games }
  }),
)
const thirdPlace = computed(() => {
  const tp = rows.value.find((m: any) => m.stage === 'third')
  if (!tp) return null
  if (onlyDiffs.value && !rowHasDiff(tp)) return null
  return tp
})

// Score: of the knockout ties already decided, how many passes did they call?
const decided = computed(() => rows.value.filter((m: any) => winnerVerdict(m) !== null))
const hits = computed(() => decided.value.filter((m: any) => winnerVerdict(m) === 'hit').length)
const champMatch = computed(() => winnerVerdict(rows.value.find((m: any) => m.stage === 'final') || {}))

// ── Responsive: one round at a time on phones, full tree on desktop ───────────
const isMobile = ref(false)
const mobileRound = ref<string>('r32')
let mq: MediaQueryList | null = null
function syncMq(e: { matches: boolean }) { isMobile.value = e.matches }
onMounted(() => {
  mq = window.matchMedia('(max-width: 600px)')
  syncMq(mq)
  mq.addEventListener('change', syncMq)
})
onBeforeUnmount(() => mq?.removeEventListener('change', syncMq))

function flag(name?: string | null) {
  return getTeam(name).flag
}
function shortDay(d: string, tz?: string) {
  return new Date(d).toLocaleDateString('es', { day: '2-digit', month: 'short', timeZone: tz })
}
</script>

<template>
  <div>
    <section class="hero">
      <h1>🆚 Tu cuadro vs. la realidad</h1>
      <p>Compara, llave por llave, a quién pusiste tú a avanzar contra quién está avanzando de verdad.</p>
    </section>

    <!-- Not logged in -->
    <div v-if="!loggedIn || data?.loggedIn === false" class="card note">
      <span class="big">🔒</span>
      <p>Inicia sesión para comparar tu cuadro con los resultados reales.</p>
      <NuxtLink class="btn" to="/login">Entrar</NuxtLink>
    </div>

    <template v-else>
      <p v-if="!data?.reveal" class="card reveal">
        🙈 Solo puedes comparar tu propio cuadro hasta que arranque el torneo.
      </p>

      <!-- Player selector (only meaningful once others are revealed) -->
      <nav v-if="data?.reveal && players.length > 1" class="chips players">
        <button
          v-for="p in players"
          :key="p.id"
          class="chip"
          :class="{ on: selected === p.id }"
          @click="selected = p.id"
        >
          {{ p.name }}<span v-if="p.id === meId" class="you">tú</span>
        </button>
      </nav>

      <!-- Champion comparison + accuracy -->
      <div class="summary">
        <div class="champ card">
          <div class="cc">
            <span class="cc-lbl">{{ isMe ? 'Tu campeón' : 'Campeón de ' + targetName }}</span>
            <div class="cc-team">
              <template v-if="data?.predictedChampion">
                <span class="fl">{{ flag(data.predictedChampion) }}</span> {{ data.predictedChampion }}
              </template>
              <span v-else class="tbd">— sin definir —</span>
            </div>
          </div>
          <span class="vs" :class="champMatch || ''">{{ champMatch === 'hit' ? '✓' : champMatch === 'miss' ? '✗' : 'vs' }}</span>
          <div class="cc real">
            <span class="cc-lbl">Campeón real</span>
            <div class="cc-team">
              <template v-if="data?.realChampion">
                <span class="fl">{{ flag(data.realChampion) }}</span> {{ data.realChampion }}
              </template>
              <span v-else class="tbd">por definir</span>
            </div>
          </div>
        </div>
        <div class="stat card">
          <span class="big-num">{{ hits }}<span class="den">/{{ decided.length }}</span></span>
          <span class="stat-lbl">pases acertados<br>en llaves ya definidas</span>
        </div>
      </div>

      <!-- Controls -->
      <div class="bar-row">
        <label class="toggle" :class="{ on: onlyDiffs }">
          <input v-model="onlyDiffs" type="checkbox" />
          <span>Solo diferencias</span>
        </label>
        <span class="legend">
          <span class="lg adv">➜ avanzó</span>
          <span class="lg hit">✓ acertaste</span>
          <span class="lg miss">✗ fallaste</span>
        </span>
      </div>

      <p v-show="!isMobile" class="scrollhint">← Desliza para ver todas las rondas →</p>

      <!-- Mobile: pick a round to view -->
      <nav v-show="isMobile" class="chips rounds">
        <button
          v-for="r in ROUNDS"
          :key="r.key"
          class="chip"
          :class="{ on: mobileRound === r.key }"
          @click="mobileRound = r.key"
        >{{ r.label }}</button>
        <button v-if="thirdPlace" class="chip" :class="{ on: mobileRound === 'third' }" @click="mobileRound = 'third'">3.º</button>
      </nav>

      <div class="bracket">
        <div v-for="col in columns" v-show="!isMobile || mobileRound === col.key" :key="col.key" class="round">
          <div class="rhead">{{ col.label }}</div>
          <p v-if="!col.games.length" class="round-empty">Sin diferencias</p>
          <div v-for="m in col.games" :key="m.code" class="seed">
            <div class="game card" :class="['v-' + (winnerVerdict(m) || 'none')]">
              <div class="g-meta">{{ shortDay(m.kickoffAt, m.venue?.tz) }} · {{ m.venue?.city }}</div>
              <div v-for="side in (['home','away'] as const)" :key="side" class="g-team" :class="sideClass(m, side)">
                <span class="fl">{{ flag(cell(m, side).team) }}</span>
                <span class="nm" :class="{ slot: !cell(m, side).team }">{{ cell(m, side).team || cell(m, side).label }}</span>
                <span class="mark">{{ sideMark(m, side) }}</span>
              </div>

              <!-- Where your bracket diverged -->
              <div v-if="matchupDiffers(m)" class="cmp">
                🔮 Tu llave: {{ m.predicted.home.team }} <span class="x">vs</span> {{ m.predicted.away.team }}
              </div>
              <!-- Your pass, before reality decides -->
              <div v-else-if="!m.actual?.winner && m.predicted?.winner" class="cmp pend">
                Tu pase: <strong>{{ m.predicted.winner }}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Third place -->
      <div
        v-if="thirdPlace"
        v-show="!isMobile || mobileRound === 'third'"
        class="third card"
        :class="['v-' + (winnerVerdict(thirdPlace) || 'none')]"
      >
        <span class="medal">🥉</span>
        <div class="tp-main">
          <span class="tp-lbl">Tercer puesto · {{ shortDay(thirdPlace.kickoffAt, thirdPlace.venue?.tz) }}</span>
          <div class="tp-row">
            <div v-for="side in (['home','away'] as const)" :key="side" class="g-team" :class="sideClass(thirdPlace, side)">
              <span class="fl">{{ flag(cell(thirdPlace, side).team) }}</span>
              <span class="nm" :class="{ slot: !cell(thirdPlace, side).team }">{{ cell(thirdPlace, side).team || cell(thirdPlace, side).label }}</span>
              <span class="mark">{{ sideMark(thirdPlace, side) }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.hero { background: linear-gradient(135deg, #14323a 0%, #181b22 60%); border: 1px solid var(--line); border-radius: 16px; padding: 20px 22px; margin-bottom: 16px; }
.hero h1 { margin: 0 0 4px; font-size: 24px; }
.hero p { margin: 0; color: var(--mut); font-size: 14px; }

.card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; }
.note { display: block; text-align: center; padding: 28px 20px; color: var(--mut); }
.note .big { font-size: 34px; display: block; margin-bottom: 6px; }
.note .btn { margin-top: 10px; }
.reveal { padding: 12px 16px; color: #f5c842; font-size: 13px; font-weight: 600; margin-bottom: 14px; border-color: #4a4220; background: linear-gradient(135deg, rgba(210, 153, 34, .1), var(--card)); }

/* chips */
.chips { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 14px; -webkit-overflow-scrolling: touch; }
.chips::-webkit-scrollbar { height: 0; }
.chip { flex: 0 0 auto; background: var(--card); color: var(--mut); border: 1px solid var(--line); padding: 7px 13px; border-radius: 999px; font-weight: 700; font-size: 13px; cursor: pointer; transition: .15s; white-space: nowrap; }
.chip:hover { color: var(--txt); }
.chip.on { background: var(--acc); color: #fff; border-color: var(--acc); }
.chip .you { margin-left: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; background: rgba(255,255,255,.25); padding: 1px 5px; border-radius: 6px; }

/* summary: champion compare + accuracy */
.summary { display: grid; grid-template-columns: 1fr auto; gap: 12px; margin-bottom: 14px; }
.champ { display: flex; align-items: center; gap: 10px; padding: 14px 16px; background: linear-gradient(135deg, rgba(245, 200, 66, .14), var(--card)); border-color: #5a4a1e; }
.cc { flex: 1; min-width: 0; }
.cc.real { text-align: right; }
.cc-lbl { color: var(--mut); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; }
.cc-team { font-size: 16px; font-weight: 800; margin-top: 4px; display: flex; align-items: center; gap: 7px; }
.cc.real .cc-team { justify-content: flex-end; }
.cc-team .fl { font-size: 20px; }
.cc-team .tbd { color: var(--mut); font-style: italic; font-weight: 600; font-size: 13px; }
.champ .vs { flex: 0 0 auto; font-weight: 900; font-size: 13px; color: #6b7280; width: 26px; height: 26px; display: grid; place-items: center; border-radius: 999px; background: #0f1116; }
.champ .vs.hit { color: var(--good); background: rgba(63,185,80,.16); }
.champ .vs.miss { color: #f85149; background: rgba(248,81,73,.16); }
.stat { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px 18px; text-align: center; }
.big-num { font-size: 30px; font-weight: 900; line-height: 1; color: var(--good); }
.big-num .den { font-size: 17px; color: var(--mut); font-weight: 800; }
.stat-lbl { color: var(--mut); font-size: 11px; font-weight: 600; margin-top: 6px; line-height: 1.3; }

/* control bar */
.bar-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.toggle { display: inline-flex; align-items: center; gap: 7px; cursor: pointer; user-select: none; background: var(--card); border: 1px solid var(--line); padding: 7px 13px; border-radius: 999px; font-size: 13px; font-weight: 700; color: var(--mut); transition: .15s; }
.toggle.on { color: #fff; border-color: var(--acc); background: rgba(88,101,242,.16); }
.toggle input { accent-color: var(--acc); }
.legend { display: flex; gap: 12px; flex-wrap: wrap; }
.lg { font-size: 11.5px; font-weight: 700; }
.lg.adv { color: var(--txt); }
.lg.hit { color: var(--good); }
.lg.miss { color: #f85149; }

.scrollhint { display: block; color: var(--mut); font-size: 12px; text-align: center; margin: 0 0 8px; }
.rounds { margin-bottom: 14px; }

/* bracket */
.bracket { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 10px; -webkit-overflow-scrolling: touch; }
.round { display: flex; flex-direction: column; justify-content: space-around; flex: 0 0 212px; min-width: 212px; }
.rhead { text-align: center; font-weight: 800; font-size: 13px; color: var(--mut); text-transform: uppercase; letter-spacing: .6px; padding-bottom: 10px; }
.round-empty { color: #4a5160; font-size: 12px; text-align: center; font-style: italic; }
.seed { display: flex; flex-direction: column; justify-content: center; flex: 1 0 auto; padding: 6px 0; }

.game { padding: 7px; display: flex; flex-direction: column; gap: 4px; }
.game.v-hit { border-color: #2e5a36; }
.game.v-miss { border-color: #5a2e2e; }
.g-meta { font-size: 10px; color: #6b7280; padding: 0 2px 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.g-team { display: flex; align-items: center; gap: 8px; width: 100%; background: #0f1116; color: var(--txt); border: 1.5px solid transparent; border-radius: 9px; padding: 7px 9px; min-height: 38px; }
.g-team .fl { font-size: 18px; flex: 0 0 auto; }
.g-team .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; font-size: 13.5px; }
.g-team .nm.slot { color: var(--mut); font-style: italic; font-weight: 600; font-size: 12px; }
.g-team .mark { flex: 0 0 auto; width: 15px; font-weight: 900; text-align: center; color: var(--mut); }
.g-team.adv { background: #131720; border-color: #3a4256; }
.g-team.adv .nm { color: #fff; }
.g-team.pred { border-style: dashed; border-color: var(--line); opacity: .8; }
.g-team.pred .nm { font-style: italic; color: var(--mut); }
.g-team.tbd { background: transparent; border-style: dashed; border-color: var(--line); }
.g-team.hit { background: rgba(63, 185, 80, .16); border-color: var(--good); }
.g-team.hit .nm { color: #d6ffd9; }
.g-team.hit .mark { color: var(--good); }
.g-team.miss { background: rgba(248, 81, 73, .14); border-color: #f85149; }
.g-team.miss .mark { color: #f85149; }

.cmp { font-size: 11px; color: var(--mut); padding: 2px 3px 0; line-height: 1.35; }
.cmp .x { color: #4a5160; font-weight: 700; }
.cmp.pend { color: #8a93a3; }
.cmp.pend strong { color: var(--txt); }

/* third place */
.third { display: flex; align-items: center; gap: 14px; padding: 14px 16px; margin-top: 18px; }
.third.v-hit { border-color: #2e5a36; }
.third.v-miss { border-color: #5a2e2e; }
.third .medal { font-size: 28px; }
.tp-main { flex: 1; min-width: 0; }
.tp-lbl { font-weight: 700; color: var(--mut); font-size: 12px; text-transform: uppercase; letter-spacing: .5px; }
.tp-row { display: flex; gap: 10px; margin-top: 8px; }
.tp-row .g-team { max-width: 240px; }

/* mobile */
@media (max-width: 720px) {
  .summary { grid-template-columns: 1fr; }
  .stat { flex-direction: row; gap: 12px; justify-content: flex-start; }
  .stat-lbl { text-align: left; }
}
@media (max-width: 600px) {
  .hero h1 { font-size: 20px; }
  .bracket { flex-direction: column; gap: 0; overflow-x: visible; }
  .round { flex: 1 1 auto; min-width: 0; width: 100%; }
  .rhead { text-align: left; font-size: 12px; padding: 14px 4px 8px; margin-top: 6px; border-top: 1px solid var(--line); }
  .round:first-child .rhead { border-top: none; margin-top: 0; }
  .seed { padding: 4px 0; }
  .tp-row { flex-direction: column; }
  .tp-row .g-team { max-width: none; }
}
</style>
