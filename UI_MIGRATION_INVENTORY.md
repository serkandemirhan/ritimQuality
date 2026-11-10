# Ritim Quality UI Migration Inventory

Baseline date: 2026-11-09  
Baseline HEAD: `79b66f38fde57dbfe809b7b236f2389ea8440010` (`main`)  
Local working tree: dirty before this migration; user changes are authoritative and preserved.

## Safety baseline

- File-level backup: `C:\qcControl\ui-migration-backups\20261109-165636`
- Backup manifest: 883 files, 78,399,343 bytes, SHA-256 verified source-to-copy.
- Secrets and `.env` files were excluded. Tracked example environment files were retained because they contain templates, not runtime secrets.
- No reset, clean, checkout, stash, pull, rebase, merge, push, or production deployment is part of this migration.
- `on-premise/` is a separate application tree and is not synchronized by this work.

## Local architecture

| Area | Verified local implementation |
|---|---|
| Frontend | React 19.0.1, Vite 6.x, TypeScript 5.8, Tailwind CSS 4 via `@tailwindcss/vite` |
| Routing | State/query-driven tab navigation in `src/App.tsx`; no React Router. The cancelable `ritim-measurement-navigate` event protects active measurement navigation. |
| UI | Local facade in `src/components/ui/index.tsx`, Tailwind utilities, `src/design-system.css`, shared website brand tokens, Lucide icons, Motion and Recharts. |
| Backend | Express 4 TypeScript API, Zod validation, PostgreSQL through `pg`; server and serverless entry points share route/service code. |
| Persistence | PostgreSQL migrations under `server/db/migrations/`; browser/local recovery through `StorageService` and IndexedDB mobile measurement services. |
| Auth | JWT access/session flow, bcrypt password verification, tenant-scoped middleware and runtime role lookup. Account verification/reset additions are present locally but were untracked at baseline. |
| Roles | `admin`, `quality_engineer`, `operator`, `auditor`; navigation and API checks both exist. Menu visibility is not treated as authorization. |
| PDF/drawing | `pdfjs-dist` for PDF interpretation/rendering, `pdf-lib` for PDF work, normalized annotation coordinates in `DrawingCanvas`/`AnnotationCanvas`, report print/PDF surface in `InspectionCertificateModal`. |
| Analytics | Recharts UI with calculation logic isolated in `src/services/spcEngine.ts`. |
| Mobile | Dedicated `MobileMeasurementShell`, Visual Viewport handling, application keypad, safe-area CSS, IndexedDB draft/outbox/media/retest model. |

## Screen and functionality inventory

Classification reflects local code plus baseline automated evidence, not menu labels or marketing claims.

| Screen/workspace | Classification | Evidence and preserved behavior |
|---|---|---|
| Authentication, registration, verification, password recovery | Partially implemented | `AuthGateway`, `VerifyEmailNotice`, account API routes and browser tests exist. Real email delivery and production identity flows were not exercised in this baseline. |
| Onboarding | Partially implemented | Product/plan setup and first-use flow exist in `Onboarding`; external user-journey study has not been run. |
| General overview | Fully implemented and verified | `Overview`, API-backed overview service, empty/error/active states and existing evidence scripts/screenshots. No template/sample metrics may be introduced. |
| Organization | Fully implemented and verified | Admin-only organization view is routed through `WorkCenter`; API role restriction exists. |
| Tasks/actions | Fully implemented and verified | Task assignment/start/complete and request context in `WorkCenter` and workflow routes; lifecycle tests exist. |
| Nonconformities | Fully implemented and verified | Case transitions, ownership constraints and role checks are implemented in workflow routes and lifecycle tests. |
| Approvals | Fully implemented and verified | Approval actions and quality-role authorization exist; review/approval browser tests are present. |
| Notifications | Fully implemented and verified | Inbox/list/panel components and workflow notifications exist; unread/history flows have browser evidence. |
| Operator measurement preparation | Fully implemented and verified | `OperatorStation` preserves product/revision/lot/order selection, QR/camera fallback, save locking and desktop/mobile shell selection. |
| Mobile measurement | Fully implemented and verified in automation | Dedicated shell, custom keypad, 5×50 model, offline/reload/outbox/media/retest tests. Physical iPhone/Android acceptance remains **unable to verify in this environment**. |
| Control plans and revisions | Fully implemented and verified | `ControlPlanEditor`, `CharacteristicWorkspace`, revision snapshots, activation/deletion and tolerance data are covered by domain/revision tests. |
| Technical drawing annotation | Fully implemented and verified in browser automation | Normalized marker IDs/coordinates, zoom/pan, balloon/report links and drawing analysis tests exist. Multi-page rendering must not be reduced to a single-page template assumption. |
| Parts/products | Fully implemented and verified | `ProductManagement` handles part metadata, drawings and plan relationships; API mutation roles are enforced. |
| SPC analysis | Fully implemented; visual regression pending | Recharts views and `spcEngine` calculations exist. Numeric before/after fixture comparison is required before chart-shell migration. |
| Inspection history | Fully implemented and verified | `MeasurementLogs` filtering, mobile cards, detail trace, record opening and export services exist. Filtered record identity/payload must remain unchanged. |
| Inspection report/PDF | Fully implemented and verified | Current local premium pagination/report logic and report analysis tests pass. Print selectors and A4 layout are protected from global UI changes. |
| Users and roles | Fully implemented and verified | Admin-only management, four Quality roles, last-admin protection and API authorization exist. |
| Subscription/billing | Partially implemented | Stripe checkout/webhook and admin UI exist. Live Stripe transaction was not run. |
| Settings/rules/backup | Fully implemented locally; production persistence partly unverified | Company, preferences, inspection rules, push and backup surfaces exist; production external services were not exercised. |

