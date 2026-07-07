<script setup lang="ts">
import { getTeam } from '~/utils/teams'

definePageMeta({ middleware: 'new-ko-only' })
const { loggedIn } = useUserSession()
const { data, refresh } = await useFetch('/api/ko-bracket')

const ROUNDS = [
  { key: 'r32', label: '16avos' },
  { key: 'r16', label: 'Octavos' },
  { key: 'qf', label: 'Cuartos' },
  { key: 'sf', label: 'Semis' },
  { key: 'final', label: 'Final' },
] as const

const rows = computed(() => data.value?.rows || [])
const columns = computed(() =>
  ROUNDS.map((r) => ({ ...r, games: rows.value.filter((m: any) => m.stage === r.key) })),
)
const thirdPlace = computed(() => rows.value.find((m: any) => m.stage === 'third'))

// Local editable scorelines, hydrated from the server each load/refresh.
const draft = reactive<Record<string, { h: number | null; a: number | null; adv: 'H' | 'A' | null }>>({})
watch(
  () => data.value?.rows,
  (rs) => {
    if (!rs) return
    for (const r of rs as any[]) {
      draft[r.code] = { h: r.pred?.homeGoals ?? null, a: r.pred?.awayGoals ?? null, adv: r.pred?.advancer ?? null }
    }
  },
  { immediate: true },
)

const bothKnown = (m: any) => !!(m.home?.team && m.away?.team)
function sideOf(d: { h: number | null; a: number | null; adv: 'H' | 'A' | null }): 'H' | 'A' | null {
  if (d.h == null || d.a == null) return null
  if (d.h > d.a) return 'H'
  if (d.a > d.h) return 'A'
  return d.adv
}
const isLevel = (m: any) => {
  const d = draft[m.code]
  return d && d.h != null && d.a != null && d.h === d.a
}
// Highlight the real winner once a tie is played; otherwise the user's pick.
function advHighlight(m: any, side: 'home' | 'away') {
  const team = side === 'home' ? m.home?.team : m.away?.team
  if (m.result?.winner) return m.result.winner === team
  return bothKnown(m) && sideOf(draft[m.code]) === (side === 'home' ? 'H' : 'A')
}

const saving = ref<string | null>(null)
const timers: Record<string, any> = {}
function queueSave(m: any) {
  clearTimeout(timers[m.code])
  timers[m.code] = setTimeout(() => save(m), 400)
}
async function save(m: any) {
  const d = draft[m.code]
  if (!bothKnown(m) || !d || d.h == null || d.a == null || m.locked) return
  saving.value = m.code
  try {
    await $fetch('/api/ko-predictions', {
      method: 'PUT',
      body: { matchId: m._id, homeGoals: d.h, awayGoals: d.a, advancer: d.h === d.a ? d.adv : null },
    })
    await refresh() // re-propagate the user's predicted winners forward
  } catch (e: any) {
    alert(e.data?.statusMessage || 'No se pudo guardar')
  }
  saving.value = null
}

function bump(m: any, side: 'h' | 'a', delta: number) {
  if (!bothKnown(m) || m.locked) return
  const d = draft[m.code]
  const next = Math.max(0, Math.min(99, (d[side] ?? 0) + delta))
  d[side] = next
  queueSave(m)
}
function onInput(m: any, side: 'h' | 'a', e: Event) {
  const v = (e.target as HTMLInputElement).value
  const n = v === '' ? null : Math.max(0, Math.min(99, Math.floor(Number(v))))
  draft[m.code][side] = Number.isNaN(n as number) ? null : n
  queueSave(m)
}
function setAdv(m: any, side: 'H' | 'A') {
  if (m.locked) return
  draft[m.code].adv = side
  save(m)
}

