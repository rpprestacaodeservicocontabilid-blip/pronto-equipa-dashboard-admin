# Gestão de contratos

O módulo Angular em `src/app/modules/contracts` reúne as rotas, os contratos
TypeScript, o cliente HTTP e os componentes. Reutiliza o layout do painel e os
tokens do TailAdmin.

| Rota | Área |
| --- | --- |
| `/contracts` | Empresas do utilizador |
| `/contracts/:companyId` | Indicadores, distribuição, alertas de termo e contratos recentes |
| `/contracts/:companyId/all` | Listagem, filtros, ordenação, paginação e CSV |
| `/contracts/:companyId/new` | Formulário em seis etapas para criar e submeter |
| `/contracts/:companyId/details/:id` | Condições, operações, trabalhador, documentos e histórico |
| `/contracts/:companyId/details/:id/edit` | Edição de rascunho |
| `/contracts/:companyId/types` | Consulta e criação de modalidades contratuais |
| `/contracts/:companyId/<secção>` | Aprovações, renovações, adendas, termos, suspensões, rescisões e arquivo |

## Âmbito empresarial

O selector consulta `GET /companies` e o módulo usa `GET /company/context` para
obter as permissões efectivas. Os pedidos empresariais incluem `X-Company-Id`.
O backend valida pertença, contexto e direitos. A role global `SUPER_ADMIN`
segue as mesmas regras empresariais. A configuração completa do papel exige
`company.read`. Onde a API só confirmar `contracts.read`, o painel permite a
consulta básica após confirmação da empresa e do acesso à listagem.

O estado e as permissões determinam quais acções aparecem. Edição e operações de
ciclo de vida enviam `expectedVersion` para que a API rejeite alterações sobre uma
versão desactualizada. O backend regista as operações e enfileira os respectivos
eventos. O CSV é gerado no navegador após revalidar `contracts.export` no contexto
da empresa.

## Integrações e comportamento

- A identificação vem de Trabalhadores. O nome do departamento é apresentado
  quando a referência é resolvida em Organização. As condições contractuais
  ficam no próprio contrato.
- As atribuições de Estrutura Salarial são consultadas por trabalhador e
  apresentadas apenas quando correspondem ao contrato aberto.
- Documentos existentes podem ser associados e abertos através dos links
  temporários autorizados pela API de Documentos.
- As secções de operações agrupam contratos. O histórico, as datas anteriores
  e a comparação de versões estão disponíveis no detalhe de cada contrato.
- O backend devolve a referência da regra legal e valida o limite de renovações.
  Adendas e rescisões são registadas para a data actual porque a API aplica a
  alteração na própria chamada. O agendamento futuro exige suporte no backend.
- O arquivo usa os estados de encerramento e o registo de arquivamento do
  backend. A integração com o Processamento Salarial depende do consumo dos
  eventos do backend.
