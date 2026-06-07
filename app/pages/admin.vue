<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

const { data: matches, refresh } = await useFetch('/api/matches')
const saving = ref<string | null>(null)

watchEffect(() => {
  matches.value?.forEach((m: any) => {
    if (m.editH == null) m.editH = m.homeGoals
    if (m.editA == null) m.editA = m.awayGoals
  })
})

async function saveResult(m: any) {
  if (m.editH == null || m.editA == null) return
  saving.value = m._id
  try {
    await $fetch(`/api/matches/${m._id}/result`, {
      method: 'PUT',
      body: { homeGoals: Number(m.editH), awayGoals: Number(m.editA) },
    })
    await refresh()
  } catch (e: any) {
    alert(e.data?.statusMessage || 'Error')
  }
  saving.value = null
}
</script>

<template>
  <div class="list">
    <h2>Cargar resultados</h2>
    <div v-for="m in matches" :key="m._id" class="card row">
      <span class="team">{{ m.homeTeam }}</span>
      <div class="inputs">
        <input type="number" min="0" max="99" v-model="m.editH" />
        <span>-</span>
        <input type="number" min="0" max="99" v-model="m.editA" />
      </div>
      <span class="team away">{{ m.awayTeam }}</span>
      <span class="status" :class="{ done: m.status === 'finished' }">{{ m.status === 'finished' ? '✓' : '' }}</span>
      <button class="btn" :disabled="saving === m._id" @click="saveResult(m)">Guardar</button>
    </div>
  </div>
</template>

<style scoped>
.card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:10px 14px; margin-bottom:8px; }
.row { display:grid; grid-template-columns: 1fr auto 1fr 24px auto; align-items:center; gap:10px; }
.team { font-weight:bold; }
.team.away { text-align:right; }
.inputs { display:flex; align-items:center; gap:6px; }
.inputs input { width:52px; padding:6px; text-align:center; background:#0f1116; color:var(--txt); border:1px solid var(--line); border-radius:6px; }
.status.done { color:var(--good); }
h2 { margin:0 0 12px; }
</style>