## Existing public UI contracts to preserve

- `Button`: `primary | secondary | ghost | danger`, `loading`, native button props, default `type="button"`, `aria-busy`.
- Native event contracts for `Input`, `Select`, `MultiSelect`, date and measurement inputs.
- `DataTable`: children-based native table, caption/region label and automatic `data-label` generation for `rq-mobile-cards`.
- `Tabs`: `items/value/onChange/label`, arrow/Home/End keyboard behavior.
- `Modal`, `Drawer`, `ConfirmDialog`: controlled `open/title/onClose/busy`, focus restoration and busy close protection.
- Product components: `ToleranceBand`, `SampleProgress`, `TraceTimeline`; calculations and status meaning remain outside presentation primitives.
- App shell, active tab state, role rules, offline recovery, kiosk/focus state and all mutation callbacks remain owned by the existing application.

## Open-source UI evaluation

| Candidate | License / activity | Fit for this application | Decision |
|---|---|---|---|
| shadcn/ui | MIT; active official registry and Vite/Tailwind 4 documentation | Source-owned primitives can sit behind the current facade without replacing routing or domain state. Radix variant supports controlled accessible overlays. | **Selected foundation** |
| Shadcn Admin | MIT, active Vite/shadcn dashboard template | Strong visual/navigation reference, but importing its app shell/router/auth model would conflict with Ritim state and permissions. | Reference only; do not install template |
| TailAdmin | Open-source React/Tailwind dashboard with active React 19/Tailwind 4 work | Broad dashboard examples but carries template pages, layout assumptions and dependencies unrelated to inspection workflows. | Reject as application foundation |
| Tabler | MIT and actively released | Mature visual system and components, but adds a separate Bootstrap-derived CSS/JS system and chart licensing considerations. | Reject due to style/runtime duplication |
| React Admin | MIT core and actively maintained | Excellent CRUD/data-provider framework, but would replace routing, resource/state and form architecture; enterprise features also have separate terms. | Reject for incremental integration |
| Mantine | MIT, mature React component suite | Accessible and complete, but adds provider/theme/Styles API beside Tailwind and the existing facade. | Viable fallback, not selected |

Selected combination: official shadcn/ui-style source primitives using the **Radix** family, the existing Ritim facade/brand tokens, existing Recharts analytics, and the existing PDF.js/pdf-lib/drawing implementation. No generic dashboard template, fake data, second router or second domain model will be introduced.

Official references:

- https://ui.shadcn.com/docs
- https://ui.shadcn.com/docs/installation/vite
- https://ui.shadcn.com/docs/tailwind-v4
- https://github.com/shadcn-ui/ui/blob/main/LICENSE.md
- https://github.com/satnaing/shadcn-admin
- https://github.com/TailAdmin/free-react-tailwind-admin-dashboard
- https://github.com/tabler/tabler/blob/dev/LICENSE
- https://github.com/marmelab/react-admin/blob/master/LICENSE.md
- https://mantine.dev/

## Baseline verification

Passed on Windows, Node 22 toolchain:

- `npm run lint`
- `npm run build:api`
- `npm run build`
- `npm run test:cloud` — 15 tests passed across validation/runtime suites
- `npm run test:revisions` — 4 tests passed
- `npm run test:mobile-measurement` — 7 tests passed
- `npm run test:report-analysis` — passed

Baseline production build: main application chunk 562.48 kB / 168.62 kB gzip. Large existing PDF/chart chunks are recorded separately and are not attributed to UI migration.

Pending baseline gates:

- `test:mobile-measurement:browser` after its compiled fixture prerequisites.
- Physical Android Chrome/iPhone Safari keyboard, camera, safe-area and orientation checks.
- Production Supabase, mail and Stripe external-service checks.
- Five-person first-report usability study.

## Phased migration plan

1. Foundation: semantic tokens, `cn`, source primitives, facade adapters; smoke-test every facade consumer.
2. Low-risk administration/product/control-plan surfaces; preserve native input/select contracts.
3. Dialog/Sheet/Tabs/navigation only after focus, busy-close, role and breakpoint tests.
4. Records/SPC/report outer shell with data and A4 comparisons.
5. Desktop measurement preparation, then minimal mobile visual token alignment; preserve custom keypad and Visual Viewport behavior.
6. End-to-end first-report regression, accessibility/viewport evidence and removal only of proven-unused styles.

