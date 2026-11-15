---
id: security-headers/nextjs
title: HTTP security headers and CSP for a Next.js App Router app
topic: security-headers
stack: [nextjs, typescript]
summary: >-
  Send a nonce-based strict CSP ('strict-dynamic', object-src 'none') from
  proxy.ts on dynamic pages, starting in Report-Only. Set nosniff,
  Referrer-Policy, Permissions-Policy, X-Frame-Options and HSTS on every route
  with next.config headers(), and turn off X-Powered-By.
status: verified
card_version: 1.0.0
last_verified: 2026-11-15
review_level: seed
authors: [RIDAM7]
reviewers: [RIDAM7]
lenses: [security, performance, ux, data, cost]
applies_when:
  app_types: [web-app, saas, dashboard, e-commerce, marketing-site]
  not_for: [pages-router-only-app, api-only-service]
related: [auth/nextjs-postgres, payments-webhooks/nextjs-postgres, file-uploads/nextjs-s3, caching/nextjs-postgres, rate-limiting/nextjs-postgres]

checklist:
  - id: strict-csp-nonce
    lens: security
    level: must
    text: "On dynamic HTML routes, build the CSP in `proxy.ts` with a fresh random nonce per request: `script-src 'self' 'nonce-…' 'strict-dynamic'`, `object-src 'none'`, `base-uri 'none'`."
    why: An allowlist CSP with 'unsafe-inline' still runs injected inline scripts; a per-response nonce does not.
  - id: csp-on-request-headers
    lens: security
    level: must
    text: "Set the CSP (or Report-Only) header on the forwarded request via `NextResponse.next({ request: { headers } })` as well as on the response."
    why: Next.js reads the nonce from the request header; without it its own scripts get no nonce and are blocked.
  - id: dynamic-render-nonce-routes
    lens: performance
    level: must
    text: "Render every route that gets the nonce CSP dynamically (`await connection()` or `headers()` in the root layout), and do not combine it with `cacheComponents` (Partial Prerendering)."
    why: Prerendered HTML is built with no request, so it has no nonce and its scripts are blocked.
  - id: no-unsafe-eval-in-prod
    lens: security
    level: must
    text: "Add `'unsafe-eval'` to `script-src` only when `NODE_ENV` is `development`."
    why: React needs eval only for dev debugging; the Next.js CSP guide says neither React nor Next.js uses eval in production.
  - id: third-party-nonce
    lens: security
    level: must
    text: "Pass the nonce to every `next/script` and `@next/third-parties` component, and list each vendor's hosts in `connect-src`, `frame-src` and `img-src`."
    why: Under 'strict-dynamic', CSP3 browsers ignore host entries in script-src, so un-nonced vendor scripts are blocked.
  - id: report-only-rollout
    lens: ux
    level: must
    text: "Ship a new or tightened CSP as `Content-Security-Policy-Report-Only` first and enforce it only after reports from real traffic on every page type are clean."
    why: Report-Only blocks nothing, so breakage shows up in reports instead of in front of users.
  - id: report-endpoint
    lens: data
    level: should
    text: "Add `report-to` (named in `Reporting-Endpoints`) and `report-uri`; the Route Handler accepts `application/reports+json` and `application/csp-report`, caps size and rate-limits."
    why: report-uri is deprecated but older browsers only use it; endpoints must be https URLs; report bodies are attacker-controlled.
  - id: baseline-headers-all-routes
    lens: security
    level: must
    text: "Send `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and a deny-by-default `Permissions-Policy` from `headers()` with `source: '/:path*'`."
    why: The proxy matcher skips API routes and static files; next.config headers also cover `public/` files.
  - id: block-framing
    lens: security
    level: must
    text: "Block framing with CSP `frame-ancestors 'none'` (or an origin list) on HTML, plus a matching `X-Frame-Options` (`DENY` or `SAMEORIGIN`) on every response."
    why: frame-ancestors overrides X-Frame-Options where supported; older browsers only know X-Frame-Options.
  - id: hsts-staged
    lens: security
    level: must
    text: "Send `Strict-Transport-Security` with `max-age` of at least 31536000; add `includeSubDomains` only when every subdomain serves HTTPS, and `preload` only by explicit decision."
    why: Preload needs includeSubDomains and takes months to undo (hstspreload.org).
  - id: powered-by-off
    lens: security
    level: should
    text: "Set `poweredByHeader: false` in `next.config`."
    why: "Next.js sends `X-Powered-By: Next.js` by default, and OWASP recommends removing it."
  - id: coop-for-popups
    lens: ux
    level: should
    text: "Send `Cross-Origin-Opener-Policy: same-origin` on HTML pages, or `same-origin-allow-popups` where OAuth or payment popups must post results back."
    why: same-origin severs the opener link to cross-origin popups.
  - id: style-attributes
    lens: security
    level: should
    text: "Keep `style-src` nonce-based for style elements; if React `style` props trigger reports, add `style-src-attr 'unsafe-inline'` instead of `'unsafe-inline'` in `style-src`."
    why: Browsers ignore 'unsafe-inline' in a directive that has a nonce; style-src-attr covers attributes only.
  - id: one-place-per-header
    lens: security
    level: should
    text: "Set each header in one layer only (proxy, `headers()` or host config), and check the final response in CI."
    why: When layers set the same header, one silently replaces the other.
  - id: ci-header-tests
    lens: security
    level: must
    text: "In CI, assert the headers on a page, an API route, a `public/` file and a 404, and run an e2e pass that fails on any CSP violation."

