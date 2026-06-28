<script setup lang="ts">
// Static explainer — no data/DB needed.
useHead({ title: 'Cómo se juega · Quiniela Mundial 2026' })
// When the new scoreline knockout bracket is on, the rules differ for eliminatorias.
const newKo = useRuntimeConfig().public.newKo
</script>

<template>
  <div class="wrap">
    <section class="hero">
      <h1>📖 Cómo se juega</h1>
      <p>Pronostica, suma aciertos y escala la tabla. Así de simple.</p>
    </section>

    <!-- Objective -->
    <div class="card lead">
      <p>
        El objetivo es <strong>acertar el resultado de cada partido</strong>. No predices el marcador
        exacto — solo <strong>quién gana</strong> (o si empatan). Gana la quiniela quien acumula
        <strong>más aciertos</strong> al final del Mundial.
      </p>
    </div>

    <!-- How to pick -->
    <h2 class="sec">1 · Cómo pronosticar</h2>
    <div class="grid2">
      <div class="card">
        <span class="tag">Fase de grupos</span>
        <p>Para cada partido eliges una de tres opciones:</p>
        <div class="seg">
          <span class="opt">🏠 Gana local</span>
          <span class="opt">Empate</span>
          <span class="opt">Gana visitante</span>
        </div>
      </div>
      <div v-if="!newKo" class="card">
        <span class="tag">Eliminatorias</span>
        <p>Tocas al equipo que crees que <strong>avanza</strong> en cada llave — desde 16avos hasta la final.</p>
        <div class="seg">
          <span class="opt win">🏆 Tu ganador</span>
          <span class="opt vs">vs</span>
          <span class="opt">El otro</span>
        </div>
      </div>
      <div v-else class="card">
        <span class="tag">Eliminatorias</span>
        <p>Con los <strong>equipos que realmente clasificaron</strong>, predices el <strong>marcador</strong> de cada llave — desde 16avos hasta la final.</p>
        <div class="seg">
          <span class="opt">🏠 2</span>
          <span class="opt vs">–</span>
          <span class="opt">1 ✈️</span>
        </div>
      </div>
    </div>
    <p class="note">
      🔒 Puedes editar todo cuanto quieras <strong>hasta el primer silbatazo del torneo</strong>. En ese
      momento se cierran todos los pronósticos.
    </p>

    <!-- Scoring -->
    <h2 class="sec">2 · Puntuación</h2>

    <!-- Legacy: 1 point per correct outcome everywhere -->
    <template v-if="!newKo">
      <div class="grid2">
        <div class="card score hit">
          <div class="pts">+1</div>
          <div>
            <strong>Acierto</strong>
            <p>Predijiste el resultado correcto (local / empate / visitante).</p>
          </div>
        </div>
        <div class="card score miss">
          <div class="pts">0</div>
          <div>
            <strong>Fallo</strong>
            <p>El resultado fue otro. Sin penalización, simplemente no suma.</p>
          </div>
        </div>
      </div>
      <p class="note">
        Cuenta <strong>el resultado, no el marcador</strong>: da igual si fue 1-0 o 3-0, si dijiste “gana
        local” y ganó el local, es <strong>acierto</strong>. Cada partido vale lo mismo: <strong>1 punto</strong>
        — los 72 de grupos y los 32 de eliminatorias.
      </p>
    </template>

    <!-- New: groups 1 pt; knockout scorelines 2 / 1 -->
    <template v-else>
      <p class="note" style="margin-top:0">
        <strong>Fase de grupos:</strong> 1 punto por acertar el resultado (local / empate / visitante) — igual que siempre. Tus puntos de grupos <strong>se conservan</strong>.
      </p>
      <h3 class="sub">Eliminatorias (nuevo cuadro)</h3>
      <div class="grid2">
        <div class="card score hit">
          <div class="pts">+2</div>
          <div>
            <strong>Marcador exacto</strong>
            <p>Acertaste <strong>los dos equipos</strong> de la llave <strong>y</strong> el marcador exacto (p. ej. dijiste México 2-1 y fue México 2-1).</p>
          </div>
        </div>
        <div class="card score win">
          <div class="pts">+1</div>
          <div>
            <strong>El equipo que avanza</strong>
            <p>El equipo que pusiste a avanzar <strong>realmente avanzó</strong>, aunque el rival o el marcador hayan sido otros.</p>
          </div>
        </div>
      </div>
      <p class="note">
        Si el que avanza no es tu equipo, 0 puntos. En 16avos los equipos ya están fijos; en las rondas
        siguientes tienes que acertar <strong>qué equipo llega</strong> a cada llave para sumar. Tus pronósticos
        viejos de eliminatorias <strong>ya no suman</strong> — solo cuenta este nuevo cuadro.
      </p>
    </template>

    <!-- Standings -->
    <h2 class="sec">3 · La tabla</h2>
    <div class="card">
      <p>La <NuxtLink to="/standings">tabla de posiciones</NuxtLink> se calcula sola en el servidor a medida
      que se cargan los resultados. El orden es:</p>
      <ol class="rank">
        <li><span class="n">1</span> Más <strong>aciertos</strong> (resultados correctos).</li>
        <li><span class="n">2</span> Si hay empate, se mantiene un orden estable por nombre.</li>
      </ol>
      <p class="small">Los puntos nunca se calculan en tu navegador — el servidor es la única fuente de verdad.</p>
    </div>

    <!-- Projection + bracket -->
    <h2 class="sec">4 · Bonus: proyección y cuadro</h2>
    <div class="grid2">
      <div class="card">
        <span class="tag">🔮 ¿Quién avanza?</span>
        <p>Con tus pronósticos de grupos, la app arma cada tabla y proyecta los <strong>2 mejores de cada
        grupo + los 8 mejores terceros</strong> hacia los 16avos.</p>
        <NuxtLink class="link" to="/avanzan">Ver mi proyección →</NuxtLink>
      </div>
      <div class="card">
        <span class="tag">🏆 El cuadro</span>
        <p v-if="!newKo">Esos clasificados <strong>rellenan el cuadro</strong> automáticamente. Luego eliges los ganadores
        ronda por ronda hasta coronar a tu campeón.</p>
        <p v-else>Con los clasificados reales, predices el <strong>marcador</strong> de cada llave; tus ganadores
        avanzan ronda por ronda hasta tu campeón.</p>
        <NuxtLink class="link" :to="newKo ? '/eliminatorias' : '/bracket'">Ir al cuadro →</NuxtLink>
      </div>
    </div>

    <!-- Example -->
    <h2 class="sec">Ejemplo</h2>
    <div v-if="!newKo" class="card example">
      <div class="ex-row">
        <span class="ex-q">Pronosticaste:</span>
        <span class="ex-pick">🇲🇽 Gana México</span>
      </div>
      <div class="ex-cases">
        <div class="ex-case ok"><span>México gana 2-0</span><b class="g">+1 ✓</b></div>
        <div class="ex-case ok"><span>México gana 1-0</span><b class="g">+1 ✓</b></div>
        <div class="ex-case no"><span>Empatan 1-1</span><b class="r">0</b></div>
        <div class="ex-case no"><span>Pierde México</span><b class="r">0</b></div>
      </div>
    </div>
    <div v-else class="card example">
      <div class="ex-row">
        <span class="ex-q">Pronosticaste (eliminatorias):</span>
        <span class="ex-pick">🇲🇽 México 2 – 1 🇧🇷</span>
      </div>
      <div class="ex-cases">
        <div class="ex-case ok"><span>Fue México 2-1</span><b class="g">+2 ✓</b></div>
        <div class="ex-case ok"><span>México avanza (otro marcador o rival)</span><b class="g">+1 ✓</b></div>
        <div class="ex-case no"><span>Avanzó Brasil</span><b class="r">0</b></div>
        <div class="ex-case no"><span>México no llegó a esa llave</span><b class="r">0</b></div>
      </div>
    </div>

    <div class="cta card">
      <p>¿Listo?</p>
      <NuxtLink class="btn" to="/">Hacer mis pronósticos</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.wrap { max-width: 760px; margin: 0 auto; }
