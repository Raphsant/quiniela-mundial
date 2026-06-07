<script setup lang="ts">
const { loggedIn, user, clear } = useUserSession()

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  await navigateTo('/')
}
</script>

<template>
  <div class="wrap">
    <header>
      <NuxtLink to="/" class="brand">⚽ <span>Quiniela</span></NuxtLink>
      <nav>
        <NuxtLink to="/">Pronósticos</NuxtLink>
        <NuxtLink to="/avanzan">¿Quién avanza?</NuxtLink>
        <NuxtLink to="/bracket">Cuadro</NuxtLink>
        <NuxtLink to="/standings">Tabla</NuxtLink>
        <NuxtLink v-if="user?.isAdmin" to="/admin">Admin</NuxtLink>
      </nav>
      <div class="account">
        <template v-if="loggedIn">
          <span class="who">👤 {{ user?.displayName || user?.username }}</span>
          <button class="btn ghost" @click="logout">Salir</button>
        </template>
        <NuxtLink v-else class="btn" to="/login">Entrar</NuxtLink>
      </div>
    </header>
    <main><NuxtPage /></main>
    <footer>Quiniela Mundial 2026 · ¡Que gane el mejor pronosticador! ⚽</footer>
  </div>
</template>

<style>
:root {
  --bg: #0d0f14; --card: #181b22; --line: #262b36; --txt: #e8eaf0; --mut: #9aa3b2;
  --acc: #5865f2; --good: #3fb950;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--txt); font-family: 'Segoe UI', system-ui, Arial, sans-serif; }
body::before {
  content: ''; position: fixed; inset: 0; z-index: -1; pointer-events: none;
  background: radial-gradient(900px 500px at 100% -10%, rgba(88, 101, 242, .12), transparent 60%),
              radial-gradient(700px 400px at -10% 0%, rgba(0, 194, 168, .08), transparent 55%);
}
.wrap { max-width: 960px; margin: 0 auto; padding: 16px; }

header {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  padding: 12px 0 16px; margin-bottom: 8px; border-bottom: 1px solid var(--line);
}
.brand { font-size: 20px; font-weight: 900; text-decoration: none; color: var(--txt); }
.brand span { background: linear-gradient(90deg, var(--acc), #00c2a8); -webkit-background-clip: text; background-clip: text; color: transparent; }
nav { display: flex; gap: 6px; flex-wrap: wrap; }
nav a {
  color: var(--mut); text-decoration: none; font-weight: 700; font-size: 14px;
  padding: 7px 12px; border-radius: 9px; transition: .15s;
}
nav a:hover { color: var(--txt); background: #20242e; }
nav a.router-link-exact-active { color: #fff; background: var(--acc); }
.account { display: flex; align-items: center; gap: 10px; margin-left: auto; }
.who { color: var(--mut); font-size: 14px; font-weight: 600; }

.btn {
  background: var(--acc); color: #fff; border: none; padding: 8px 16px; border-radius: 9px;
  cursor: pointer; font-weight: 700; font-size: 14px; text-decoration: none; display: inline-block; transition: .15s;
}
.btn:hover { filter: brightness(1.08); }
.btn.ghost { background: transparent; border: 1px solid var(--line); color: var(--mut); }
.btn.ghost:hover { color: var(--txt); border-color: #3a4150; }

main { padding-top: 14px; }
footer { text-align: center; color: var(--mut); font-size: 12px; padding: 28px 0 16px; margin-top: 24px; border-top: 1px solid var(--line); }

@media (max-width: 560px) {
  .wrap { padding: 12px; }
  header { gap: 10px; }
  .brand { font-size: 18px; }
  nav { order: 3; width: 100%; justify-content: space-between; }
  nav a { padding: 7px 10px; font-size: 13px; }
  .account { margin-left: auto; }
  .who { display: none; }
}
</style>
