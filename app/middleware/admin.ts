export default defineNuxtRouteMiddleware(() => {
  const { loggedIn, user } = useUserSession()
  if (!loggedIn.value || !user.value?.isAdmin) return navigateTo('/')
})
