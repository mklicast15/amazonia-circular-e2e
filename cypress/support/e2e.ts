import './commands'

// O SSR de dev do TanStack Start ocasionalmente lança um erro de hydration
// mismatch do React (bug real: uma tag <style> difere entre o render do
// servidor e do cliente). O Cypress trata isso como uma exceção fatal não
// tratada; ignora só essa para não falhar testes que não têm nada a ver com isso.
Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('Hydration failed')) return false
})
