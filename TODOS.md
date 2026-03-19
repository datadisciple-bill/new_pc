# TODOs — Equinix Pricing Tool

## Sprint 1: Pricing Trust (IN PROGRESS)
- [ ] Add `fetchedAt: number` to `PricingResult` — per-item timestamps for when each price was fetched
- [ ] Add `pricingErrors` map to Zustand store — per-service error tracking with retry
- [ ] Green "Verified" / amber "Estimated" badges on all pricing displays (ServiceCard, PriceSheet)
- [ ] Surface pricing fetch errors to user — "Price unavailable" with retry + manual price entry
- [ ] Manual price override on any service type — creates PricingResult with `isEstimate: true`
- [ ] 9 new tests across priceCalculator, configStore, csvGenerator, vcPricingCache
- [ ] Input validation for manual price entry — ensure only numeric values accepted
- [ ] Backwards compatibility — importing projects saved before `fetchedAt` should not crash

## Sprint 2: Demo Polish
- [ ] Fix mobile touch targets — ConfirmDeleteButton "Yes"/"No" buttons (QA ISSUE-003, partially fixed)
- [ ] Fix walkthrough dialog exceeding 375px mobile viewport (QA ISSUE-013)
- [ ] Add horizontal scroll on mobile price table — columns currently hidden (QA ISSUE-011)
- [ ] Create "Demo Mode" with pre-loaded sample multi-metro deal data
- [ ] Test full mobile flow on actual phone: launch → metros → services → diagram → export
- [ ] Fix `text-[10px]` interactive elements — 30+ locations below recommended mobile minimum (QA ISSUE-012)

## Sprint 3: VP Demo Package
- [ ] Write 5-minute demo script (document, not code)
- [ ] Create "Before vs After" comparison slide
- [ ] Include roadmap slide: collaboration, MEDDPICC, Solution Builder replacement
- [ ] Get Al Zsidi testimonial

## Accessibility (from QA)
- [ ] Add ARIA labels to all icon-only buttons — 0 aria-labels currently (QA ISSUE-002)
- [ ] Add role="tablist" / role="tab" to metro selector tabs
- [ ] Add Escape key to remaining modals (WalkthroughDialog, ImportDialog) (QA ISSUE-005, partial)
- [ ] Fix metro region badge contrast — bg-blue-100/text-blue-700 fails WCAG AA (QA ISSUE-010)
- [ ] Add keyboard navigation to diagram (QA ISSUE-006)

## Known Issues (from QA)
- [ ] Handle pinning requires right-click — no mobile/touch support (QA ISSUE-004)
- [ ] Token expiry not enforced — expired tokens used until API rejects (QA ISSUE-008)
- [ ] Undo stores full project snapshots — memory concern for large projects (QA ISSUE-009)
- [ ] CSV export doesn't validate pricing data before export (QA ISSUE-014)

## Design System
- [ ] Create DESIGN.md via /design-consultation — document color system, typography, spacing, component patterns for the app UI (CLAUDE.md covers diagram branding but not the app itself)

## Open Questions (from design doc)
- [ ] Deploy to shared internal URL vs localhost demo?
- [ ] Can Solution Builder's pricing data source be reused?
- [ ] Identify the VP for the demo
- [ ] Check internal design review process for Equinix branding compliance