// One round at a time on phones; full tree on desktop.
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
      <h1>🎯 Cuadro de Eliminatorias</h1>
      <p>Nuevo pronóstico con los <strong>equipos que realmente clasificaron</strong>. Esta vez predices el <strong>marcador</strong>: 2 puntos si aciertas el resultado exacto, 1 si solo aciertas quién avanza.</p>
    </section>

    <!-- Not logged in -->
    <div v-if="!loggedIn || data?.loggedIn === false" class="card note">
      <span class="big">🔒</span>
      <p>Inicia sesión para llenar tu cuadro de eliminatorias.</p>
      <NuxtLink class="btn" to="/login">Entrar</NuxtLink>
    </div>

    <!-- Groups not settled yet -->
    <p v-else-if="!data?.ready" class="card note">
      ⏳ El cuadro se abre cuando terminen todos los grupos y se definan los 32 clasificados.
    </p>

    <template v-else>
      <!-- Champion + progress -->
      <div class="summary">
        <div class="champ card">
          <span class="trophy">🏆</span>
          <div>
            <span class="lbl">Tu campeón</span>
            <div class="cname">
              <template v-if="data?.champion"><span class="fl">{{ flag(data.champion) }}</span> {{ data.champion }}</template>
              <span v-else class="tbd">— elige los marcadores —</span>
            </div>
          </div>
        </div>
        <div class="stat card">
          <span class="big-num">{{ data?.predictedCount }}<span class="den">/{{ data?.totalGames }}</span></span>
          <span class="stat-lbl">marcadores<br>pronosticados</span>
        </div>
      </div>

      <p v-show="!isMobile" class="scrollhint">← Desliza para ver todas las rondas →</p>

      <!-- Mobile round picker -->
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
          <div v-for="m in col.games" :key="m.code" class="seed">
            <div class="game card" :class="{ saving: saving === m.code, locked: m.locked, voided: m.voided }">
              <div class="g-meta">
                {{ shortDay(m.kickoffAt, m.venue?.tz) }} · {{ m.venue?.city }}
                <span v-if="m.locked" class="lk">🔒</span>
                <span v-if="m.voided" class="void-tag">no cuenta</span>
              </div>

              <div
                v-for="side in (['home','away'] as const)"
                :key="side"
                class="g-team"
                :class="{ adv: advHighlight(m, side), tbd: !m[side].team }"
              >
                <span class="fl">{{ flag(m[side].team) }}</span>
                <span class="nm" :class="{ slot: !m[side].team }">{{ m[side].team || m[side].label }}</span>
                <!-- Open tie: predict the score. Played/locked tie: show the result. -->
                <div v-if="bothKnown(m) && !m.locked && !m.result" class="stepper">
                  <button class="st" @click="bump(m, side === 'home' ? 'h' : 'a', -1)">−</button>
                  <input
                    class="gin"
                    type="number"
                    inputmode="numeric"
                    min="0"
                    max="99"
                    :value="draft[m.code]?.[side === 'home' ? 'h' : 'a'] ?? ''"
                    @input="onInput(m, side === 'home' ? 'h' : 'a', $event)"
                  />
                  <button class="st" @click="bump(m, side === 'home' ? 'h' : 'a', 1)">+</button>
                </div>
                <span v-else-if="m.result" class="rg">{{ side === 'home' ? m.result.homeGoals : m.result.awayGoals }}</span>
              </div>

              <!-- Penalties: who advances on a level predicted score (open ties only) -->
              <div v-if="bothKnown(m) && !m.locked && !m.result && isLevel(m)" class="advpick">
                <span class="apl">Empate · ¿quién pasa?</span>
                <div class="apbtns">
                  <button class="ap" :class="{ on: draft[m.code].adv === 'H' }" @click="setAdv(m, 'H')">{{ flag(m.home.team) }} {{ getTeam(m.home.team).abbr }}</button>
                  <button class="ap" :class="{ on: draft[m.code].adv === 'A' }" @click="setAdv(m, 'A')">{{ flag(m.away.team) }} {{ getTeam(m.away.team).abbr }}</button>
                </div>
              </div>
              <!-- Played: real score is on the rows above; show their prediction here. -->
              <div v-if="m.result" class="played">
                <template v-if="m.pred">
                  <span class="pl-lbl">🔮 Tu marcador</span>
                  <span class="pl-sc">{{ m.pred.homeGoals }}–{{ m.pred.awayGoals }}</span>
                  <span v-if="m.voided" class="pl-pts vd">no cuenta</span>
                  <span v-else-if="m.points != null" class="pl-pts" :class="{ ok: m.points > 0 }">{{ m.points > 0 ? '+' + m.points : '0' }}</span>
                </template>
                <span v-else class="pl-none">sin pronóstico</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Third place -->
      <div v-if="thirdPlace" v-show="!isMobile || mobileRound === 'third'" class="third card" :class="{ saving: saving === thirdPlace.code, locked: thirdPlace.locked, voided: thirdPlace.voided }">
        <span class="medal">🥉</span>
        <div class="tp-main">
          <span class="tp-lbl">
            Tercer puesto · {{ shortDay(thirdPlace.kickoffAt, thirdPlace.venue?.tz) }}
            <span v-if="thirdPlace.locked">🔒</span>
            <span v-if="thirdPlace.voided" class="void-tag">no cuenta</span>
          </span>
          <div class="tp-row">
            <div
              v-for="side in (['home','away'] as const)"
              :key="side"
              class="g-team"
              :class="{ adv: advHighlight(thirdPlace, side), tbd: !thirdPlace[side].team }"
            >
              <span class="fl">{{ flag(thirdPlace[side].team) }}</span>
              <span class="nm" :class="{ slot: !thirdPlace[side].team }">{{ thirdPlace[side].team || thirdPlace[side].label }}</span>
              <div v-if="bothKnown(thirdPlace) && !thirdPlace.locked && !thirdPlace.result" class="stepper">
                <button class="st" @click="bump(thirdPlace, side === 'home' ? 'h' : 'a', -1)">−</button>
                <input
                  class="gin"
                  type="number"
                  inputmode="numeric"
                  min="0"
                  max="99"
                  :value="draft[thirdPlace.code]?.[side === 'home' ? 'h' : 'a'] ?? ''"
                  @input="onInput(thirdPlace, side === 'home' ? 'h' : 'a', $event)"
                />
                <button class="st" @click="bump(thirdPlace, side === 'home' ? 'h' : 'a', 1)">+</button>
              </div>
              <span v-else-if="thirdPlace.result" class="rg">{{ side === 'home' ? thirdPlace.result.homeGoals : thirdPlace.result.awayGoals }}</span>
            </div>
          </div>
          <div v-if="bothKnown(thirdPlace) && !thirdPlace.locked && !thirdPlace.result && isLevel(thirdPlace)" class="advpick">
            <span class="apl">Empate · ¿quién pasa?</span>
            <div class="apbtns">
              <button class="ap" :class="{ on: draft[thirdPlace.code].adv === 'H' }" @click="setAdv(thirdPlace, 'H')">{{ flag(thirdPlace.home.team) }} {{ getTeam(thirdPlace.home.team).abbr }}</button>
              <button class="ap" :class="{ on: draft[thirdPlace.code].adv === 'A' }" @click="setAdv(thirdPlace, 'A')">{{ flag(thirdPlace.away.team) }} {{ getTeam(thirdPlace.away.team).abbr }}</button>
            </div>
          </div>
          <div v-if="thirdPlace.result" class="played">
            <template v-if="thirdPlace.pred">
              <span class="pl-lbl">🔮 Tu marcador</span>
              <span class="pl-sc">{{ thirdPlace.pred.homeGoals }}–{{ thirdPlace.pred.awayGoals }}</span>
              <span v-if="thirdPlace.voided" class="pl-pts vd">no cuenta</span>
              <span v-else-if="thirdPlace.points != null" class="pl-pts" :class="{ ok: thirdPlace.points > 0 }">{{ thirdPlace.points > 0 ? '+' + thirdPlace.points : '0' }}</span>
            </template>
            <span v-else class="pl-none">sin pronóstico</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.hero { background: linear-gradient(135deg, #163a2e 0%, #181b22 60%); border: 1px solid var(--line); border-radius: 16px; padding: 20px 22px; margin-bottom: 16px; }
.hero h1 { margin: 0 0 4px; font-size: 24px; }
.hero p { margin: 0; color: var(--mut); font-size: 14px; }
.hero strong { color: var(--txt); }

.card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; }
.note { display: block; text-align: center; padding: 28px 20px; color: var(--mut); }
.note .big { font-size: 34px; display: block; margin-bottom: 6px; }
.note .btn { margin-top: 10px; }

/* summary */
.summary { display: grid; grid-template-columns: 1fr auto; gap: 12px; margin-bottom: 14px; }
.champ { display: flex; align-items: center; gap: 14px; padding: 14px 16px; background: linear-gradient(135deg, rgba(245, 200, 66, .16), var(--card)); border-color: #5a4a1e; }
.champ .trophy { font-size: 34px; }
.champ .lbl { color: #f5c842; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
.champ .cname { font-size: 19px; font-weight: 800; margin-top: 3px; display: flex; align-items: center; gap: 8px; }
.champ .cname .tbd { color: var(--mut); font-style: italic; font-weight: 600; font-size: 14px; }
.stat { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px 18px; text-align: center; }
.big-num { font-size: 28px; font-weight: 900; line-height: 1; color: var(--acc); }
.big-num .den { font-size: 16px; color: var(--mut); font-weight: 800; }
.stat-lbl { color: var(--mut); font-size: 11px; font-weight: 600; margin-top: 6px; line-height: 1.3; }

.scrollhint { display: block; color: var(--mut); font-size: 12px; text-align: center; margin: 0 0 8px; }
.chips { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 14px; -webkit-overflow-scrolling: touch; }
.chips::-webkit-scrollbar { height: 0; }
.chip { flex: 0 0 auto; background: var(--card); color: var(--mut); border: 1px solid var(--line); padding: 7px 13px; border-radius: 999px; font-weight: 700; font-size: 13px; cursor: pointer; transition: .15s; white-space: nowrap; }
.chip:hover { color: var(--txt); }
.chip.on { background: var(--acc); color: #fff; border-color: var(--acc); }
.rounds { margin-bottom: 14px; }

/* bracket */
.bracket { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 10px; -webkit-overflow-scrolling: touch; }
.round { display: flex; flex-direction: column; justify-content: space-around; flex: 0 0 230px; min-width: 230px; }
.rhead { text-align: center; font-weight: 800; font-size: 13px; color: var(--mut); text-transform: uppercase; letter-spacing: .6px; padding-bottom: 10px; }
.seed { display: flex; flex-direction: column; justify-content: center; flex: 1 0 auto; padding: 6px 0; }

.game { padding: 7px; display: flex; flex-direction: column; gap: 4px; transition: border-color .15s, opacity .15s; }
.game.saving { border-color: var(--acc); }
.game.locked { opacity: .85; }
.g-meta { font-size: 10px; color: #6b7280; padding: 0 2px 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.g-meta .lk { margin-left: 4px; }

.g-team { display: flex; align-items: center; gap: 8px; width: 100%; background: #0f1116; color: var(--txt); border: 1.5px solid transparent; border-radius: 9px; padding: 6px 8px; min-height: 40px; }
.g-team .fl { font-size: 18px; flex: 0 0 auto; }
.g-team .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; font-size: 13.5px; }
.g-team .nm.slot { color: var(--mut); font-style: italic; font-weight: 600; font-size: 12px; }
.g-team.adv { background: rgba(63, 185, 80, .14); border-color: #2e5a36; }
.g-team.adv .nm { color: #d6ffd9; font-weight: 800; }
.g-team.tbd { background: transparent; border-style: dashed; border-color: var(--line); }

/* goal stepper */
.stepper { display: flex; align-items: center; gap: 0; flex: 0 0 auto; background: #0b0d12; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.stepper .st { width: 26px; height: 30px; border: none; background: transparent; color: var(--mut); font-size: 18px; font-weight: 800; cursor: pointer; line-height: 1; }
.stepper .st:hover:not(:disabled) { background: #161a22; color: var(--txt); }
.stepper .st:disabled { opacity: .4; cursor: default; }
.gin { width: 30px; height: 30px; border: none; border-left: 1px solid var(--line); border-right: 1px solid var(--line); background: transparent; color: var(--txt); text-align: center; font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; -moz-appearance: textfield; }
.gin::-webkit-outer-spin-button, .gin::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.gin:focus { outline: none; background: rgba(88,101,242,.14); }

/* voided / played ties */
.void-tag { margin-left: 6px; color: #f5c842; background: rgba(245, 200, 66, .15); border: 1px solid #5a4a1e; border-radius: 6px; padding: 0 6px; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .3px; white-space: nowrap; }
.game.voided, .third.voided { opacity: .92; border-style: dashed; }
.g-team .rg { flex: 0 0 auto; font-size: 16px; font-weight: 900; font-variant-numeric: tabular-nums; color: var(--txt); min-width: 24px; text-align: center; }
/* played tie: their prediction + points, beneath the real result on the rows */
.played { display: flex; align-items: center; gap: 7px; padding: 5px 3px 1px; margin-top: 3px; border-top: 1px dashed #232936; font-size: 11px; }
.pl-lbl { color: #8a93a3; font-weight: 700; }
.pl-sc { color: var(--txt); font-weight: 800; font-variant-numeric: tabular-nums; }
.pl-pts { margin-left: auto; font-weight: 800; font-size: 10.5px; color: var(--mut); background: #0f1116; border: 1px solid var(--line); border-radius: 999px; padding: 1px 8px; }
.pl-pts.ok { color: var(--good); border-color: #2e5a36; background: rgba(63, 185, 80, .12); }
.pl-pts.vd { color: #f5c842; border-color: #5a4a1e; background: rgba(245, 200, 66, .12); }
.pl-none { color: #6b7280; font-style: italic; }

/* penalties advancer */
.advpick { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 2px 2px 0; flex-wrap: wrap; }
.apl { font-size: 10.5px; color: #f5c842; font-weight: 700; }
.apbtns { display: flex; gap: 5px; }
.ap { background: #0f1116; border: 1px solid var(--line); color: var(--mut); border-radius: 7px; padding: 4px 8px; font-size: 11px; font-weight: 800; cursor: pointer; transition: .14s; }
.ap:hover:not(:disabled) { color: var(--txt); }
.ap.on { background: rgba(245,200,66,.18); border-color: #5a4a1e; color: #ffe9a8; }
.ap:disabled { opacity: .5; cursor: default; }

/* third place */
.third { display: flex; align-items: flex-start; gap: 14px; padding: 14px 16px; margin-top: 18px; }
.third .medal { font-size: 28px; }
.tp-main { flex: 1; min-width: 0; }
.tp-lbl { font-weight: 700; color: var(--mut); font-size: 12px; text-transform: uppercase; letter-spacing: .5px; }
.tp-row { display: flex; gap: 10px; margin-top: 8px; }
.tp-row .g-team { max-width: 260px; }

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
