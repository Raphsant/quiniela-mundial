<script setup lang="ts">
const { user } = useUserSession()
const { data } = await useFetch('/api/standings')

const rows = computed(() => data.value?.standings || [])
const me = computed(() => (user.value as any)?.id || null)
const started = computed(() => (data.value?.matchesScored || 0) > 0)

const podium = computed(() => rows.value.slice(0, 3))
const rest = computed(() => rows.value.slice(3))
// Podium display order: 2nd, 1st, 3rd (classic podium silhouette).
const podiumOrder = computed(() => {
  const p = podium.value
  return [p[1], p[0], p[2]].filter(Boolean)
})
function podiumIndex(r: any) {
  return podium.value.indexOf(r)
}
// Medal follows the SHARED rank, so co-leaders both get gold.
function medal(rank: number) {
  return ['🥇', '🥈', '🥉'][rank - 1] || '🏅'
}
function pct(r: any) {
  return r.played ? Math.round((r.aciertos / r.played) * 100) : 0
}
</script>

<template>
  <div>
    <section class="hero">
      <h1>🏆 Tabla de posiciones</h1>
      <p v-if="started">
        {{ data?.matchesScored }} de {{ data?.totalMatches }} partidos contabilizados ·
        {{ data?.config.hit }} {{ data?.config.hit === 1 ? 'punto' : 'puntos' }} por acierto
      </p>
      <p v-else>La tabla se llena sola con cada resultado oficial que se cargue.</p>
    </section>

    <div v-if="!started" class="card empty">
      <span class="big">🏁</span>
      <p class="main">Aún no hay resultados cargados.</p>
      <p class="sub">
        {{ rows.length }} participante{{ rows.length === 1 ? '' : 's' }} esperando el primer
        silbatazo — ¡vuelve cuando ruede el balón!
      </p>
    </div>

    <template v-else>
      <!-- Podium -->
      <div class="podium">
        <div
          v-for="r in podiumOrder"
          :key="r.userId"
          class="pod"
          :class="['p' + podiumIndex(r), { me: r.userId === me }]"
        >
          <span class="medal">{{ medal(r.rank) }}</span>
          <span class="pname">{{ r.name }}<span v-if="r.userId === me" class="you">tú</span></span>
          <span class="ppts">{{ r.points }} pts</span>
          <span class="pmeta">{{ r.aciertos }} de {{ r.played }} aciertos</span>
          <div class="stand">{{ r.rank }}</div>
        </div>
      </div>

      <!-- Rest of the table -->
      <div v-if="rest.length" class="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Jugador</th>
              <th class="num">Pts</th>
              <th class="num">Aciertos</th>
              <th class="effh">Efectividad</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rest" :key="r.userId" :class="{ me: r.userId === me }">
              <td class="rank">{{ r.rank }}</td>
              <td class="player">{{ r.name }}<span v-if="r.userId === me" class="you">tú</span></td>
              <td class="num pts">{{ r.points }}</td>
              <td class="num hits">{{ r.aciertos }}<span class="of">/{{ r.played }}</span></td>
              <td class="eff">
                <div class="bar"><span class="fill" :style="{ width: pct(r) + '%' }" /></div>
                <span class="pcttxt">{{ r.played ? pct(r) + '%' : '—' }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.hero { background: linear-gradient(135deg, #1b2a4a 0%, #181b22 60%); border: 1px solid var(--line); border-radius: 16px; padding: 20px 22px; margin-bottom: 18px; }
.hero h1 { margin: 0 0 4px; font-size: 24px; }
.hero p { margin: 0; color: var(--mut); font-size: 13px; }

.card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; }
.empty { text-align: center; padding: 36px 20px; }
.empty .big { font-size: 40px; display: block; margin-bottom: 8px; }
.empty .main { margin: 0 0 4px; font-weight: 800; }
.empty .sub { margin: 0; color: var(--mut); font-size: 13.5px; }

/* "You" chip + row highlight */
.you {
  display: inline-block; margin-left: 7px; padding: 1px 7px; border-radius: 999px;
  font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px;
  color: #fff; background: var(--acc); vertical-align: 2px;
}

/* Podium */
.podium { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; align-items: end; margin-bottom: 18px; }
.pod {
  position: relative; display: flex; flex-direction: column; align-items: center; text-align: center;
  background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 16px 10px 30px;
}
.pod .medal { font-size: 30px; }
.pod .pname { font-weight: 800; margin-top: 6px; font-size: 15px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pod .ppts { font-size: 21px; font-weight: 900; margin-top: 2px; }
.pod .pmeta { font-size: 11px; color: var(--mut); margin-top: 4px; }
.pod .stand { position: absolute; bottom: 8px; font-size: 12px; font-weight: 900; opacity: .35; }
/* Heights + colors per place (p0 = leader, centre card) */
.pod.p0 { border-color: #6b5a1e; background: linear-gradient(180deg, rgba(245, 200, 66, .16), var(--card)); padding-top: 26px; transform: translateY(-8px); }
.pod.p0 .ppts { color: #f5c842; }
.pod.p1 { border-color: #555b66; }
.pod.p2 { border-color: #5a3f2e; }
.pod.me { box-shadow: 0 0 0 2px rgba(88, 101, 242, .55); }

/* Table */
.table-wrap { padding: 6px 4px; overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 11px 12px; border-bottom: 1px solid var(--line); white-space: nowrap; }
tr:last-child td { border-bottom: none; }
th { color: var(--mut); font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
th.num, td.num { text-align: right; }
.rank { color: var(--mut); font-weight: 700; font-variant-numeric: tabular-nums; }
.player { font-weight: 700; max-width: 0; width: 99%; overflow: hidden; text-overflow: ellipsis; }
.pts { font-weight: 900; font-size: 15px; font-variant-numeric: tabular-nums; }
.hits { font-weight: 700; font-variant-numeric: tabular-nums; }
.hits .of { color: var(--mut); font-weight: 600; font-size: 12px; }
tbody tr { transition: background .12s; }
tbody tr:hover { background: rgba(255, 255, 255, .025); }
tbody tr.me { background: rgba(88, 101, 242, .1); box-shadow: inset 3px 0 0 var(--acc); }

/* Efficiency bar */
.effh { min-width: 130px; }
.eff { min-width: 130px; }
.eff .bar { display: inline-block; vertical-align: middle; width: 76px; height: 6px; border-radius: 999px; background: #20242e; overflow: hidden; margin-right: 8px; }
.eff .fill { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--acc), #00c2a8); }
.pcttxt { color: var(--mut); font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }

@media (max-width: 560px) {
  .pod .pname { font-size: 13px; }
  .pod .ppts { font-size: 17px; }
  .pod .pmeta { font-size: 10px; }
  .pod { padding: 12px 6px 26px; }
  .effh, .eff { min-width: 0; }
  .eff .bar { width: 48px; }
}
</style>