decisions:
  - id: rendering
    question: Must your HTML pages stay statically generated or cached (static, ISR, or Partial Prerendering with cacheComponents)?
    options:
      - { id: mostly-dynamic, label: "No, most pages read cookies or per-user data", points_to: nonce-proxy }
      - { id: mixed, label: "Mixed: static marketing pages, dynamic app pages", points_to: nonce-proxy }
      - { id: must-stay-static, label: "Yes, pages must stay static or cached", points_to: static-config }
    default: mostly-dynamic
  - id: hosting
    question: How is the app served?
    options:
      - { id: vercel, label: "Vercel" }
      - { id: node-server, label: "Self-hosted next start or container behind a reverse proxy" }
      - { id: static-export, label: "Static export (output: 'export') on a CDN", points_to: host-cdn-headers }
  - id: third-parties
    question: Which third-party scripts or frames will pages load?
    options:
      - { id: none, label: "None" }
      - { id: analytics, label: "Analytics or a tag manager" }
      - { id: payments, label: "Payments (for example Stripe.js or Checkout)" }
      - { id: several, label: "Several of these" }
  - id: framing
    question: Must other sites embed your pages in an iframe?
    options:
      - { id: never, label: "Never" }
      - { id: partners, label: "Only specific partner origins" }
    default: never
  - id: subdomains-https
    question: Does every subdomain of your domain serve HTTPS, now and for the long term?
    options:
      - { id: all-https, label: "Yes, every subdomain is HTTPS-only" }
      - { id: not-sure, label: "Not sure, or some are not" }
    default: not-sure
  - id: popups
    question: Do you open OAuth or payment popups that send results back to the opening page?
    options:
      - { id: uses-popups, label: "Yes, or not sure" }
      - { id: no-popups, label: "No, all flows use redirects" }
    default: uses-popups

options:
  - id: nonce-proxy
    name: Nonce-based strict CSP in proxy.ts
    best_fit_when:
      - Pages are already dynamic (authenticated app, dashboards, checkout)
      - You handle sensitive data or must avoid 'unsafe-inline'
    avoid_when:
      - Pages must stay static, ISR or use cacheComponents (Partial Prerendering)
      - You deploy with output 'export' and have no Next.js server
    tradeoffs:
      - Every covered route renders per request, with no static HTML or CDN caching by default
      - Every third-party script must receive the nonce
      - Proxy runs on every matched request
  - id: static-config
    name: Static CSP in next.config headers()
    best_fit_when:
      - Marketing or docs pages that must stay static, ISR or prerendered
      - You want frame-ancestors, object-src, base-uri, form-action and connect-src limits at no per-request cost
    avoid_when:
      - Pages handle sensitive data and you rely on CSP to contain XSS
    tradeoffs:
      - App Router inlines RSC payload scripts, so script-src needs 'unsafe-inline', which also lets injected inline scripts run
      - experimental.sri adds integrity to JS chunks but does not remove the need for 'unsafe-inline'
  - id: host-cdn-headers
    name: Headers set by the host or CDN
    examples: [vercel.json headers, Cloudflare response header rules, nginx add_header]
    best_fit_when:
      - Static export or HTML served from a CDN without a Next.js server
      - One baseline policy shared by several apps on one domain
    avoid_when:
      - You need per-request nonces and have no edge code that rewrites HTML
    tradeoffs:
      - Same 'unsafe-inline' weakness as a static CSP
      - Config lives outside the app, so only a test of the deployed response proves it
