# Organização

O módulo Angular está em `src/app/modules/organization` e mantém o layout e
os componentes TailAdmin. O selector em `/organization` partilha a lista de
empresas do utilizador com Contratos.

| Rota relativa a `/organization/:companyId` | Área |
| --- | --- |
| `/` | Indicadores, tarefas de revisão e actividade autorizada |
| `/structure` | Organograma, mudança de departamento superior e vista histórica |
| `/departments` | Departamentos, responsáveis, estabelecimentos e afectações de trabalhadores |
| `/job-functions`, `/job-positions`, `/professional-categories` | Funções, cargos e categorias |
| `/establishments` | Estabelecimentos e respectivos departamentos |
| `/cost-centers`, `/cost-allocations` | Hierarquia de centros e distribuição de 100% por trabalhador e vigência |
| `/calendars` | Dias úteis, vista mensal e feriados ou excepções registados |
| `/schedules`, `/shifts` | Horários, turnos e afectações a departamentos, estabelecimentos ou trabalhadores |
| `/history`, `/audit` | Versões comparadas e auditoria da empresa |

A consulta requer `organization:read`. As permissões em `GET /company/context`
habilitam cada operação e as permissões de Trabalhadores habilitam os selectores
de pessoas. Sem `company.read`, o módulo disponibiliza apenas consulta básica
depois de a API confirmar a associação activa e o acesso a departamentos.
`SUPER_ADMIN` não implica acesso à estrutura interna da empresa.

Os pedidos incluem `X-Company-Id` e as alterações versionadas enviam
`expectedVersion`. A alteração de hierarquia usa o endpoint dedicado e exclui
o próprio departamento e os seus descendentes das opções. O histórico de
departamentos permite reconstruir a hierarquia no fim de um dia UTC. O cliente
valida a soma das afectações, vigências, pausas e sobreposições de turnos,
incluindo os que atravessam a meia-noite ou a fronteira da semana.

O histórico consome `/organization/:resource/:id/history`. A auditoria
consome `/audit/records` com filtro `module=organization`, motivo de consulta
e a permissão `audit:records:read-tenant`.

## Limites da API fornecida

- A API aceita `employeeId`, `relatedId` e `percentage` nas operações de escrita.
  O serializador actual omite esses campos nas respostas. O painel assinala
  os valores indisponíveis e permite filtrar afectações por centro de custo.
- A API cria a distribuição completa numa transacção. A substituição ou
  encerramento de uma distribuição repartida exige uma operação equivalente
  no backend. O painel cria afectações com vigência a partir da data actual.
- Turnos e excepções são acrescentados pelos endpoints existentes. Edição e
  remoção individuais desses registos precisam de endpoints próprios. As
  mudanças de turno são aplicadas a horários com início no dia actual ou
  futuro, preservando períodos já iniciados.
- O calendário mostra os feriados nacionais ou locais configurados como
  excepções. A API não fornece um calendário oficial, nem valida as referências
  de regras legais. O processamento de eventos para folhas salariais é
  responsabilidade do backend.
