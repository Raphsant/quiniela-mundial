<script setup lang="ts">
import { getTeam } from '~/utils/teams'

const { loggedIn } = useUserSession()
const { data } = await useFetch('/api/predictions/all')

const tab = ref<'grupos' | 'cuadro'>('grupos')

// ── Group stage ──────────────────────────────────────────────────────────────
const groupLetters = computed(() =>
  [...new Set((data.value?.group || []).map((m: any) => m.group))].sort() as string[],
)
const activeGroup = ref<string>('TODOS')
const groupMatches = computed(() => {
  const all = data.value?.group || []
  return activeGroup.value === 'TODOS' ? all : all.filter((m: any) => m.group === activeGroup.value)
})

const players = computed(() => data.value?.players || [])
const meId = computed(() => data.value?.me?.id || '')

// Split the field three ways for one group match.
function split(m: any) {
  const home: any[] = [], draw: any[] = [], away: any[] = []
  for (const p of players.value) {
    const o = m.picks[p.id]
    if (o === 'H') home.push(p)
    else if (o === 'D') draw.push(p)
    else if (o === 'A') away.push(p)
  }
  return { home, draw, away, total: home.length + draw.length + away.length }
}
function pct(n: number, total: number) {
  return total ? Math.round((n / total) * 100) : 0
}

// ── Bracket (per player) ─────────────────────────────────────────────────────
const selectedPlayer = ref<string>('')
watchEffect(() => {
  if (selectedPlayer.value && players.value.some((p: any) => p.id === selectedPlayer.value)) return
  if (!players.value.length) return
  selectedPlayer.value = players.value.some((p: any) => p.id === meId.value) ? meId.value : players.value[0].id
})
const bracket = computed(() => data.value?.brackets?.[selectedPlayer.value] || null)

const ROUNDS = [
  { key: 'r32', label: '16avos' },
  { key: 'r16', label: 'Octavos' },
  { key: 'qf', label: 'Cuartos' },
  { key: 'sf', label: 'Semis' },
  { key: 'final', label: 'Final' },
] as const
const columns = computed(() =>
  ROUNDS.map((r) => ({ ...r, games: (bracket.value?.matches || []).filter((m: any) => m.stage === r.key) })),
)
const thirdPlace = computed(() => (bracket.value?.matches || []).find((m: any) => m.stage === 'third'))

// On phones the bracket shows ONE round at a time (a comfortable vertical list);
// on desktop the whole tree is laid out horizontally. matchMedia drives the switch.
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

// ── Shared helpers ───────────────────────────────────────────────────────────
function flag(name?: string | null) {
  return getTeam(name).flag
}
function dayStr(d: string, tz?: string) {
  return new Date(d).toLocaleDateString('es', { weekday: 'short', day: '2-digit', month: 'short', timeZone: tz })
}
function timeStr(d: string, tz?: string) {
  return new Date(d).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', timeZone: tz })
}
function shortDay(d: string, tz?: string) {
  return new Date(d).toLocaleDateString('es', { day: '2-digit', month: 'short', timeZone: tz })
}
function matchday(code: string) {
  const n = Number(String(code || '').split('-')[1] || 0)
  return n ? Math.ceil(n / 2) : null
}

// Whose pick won this group outcome? null until the match is final.
function groupVerdict(m: any, o: 'H' | 'D' | 'A'): 'hit' | 'miss' | null {
  if (!m.result) return null
  return o === m.result ? 'hit' : 'miss'
}
// Did the selected player call this knockout tie right?
function koVerdict(m: any): 'hit' | 'miss' | null {
  const real = data.value?.koResult?.[m.code]
  if (!real || !m.pick) return null
  return m.pick === real ? 'hit' : 'miss'
}
function outcomeWord(o: 'H' | 'D' | 'A', m: any) {
  if (o === 'D') return 'Empate'
  return o === 'H' ? m.homeTeam : m.awayTeam
}
</script>

