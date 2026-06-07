<script setup lang="ts">
const { data } = await useFetch('/api/standings')

const rows = computed(() => data.value?.standings || [])
const podium = computed(() => rows.value.slice(0, 3))
const rest = computed(() => rows.value.slice(3))
const medals = ['🥇', '🥈', '🥉']
// Podium display order: 2nd, 1st, 3rd (classic podium shape).
const podiumOrder = computed(() => {
  const p = podium.value
  return [p[1], p[0], p[2]].filter(Boolean)
})
function place(name: string) {
  return podium.value.findIndex((r: any) => r?.name === name)
}
</script>

<template>
  <div>
    <section class="hero">
      <h1>📊 Tabla de Posiciones</h1>
      <p>
        {{ data?.matchesScored || 0 }} partidos contabilizados ·
        acierto = {{ data?.config.outcome }} pt · exacto = {{ data?.config.exact }} pts
      </p>
    </section>

    <div v-if="!rows.length" class="card empty">
      <span class="big">🏁</span>
      <p>Aún no hay resultados cargados. ¡Vuelve cuando empiece el torneo!</p>
    </div>

    <template v-else>
      <!-- Podium -->
      <div class="podium">
        <div
          v-for="r in podiumOrder"
          :key="r.name"
          class="pod"
          :class="['p' + place(r.name)]"
        >
          <span class="medal">{{ medals[place(r.name)] }}</span>
          <span class="pname">{{ r.name }}</span>
          <span class="ppts">{{ r.points }} pts</span>
          <span class="pmeta">{{ r.aciertos }} aciertos · {{ r.exactos }} exactos</span>
          <div class="stand">{{ place(r.name) + 1 }}</div>
        </div>
      </div>

      <!-- Rest of the table -->
      <div v-if="rest.length" class="card table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>Jugador</th><th>PJ</th><th>Aciertos</th><th>Exactos</th><th>Pts</th></tr>
          </thead>
          <tbody>
            <tr v-for="r in rest" :key="r.userId">
              <td class="rank">{{ r.rank }}</td>
              <td class="player">{{ r.name }}</td>
              <td>{{ r.played }}</td>
              <td class="strong">{{ r.aciertos }}</td>
              <td>{{ r.exactos }}</td>
              <td class="pts">{{ r.points }}</td>
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
.empty { text-align: center; padding: 36px 20px; color: var(--mut); }
.empty .big { font-size: 40px; display: block; margin-bottom: 8px; }

/* Podium */
.podium { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; align-items: end; margin-bottom: 18px; }
.pod {
  position: relative; display: flex; flex-direction: column; align-items: center; text-align: center;
  background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 16px 10px 30px;
}
.pod .medal { font-size: 30px; }
.pod .pname { font-weight: 800; margin-top: 6px; font-size: 15px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pod .ppts { font-size: 20px; font-weight: 900; margin-top: 2px; }
.pod .pmeta { font-size: 11px; color: var(--mut); margin-top: 4px; }
.pod .stand { position: absolute; bottom: 8px; font-size: 12px; font-weight: 900; opacity: .35; }
/* Heights + colors per place */
.pod.p0 { border-color: #6b5a1e; background: linear-gradient(180deg, rgba(245, 200, 66, .16), var(--card)); padding-top: 26px; transform: translateY(-8px); }
.pod.p0 .ppts { color: #f5c842; }
.pod.p1 { border-color: #555b66; }
.pod.p2 { border-color: #5a3f2e; }

/* Table */
.table-wrap { padding: 6px 4px; overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 11px 12px; border-bottom: 1px solid var(--line); white-space: nowrap; }
tr:last-child td { border-bottom: none; }
th { color: var(--mut); font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
.rank { color: var(--mut); font-weight: 700; }
.player { font-weight: 700; }
.strong { font-weight: 800; }
.pts { font-weight: 900; }

@media (max-width: 560px) {
  .pod .pname { font-size: 13px; }
  .pod .ppts { font-size: 17px; }
  .pod .pmeta { font-size: 10px; }
  .pod { padding: 12px 6px 26px; }
}
</style>
