<script setup lang="ts">
definePageMeta({ middleware: 'legacy-ko-hidden' })
const { loggedIn } = useUserSession()
const { data, refresh } = await useFetch('/api/bracket')
const saving = ref<string | null>(null)

const ROUNDS = [
  { key: 'r32', label: '16avos' },
  { key: 'r16', label: 'Octavos' },
  { key: 'qf', label: 'Cuartos' },
  { key: 'sf', label: 'Semis' },
  { key: 'final', label: 'Final' },
] as const

// API already returns matches sorted by stage then bracket-order code.
const columns = computed(() =>
  ROUNDS.map((r) => ({
    ...r,
    games: (data.value?.matches || []).filter((m: any) => m.stage === r.key),
  })),
)
const thirdPlace = computed(() => (data.value?.matches || []).find((m: any) => m.stage === 'third'))

function dayStr(d: string, tz?: string) {
  return new Date(d).toLocaleDateString('es', { day: '2-digit', month: 'short', timeZone: tz })
}

// Tap the team you think wins; it propagates to the next round on refresh.
async function pickWinner(m: any, side: 'H' | 'A') {
  if (!data.value || data.value.locked || !loggedIn.value) return
  if (!m.home.team || !m.away.team) return // both sides must be known
  saving.value = m.code
  try {
    await $fetch('/api/predictions', { method: 'PUT', body: { matchId: m._id, outcome: side } })
    await refresh()
  } catch (e: any) {
    alert(e.data?.statusMessage || 'No se pudo guardar')
  }
  saving.value = null
}
</script>

