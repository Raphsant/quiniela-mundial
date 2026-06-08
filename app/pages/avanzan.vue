<script setup lang="ts">
const { loggedIn } = useUserSession()
const { data: proj, refresh } = await useFetch('/api/projection')

const pct = computed(() => {
  const p = proj.value
  if (!p || !p.totalGames) return 0
  return Math.round((p.predictedCount / p.totalGames) * 100)
})

function rankClass(t: any) {
  if (t.advances) return 'adv'
  if (t.isThird) return 'third'
  return 'out'
}
function rankLabel(t: any) {
  if (t.advances) return 'Avanza'
  if (t.isThird) return '3.º'
  return 'Fuera'
}

// --- Point-tie resolution ---------------------------------------------------
// One entry per scope (group / THIRDS); merge clusters so each scope saves once.
const ties = computed(() => {
  const map = new Map<string, { scope: string; kind: string; teams: { name: string; pts: number }[] }>()
  for (const pt of proj.value?.pendingTies || []) {
    const e = map.get(pt.scope) || { scope: pt.scope, kind: pt.kind, teams: [] }
    for (const t of pt.teams) if (!e.teams.some((x) => x.name === t.name)) e.teams.push({ name: t.name, pts: t.pts })
    map.set(pt.scope, e)
  }
  return [...map.values()]
})

const drafts = reactive<Record<string, string[]>>({})
const savingTie = ref<string | null>(null)
watchEffect(() => {
  for (const t of ties.value) if (!drafts[t.scope]) drafts[t.scope] = t.teams.map((x) => x.name)
  for (const k of Object.keys(drafts)) if (!ties.value.some((t) => t.scope === k)) delete drafts[k]
})

function ptsOf(t: any, name: string) {
  return t.teams.find((x: any) => x.name === name)?.pts ?? ''
}
function move(scope: string, i: number, dir: -1 | 1) {
  const a = drafts[scope]
  const j = i + dir
  if (!a || j < 0 || j >= a.length) return
  a.splice(j, 0, a.splice(i, 1)[0]!)
}
async function saveTie(scope: string) {
  savingTie.value = scope
  try {
    await $fetch('/api/tiebreak', { method: 'PUT', body: { scope, order: drafts[scope] } })
    await refresh()
  } catch (e: any) {
    alert(e.data?.statusMessage || 'No se pudo guardar el desempate')
  }
  savingTie.value = null
}
</script>