recommended: nonce-proxy

versions:
  - package: next
    range: ">=16.0.0 <17.0.0"
    notes:
      - "`middleware.ts` is deprecated and renamed to `proxy.ts` (export `proxy`). Proxy always uses the Node.js runtime; a `runtime` export throws."
      - "Next.js reads the nonce from the request's `Content-Security-Policy` or `Content-Security-Policy-Report-Only` header (`script-src`, else `default-src`), so forward it with `NextResponse.next({ request: { headers } })`."
      - "Nonces need dynamic rendering: static, ISR and Partial Prerendering (`cacheComponents: true`) shells have no nonce. Use `await connection()` or `headers()` in the root layout."
      - "`experimental.sri` adds `integrity` to build-time JS chunks only; the inline `self.__next_f` RSC payload scripts still need a nonce or `'unsafe-inline'`."
      - "Dev needs `'unsafe-eval'` for React debugging, production does not. `poweredByHeader: false` removes the default `X-Powered-By: Next.js`."
    docs: https://nextjs.org/docs/app/guides/content-security-policy
    context7: https://context7.com/vercel/next.js
  - package: next
    range: ">=15.0.0 <16.0.0"
    notes:
      - "The nonce code lives in `middleware.ts` exporting `middleware`; the request-header flow is the same as in 16.x."
      - "The 15.x guide's static `headers()` example puts `'unsafe-eval'` in every environment; keep it out of production."
      - "`experimental.sri` works only with webpack in 15.x, not Turbopack."
      - "Partial Prerendering (`experimental.ppr`) is incompatible with a nonce-based CSP."
    docs: https://nextjs.org/docs/15/app/guides/content-security-policy
    context7: https://context7.com/vercel/next.js

verify:
  - id: baseline-on-every-route
    lens: security
    type: integration
    check: A page, an API route, a public/ file and a 404 response each carry nosniff, Referrer-Policy, Permissions-Policy and X-Frame-Options, and none carries X-Powered-By.
  - id: nonce-fresh-and-applied
    lens: security
    type: integration
    check: Two requests to the same page return different nonces, and every script tag in each HTML response carries the nonce from that response's CSP header.
  - id: csp-policy-shape
    lens: security
    type: unit
    check: The production CSP builder output contains a nonce source, 'strict-dynamic', object-src 'none', base-uri and frame-ancestors, and contains neither 'unsafe-eval' nor 'unsafe-inline' in script-src.
  - id: injected-script-blocked
    lens: security
    type: e2e
    check: A test page that renders an inline script without the nonce (as stored XSS would) does not run it, and the browser reports a CSP violation.
  - id: no-violations-key-flows
    lens: ux
    type: e2e
    check: Sign-in (including OAuth popups), checkout with the payment provider's frames, and a dashboard page raise zero securitypolicyviolation events under the enforced policy.
  - id: framing-blocked
    lens: security
    type: e2e
    check: A page from another origin cannot display the app in an iframe.
  - id: nonce-routes-dynamic
    lens: performance
    type: integration
    check: The production build lists every route covered by the nonce matcher as dynamic, and none of them is served from a prerendered file.
  - id: hsts-production
    lens: security
    type: integration
    check: Production HTTPS responses carry Strict-Transport-Security with max-age of at least 31536000, and preload appears only if the team chose to submit the domain.
  - id: report-endpoint-limits
    lens: data
    type: integration
    check: The report endpoint returns 2xx for valid application/reports+json and application/csp-report bodies, rejects oversized bodies, rate-limits bursts, and stores URLs without query strings.
  - id: deployed-scan
    lens: security
    type: scan
    check: An HTTP header scanner and a CSP evaluator run against the preview deployment report no high-severity header or CSP findings.

