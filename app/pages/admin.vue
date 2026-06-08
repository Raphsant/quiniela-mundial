<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

const tab = ref<'users' | 'results' | 'create'>('users')

// Users + their predictions (read-only).
const { data: usersData, refresh: refreshUsers } = await useFetch('/api/admin/users')

// Create user (admin-only).
const form = reactive({ username: '', password: '', displayName: '', isAdmin: false })
const creating = ref(false)
const createMsg = ref<{ ok: boolean; text: string } | null>(null)
async function createUser() {
  if (!form.username.trim() || form.password.length < 6) {
    createMsg.value = { ok: false, text: 'Usuario requerido y contraseña de 6+ caracteres.' }
    return
  }
  creating.value = true
  createMsg.value = null
  try {
    const res = await $fetch('/api/admin/users', {
      method: 'POST',
      body: {
        username: form.username,
        password: form.password,
        displayName: form.displayName || undefined,
        isAdmin: form.isAdmin,
      },
    })
    createMsg.value = { ok: true, text: `Usuario "${res.user.username}" creado${res.user.isAdmin ? ' (admin)' : ''}.` }
    form.username = ''
    form.password = ''
    form.displayName = ''
    form.isAdmin = false
    await refreshUsers()
  } catch (e: any) {
    createMsg.value = { ok: false, text: e.data?.statusMessage || 'Error al crear usuario' }
  }
  creating.value = false
}

// Results loading (existing).
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

// How a pick reads. Group matches have team names; knockout teams are per-user.
function pickLabel(p: any) {
  if (p.home && p.away) return p.outcome === 'H' ? p.home : p.outcome === 'A' ? p.away : 'Empate'
  return p.outcome === 'H' ? 'Local' : p.outcome === 'A' ? 'Visitante' : 'Empate'
}
function matchLabel(p: any) {
  return p.home && p.away ? `${p.home} vs ${p.away}` : p.code
}
</script>

<template>
  <div>
    <h1 class="title">Admin</h1>
    <nav class="tabs">
      <button class="tab" :class="{ on: tab === 'users' }" @click="tab = 'users'">
        Usuarios y pronósticos
      </button>
      <button class="tab" :class="{ on: tab === 'results' }" @click="tab = 'results'">
        Cargar resultados
      </button>
      <button class="tab" :class="{ on: tab === 'create' }" @click="tab = 'create'">
        Crear usuario
      </button>
    </nav>

    <!-- USERS -->
    <section v-show="tab === 'users'">
      <p class="muted">
        {{ usersData?.users.length || 0 }} usuario(s) · cada uno pronostica hasta {{ usersData?.totalMatches || 0 }} partidos.
      </p>
      <div v-for="u in usersData?.users" :key="u.id" class="ucard card">
        <details>
          <summary>
            <span class="uname">{{ u.displayName }}</span>
            <span v-if="u.isAdmin" class="badge admin">admin</span>
            <span class="spacer" />
            <span class="ucount">{{ u.count }} / {{ usersData?.totalMatches }}</span>
            <span class="chev">▾</span>
          </summary>
          <div v-if="u.predictions.length" class="picks">
            <div v-for="p in u.predictions" :key="p.code" class="pick">
              <span class="pcode">{{ p.code }}</span>
              <span class="pmatch">{{ matchLabel(p) }}</span>
              <span class="ppick" :class="p.outcome === 'D' ? 'draw' : 'win'">{{ pickLabel(p) }}</span>
            </div>
          </div>
          <p v-else class="muted empty">Sin pronósticos todavía.</p>
        </details>
      </div>
      <p v-if="!usersData?.users.length" class="muted">No hay usuarios registrados.</p>
    </section>

    <!-- RESULTS -->
    <section v-show="tab === 'results'" class="list">
      <div v-for="m in matches" :key="m._id" class="card row">
        <span class="team">{{ m.homeTeam || m.code }}</span>
        <div class="inputs">
          <input type="number" min="0" max="99" v-model="m.editH" />
          <span>-</span>
          <input type="number" min="0" max="99" v-model="m.editA" />
        </div>
        <span class="team away">{{ m.awayTeam || '' }}</span>
        <span class="status" :class="{ done: m.status === 'finished' }">{{ m.status === 'finished' ? '✓' : '' }}</span>
        <button class="btn" :disabled="saving === m._id" @click="saveResult(m)">Guardar</button>
      </div>
    </section>

    <!-- CREATE USER -->
    <section v-show="tab === 'create'">
      <form class="card form" @submit.prevent="createUser">
        <label class="field">
          <span>Usuario</span>
          <input v-model="form.username" type="text" autocapitalize="none" autocomplete="off" placeholder="juan" />
        </label>
        <label class="field">
          <span>Contraseña</span>
          <input v-model="form.password" type="text" autocomplete="off" placeholder="mín. 6 caracteres" />
        </label>
        <label class="field">
          <span>Nombre a mostrar <em>(opcional)</em></span>
          <input v-model="form.displayName" type="text" autocomplete="off" placeholder="Juan Pérez" />
        </label>
        <label class="check">
          <input v-model="form.isAdmin" type="checkbox" />
          <span>Administrador</span>
        </label>
        <button class="btn create" type="submit" :disabled="creating">
          {{ creating ? 'Creando…' : 'Crear usuario' }}
        </button>
        <p v-if="createMsg" class="msg" :class="createMsg.ok ? 'ok' : 'err'">{{ createMsg.text }}</p>
      </form>
    </section>
  </div>