<template>
  <div>
    <section class="hero">
      <div>
        <h1>👀 Pronósticos de todos</h1>
        <p>Mira lo que pronosticó cada jugador — grupo por grupo y todo el cuadro.</p>
      </div>
    </section>

    <!-- Not logged in -->
    <div v-if="!loggedIn || data?.loggedIn === false" class="card note">
      <span class="big">🔒</span>
      <p>Inicia sesión para ver los pronósticos de la comunidad.</p>
      <NuxtLink class="btn" to="/login">Entrar</NuxtLink>
    </div>

    <template v-else>
      <p v-if="!data?.reveal" class="card reveal">
        🙈 Los pronósticos de los demás se revelan cuando arranca el torneo. Por ahora solo ves los tuyos.
      </p>

      <!-- Tabs -->
      <nav class="tabs">
        <button class="tab" :class="{ on: tab === 'grupos' }" @click="tab = 'grupos'">⚽ Fase de grupos</button>
        <button class="tab" :class="{ on: tab === 'cuadro' }" @click="tab = 'cuadro'">🏆 Cuadro final</button>
      </nav>

      <!-- ── GROUP STAGE ─────────────────────────────────────────────── -->
      <section v-show="tab === 'grupos'">
        <nav class="chips">
          <button class="chip" :class="{ on: activeGroup === 'TODOS' }" @click="activeGroup = 'TODOS'">Todos</button>
          <button
            v-for="g in groupLetters"
            :key="g"
            class="chip"
            :class="{ on: activeGroup === g }"
            @click="activeGroup = g"
          >Grupo {{ g }}</button>
        </nav>

        <div class="glist">
          <article v-for="m in groupMatches" :key="m._id" class="gcard card">
            <!-- fixture header -->
            <header class="gc-head">
              <span class="meta">
                <span class="gbadge">{{ m.group }}{{ matchday(m.code) ? ' · J' + matchday(m.code) : '' }}</span>
                <span class="date">{{ dayStr(m.kickoffAt, m.venue?.tz) }} · {{ timeStr(m.kickoffAt, m.venue?.tz) }}</span>
              </span>
              <span v-if="m.status === 'finished'" class="score">{{ m.homeGoals }}–{{ m.awayGoals }}</span>
              <span v-else class="pending">por jugar</span>
            </header>

            <div class="fixture">
              <span class="tm" :class="{ won: m.result === 'H', lost: m.result && m.result !== 'H' }">
                <span class="fl">{{ flag(m.homeTeam) }}</span>
                <span class="nm">{{ m.homeTeam }}</span>
              </span>
              <span class="vs">{{ m.status === 'finished' ? 'vs' : 'vs' }}</span>
              <span class="tm away" :class="{ won: m.result === 'A', lost: m.result && m.result !== 'A' }">
                <span class="nm">{{ m.awayTeam }}</span>
                <span class="fl">{{ flag(m.awayTeam) }}</span>
              </span>
            </div>

            <!-- consensus split bar -->
            <div class="bar" :aria-label="'Distribución de pronósticos'">
              <span
                class="seg h"
                :style="{ width: pct(split(m).home.length, split(m).total) + '%', '--c1': getTeam(m.homeTeam).c1, '--c2': getTeam(m.homeTeam).c2 }"
                :class="{ win: m.result === 'H', faded: m.result && m.result !== 'H' }"
              />
              <span
                class="seg d"
                :style="{ width: pct(split(m).draw.length, split(m).total) + '%' }"
                :class="{ win: m.result === 'D', faded: m.result && m.result !== 'D' }"
              />
              <span
                class="seg a"
                :style="{ width: pct(split(m).away.length, split(m).total) + '%', '--c1': getTeam(m.awayTeam).c1, '--c2': getTeam(m.awayTeam).c2 }"
                :class="{ win: m.result === 'A', faded: m.result && m.result !== 'A' }"
              />
            </div>

            <!-- three columns of names -->
            <div class="cols">
              <div v-for="col in (['H','D','A'] as const)" :key="col" class="col" :class="['v-' + (groupVerdict(m, col) || 'none')]">
                <div class="col-head">
                  <span class="ch-label">
                    <template v-if="col !== 'D'">{{ flag(col === 'H' ? m.homeTeam : m.awayTeam) }} {{ col === 'H' ? m.homeTeam : m.awayTeam }}</template>
                    <template v-else>Empate</template>
                  </span>
                  <span class="ch-count">{{ split(m)[col === 'H' ? 'home' : col === 'D' ? 'draw' : 'away'].length }}</span>
                </div>
                <div class="names">
                  <span
                    v-for="p in split(m)[col === 'H' ? 'home' : col === 'D' ? 'draw' : 'away']"
                    :key="p.id"
                    class="nchip"
                    :class="{ me: p.id === meId, hit: groupVerdict(m, col) === 'hit', miss: groupVerdict(m, col) === 'miss' }"
                  >
                    <span v-if="groupVerdict(m, col) === 'hit'" class="mk">✓</span>
                    <span v-else-if="groupVerdict(m, col) === 'miss'" class="mk">✗</span>
                    {{ p.name }}
                  </span>
                  <span v-if="!split(m)[col === 'H' ? 'home' : col === 'D' ? 'draw' : 'away'].length" class="empty">—</span>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <!-- ── BRACKET ─────────────────────────────────────────────────── -->
      <section v-show="tab === 'cuadro'">
        <nav class="chips players">
          <button
            v-for="p in players"
            :key="p.id"
            class="chip"
            :class="{ on: selectedPlayer === p.id }"
            @click="selectedPlayer = p.id"
          >
            {{ p.name }}<span v-if="p.id === meId" class="you">tú</span>
          </button>
        </nav>

        <div v-if="bracket?.champion" class="champ card">
          <span class="trophy">🏆</span>
          <div>
            <span class="lbl">Campeón de {{ players.find((p:any)=>p.id===selectedPlayer)?.name }}</span>
            <div class="cname"><span class="fl">{{ flag(bracket.champion) }}</span> {{ bracket.champion }}</div>
          </div>
        </div>
        <p v-else class="card note small">
          🧩 Este jugador aún no completó su cuadro ({{ bracket?.predictedCount || 0 }}/{{ bracket?.totalGames || 0 }} pronósticos de grupo).
        </p>

        <p v-show="!isMobile" class="scrollhint">← Desliza para ver todas las rondas →</p>

        <!-- Mobile: pick a round to view (the tree is too wide for a phone). -->
        <nav v-show="isMobile" class="chips rounds">
          <button
            v-for="r in ROUNDS"
            :key="r.key"
            class="chip"
            :class="{ on: mobileRound === r.key }"
            @click="mobileRound = r.key"
          >{{ r.label }}</button>
          <button v-if="thirdPlace" class="chip" :class="{ on: mobileRound === 'third' }" @click="mobileRound = 'third'">3.º puesto</button>
        </nav>

        <div class="bracket">
          <div v-for="col in columns" v-show="!isMobile || mobileRound === col.key" :key="col.key" class="round">
            <div class="rhead">{{ col.label }}</div>
            <div v-for="m in col.games" :key="m.code" class="seed">
              <div class="game card" :class="['v-' + (koVerdict(m) || 'none')]">
                <div class="g-meta">{{ shortDay(m.kickoffAt, m.venue?.tz) }} · {{ m.venue?.city }}</div>
                <div
                  v-for="side in (['H','A'] as const)"
                  :key="side"
                  class="g-team"
                  :class="{
                    sel: m.pick === side,
                    dim: m.pick && m.pick !== side,
                    tbd: !(side === 'H' ? m.home : m.away).team,
                    hit: m.pick === side && koVerdict(m) === 'hit',
                    miss: m.pick === side && koVerdict(m) === 'miss',
                  }"
                >
                  <template v-if="(side === 'H' ? m.home : m.away).team">
                    <span class="fl">{{ flag((side === 'H' ? m.home : m.away).team) }}</span>
                    <span class="nm">{{ (side === 'H' ? m.home : m.away).team }}</span>
                    <span class="mark">{{ m.pick === side ? (koVerdict(m) === 'miss' ? '✗' : '✓') : '' }}</span>
                  </template>
                  <span v-else class="slot">{{ (side === 'H' ? m.home : m.away).label }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- third place -->
        <div v-if="thirdPlace" v-show="!isMobile || mobileRound === 'third'" class="third card" :class="['v-' + (koVerdict(thirdPlace) || 'none')]">
          <span class="medal">🥉</span>
          <div class="tp-main">
            <span class="tp-lbl">Tercer puesto · {{ shortDay(thirdPlace.kickoffAt, thirdPlace.venue?.tz) }}</span>
            <div class="tp-row">
              <div
                v-for="side in (['H','A'] as const)"
                :key="side"
                class="g-team"
                :class="{
                  sel: thirdPlace.pick === side,
                  dim: thirdPlace.pick && thirdPlace.pick !== side,
                  tbd: !(side === 'H' ? thirdPlace.home : thirdPlace.away).team,
                  hit: thirdPlace.pick === side && koVerdict(thirdPlace) === 'hit',
                  miss: thirdPlace.pick === side && koVerdict(thirdPlace) === 'miss',
                }"
              >
                <template v-if="(side === 'H' ? thirdPlace.home : thirdPlace.away).team">
                  <span class="fl">{{ flag((side === 'H' ? thirdPlace.home : thirdPlace.away).team) }}</span>
                  <span class="nm">{{ (side === 'H' ? thirdPlace.home : thirdPlace.away).team }}</span>
                  <span class="mark">{{ thirdPlace.pick === side ? (koVerdict(thirdPlace) === 'miss' ? '✗' : '✓') : '' }}</span>
                </template>
                <span v-else class="slot">{{ (side === 'H' ? thirdPlace.home : thirdPlace.away).label }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.hero { background: linear-gradient(135deg, #2a1b4a 0%, #181b22 60%); border: 1px solid var(--line); border-radius: 16px; padding: 20px 22px; margin-bottom: 16px; }
.hero h1 { margin: 0 0 4px; font-size: 24px; }
.hero p { margin: 0; color: var(--mut); font-size: 14px; }

.card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; }
.note { display: block; text-align: center; padding: 28px 20px; color: var(--mut); }
.note .big { font-size: 34px; display: block; margin-bottom: 6px; }
.note .btn { margin-top: 10px; }
.note.small { text-align: left; padding: 14px 16px; font-size: 14px; margin-bottom: 16px; }
.reveal { padding: 12px 16px; color: #f5c842; font-size: 13px; font-weight: 600; margin-bottom: 14px; border-color: #4a4220; background: linear-gradient(135deg, rgba(210, 153, 34, .1), var(--card)); }

/* Tabs + chips */
.tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.tab { background: var(--card); color: var(--mut); border: 1px solid var(--line); padding: 9px 16px; border-radius: 999px; font-weight: 700; font-size: 14px; cursor: pointer; transition: .15s; }
.tab.on { background: var(--acc); color: #fff; border-color: var(--acc); }

.chips { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 14px; -webkit-overflow-scrolling: touch; }
.chips::-webkit-scrollbar { height: 0; }
.chip { flex: 0 0 auto; background: var(--card); color: var(--mut); border: 1px solid var(--line); padding: 7px 13px; border-radius: 999px; font-weight: 700; font-size: 13px; cursor: pointer; transition: .15s; white-space: nowrap; }
.chip:hover { color: var(--txt); }
.chip.on { background: var(--acc); color: #fff; border-color: var(--acc); }
.chip .you { margin-left: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; background: rgba(255,255,255,.25); padding: 1px 5px; border-radius: 6px; }

/* ── Group cards ── */
.glist { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.gcard { padding: 13px 15px; }
.gc-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.meta { display: flex; align-items: center; gap: 8px; min-width: 0; }
.gbadge { font-size: 10.5px; font-weight: 800; color: #b69cff; background: rgba(136, 108, 255, .14); padding: 3px 8px; border-radius: 6px; white-space: nowrap; }
.date { color: var(--mut); font-size: 12px; text-transform: capitalize; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.score { font-weight: 900; font-size: 16px; font-variant-numeric: tabular-nums; flex: 0 0 auto; }
.pending { font-size: 11px; color: var(--mut); font-style: italic; flex: 0 0 auto; }

.fixture { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; margin-bottom: 12px; }
.tm { display: flex; align-items: center; gap: 7px; min-width: 0; font-weight: 700; font-size: 14px; }
.tm.away { flex-direction: row-reverse; }
.tm .fl { font-size: 19px; flex: 0 0 auto; }
.tm .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tm.won { color: var(--good); }
.tm.lost { color: var(--mut); opacity: .7; }
.vs { color: #4a5160; font-weight: 800; font-size: 11px; }

/* split bar */
.bar { display: flex; height: 10px; border-radius: 999px; overflow: hidden; background: #0f1116; margin-bottom: 12px; gap: 2px; }
.seg { display: block; height: 100%; transition: .2s; min-width: 0; }
.seg.h { background: linear-gradient(90deg, var(--c1, var(--acc)), var(--c2, var(--acc))); }
.seg.a { background: linear-gradient(90deg, var(--c2, var(--acc)), var(--c1, var(--acc))); }
.seg.d { background: #899099; }
.seg.faded { opacity: .3; }
.seg.win { box-shadow: inset 0 0 0 2px var(--good), inset 0 0 6px rgba(63,185,80,.5); }

/* three name columns */
.cols { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
.col { background: #0f1116; border: 1px solid var(--line); border-radius: 10px; padding: 8px; min-width: 0; }
.col.v-hit { border-color: #2e5a36; background: rgba(63, 185, 80, .07); }
.col-head { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 7px; }
.ch-label { font-size: 11px; font-weight: 800; color: var(--txt); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ch-count { font-size: 11px; font-weight: 900; color: var(--mut); background: #20242e; border-radius: 999px; padding: 1px 7px; flex: 0 0 auto; }
.names { display: flex; flex-direction: column; gap: 4px; }
.nchip { display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: var(--txt); background: #181b22; border: 1px solid var(--line); border-radius: 7px; padding: 3px 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nchip .mk { font-weight: 900; flex: 0 0 auto; }
.nchip.hit { color: var(--good); border-color: #2e5a36; background: rgba(63, 185, 80, .1); }
.nchip.miss { color: var(--mut); opacity: .65; }
.nchip.me { box-shadow: inset 0 0 0 1.5px var(--acc); }
.empty { color: #4a5160; font-size: 12px; text-align: center; padding: 2px 0; }

/* ── Bracket ── */
.players { margin-bottom: 16px; }
.champ { display: flex; align-items: center; gap: 14px; padding: 14px 16px; margin-bottom: 16px; background: linear-gradient(135deg, rgba(245, 200, 66, .16), var(--card)); border-color: #5a4a1e; }
.champ .trophy { font-size: 34px; }
.champ .lbl { color: #f5c842; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
.champ .cname { font-size: 19px; font-weight: 800; margin-top: 3px; display: flex; align-items: center; gap: 8px; }
.scrollhint { display: block; color: var(--mut); font-size: 12px; text-align: center; margin: 0 0 8px; }
.rounds { margin-bottom: 14px; }

.bracket { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 10px; -webkit-overflow-scrolling: touch; }
.round { display: flex; flex-direction: column; justify-content: space-around; flex: 0 0 208px; min-width: 208px; }
.rhead { text-align: center; font-weight: 800; font-size: 13px; color: var(--mut); text-transform: uppercase; letter-spacing: .6px; padding-bottom: 10px; }
.seed { display: flex; flex-direction: column; justify-content: center; flex: 1 0 auto; padding: 6px 0; }

.game { padding: 7px; display: flex; flex-direction: column; gap: 4px; }
.game.v-hit { border-color: #2e5a36; }
.game.v-miss { border-color: #5a2e2e; }
.g-meta { font-size: 10px; color: #6b7280; padding: 0 2px 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.g-team { display: flex; align-items: center; gap: 8px; width: 100%; background: #0f1116; color: var(--txt); border: 1.5px solid transparent; border-radius: 9px; padding: 7px 9px; min-height: 38px; }
.g-team .fl { font-size: 18px; flex: 0 0 auto; }
.g-team .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; font-size: 13.5px; }
.g-team .mark { flex: 0 0 auto; width: 14px; font-weight: 900; color: var(--acc); text-align: center; }
.g-team.sel { background: rgba(88, 101, 242, .18); border-color: var(--acc); }
.g-team.sel .mark { color: #fff; }
.g-team.dim { opacity: .5; }
.g-team.tbd { background: transparent; border-style: dashed; border-color: var(--line); }
.g-team.hit { background: rgba(63, 185, 80, .16); border-color: var(--good); }
.g-team.hit .mark { color: var(--good); }
.g-team.miss { background: rgba(248, 81, 73, .14); border-color: #f85149; }
.g-team.miss .mark { color: #f85149; }
.slot { color: var(--mut); font-size: 12px; font-style: italic; font-weight: 600; }

.third { display: flex; align-items: center; gap: 14px; padding: 14px 16px; margin-top: 18px; }
.third.v-hit { border-color: #2e5a36; }
.third.v-miss { border-color: #5a2e2e; }
.third .medal { font-size: 28px; }
.tp-main { flex: 1; min-width: 0; }
.tp-lbl { font-weight: 700; color: var(--mut); font-size: 12px; text-transform: uppercase; letter-spacing: .5px; }
.tp-row { display: flex; gap: 10px; margin-top: 8px; }
.tp-row .g-team { max-width: 230px; }

/* ── Mobile ── */
@media (max-width: 720px) {
  .glist { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
  /* One round at a time, stacked as a comfortable full-width list. */
  .bracket { flex-direction: column; gap: 0; overflow-x: visible; }
  .round { flex: 1 1 auto; min-width: 0; width: 100%; }
  .rhead { text-align: left; font-size: 12px; padding: 14px 4px 8px; margin-top: 6px; border-top: 1px solid var(--line); }
  .round:first-child .rhead { border-top: none; margin-top: 0; }
  .seed { padding: 4px 0; }
  .tp-row { flex-direction: column; }
  .tp-row .g-team { max-width: none; }
}
@media (max-width: 420px) {
  .cols { grid-template-columns: 1fr; gap: 6px; }
  .col-head { margin-bottom: 5px; }
}
</style>
