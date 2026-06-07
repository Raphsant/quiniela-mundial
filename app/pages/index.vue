<script setup lang="ts">
import { getTeam } from '~/utils/teams'

const { loggedIn } = useUserSession()
// deep:true is required — Nuxt 4 defaults useFetch to a shallowRef, so mutating
// m.prediction.outcome (below) wouldn't be reactive and the UI wouldn't update.
const { data: matches, refresh } = await useFetch('/api/matches', { deep: true })
const saving = ref<string | null>(null)
const justSaved = ref<string | null>(null)

// Only group-stage matches live here; knockouts have their own bracket page.
const groupMatches = computed(() => (matches.value || []).filter((m: any) => m.stage === 'group'))

const groups = computed(() =>
  [...new Set(groupMatches.value.map((m: any) => m.group))].sort() as string[],
)
const activeGroup = ref<string>('')
watchEffect(() => {
  if (!activeGroup.value && groups.value.length) activeGroup.value = groups.value[0]!
})

const visible = computed(() =>
  groupMatches.value.filter((m: any) => m.group === activeGroup.value),
)

// Ensure each match has a local prediction object to bind to.
watchEffect(() => {
  groupMatches.value.forEach((m: any) => {
    if (!m.prediction) m.prediction = { outcome: null }
  })
})

// Progress: how many picks are in for the active group.
const filled = computed(() => visible.value.filter((m: any) => m.prediction?.outcome).length)

// Display kickoff in the venue's own local time (falls back to viewer tz).
function dayStr(d: string, tz?: string) {
  return new Date(d).toLocaleDateString('es', { weekday: 'short', day: '2-digit', month: 'short', timeZone: tz })
}
function timeStr(d: string, tz?: string) {
  return new Date(d).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', timeZone: tz })
}
function matchday(m: any) {
  const n = Number(String(m.code || '').split('-')[1] || 0)
  return n ? Math.ceil(n / 2) : null
}
function countdown(d: string) {
  const ms = new Date(d).getTime() - Date.now()
  if (ms <= 0) return null
  const days = Math.floor(ms / 8.64e7)
  if (days >= 1) return `en ${days} día${days > 1 ? 's' : ''}`
  const hrs = Math.floor(ms / 3.6e6)
  if (hrs >= 1) return `en ${hrs} h`
  return 'pronto'
}

function flag(name: string) {
  return getTeam(name).flag
}

// Actual outcome of a finished match.
function actualOutcome(m: any): 'H' | 'D' | 'A' | null {
  if (m.status !== 'finished' || m.homeGoals == null) return null
  return m.homeGoals > m.awayGoals ? 'H' : m.homeGoals < m.awayGoals ? 'A' : 'D'
}
function verdict(m: any): 'hit' | 'miss' | null {
  const act = actualOutcome(m)
  if (!act || !m.prediction?.outcome) return null
  return m.prediction.outcome === act ? 'hit' : 'miss'
}
function outcomeLabel(o: string | null, m: any) {
  if (o === 'H') return `Gana ${m.homeTeam}`
  if (o === 'A') return `Gana ${m.awayTeam}`
  if (o === 'D') return 'Empate'
  return '—'
}

