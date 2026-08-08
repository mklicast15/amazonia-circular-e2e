import './commands'

// TanStack Start's dev SSR occasionally throws a React hydration-mismatch
// error (real bug: a <style> tag differs between server and client render).
// Cypress treats it as a fatal uncaught exception; ignore just that one so
// it doesn't fail unrelated tests.
Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('Hydration failed')) return false
})
