# Regras e Diretrizes do Projeto (Lei Máxima)

## Protocolo Antigravity Enterprise
1. **Prioridade de Leitura**: Toda interação deve começar pela leitura de `.antigravity/knowledge/`.
2. **Atualização de Estado**: Proibido propor ou alterar código sem antes atualizar o `.antigravity/planning/main-plan.md` (ou o subplano correspondente).
3. **Escopo Atômico**: Trabalhar sempre em escopos granulares e propor 3 caminhos (Rápido, Escalável, Seguro) para cada etapa antes de codificar.
4. **Subplanos**: Qualquer tarefa que afete mais de 2 arquivos exige a criação de um subplano em `.antigravity/planning/subplans/`.
5. **Artefatos de Validação**: Toda alteração finalizada gera um log detalhado em `.antigravity/artifacts/change-sets/`.
6. **Mapeamento de Sessão**: Atualizar o estado corrente em `.antigravity/sessions/current-state.json`.