// One-tap pick: set the outcome and persist immediately.
async function pick(m: any, o: 'H' | 'D' | 'A') {
  if (m.locked || !loggedIn.value) return
  m.prediction.outcome = o
  saving.value = m._id
  try {
    await $fetch('/api/predictions', { method: 'PUT', body: { matchId: m._id, outcome: o } })
    justSaved.value = m._id
    setTimeout(() => (justSaved.value === m._id ? (justSaved.value = null) : null), 1200)
  } catch (e: any) {
    alert(e.data?.statusMessage || 'No se pudo guardar')
    await refresh()
  }
  saving.value = null
}
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="hero">
      <div class="hero-txt">
        <h1>⚽ Quiniela Mundial <span class="yr">2026</span></h1>
        <p>Elige quién gana cada partido y descubre quién avanza.</p>
      </div>
      <NuxtLink v-if="loggedIn" class="advance-cta" to="/avanzan">
        🔮 ¿Quién avanza?
      </NuxtLink>
    </section>

    <div v-if="!loggedIn" class="card cta">
      <span class="cta-emoji">🔒</span>
      <p>Inicia sesión para registrar tus pronósticos.</p>
      <NuxtLink class="btn" to="/login">Entrar</NuxtLink>
    </div>

    <template v-else>
      <!-- Group selector -->
      <nav class="groups">
        <button
          v-for="g in groups"
          :key="g"
          class="gbtn"
          :class="{ active: g === activeGroup }"
          @click="activeGroup = g"
        >
          Grupo {{ g }}
        </button>
      </nav>

      <div class="ghead">
        <div>
          <h2>Grupo {{ activeGroup }}</h2>
          <span class="progress">{{ filled }} de {{ visible.length }} pronósticos listos</span>
        </div>
        <div class="pbar" :aria-label="`${filled} de ${visible.length}`">
          <span class="pbar-fill" :style="{ width: visible.length ? (filled / visible.length) * 100 + '%' : '0%' }" />
        </div>
      </div>

      <!-- Matches -->
      <div class="list">
        <article
          v-for="m in visible"
          :key="m._id"
          class="match"
          :class="{ locked: m.locked && m.status !== 'finished', done: m.status === 'finished' }"
        >
          <!-- Fixture rail -->
          <header class="m-head">
            <div class="when">
              <span class="md">Jornada {{ matchday(m) }}</span>
              <span class="cal">{{ dayStr(m.kickoffAt, m.venue?.tz) }}</span>
              <span class="time">{{ timeStr(m.kickoffAt, m.venue?.tz) }}</span>
            </div>
            <span v-if="m.status === 'finished'" class="badge final"><i class="dot" />Final</span>
            <span v-else-if="m.locked" class="badge lock"><i class="dot" />Cerrado</span>
            <span v-else class="badge open"><i class="dot" />{{ countdown(m.kickoffAt) || 'Abierto' }}</span>
          </header>

          <!-- Teams -->
          <div class="row">
            <TeamBadge class="side" :name="m.homeTeam" align="left" />
            <span class="vs">vs</span>
            <TeamBadge class="side" :name="m.awayTeam" align="right" />
          </div>

          <!-- Pick control (open) -->
          <div v-if="!m.locked" class="pick" role="group" aria-label="¿Quién gana?">
            <button
              class="seg" :class="{ sel: m.prediction.outcome === 'H' }"
              :disabled="saving === m._id" @click="pick(m, 'H')"
            >
              <span class="seg-flag">{{ flag(m.homeTeam) }}</span> Gana
            </button>
            <button
              class="seg draw" :class="{ sel: m.prediction.outcome === 'D' }"
              :disabled="saving === m._id" @click="pick(m, 'D')"
            >Empate</button>
            <button
              class="seg" :class="{ sel: m.prediction.outcome === 'A' }"
              :disabled="saving === m._id" @click="pick(m, 'A')"
            >
              Gana <span class="seg-flag">{{ flag(m.awayTeam) }}</span>
            </button>
          </div>

          <!-- Footer: venue + status -->
          <footer class="m-foot">
            <span v-if="m.venue" class="venue">
              <span class="pin">📍</span>
              <span class="vtxt"><strong>{{ m.venue.stadium }}</strong> · {{ m.venue.city }}</span>
            </span>
            <span v-else class="venue tbd"><span class="pin">📍</span> Sede por confirmar</span>

            <span v-if="justSaved === m._id" class="saved">✓ Guardado</span>

            <!-- Finished result -->
            <div v-else-if="m.status === 'finished'" class="result">
              <span class="rscore">{{ m.homeGoals }}<span class="rdash">-</span>{{ m.awayGoals }}</span>
              <span v-if="verdict(m) === 'hit'" class="v hit">✅ Acertaste</span>
              <span v-else-if="verdict(m) === 'miss'" class="v miss">❌ {{ outcomeLabel(m.prediction.outcome, m) }}</span>
              <span v-else class="v none">Sin pronóstico</span>
            </div>

            <!-- Locked but not yet played: show the locked pick -->
            <span v-else-if="m.locked && m.prediction.outcome" class="v locked-pick">
              🔒 {{ outcomeLabel(m.prediction.outcome, m) }}
            </span>
          </footer>
        </article>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Hero */