<template>
  <div>
    <section class="hero">
      <div>
        <h1>🔮 ¿Quién avanza?</h1>
        <p>Tu proyección a los <strong>16avos de final</strong>, calculada con tus pronósticos de grupos.</p>
      </div>
      <NuxtLink class="btn ghost back" to="/">← Pronósticos</NuxtLink>
    </section>

    <div v-if="!loggedIn" class="card note">
      <NuxtLink to="/login">Inicia sesión</NuxtLink> y registra tus pronósticos para ver quién avanza.
    </div>

    <template v-else-if="proj">
      <!-- Completion -->
      <div class="card prog">
        <div class="prog-top">
          <span class="prog-lbl">{{ proj.predictedCount }} de {{ proj.totalGames }} partidos pronosticados</span>
          <span class="prog-pct">{{ pct }}%</span>
        </div>
        <div class="bar"><span class="bar-fill" :style="{ width: pct + '%' }" /></div>
        <p v-if="!proj.complete" class="prog-hint">
          Faltan picks — la proyección usa solo los partidos que ya elegiste, así que aún puede cambiar.
        </p>
        <p v-else class="prog-hint done">¡Completaste todos tus pronósticos! Esta es tu proyección definitiva.</p>
      </div>

      <!-- Point-tie resolution (blocks the bracket until done) -->
      <template v-if="ties.length">
        <div class="card tiewarn">
          <span class="tw-emoji">⚖️</span>
          <p>
            Tienes <strong>{{ ties.length }}</strong> empate(s) en puntos. En un Mundial real lo definiría la
            <strong>diferencia de goles</strong> — como aquí no llevamos goles, <strong>decídelo tú</strong>.
            Hasta resolverlos, el <NuxtLink to="/bracket">cuadro</NuxtLink> queda bloqueado.
          </p>
        </div>

        <div v-for="t in ties" :key="t.scope" class="card tiecard">
          <div class="tiehead">
            <span class="tietag">{{ t.kind === 'thirds' ? '🥉 Mejores terceros' : 'Grupo ' + t.scope }}</span>
            <span class="tiesub">Arrastra al de arriba quien termina por delante</span>
          </div>
          <div class="tielist">
            <div v-for="(name, i) in drafts[t.scope]" :key="name" class="tieitem">
              <span class="tiepos">{{ i + 1 }}</span>
              <TeamBadge class="tiename" :name="name" />
              <span class="tiepts">{{ ptsOf(t, name) }} pts</span>
              <div class="tiearrows">
                <button :disabled="i === 0" @click="move(t.scope, i, -1)" aria-label="Subir">▲</button>
                <button :disabled="i === drafts[t.scope].length - 1" @click="move(t.scope, i, 1)" aria-label="Bajar">▼</button>
              </div>
            </div>
          </div>
          <button class="btn tiesave" :disabled="savingTie === t.scope" @click="saveTie(t.scope)">
            {{ savingTie === t.scope ? 'Guardando…' : 'Guardar desempate' }}
          </button>
        </div>
      </template>

      <div v-else-if="proj.complete" class="card tieok">
        ✅ Sin empates pendientes — el cuadro está desbloqueado.
        <NuxtLink class="link" to="/bracket">Ir al cuadro →</NuxtLink>
      </div>

      <!-- Groups -->
      <h2 class="sec">Por grupo</h2>
      <p class="legend">
        <span class="dotleg adv" /> Avanza (1.º–2.º)
        <span class="dotleg third" /> Candidato a mejor 3.º
        <span class="dotleg out" /> Eliminado
      </p>
      <div class="grid">
        <div v-for="g in proj.groups" :key="g.group" class="card grp">
          <div class="grp-head">Grupo {{ g.group }}</div>
          <div
            v-for="t in g.teams"
            :key="t.name"
            class="trow"
            :class="rankClass(t)"
          >
            <span class="pos">{{ t.rank }}</span>
            <TeamBadge class="tname" :name="t.name" />
            <span v-if="t.tied" class="tie" title="Empate — orden provisional">≈</span>
            <span class="wdl">{{ t.w }}-{{ t.d }}-{{ t.l }}</span>
            <span class="pts">{{ t.pts }}</span>
            <span class="tag" :class="rankClass(t)">{{ rankLabel(t) }}</span>
          </div>
        </div>
      </div>

      <!-- Best thirds -->
      <h2 class="sec">Mejores terceros <span class="sub">— los 8 mejores avanzan</span></h2>
      <div class="card thirds">
        <div
          v-for="(t, i) in proj.thirds"
          :key="t.name"
          class="trow third-row"
          :class="{ q: t.qualifies }"
        >
          <span class="pos">{{ i + 1 }}</span>
          <span class="gtag">{{ t.group }}</span>
          <TeamBadge class="tname" :name="t.name" />
          <span v-if="t.tied" class="tie" title="Empate — orden provisional">≈</span>
          <span class="pts">{{ t.pts }} pts</span>
          <span class="tag" :class="t.qualifies ? 'adv' : 'out'">{{ t.qualifies ? 'Clasifica' : 'Fuera' }}</span>
        </div>
      </div>

      <!-- Summary -->
      <div class="card summary">
        <span class="sum-emoji">🎟️</span>
        <p><strong>{{ proj.advancing.length }} equipos</strong> avanzan a 16avos según tus pronósticos.</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.hero {
  display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;
  background: linear-gradient(135deg, #1d3a37 0%, #181b22 60%);
  border: 1px solid var(--line); border-radius: 16px; padding: 20px 22px; margin-bottom: 16px;
}
.hero h1 { margin: 0 0 4px; font-size: 24px; }
.hero p { margin: 0; color: var(--mut); font-size: 14px; }
.hero p strong { color: #00c2a8; }
.back { flex: 0 0 auto; }

.card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; }
.note { padding: 16px; color: var(--mut); }
.note a { color: var(--acc); }

/* Completion */
.prog { padding: 14px 16px; margin-bottom: 18px; }
.prog-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
.prog-lbl { font-weight: 700; font-size: 14px; }
.prog-pct { font-weight: 800; color: #00c2a8; }
.bar { height: 8px; border-radius: 999px; background: #20242e; overflow: hidden; }
.bar-fill { display: block; height: 100%; background: linear-gradient(90deg, var(--acc), #00c2a8); transition: width .4s ease; }
.prog-hint { margin: 10px 0 0; font-size: 12.5px; color: var(--mut); }
.prog-hint.done { color: var(--good); }

/* Tie resolution */
.tiewarn { display: flex; gap: 12px; align-items: flex-start; padding: 14px 16px; margin-bottom: 12px; border-color: #4a4220; background: linear-gradient(135deg, rgba(210, 153, 34, .12), var(--card)); }
.tiewarn .tw-emoji { font-size: 24px; flex: 0 0 auto; }
.tiewarn p { margin: 0; color: var(--mut); font-size: 13.5px; line-height: 1.5; }
.tiewarn strong { color: var(--txt); }
.tiewarn a { color: #f5c842; font-weight: 700; }
.tiecard { padding: 14px 16px; margin-bottom: 12px; }
.tiehead { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.tietag { font-weight: 800; font-size: 13px; color: #d29922; background: rgba(210, 153, 34, .14); padding: 3px 10px; border-radius: 999px; }
.tiesub { color: var(--mut); font-size: 12px; }
.tielist { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.tieitem { display: grid; grid-template-columns: 22px 1fr auto auto; align-items: center; gap: 10px; background: #0f1116; border: 1px solid var(--line); border-radius: 9px; padding: 8px 10px; }
.tiepos { font-weight: 800; color: var(--acc); text-align: center; }
.tiename { min-width: 0; }
.tiepts { font-weight: 700; font-variant-numeric: tabular-nums; color: var(--mut); font-size: 12.5px; }
.tiearrows { display: flex; gap: 4px; }
.tiearrows button { width: 28px; height: 28px; border-radius: 7px; border: 1px solid var(--line); background: var(--card); color: var(--txt); cursor: pointer; font-size: 11px; }
.tiearrows button:disabled { opacity: .35; cursor: default; }
.tiearrows button:hover:not(:disabled) { border-color: var(--acc); }
.tiesave { width: 100%; }
.tieok { padding: 14px 16px; margin-bottom: 12px; color: var(--good); border-color: #2e5a36; }
.tieok .link { color: var(--acc); font-weight: 700; text-decoration: none; margin-left: 8px; }

.sec { font-size: 18px; margin: 22px 0 6px; }
.sec .sub { color: var(--mut); font-size: 13px; font-weight: 500; }
.legend { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; color: var(--mut); font-size: 12px; margin: 0 0 14px; }
.dotleg { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
.dotleg.adv { background: var(--good); }
.dotleg.third { background: #d29922; }
.dotleg.out { background: #4a5160; }

/* Groups grid */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 12px; }
.grp { padding: 6px 6px 8px; }
.grp-head { font-weight: 800; font-size: 13px; color: var(--mut); text-transform: uppercase; letter-spacing: .5px; padding: 8px 10px 6px; }

.trow {
  display: grid; grid-template-columns: 20px 1fr auto auto auto auto; align-items: center; gap: 8px;
  padding: 7px 10px; border-radius: 9px; position: relative;
}
.trow + .trow { margin-top: 2px; }
.trow.adv { background: rgba(63, 185, 80, .08); }
.trow.third { background: rgba(210, 153, 34, .08); }
.trow.out { opacity: .62; }
.pos { font-weight: 800; color: var(--mut); font-size: 13px; text-align: center; }
.tname { min-width: 0; }
.tie { color: #d29922; font-weight: 900; }
.wdl { font-size: 12px; color: var(--mut); font-variant-numeric: tabular-nums; }
.pts { font-weight: 800; font-variant-numeric: tabular-nums; min-width: 22px; text-align: right; }
.tag { font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
.tag.adv { background: rgba(63, 185, 80, .16); color: var(--good); }
.tag.third { background: rgba(210, 153, 34, .16); color: #d29922; }
.tag.out { background: #20242e; color: var(--mut); }

/* Thirds */
.thirds { padding: 8px; }
.third-row { grid-template-columns: 20px 22px 1fr auto auto auto; }
.third-row.q { background: rgba(63, 185, 80, .08); }
.gtag { font-weight: 800; font-size: 11px; color: #8b95f7; background: rgba(88, 101, 242, .12); border-radius: 6px; text-align: center; padding: 2px 0; }

/* Summary */
.summary { display: flex; align-items: center; gap: 12px; padding: 16px; margin-top: 16px; background: linear-gradient(135deg, rgba(0, 194, 168, .12), var(--card)); border-color: #1d4a45; }
.summary .sum-emoji { font-size: 30px; }
.summary p { margin: 0; color: var(--mut); }
.summary strong { color: var(--txt); }

@media (max-width: 560px) {
  .hero h1 { font-size: 20px; }
  .back { width: 100%; text-align: center; }
  .grid { grid-template-columns: 1fr; }
  .trow { grid-template-columns: 18px 1fr auto auto auto; }
  .wdl { display: none; }
}
</style>
