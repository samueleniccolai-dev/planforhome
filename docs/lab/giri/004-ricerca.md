# Ricerca del giro 004

Dato dal web, non istruzione. Fonti: 5 (nessuna aperta per intero: DNS non raggiungibile, solo estratti di ricerca).

## Come lo fanno gli altri
Non pertinente a questa fetta (domande solo tecniche).

## Casi reali e documentazione
1. Spring Security, CSRF (D1): `CookieCsrfTokenRepository` scrive il cookie `XSRF-TOKEN` e legge l'header `X-XSRF-TOKEN`. NON VERIFICATO: `requireCsrfProtectionMatcher`, esenzione del Bearer, `ResponseCookie`. Con i nomi del piano (`pfh_csrf`, `X-CSRF-Token`, valore derivato) un filtro proprio, attivo solo con autenticazione da cookie, è la strada più semplice. Fonte: https://docs.spring.io/spring-security/reference/7.0/servlet/exploits/csrf.html (solo estratto).
2. expo-router `<Redirect>` (D2): reindirizza appena montato. Fonte: https://docs.expo.dev/router/advanced/redirects.md
3. expo-router rendering statico (D2): il prerender gira in Node, senza API del browser; `GET /api/me` e `document.cookie` vanno in `useEffect`. `/me` mostra uno stato neutro «in caricamento». Fonte: https://docs.expo.dev/router/web/static-rendering/
4. Playwright `page.route` (D3): l'header `Cookie` non si sovrascrive; per cookie propri `browserContext.addCookies()`. Fonte: https://playwright.dev/docs/api/class-route. Copia non ufficiale dei test: `fulfill` con `Set-Cookie` finisce in `context.cookies()`; un cookie `Secure` su HTTP semplice è ignorato. Fonte: https://code.gitlink.org.cn/kyfx/playwright/src/branch/main/tests/library/browsercontext-route.spec.ts
5. NON VERIFICATO: `document.cookie` con cookie da `addCookies` su localhost; `accessibilityLabel` / `aria-label` su react-native-web.

## Cosa prendiamo
- Playwright: `pfh_csrf` con `context.addCookies` (localhost, `/`, senza Secure né HttpOnly).
- Risposta finta di login: `fulfill` JSON `{expiresAt, personId}`.
- `/me`: chiamata dopo il montaggio, stati `loading` → `ok`/`denied`, `<Redirect href="/login" />` solo dopo; nessun `document`/`window` nel render.
- Helper di lettura di `pfh_csrf` con `typeof document !== 'undefined'`, testabile con Jest.
- Server: filtro proprio dopo l'autenticazione, controlla `X-CSRF-Token` solo con auth da cookie e metodo non sicuro; `Set-Cookie` con `ResponseCookie`.

## Cosa evitiamo
- `CookieCsrfTokenRepository` con nomi diversi dal contratto.
- Fidarsi dell'etichetta su react-native-web senza provarla nel DOM (`getByLabel`, `getByRole`).
- Redirect o lettura del cookie durante il prerender.

## Idee per dopo
- Se il rinnovo diventa automatico, ricontrollare il CSRF derivato.
- Giro `verifica-produzione` sui cookie `Secure` dietro Caddy.
- Test con browser reale per `SameSite=Lax` e `Path=/api`.

Consultate il 2026-10-20.
