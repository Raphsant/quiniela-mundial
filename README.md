# Quiniela Mundial 2026 ⚽

Pool de pronósticos para el Mundial 2026. Cada participante elige **quién gana**
cada partido (local / empate / visita); gana quien acumula más aciertos. Con tus
pronósticos de grupos la app **proyecta quién avanza** y **prellena el cuadro
eliminatorio** hasta la final: predices todo el Mundial antes del primer silbatazo.

## Stack

- **Nuxt 4** (full-stack: front Vue 3 + API en Nitro)
- **MongoDB + Mongoose** vía **nuxt-mongoose** (autoconexión en el arranque)
- **nuxt-auth-utils** — login usuario/contraseña (scrypt), sesión en cookie sellada
- **Zod** para validar cada endpoint

## Cómo funciona

- **Pronósticos por resultado (1/X/2)**, no por marcador. `NUXT_SCORING_HIT` puntos
  por acierto (default 1).
- **Cierre global**: puedes editar cualquier pronóstico hasta el **primer partido
  del torneo**; en ese instante todo se bloquea (validado en el servidor).
- **Calendario real**: `scripts/seed.ts` trae los 104 partidos oficiales (72 de
  grupos + 32 de eliminatorias) con sedes y zonas horarias.
- **`/avanzan`** proyecta las tablas de cada grupo → 2 mejores + 8 mejores terceros.
- **`/bracket`** se llena solo con esos clasificados y propaga tus ganadores
  R32 → octavos → cuartos → semis → final.

## Modelo de datos

- `User` — `username`, `passwordHash`, `displayName`, `isAdmin`
- `Match` — equipos, `group`/`stage`, `kickoffAt`, `venue {stadium, city, tz}`,
  `feedHome`/`feedAway` (descriptores de cruce para eliminatorias), resultado
- `Prediction` — `user` + `match` (índice único), `outcome` ∈ `H`/`D`/`A`

## Desarrollo local

```bash
npm install
cp .env.example .env          # completa NUXT_MONGOOSE_URI y NUXT_SESSION_PASSWORD
npm run seed                  # carga los 104 partidos
npm run create-user -- sunny 'TuPassword!' --admin
npm run dev                   # http://localhost:3000
```

Variables de entorno: ver [`.env.example`](.env.example).

## Despliegue con Docker

La imagen se publica automáticamente en **GHCR** vía GitHub Actions
(`.github/workflows/docker-publish.yml`) en cada push a la rama por defecto.

```bash
# en tu servidor (con un MongoDB externo accesible):
#  1. crea .env con NUXT_MONGOOSE_URI + NUXT_SESSION_PASSWORD
#  2. edita docker-compose.yml: reemplaza OWNER por tu usuario/org de GitHub
docker compose pull
docker compose up -d                     # app en el puerto 3000

# tareas de una sola vez (usan el stage de build, traen tsx + scripts):
docker compose --profile tools run --rm tools npm run seed
docker compose --profile tools run --rm tools npm run create-user -- sunny 'TuPassword!' --admin
```

¿Imagen sin Actions? Constrúyela tú: `docker build -t quiniela .` y corre
`docker run -p 3000:3000 --env-file .env quiniela`.

> El paquete en GHCR es privado por defecto. Hazlo público en
> **GitHub → Packages → quiniela-mundial → Package settings**, o haz
> `docker login ghcr.io` en el servidor para poder hacer `pull`.

## Seguridad

1. **El cierre se valida en el servidor** contra el primer `kickoffAt` (reloj del
   servidor), nunca en el cliente → pasado el inicio, 403.
2. **El puntaje se calcula en el servidor**; el cliente nunca envía puntos.
3. **Cargar resultados es solo-admin** (`requireAdmin`), verificado en el endpoint.
4. **Sesión en cookie httpOnly sellada** (nuxt-auth-utils), contraseñas con scrypt.
5. **Zod** valida todo input; índice único `(user, match)` evita duplicados.
