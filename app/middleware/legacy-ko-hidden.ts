// Hides the OLD knockout pages (/bracket, /comparar) while the new bracket is on.
// The pages and their data remain intact — only access is redirected, so flipping
// the feature flag back instantly restores them.
export default defineNuxtRouteMiddleware(() => {
  if (useRuntimeConfig().public.newKo) return navigateTo('/eliminatorias')
})
