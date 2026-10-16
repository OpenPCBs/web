# Trace launch and compliance checklist

Assessment date: 2026-10-16. This is an implementation record and owner action list, not a compliance certification. Public notices describe the current code; they do not invent an incorporated entity, physical address, registered trademark, DMCA agent, retention period, refund entitlement, or governing law.

## Implemented in this change

| Area | Implementation |
| --- | --- |
| Identity | Trace site/organization branding, metadata, favicon, storefront and admin labels |
| Policies | Privacy, storage/cookies, terms, shipping, returns, accessibility and security pages; permanent footer links |
| Privacy requests | Account-free request form; separate privacy/copyright/security/accessibility categories in the staff queue |
| Choices | Optional Ucamco embed blocked by default, equal-choice controls, revocation, local preference expiry, GPC blocking |
| Purchases | Explicit unchecked terms acceptance required by both checkout APIs; policy version/timestamp in Stripe session metadata |
| Access/security | Origin validation, streamed size limits, persistent request limits, headers, private caching, least-privilege admin bootstrap, safer Gerber rendering |
| Maintenance | CI type/lint/test/build checks, dependency updates, CodeQL configuration, architecture and security documentation |

## Owner/legal decisions still needed

- Confirm legal operator name, business address, jurisdiction, monitored privacy/security contact and any required representative/DPO. Trace is a brand, not a confirmed incorporated entity.
- Assess applicable privacy laws and legal bases, geographic reach, children's access, consumer rights, and any required opt-out methods. A contact form is implemented, not a complete legal determination.
- Document real processing, recipients, retention periods, deletion/export procedures, provider log retention, international transfers, DPAs and vendor agreements. Check Sites/OpenAI, Cloudflare, Stripe, suppliers and Ucamco against actual contracts.
- Define return windows, shipping commitments, RMA destination, return costs, warranty allocation, lab cancellation/deposit treatment and digital-content cancellation rights before presenting specific commercial promises.
- Confirm intellectual property permissions for all listings and images, contributor licenses, trademark clearance for Trace, and whether a registered DMCA agent is needed. No trademark registration or statutory safe harbor is asserted.
- Run a live cookie/storage/network inventory including the hosting sign-in layer and payment redirects; application source alone cannot enumerate provider cookies.
- Assign a person to monitor privacy requests and confirm identity securely, track statutory deadlines, respond/appeal where required, and preserve audit evidence. No automated deletion is implemented.
- Audit WCAG 2.2 AA with keyboard, screen reader, zoom, color contrast, mobile, and real Gerber workflows. New controls and linting are not an accessibility certification.

## Hosting and operations

- Verify valid TLS, HTTPS redirects, edge WAF/bot controls and DDoS protection in the live account. Keep the Worker reachable only through trusted Sites dispatch.
- Require MFA for staff GitHub, hosting, payment and identity accounts; remove stale access and review roles. After bootstrap, clear `ADMIN_EMAILS` from runtime configuration.
- Keep `ADMIN_SETTINGS_ENCRYPTION_KEY` stable and backed up securely. Rotate compromised secrets; never include them in source or logs.
- Establish encrypted database/file backups with least-privilege access, record recovery objectives, test a restore into an isolated environment and record the result. A code change cannot certify existing backups.
- Establish incident ownership, evidence preservation, containment, recovery, customer/regulator notification assessment and a tabletop exercise. Train staff on phishing, privacy requests and customer-data handling.
- Review dependency updates and CodeQL findings. Confirm GitHub code scanning is enabled and CI completes on the repository branch.
- Treat request limits as application abuse protection only. Configure provider-level protection against volumetric traffic; monitor rejected requests without logging sensitive bodies.

## Verification limits

Security regressions and migration preservation can be tested locally without live customers. Live Stripe payments, data-subject requests, staff identity roles, provider settings, and third-party consent behavior require configured services and operational review. Do not create a fake customer order or claim these checks passed based on compilation.

## References

- Requested checklist: https://termly.io/resources/checklists/website-checklist/
- CSRF/origin guidance: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- Cookie/storage guidance: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/
- Privacy rights overview: https://oag.ca.gov/privacy/ccpa

## Dependency audit (2026-10-16)

The initial lockfile audit reported 48 advisories (26 high, 16 moderate, 6 low). Compatible direct patches and transitive overrides address the available patches, including React server rendering, Vite, undici, WebSocket, image, YAML, URI and expansion dependencies. The remaining advisory is `braces` 3.0.3, inherited by Vinext's build-time glob pipeline, with no patched version reported. This package is not imported by application request handlers; its parser was not found in the generated Worker bundle. Avoid building untrusted repositories or using attacker-controlled glob patterns. Track the upstream fix and remove the exception when available. Do not report a clean full dependency audit.

Browser visual/interaction QA was unavailable in the execution environment. Type checking, linting, the production build, and security/migration regression tests are the automated verification performed. Live payment, hosting authentication and assistive-technology workflows still require an operational smoke test.
