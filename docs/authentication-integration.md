# Integração de autenticação do PRONTOEQUIPAS

O módulo está em `src/app/modules/auth`. As páginas originais de entrada e cadastro
continuam em `src/app/pages/auth-pages`, reutilizando os componentes e o layout do
template. As novas páginas usam o mesmo layout de autenticação e os mesmos tokens
visuais, incluindo modo escuro e direcção RTL.

## Organização e dependências

```text
src/app/modules/auth/
├── domain/
│   └── auth.models.ts
├── application/
│   ├── auth-session.store.ts
│   ├── auth.service.ts
│   └── account.service.ts
├── infrastructure/
│   ├── auth-api.service.ts
│   └── google-oauth.service.ts
├── presentation/
│   ├── components/
│   ├── password/
│   ├── verification/
│   ├── security/
│   ├── authenticated.guard.ts
│   ├── access-denied.component.ts
│   └── oauth-callback.component.ts
└── auth.routes.ts
```

`domain` contém apenas contratos TypeScript. `AuthApiService` concentra todos os
endpoints HTTP e os tipos de resposta. Os serviços de aplicação coordenam a sessão
e disponibilizam as operações de conta às páginas. O store guarda tokens apenas
em memória e expõe estado somente de leitura através do serviço de autenticação.
`GoogleOAuthService` concentra a comunicação com o popup do fornecedor.

As páginas não constroem URLs da API. A configuração HTTP, o interceptor e a guard
da plataforma permanecem em `core`. O ficheiro `core/auth/auth.service.ts` é uma
entrada de compatibilidade para consumidores existentes, sem duplicar a implementação.
O módulo define as rotas públicas e a área de segurança da conta em `auth.routes.ts`.

## Rotas e contratos

Todos os caminhos HTTP abaixo têm o prefixo configurável `/api/v1`.

| Fluxo | Rota do dashboard | Método e endpoint |
| --- | --- | --- |
| Credenciais | `/signin` | `POST /auth/login` |
| OTP de login | `/signin` | `POST /auth/login/verify-otp` |
| Reenvio de OTP | `/signin` | `POST /auth/login/resend-otp` |
| Cadastro | `/signup` | `POST /auth/register` |
| Verificação de email por código ou token | `/verify-email` | `POST /auth/verify-email` |
| Reenvio de verificação de email | `/verify-email` | `POST /auth/resend-verification` |
| Recuperação de palavra-passe | `/forgot-password` | `POST /auth/forgot-password` |
| Redefinição de palavra-passe | `/reset-password` | `POST /auth/reset-password` |
| Alteração de palavra-passe | `/account/security` | `POST /auth/change-password` |
| Renovação de tokens | Automática após 401 | `POST /auth/refresh` |
| Logout | Menu da conta | `POST /auth/logout` |
| Sessão actual | `/account/security` | `GET /sessions/current` |
| Revogar uma sessão | `/account/security` | `DELETE /sessions/:sessionId` |
| Revogar outras sessões | `/account/security` | `DELETE /sessions` |
| Login Google | `/signin`, `/signup` | `POST /oauth/google` |
| Associar Google | `/account/security` | `POST /oauth/google/link` |
| Desassociar Google | `/account/security` | `DELETE /oauth/google/unlink` |
| Verificar permissão global | `/account/security` | `GET /authorization/users/:userId/permissions/:permission` |

O reenvio do OTP de login substitui o desafio anterior; o frontend usa o novo ID.
O cadastro envia `name`, `email`, `phone`, `password`, `confirmPassword`,
`acceptTerms`. O adaptador da API acrescenta `accountType: ORGANIZER` para manter
a compatibilidade com o cadastro público do backend.
A confirmação de email e a recuperação não inferem a existência de uma conta.
Links de verificação e redefinição podem fornecer `?token=...`; o token é removido
da barra de endereço após a leitura. Tokens de desenvolvimento devolvidos pela API
não são apresentados nem guardados pelo frontend.

