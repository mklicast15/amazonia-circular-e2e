#!/usr/bin/env bash
# Regressão completa no staging, preservando os dados de teste (E2E_KEEP_DATA=1 no
# .env.staging): nada é apagado; as contas criadas ficam em kept-accounts.local.json.
#
#   scripts/regressao-staging.sh
#
# Demora: o login/cadastro do staging é limitado a 10 por IP a cada 15 min, e a suíte
# espera a janela zerar sozinha (tests/support/authBudget.ts). Duas fases: tudo menos o
# admin e, por último, a paginação do admin — ela precisa do volume de usuários e de
# eventos de auditoria que a primeira fase gera.
set -uo pipefail
cd "$(dirname "$0")/.."
set -a && . ./.env.staging && set +a

npx playwright test tests/auth tests/listings tests/marketplace tests/painel tests/permissoes tests/planos tests/publico \
  --workers=1 --reporter=list,html
fase1=$?
PLAYWRIGHT_HTML_OUTPUT_DIR=playwright-report-admin npx playwright test tests/admin --workers=1 --reporter=list,html
fase2=$?
echo "fase 1: $([ $fase1 -eq 0 ] && echo ok || echo FALHOU) | fase 2 (admin): $([ $fase2 -eq 0 ] && echo ok || echo FALHOU)"
exit $(( fase1 || fase2 ))
