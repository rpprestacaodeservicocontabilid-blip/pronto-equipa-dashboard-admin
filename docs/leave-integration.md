# Férias e Licenças

O módulo Angular em `src/app/modules/leave` reutiliza os componentes TailAdmin
e o selector de empresas. A entrada `/leave` lista as empresas do utilizador.
A área seleccionada em `/leave/:companyId` resolve as permissões em
`GET /company/context`, com o âmbito validado pela API.

| Secção | Operações |
| --- | --- |
| Visão geral | Indicadores por ano, trabalhador, departamento e estado |
| Pedidos e aprovações | Rascunhos fraccionados, submissão, decisão, cancelamento, reagendamento, início, interrupção e confirmação de gozo |
| Calendário | Visão mensal, semanal e cronológica, com ausências por dia |
| Saldos e direitos | Contas, direitos, recálculo, ajustes justificados, reservas e movimentos |
| Plano anual | Grelha mensal por trabalhador, períodos em rascunho, aprovados e concluídos |
| Sobreposições | Conflitos impeditivos por trabalhador e consulta de ausências simultâneas |
| Histórico | Decisões por pedido e auditoria de operações da empresa |
| Relatórios | Saldos, dias gozados, plano anual, pendências, departamentos, conflitos e movimentos, com Excel e impressão para PDF |

## Integração

- Cada pedido de negócio inclui `X-Company-Id`. As permissões `leave.*` e
  `audit:records:read-tenant` são verificadas no contexto empresarial. As roles
  globais não concedem acesso automático. Os filtros de departamento não
  implementam restrições de equipa no backend.
- A criação envia os períodos ao backend, que calcula os dias pelo calendário
  aplicável. O pré-cálculo visual usa o calendário de empresa e fica identificado
  como estimativa. As decisões respeitam o estado, as permissões e a política de
  auto-aprovação da API fornecida.
- A aprovação reserva dias. A confirmação de gozo envia o total efectivamente
  usado para reconciliação. Edição e transições enviam `expectedVersion`.
  Aprovação, cancelamento e gozo mantêm uma chave de idempotência enquanto uma
  mesma confirmação estiver a ser repetida.
- A interface consulta os saldos calculados pela API e grava ajustes como
  movimentos justificados. Os totais disponíveis no painel representam o saldo
  actual. O filtro de ano aplica-se ao planeamento e aos pedidos.
- A exportação revalida a permissão de relatórios e os acessos usados pela
  consulta. O Excel é um ficheiro `.xlsx`. A opção PDF abre a impressão do
  navegador para guardar o relatório como PDF.

## Capacidades dependentes da API

- O plano anual é construído com pedidos de férias anuais. A API não tem
  entidades próprias de plano, publicação ou aprovação colectiva.
- O calendário aceita um estabelecimento para os dias úteis. Os pedidos não
  incluem o estabelecimento do trabalhador, por isso permanecem no âmbito da
  empresa. O filtro de departamento usa a referência publicada por Trabalhadores.
- O histórico do pedido devolve períodos e decisões. As restantes operações
  podem ser consultadas na auditoria, com motivo e permissão. Anexos, níveis de
  aprovação e saldos transitados discriminados não têm endpoints neste módulo.
  A devolução pode ser submetida novamente. A edição continua reservada a
  rascunhos, conforme a API.
- A detecção oficial identifica sobreposições do mesmo trabalhador. A
  disponibilidade de equipas é informativa. Limites de lotação e regras para
  responsáveis essenciais requerem suporte no backend. Os dados de gozo ficam
  disponíveis no ledger. O processamento no Payroll depende do backend.