.hero { background: linear-gradient(135deg, #1b2a4a 0%, #181b22 60%); border: 1px solid var(--line); border-radius: 16px; padding: 22px; margin-bottom: 18px; }
.hero h1 { margin: 0 0 4px; font-size: 26px; }
.hero p { margin: 0; color: var(--mut); }

.card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 16px; }
.card p { margin: 0; color: var(--mut); line-height: 1.55; }
.card strong { color: var(--txt); }
.lead p { font-size: 15px; }

.sec { font-size: 18px; margin: 22px 0 10px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.tag { display: inline-block; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: .4px; color: #8b95f7; background: rgba(88, 101, 242, .12); padding: 3px 9px; border-radius: 6px; margin-bottom: 10px; }
.card p + .seg { margin-top: 10px; }

.seg { display: flex; gap: 6px; }
.opt { flex: 1; text-align: center; font-size: 12.5px; font-weight: 700; color: var(--mut); background: #0f1116; border: 1.5px solid var(--line); border-radius: 9px; padding: 9px 6px; }
.opt.win { color: #fff; background: rgba(88, 101, 242, .18); border-color: var(--acc); }
.opt.vs { flex: 0 0 auto; align-self: center; border: none; background: none; color: #4a5160; }

.note { color: var(--mut); font-size: 13.5px; line-height: 1.5; margin: 12px 2px 0; }
.note strong { color: var(--txt); }

/* score cards */
.score { display: flex; align-items: center; gap: 14px; }
.score .pts { font-size: 30px; font-weight: 900; font-variant-numeric: tabular-nums; flex: 0 0 auto; min-width: 52px; text-align: center; }
.score.hit { border-color: #2e5a36; }
.score.hit .pts { color: var(--good); }
.score.win { border-color: #3a4a72; }
.score.win .pts { color: #8b95f7; }
.score.miss .pts { color: #6b7280; }
.score strong { display: block; margin-bottom: 2px; }
.sub { font-size: 14px; margin: 16px 0 8px; color: var(--txt); }

/* ranking list */
.rank { list-style: none; padding: 0; margin: 12px 0; display: flex; flex-direction: column; gap: 8px; }
.rank li { display: flex; align-items: center; gap: 10px; color: var(--mut); }
.rank .n { flex: 0 0 auto; width: 22px; height: 22px; border-radius: 50%; background: var(--acc); color: #fff; font-weight: 800; font-size: 12px; display: grid; place-items: center; }
.rank strong { color: var(--txt); }
.small { font-size: 12.5px; }
.link { color: var(--acc); font-weight: 700; text-decoration: none; display: inline-block; margin-top: 10px; }

/* example */
.example { display: flex; flex-direction: column; gap: 12px; }
.ex-row { display: flex; align-items: center; gap: 10px; }
.ex-q { color: var(--mut); }
.ex-pick { font-weight: 800; background: rgba(88, 101, 242, .14); color: #8b95f7; padding: 5px 12px; border-radius: 999px; }
.ex-cases { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.ex-case { display: flex; justify-content: space-between; align-items: center; gap: 8px; background: #0f1116; border: 1px solid var(--line); border-radius: 9px; padding: 9px 12px; font-size: 13.5px; }
.ex-case.ok { border-color: #2e5a36; }
.ex-case b.g { color: var(--good); }
.ex-case b.r { color: #6b7280; }

.cta { text-align: center; margin-top: 18px; }
.cta p { color: var(--txt); font-weight: 700; margin-bottom: 10px; }

@media (max-width: 560px) {
  .grid2, .ex-cases { grid-template-columns: 1fr; }
  .hero h1 { font-size: 22px; }
}
</style>