sources:
  - { title: "Next.js: How to set a Content Security Policy", url: "https://nextjs.org/docs/app/guides/content-security-policy" }
  - { title: "Next.js 15: How to set a Content Security Policy", url: "https://nextjs.org/docs/15/app/guides/content-security-policy" }
  - { title: "Next.js headers config (security header examples)", url: "https://nextjs.org/docs/app/api-reference/config/next-config-js/headers" }
  - { title: "Next.js proxy.js reference (matcher, runtime, execution order)", url: "https://nextjs.org/docs/app/api-reference/file-conventions/proxy" }
  - { title: "Next.js poweredByHeader", url: "https://nextjs.org/docs/app/api-reference/config/next-config-js/poweredByHeader" }
  - { title: "Next.js cacheComponents (Partial Prerendering by default)", url: "https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents" }
  - { title: "Next.js static exports (headers and proxy unsupported)", url: "https://nextjs.org/docs/app/guides/static-exports" }
  - { title: "Next.js source: nonce parsing from request CSP headers", url: "https://github.com/vercel/next.js/blob/canary/packages/next/src/server/app-render/get-script-nonce-from-header.tsx" }
  - { title: "Next.js source: inline RSC payload scripts", url: "https://github.com/vercel/next.js/blob/canary/packages/next/src/server/app-render/use-flight-response.tsx" }
  - { title: OWASP HTTP Headers Cheat Sheet, url: "https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html" }
  - { title: OWASP Content Security Policy Cheat Sheet, url: "https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html" }
  - { title: OWASP REST Security Cheat Sheet (security headers), url: "https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html" }
  - { title: "W3C Content Security Policy Level 3 (Working Draft)", url: "https://www.w3.org/TR/CSP3/" }
  - { title: "web.dev: Mitigate XSS with a strict CSP", url: "https://web.dev/articles/strict-csp" }
  - { title: "MDN: CSP script-src ('strict-dynamic')", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src" }
  - { title: "MDN: CSP report-to", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/report-to" }
  - { title: "MDN: CSP report-uri (deprecated)", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/report-uri" }
  - { title: "MDN: Reporting-Endpoints", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Reporting-Endpoints" }
  - { title: "MDN: CSP style-src-attr", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src-attr" }
  - { title: "MDN: Strict-Transport-Security", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security" }
  - { title: "MDN: Cross-Origin-Opener-Policy", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy" }
  - { title: "MDN: Referrer-Policy", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy" }
  - { title: "MDN: Permissions-Policy payment directive", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/payment" }
  - { title: HSTS preload list submission requirements, url: "https://hstspreload.org/" }
  - { title: "Vercel: Encryption and TLS (default HSTS)", url: "https://vercel.com/docs/cdn-security/encryption" }
  - { title: "Vercel: Response headers", url: "https://vercel.com/docs/headers/response-headers" }
  - { title: "Stripe: Integration security guide (CSP directives)", url: "https://docs.stripe.com/security/guide" }
  - { title: "Google Tag Platform: Use a Content Security Policy", url: "https://developers.google.com/tag-platform/security/guides/csp" }
---

## Why this approach

A CSP stops injected scripts only when it is strict: a fresh nonce per response plus `'strict-dynamic'`, with no host allowlist or `'unsafe-inline'` deciding which scripts run. In the App Router, Next.js adds the nonce to its own scripts only when it renders the page per request, so the nonce policy belongs in `proxy.ts` on routes that are already dynamic, which covers most authenticated pages. Pages that must stay static, ISR or prerendered cannot carry a nonce; give them a static CSP from `next.config` `headers()` and accept that `'unsafe-inline'` scripts weaken its XSS protection. Use host or CDN rules when no Next.js server runs (`output: 'export'`). Whatever the CSP option, send the other headers on every route from `headers()`.

## Lenses

### Security

Treat CSP as a second layer behind output encoding. The proxy builds the policy, forwards it on the request so Next.js can read the nonce, and sets it on the response:

```ts
import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64'); // 128 bits
  const dev = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';
  const csp = `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev}; ` +
    `style-src 'self' 'nonce-${nonce}'; object-src 'none'; base-uri 'none'; ` +
    `frame-ancestors 'none'; form-action 'self'; default-src 'self'; report-to csp`;
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp); // Next.js reads the nonce here
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}
```

Stripe.js also needs its hosts in `frame-src` (including `https://hooks.stripe.com` for 3-D Secure) and `https://api.stripe.com` in `connect-src`. Stripe does not support cross-origin isolated pages, so skip `Cross-Origin-Embedder-Policy: require-corp`. Wallet buttons such as Google Pay use the Payment Request API, so keep `payment` out of a deny-by-default `Permissions-Policy` on checkout pages. For JSON Route Handlers, OWASP's REST cheat sheet adds `Cache-Control: no-store` and `Content-Security-Policy: frame-ancestors 'none'`. Do not send `X-XSS-Protection` (or send `0`), `Public-Key-Pins` or `Expect-CT`.

### Performance & latency

A nonce must differ per response, so every route it covers renders on each request: no static HTML, no ISR, and no Partial Prerendering shell. Next.js 16 enables Partial Prerendering through `cacheComponents`, so choose between that and nonces per app. Most authenticated pages already read cookies, so the extra cost lands mainly on public pages. Exclude `_next/static`, `_next/image`, `favicon.ico` and router prefetch requests from the proxy matcher as the Next.js guide does, so assets skip the proxy. Static routes can keep a build-time CSP from `headers()`. Keep the policy short: the proxy docs warn that large headers can trigger 431 errors behind some servers.

### UX flows

Roll out in Report-Only, browse every page type, and complete real third-party flows: sign-in popups, payment and 3-D Secure frames, analytics, embedded video. A missing host breaks a flow silently, often only in production because development adds `'unsafe-eval'`. `form-action 'self'` can block a form post that redirects to an OAuth provider in some browsers, so check sign-in buttons. Error pages need the same headers as normal pages. Before adding `includeSubDomains`, list every subdomain: one that only speaks HTTP becomes unreachable for returning visitors until `max-age` expires. Raise `max-age` in steps (300, 604800, then 2592000 seconds) when you first add it, as hstspreload.org recommends.

### Data model

Build the policy from one typed object (directive to sources) shared by the proxy and tests, so a change is reviewed in one place. If you store violation reports, keep one row per report with received time, effective directive, blocked URL, document path without query string, and user agent, then delete rows after a short retention period. Query strings can carry tokens. Group by directive and blocked origin to find real gaps; browser extensions also trigger reports, so do not allow a host just because it appears.

### Cost

Dynamic rendering turns cached HTML hits into function invocations and server CPU, which is the main cost of the nonce option on high-traffic public pages; keep those static where possible. Report collection can spike with traffic or after a bad deploy, so rate-limit and sample the endpoint or use a managed collector with a volume cap. A static CSP, baseline headers and host-level rules add no runtime cost.

## Common mistakes

- Generating a nonce in `proxy.ts` but leaving pages statically prerendered, so production scripts carry no nonce and the app does not hydrate.
- Setting the CSP only on the response, so Next.js never sees the nonce.
- Listing vendor hosts in `script-src` next to `'strict-dynamic'` and expecting that to allow un-nonced scripts.
- Shipping `'unsafe-eval'` or `'unsafe-inline'` scripts to production because development needed them.
- Enforcing a new policy without a Report-Only phase.
- Relying on the proxy matcher for every header, leaving API routes, `public/` files and 404s without them.
- Adding `preload` to HSTS by copying a snippet, before every subdomain is HTTPS.
- Using `Cross-Origin-Opener-Policy: same-origin` on pages that open OAuth or payment popups.
- Setting `frame-ancestors` or Report-Only through a meta tag, where browsers ignore them.
- Sending deprecated headers (`X-XSS-Protection: 1`, `Public-Key-Pins`, `Expect-CT`).

## Further reading

- [Next.js strict CSP example](https://github.com/vercel/next.js/tree/canary/examples/with-strict-csp)
- [MDN HTTP Observatory](https://developer.mozilla.org/en-US/observatory)
- [Google CSP Evaluator](https://csp-evaluator.withgoogle.com/)