<template>
  <div>
    <section class="hero">
      <h1>🏆 Cuadro Final</h1>
      <p>Predice todo el Mundial. El cuadro se llena solo con tus pronósticos de grupo — luego elige quién gana cada llave hasta la final.</p>
    </section>

    <div v-if="data?.champion" class="champ card">
      <span class="trophy">🏆</span>
      <div>
        <span class="lbl">Tu campeón del mundo</span>
        <div class="cname"><TeamBadge :name="data.champion" /></div>
      </div>
    </div>

    <div v-if="!loggedIn" class="note card">
      <NuxtLink to="/login">Inicia sesión</NuxtLink> para pronosticar las eliminatorias.
    </div>
    <NuxtLink v-else-if="!data?.complete" to="/" class="note card todo">
      🧩 Completa tus <strong>{{ data?.predictedCount }}/{{ data?.totalGames }}</strong> pronósticos de grupo para llenar el cuadro con los equipos que avanzan. <span class="go">Ir a pronósticos →</span>
    </NuxtLink>
    <NuxtLink v-else-if="data?.tiesPending" to="/avanzan" class="note card todo">
      ⚖️ Hay <strong>empate(s) en puntos</strong> que definen quién avanza. Resuélvelos en <strong>¿Quién avanza?</strong> para desbloquear el cuadro. <span class="go">Resolver empates →</span>
    </NuxtLink>
    <p v-else-if="data?.locked" class="note card">🔒 El torneo comenzó: el cuadro quedó bloqueado.</p>
    <p v-else class="note card ok">✅ ¡Cuadro completo! Elige los ganadores ronda por ronda hasta coronar a tu campeón.</p>

    <p class="scrollhint">← Desliza para ver todas las rondas →</p>

    <div class="bracket">
      <div v-for="col in columns" :key="col.key" class="round">
        <div class="rhead">{{ col.label }}</div>
        <div v-for="m in col.games" :key="m.code" class="seed">
          <div class="game card" :class="{ decided: m.winner }">
            <div class="g-meta">{{ dayStr(m.kickoffAt, m.venue?.tz) }} · {{ m.venue?.city }}</div>
            <button
              v-for="side in (['H','A'] as const)"
              :key="side"
              class="g-team"
              :class="{
                sel: m.pick === side,
                dim: m.pick && m.pick !== side,
                tbd: !(side === 'H' ? m.home : m.away).team,
              }"
              :disabled="data?.locked || !loggedIn || !m.home.team || !m.away.team || saving === m.code"
              @click="pickWinner(m, side)"
            >
              <template v-if="(side === 'H' ? m.home : m.away).team">
                <TeamBadge :name="(side === 'H' ? m.home : m.away).team" compact />
                <span class="mark">{{ m.pick === side ? '✓' : '' }}</span>
              </template>
              <span v-else class="slot">{{ (side === 'H' ? m.home : m.away).label }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Third place -->
    <div v-if="thirdPlace" class="third card">
      <span class="medal">🥉</span>
      <div class="tp-main">
        <span class="tp-lbl">Tercer puesto · {{ dayStr(thirdPlace.kickoffAt, thirdPlace.venue?.tz) }}</span>
        <div class="tp-row">
          <button
            v-for="side in (['H','A'] as const)"
            :key="side"
            class="g-team"
            :class="{ sel: thirdPlace.pick === side, dim: thirdPlace.pick && thirdPlace.pick !== side, tbd: !(side === 'H' ? thirdPlace.home : thirdPlace.away).team }"
            :disabled="data?.locked || !loggedIn || !thirdPlace.home.team || !thirdPlace.away.team || saving === thirdPlace.code"
            @click="pickWinner(thirdPlace, side)"
          >
            <template v-if="(side === 'H' ? thirdPlace.home : thirdPlace.away).team">
              <TeamBadge :name="(side === 'H' ? thirdPlace.home : thirdPlace.away).team" compact />
              <span class="mark">{{ thirdPlace.pick === side ? '✓' : '' }}</span>
            </template>
            <span v-else class="slot">{{ (side === 'H' ? thirdPlace.home : thirdPlace.away).label }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero { background: linear-gradient(135deg, #3a2a1a 0%, #181b22 60%); border: 1px solid var(--line); border-radius: 16px; padding: 20px 22px; margin-bottom: 16px; }
.hero h1 { margin: 0 0 4px; font-size: 24px; }
.hero p { margin: 0; color: var(--mut); font-size: 14px; }

.card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; }
.champ { display: flex; align-items: center; gap: 14px; padding: 16px; margin-bottom: 16px; background: linear-gradient(135deg, rgba(245, 200, 66, .16), var(--card)); border-color: #5a4a1e; }
.champ .trophy { font-size: 38px; }
.champ .lbl { color: #f5c842; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
.champ .cname { font-size: 19px; margin-top: 3px; }

.note { display: block; padding: 14px 16px; color: var(--mut); font-size: 14px; margin-bottom: 16px; text-decoration: none; }
.note a { color: var(--acc); }
.note strong { color: var(--txt); }
.note.todo { border-color: #4a4220; background: linear-gradient(135deg, rgba(210, 153, 34, .1), var(--card)); }
.note.todo .go { color: #f5c842; font-weight: 700; white-space: nowrap; }
.note.ok { border-color: #2e5a36; color: var(--good); }
.scrollhint { display: none; color: var(--mut); font-size: 12px; text-align: center; margin: 0 0 8px; }

.bracket { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 10px; -webkit-overflow-scrolling: touch; scroll-snap-type: x proximity; }
.round { display: flex; flex-direction: column; justify-content: space-around; flex: 0 0 196px; min-width: 196px; scroll-snap-align: start; }
.rhead { text-align: center; font-weight: 800; font-size: 13px; color: var(--mut); text-transform: uppercase; letter-spacing: .6px; padding-bottom: 10px; position: sticky; top: 0; }
.seed { display: flex; flex-direction: column; justify-content: center; flex: 1 0 auto; padding: 6px 0; }

.game { padding: 7px; display: flex; flex-direction: column; gap: 4px; transition: border-color .15s; }
.game.decided { border-color: #3a4256; }
.g-meta { font-size: 10px; color: #6b7280; padding: 0 2px 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.g-team {
  display: flex; align-items: center; gap: 8px; width: 100%;
  background: #0f1116; color: var(--txt); border: 1.5px solid transparent; border-radius: 9px;
  padding: 7px 9px; cursor: pointer; transition: .14s; text-align: left; min-height: 38px;
}
.g-team :deep(.team) { flex: 1; min-width: 0; }
.g-team:hover:not(:disabled) { background: #161a22; }
.g-team:disabled { cursor: default; }
.g-team .mark { flex: 0 0 auto; width: 14px; font-weight: 900; color: var(--acc); }
.g-team.sel { background: rgba(88, 101, 242, .18); border-color: var(--acc); }
.g-team.sel .mark { color: #fff; }
.g-team.dim { opacity: .45; }
.g-team.tbd { background: transparent; border-style: dashed; border-color: var(--line); cursor: default; }
.slot { color: var(--mut); font-size: 12px; font-style: italic; font-weight: 600; }

/* Third place */
.third { display: flex; align-items: center; gap: 14px; padding: 14px 16px; margin-top: 18px; }
.third .medal { font-size: 28px; }
.tp-main { flex: 1; min-width: 0; }
.tp-lbl { font-weight: 700; color: var(--mut); font-size: 12px; text-transform: uppercase; letter-spacing: .5px; }
.tp-row { display: flex; gap: 10px; margin-top: 8px; }
.tp-row .g-team { max-width: 230px; }

@media (max-width: 560px) {
  .scrollhint { display: block; }
  .round { flex: 0 0 168px; min-width: 168px; }
  .hero h1 { font-size: 20px; }
  .tp-row { flex-direction: column; }
  .tp-row .g-team { max-width: none; }
}
</style>
