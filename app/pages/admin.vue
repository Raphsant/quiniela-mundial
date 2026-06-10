<script setup lang="ts">
import { getTeam } from '~/utils/teams'

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

// Results loading (existing). Knockout rows come back with the real teams as
// far as entered results determine them, plus a slot label until then.
// deep:true — Nuxt 4 defaults useFetch to a shallowRef, and the template reacts
// to per-row edits (editH/editA toggle the advancer block, editAdv its buttons).
const { data: matches, refresh } = await useFetch('/api/matches', { deep: true })
const saving = ref<string | null>(null)
watchEffect(() => {
  matches.value?.forEach((m: any) => {
    if (m.editH == null) m.editH = m.homeGoals
    if (m.editA == null) m.editA = m.awayGoals
    if (m.editAdv == null) m.editAdv = m.advancer
  })
})

function filled(v: any) {
  return v !== null && v !== undefined && v !== ''
}
// Level knockout score → the admin must say who went through (penalties).
function needsAdvancer(m: any) {
  return m.stage !== 'group' && filled(m.editH) && filled(m.editA) && Number(m.editH) === Number(m.editA)
}

async function saveResult(m: any) {
  if (!filled(m.editH) || !filled(m.editA)) return
  saving.value = m._id
  try {
    await $fetch(`/api/matches/${m._id}/result`, {
      method: 'PUT',
      body: {
        homeGoals: Number(m.editH),
        awayGoals: Number(m.editA),
        advancer: needsAdvancer(m) ? m.editAdv || null : null,
      },
    })
    await refresh()
  } catch (e: any) {
    alert(e.data?.statusMessage || 'Error')
  }
  saving.value = null
}

const STAGE_LABELS: Record<string, string> = {
  group: 'Fase de grupos',
  r32: 'Dieciseisavos de final',
  r16: 'Octavos de final',
  qf: 'Cuartos de final',
  sf: 'Semifinales',
  third: 'Tercer puesto',
  final: 'Final',
}
// Matches arrive sorted by kickoff, so stages are contiguous: show a heading
// each time the stage changes.
function stageHead(i: number) {
  const list: any[] = matches.value || []
  const m = list[i]
  const prev = list[i - 1]
  return m && (!prev || prev.stage !== m.stage) ? STAGE_LABELS[m.stage] || m.stage : null
}

function flag(name: string | null) {
  return getTeam(name).flag
}

// How a pick reads. Knockout teams are the user's own predicted bracket; while
// their group picks are incomplete the slot is unknown and we fall back.
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
      <template v-for="(m, i) in matches" :key="m._id">
        <h3 v-if="stageHead(i)" class="stagehead">{{ stageHead(i) }}</h3>
        <div class="card mrow" :class="{ done: m.status === 'finished' }">
          <div class="row">
            <span class="code">{{ m.code }}</span>
            <span class="team">
              <span class="flag">{{ flag(m.homeTeam) }}</span>
              <span v-if="m.homeTeam" class="tname">{{ m.homeTeam }}</span>
              <span v-else class="slot">{{ m.homeSlot || 'Por definir' }}</span>
            </span>
            <div class="inputs">
              <input type="number" min="0" max="99" v-model="m.editH" />
              <span>-</span>
              <input type="number" min="0" max="99" v-model="m.editA" />
            </div>
            <span class="team away">
              <span v-if="m.awayTeam" class="tname">{{ m.awayTeam }}</span>
              <span v-else class="slot">{{ m.awaySlot || 'Por definir' }}</span>
              <span class="flag">{{ flag(m.awayTeam) }}</span>
            </span>
            <span class="status" :class="{ done: m.status === 'finished' }">{{ m.status === 'finished' ? '✓' : '' }}</span>
            <button class="btn" :disabled="saving === m._id" @click="saveResult(m)">Guardar</button>
          </div>
          <div v-if="needsAdvancer(m)" class="adv">
            <span class="advlbl">⚖️ Empate — ¿quién avanza (penales)?</span>
            <div class="advbtns">
              <button class="advbtn" :class="{ on: m.editAdv === 'H' }" @click="m.editAdv = 'H'">
                {{ m.homeTeam || m.homeSlot || 'Local' }}
              </button>
              <button class="advbtn" :class="{ on: m.editAdv === 'A' }" @click="m.editAdv = 'A'">
                {{ m.awayTeam || m.awaySlot || 'Visitante' }}
              </button>
            </div>
          </div>
        </div>
      </template>
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
.stagehead {
  margin: 20px 0 10px; font-size: 12px; font-weight: 800; text-transform: uppercase;
  letter-spacing: .7px; color: var(--mut);
}
.stagehead:first-child { margin-top: 0; }
.mrow { padding: 10px 14px; margin-bottom: 8px; }
.mrow.done { border-color: #2e4636; }
.row { display: grid; grid-template-columns: 58px 1fr auto 1fr 22px auto; align-items: center; gap: 10px; }
.code {
  font-size: 10.5px; font-weight: 800; color: #8b95f7; background: rgba(88, 101, 242, .12);
  padding: 3px 4px; border-radius: 6px; text-align: center; white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.team { display: flex; align-items: center; gap: 7px; min-width: 0; font-weight: 700; }
.team .tname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.team .flag { font-size: 18px; flex: 0 0 auto; }
.team.away { justify-content: flex-end; text-align: right; }
.slot { color: var(--mut); font-style: italic; font-weight: 600; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.inputs { display: flex; align-items: center; gap: 6px; }
.inputs input { width: 52px; padding: 6px; text-align: center; background: #0f1116; color: var(--txt); border: 1px solid var(--line); border-radius: 6px; }
.status.done { color: var(--good); }

/* Penalties: who advances on a level knockout score */
.adv { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--line); }
.advlbl { font-size: 12.5px; color: #d29922; font-weight: 700; }
.advbtns { display: flex; gap: 8px; flex-wrap: wrap; }
.advbtn {
  background: #0f1116; color: var(--mut); border: 1.5px solid var(--line);
  padding: 6px 12px; border-radius: 8px; font-weight: 700; font-size: 12.5px; cursor: pointer; transition: .14s;
}
.advbtn:hover { color: var(--txt); border-color: #3a4256; }
.advbtn.on { background: rgba(88, 101, 242, .18); border-color: var(--acc); color: #fff; }

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
  .row { grid-template-columns: 44px 1fr auto 1fr; }
  .row .status { display: none; }
  .row .btn { grid-column: 1 / -1; }
}
</style>