.hero {
  display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;
  background: linear-gradient(135deg, #1b2a4a 0%, #181b22 60%);
  border: 1px solid var(--line); border-radius: 16px; padding: 20px 22px; margin-bottom: 18px;
}
.hero h1 { margin: 0 0 4px; font-size: 26px; }
.hero .yr { background: linear-gradient(90deg, var(--acc), #00c2a8); -webkit-background-clip: text; background-clip: text; color: transparent; }
.hero p { margin: 0; color: var(--mut); font-size: 14px; }
.advance-cta {
  flex: 0 0 auto; text-decoration: none; font-weight: 800; font-size: 14px; color: #fff;
  background: linear-gradient(135deg, var(--acc), #00c2a8); padding: 11px 16px; border-radius: 12px;
  box-shadow: 0 8px 20px -10px rgba(88, 101, 242, .8); transition: .15s;
}
.advance-cta:hover { filter: brightness(1.08); transform: translateY(-1px); }

/* CTA */
.card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; }
.cta { text-align: center; padding: 28px; }
.cta-emoji { font-size: 34px; display: block; margin-bottom: 6px; }
.cta .btn { margin-top: 10px; }

/* Group selector */
.groups { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; margin-bottom: 14px; -webkit-overflow-scrolling: touch; }
.groups::-webkit-scrollbar { height: 0; }
.gbtn {
  flex: 0 0 auto; background: var(--card); color: var(--mut); border: 1px solid var(--line);
  padding: 8px 14px; border-radius: 999px; font-weight: 700; font-size: 13px; cursor: pointer; transition: .15s;
}
.gbtn:hover { color: var(--txt); }
.gbtn.active { background: var(--acc); color: #fff; border-color: var(--acc); }

.ghead { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.ghead h2 { margin: 0 0 2px; font-size: 20px; }
.progress { color: var(--mut); font-size: 12.5px; font-weight: 600; }
.pbar { flex: 0 1 160px; height: 6px; border-radius: 999px; background: #20242e; overflow: hidden; }
.pbar-fill {
  display: block; height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, var(--acc), #00c2a8); transition: width .35s ease;
}

/* Match card */
.match {
  position: relative; overflow: hidden;
  background: var(--card);
  border: 1px solid var(--line); border-radius: 16px;
  padding: 0; margin-bottom: 14px;
  box-shadow: 0 8px 24px -18px rgba(0, 0, 0, .7);
  transition: border-color .18s, transform .18s, box-shadow .18s;
}
.match:hover { border-color: #2f3646; transform: translateY(-2px); box-shadow: 0 16px 32px -20px rgba(0, 0, 0, .85); }
.match.done { opacity: .9; }

/* Fixture rail */
.m-head {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 12px 16px 4px;
}
.when { display: flex; align-items: center; gap: 9px; min-width: 0; font-size: 12.5px; }
.md {
  font-weight: 800; font-size: 10.5px; letter-spacing: .5px; text-transform: uppercase;
  color: #8b95f7; background: rgba(88, 101, 242, .12); padding: 3px 8px; border-radius: 6px; white-space: nowrap;
}
.cal { text-transform: capitalize; white-space: nowrap; color: var(--txt); font-weight: 600; }
.time { color: var(--mut); font-variant-numeric: tabular-nums; }
.badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px 4px 8px; border-radius: 999px; font-weight: 700; font-size: 11px; white-space: nowrap;
}
.badge .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex: 0 0 auto; }
.badge.open { background: rgba(88, 101, 242, .14); color: #8b95f7; }
.badge.lock { background: rgba(210, 153, 34, .14); color: #d29922; }
.badge.final { background: rgba(63, 185, 80, .14); color: var(--good); }
.badge.open .dot { animation: pulse 1.8s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .3; } }

/* Teams */
.row { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; padding: 10px 16px 12px; }
.side { min-width: 0; }
.vs { color: #4a5160; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; }

/* Pick control (segmented 1/X/2) */
.pick { display: grid; grid-template-columns: 1fr .8fr 1fr; gap: 8px; padding: 0 16px 14px; }
.seg {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 44px; padding: 0 8px; cursor: pointer;
  background: #0f1116; color: var(--mut); border: 1.5px solid var(--line); border-radius: 11px;
  font-weight: 800; font-size: 13.5px; transition: .14s; white-space: nowrap;
}
.seg .seg-flag { font-size: 18px; }
.seg:hover:not(:disabled) { border-color: #3a4256; color: var(--txt); }
.seg.sel { background: rgba(88, 101, 242, .18); border-color: var(--acc); color: #fff; box-shadow: 0 0 0 3px rgba(88, 101, 242, .15); }
.seg.draw.sel { background: rgba(154, 163, 178, .16); border-color: #6b7280; }
.seg:disabled { cursor: default; }

/* Footer */
.m-foot {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 16px; border-top: 1px solid var(--line);
  background: rgba(0, 0, 0, .12);
}
.venue { display: flex; align-items: center; gap: 6px; min-width: 0; margin-right: auto; color: var(--mut); font-size: 12.5px; }
.venue .pin { flex: 0 0 auto; opacity: .85; }
.venue .vtxt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.venue strong { color: #c7cdd9; font-weight: 700; }
.venue.tbd { font-style: italic; }
.saved { flex: 0 0 auto; color: var(--good); font-weight: 800; font-size: 13px; }
.result { display: flex; align-items: center; gap: 10px; flex: 0 0 auto; }
.rscore { font-weight: 800; font-size: 17px; font-variant-numeric: tabular-nums; }
.rscore .rdash { color: #4a5160; margin: 0 3px; }
.v { font-size: 12.5px; font-weight: 700; padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
.v.hit { background: rgba(63, 185, 80, .16); color: var(--good); }
.v.miss { background: rgba(248, 81, 73, .14); color: #f85149; }
.v.none { background: #20242e; color: var(--mut); }
.v.locked-pick { background: rgba(210, 153, 34, .14); color: #d29922; flex: 0 0 auto; }

/* Mobile */
@media (max-width: 560px) {
  .hero { padding: 16px; }
  .hero h1 { font-size: 21px; }
  .advance-cta { width: 100%; text-align: center; }
  .ghead { flex-direction: column; align-items: stretch; gap: 8px; }
  .pbar { flex: none; }
  .m-head { padding: 11px 13px 4px; }
  .when { gap: 7px; font-size: 12px; }
  .row { gap: 8px; padding: 8px 13px 10px; }
  .pick { padding: 0 13px 13px; gap: 6px; }
  .seg { height: 42px; font-size: 12.5px; gap: 4px; padding: 0 6px; }
  .seg .seg-flag { font-size: 16px; }
  .m-foot { flex-wrap: wrap; padding: 11px 13px; }
  .result { flex: 1 1 100%; justify-content: space-between; }
}
</style>
