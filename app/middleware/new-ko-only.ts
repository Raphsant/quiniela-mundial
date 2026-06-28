// Guards the new scoreline bracket page: only reachable when the feature is on.
// When off, the page is hidden (redirect home) so reverting needs no code change.
export default defineNuxtRouteMiddleware(() => {
  if (!useRuntimeConfig().public.newKo) return navigateTo('/')
})