</template>

<style scoped>
.title { margin: 0 0 12px; }
.tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.tab {
  background: var(--card); color: var(--mut); border: 1px solid var(--line);
  padding: 8px 14px; border-radius: 999px; font-weight: 700; font-size: 13px; cursor: pointer;
}
.tab.on { background: var(--acc); color: #fff; border-color: var(--acc); }
.muted { color: var(--mut); font-size: 13px; margin: 0 0 14px; }
.muted.empty { padding: 10px 14px; }

.card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; }

/* Users */
.ucard { margin-bottom: 8px; overflow: hidden; }
.ucard summary {
  display: flex; align-items: center; gap: 10px; padding: 12px 14px; cursor: pointer; list-style: none;
}
.ucard summary::-webkit-details-marker { display: none; }
.uname { font-weight: 800; }
.badge.admin { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; color: #f5c842; background: rgba(245, 200, 66, .14); padding: 2px 7px; border-radius: 999px; }
.spacer { flex: 1; }
.ucount { color: var(--mut); font-weight: 700; font-size: 13px; font-variant-numeric: tabular-nums; }
.chev { color: var(--mut); transition: transform .15s; }
details[open] .chev { transform: rotate(180deg); }
.picks { border-top: 1px solid var(--line); max-height: 340px; overflow-y: auto; }
.pick {
  display: grid; grid-template-columns: 60px 1fr auto; align-items: center; gap: 10px;
  padding: 7px 14px; font-size: 13px; border-top: 1px solid #20242e;
}
.pick:first-child { border-top: none; }
.pcode { color: var(--mut); font-weight: 700; font-variant-numeric: tabular-nums; font-size: 11px; }
.pmatch { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ppick { font-weight: 800; white-space: nowrap; }
.ppick.win { color: var(--acc); }
.ppick.draw { color: var(--mut); }

/* Results */
.row { display: grid; grid-template-columns: 1fr auto 1fr 24px auto; align-items: center; gap: 10px; padding: 10px 14px; margin-bottom: 8px; }
.team { font-weight: bold; }
.team.away { text-align: right; }
.inputs { display: flex; align-items: center; gap: 6px; }
.inputs input { width: 52px; padding: 6px; text-align: center; background: #0f1116; color: var(--txt); border: 1px solid var(--line); border-radius: 6px; }
.status.done { color: var(--good); }

/* Create user */
.form { display: flex; flex-direction: column; gap: 14px; padding: 16px; max-width: 420px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field span { font-size: 13px; font-weight: 700; color: var(--mut); }
.field em { font-weight: 400; font-style: normal; opacity: .7; }
.field input {
  padding: 10px 12px; background: #0f1116; color: var(--txt);
  border: 1px solid var(--line); border-radius: 8px; font-size: 15px;
}
.check { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; }
.check input { width: 18px; height: 18px; }
.btn.create { padding: 11px; font-size: 15px; }
.msg { margin: 0; font-size: 13px; font-weight: 700; }
.msg.ok { color: var(--good); }
.msg.err { color: #ff6b6b; }

@media (max-width: 560px) {
  .pick { grid-template-columns: 48px 1fr auto; }
  .row { grid-template-columns: 1fr auto 1fr; }
  .row .status, .row .btn { grid-column: span 3; }
}
</style>
