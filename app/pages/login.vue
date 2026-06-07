<script setup lang="ts">
const { loggedIn, fetch: refreshSession } = useUserSession()
const route = useRoute()

// Already signed in? Bounce home.
watchEffect(() => {
  if (loggedIn.value) navigateTo('/')
})

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { username: username.value, password: password.value },
    })
    await refreshSession()
    await navigateTo((route.query.redirect as string) || '/')
  } catch (e: any) {
    error.value = e.data?.statusMessage || 'No se pudo iniciar sesión'
  }
  loading.value = false
}
</script>

<template>
  <div class="card login">
    <h2>Iniciar sesión</h2>
    <form @submit.prevent="submit">
      <label>
        Usuario
        <input v-model="username" autocomplete="username" autofocus />
      </label>
      <label>
        Contraseña
        <input v-model="password" type="password" autocomplete="current-password" />
      </label>
      <p v-if="error" class="err">{{ error }}</p>
      <button class="btn" type="submit" :disabled="loading || !username || !password">
        {{ loading ? '...' : 'Entrar' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login { max-width: 360px; margin: 40px auto; }
h2 { margin: 0 0 16px; }
form { display: flex; flex-direction: column; gap: 12px; }
label { display: flex; flex-direction: column; gap: 6px; color: var(--mut); font-size: 14px; }
input { padding: 9px 10px; background: #0f1116; color: var(--txt); border: 1px solid var(--line); border-radius: 8px; }
.err { color: #f85149; font-size: 14px; margin: 0; }
.btn { margin-top: 4px; }
</style>