## Sessão e autorização

- Recarregar a página exige novo login; não se guardam refresh tokens em localStorage.
- A interface de segurança exige autenticação. A gestão global de empresas exige
  `SUPER_ADMIN`. As outras contas entram na selecção de empresas do módulo de
  contratos e podem gerir a sua segurança.
- As claims decodificadas controlam a interface; a API continua a validar assinatura,
  sessão, roles e permissões em cada pedido protegido.
- O interceptor não envia tokens para outros servidores nem endpoints públicos de
  autenticação. Alterar a palavra-passe e associar/desassociar Google exigem Bearer.
- Pedidos concorrentes com 401 partilham uma renovação. O pedido é repetido uma vez;
  um 403 não desencadeia renovação. Respostas tardias não restauram sessões encerradas.
- Cada novo login começa com uma renovação independente. Falhas temporárias de rede
  ou do serviço de renovação permitem tentar novamente na mesma sessão.
- Alterar a palavra-passe invalida todas as sessões no backend e exige novo login.
- `DELETE /sessions` preserva a sessão actual no backend. A interface comunica esse
  comportamento e confirma as revogações antes de enviar o pedido.

## Configurar Google OAuth

Em `public/config.json`, preencher apenas os dados públicos:

```json
{
  "apiBaseUrl": "/api/v1",
  "googleOAuth": {
    "clientId": "CLIENT_ID_DO_GOOGLE",
    "redirectUri": "http://localhost:4200/oauth/callback"
  }
}
```

O backend deve usar o mesmo `GOOGLE_CLIENT_ID` e `GOOGLE_REDIRECT_URI` e ter
`GOOGLE_CLIENT_SECRET` configurado. O segredo pertence exclusivamente ao backend.
A URI deve estar registada no fornecedor e apontar para `/oauth/callback` na origem
do dashboard. Em produção, usar HTTPS. Sem client ID, os botões de login Google
ficam ocultos. Não há suporte de autenticação X na API fornecida.

O popup usa um estado aleatório por tentativa. A janela principal verifica origem,
janela remetente e estado antes de trocar o código pela API. O código não passa pela
rota principal de login e os tokens não são transportados em URLs ou postMessage.
O servidor do dashboard deve permitir a comunicação do popup com a janela de origem;
uma política COOP que elimine `window.opener` impede esse fluxo.

## Limites observados no backend

O cadastro público do backend exige um dos tipos legados de conta. O painel
usa `ORGANIZER` na chamada e continua a obter permissões empresariais das
associações do utilizador e as de plataforma das roles globais.

O backend envia mensagens através de `AUTH_EMAIL_PROVIDER_URL` e
`AUTH_SMS_PROVIDER_URL`, com `AUTH_NOTIFICATION_API_KEY` quando exigida pelo
fornecedor. Sem endpoint configurado, não envia mensagens em desenvolvimento e
recusa o envio em produção. Entrega de OTP e recuperação exigem configurar esses
adaptadores e os respectivos templates.
A API não disponibiliza listagem de dispositivos/sessões nem consulta do estado de
associação Google. A interface apresenta a sessão actual, as acções de revogação e
o resultado das operações; não inventa listas ou estados de associação.

## Validação

```sh
node node_modules/@angular/compiler-cli/bundles/src/bin/ngc.js -p tsconfig.app.json --noEmit
node node_modules/@angular/compiler-cli/bundles/src/bin/ngc.js -p tsconfig.spec.json --noEmit
npm run build
npm test -- --watch=false --browsers=ChromeHeadless
```

A verificação do compilador Angular cobre tipos e templates. Os testes incluem
cadastro, substituição de desafio OTP, isolamento de credenciais, protecção dos
endpoints sensíveis, renovação concorrente e resposta tardia após logout.
Executar os testes no browser e os fluxos ponta a ponta com a API activa, uma conta
de plataforma válida e os fornecedores de entrega/OAuth configurados.
