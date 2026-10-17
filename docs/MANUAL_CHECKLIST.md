# Manual verification checklist

Automated checks cover a lot (`docs/TEST_RESULTS.md`), but they do not replace a person. Work through this list with a keyboard, a phone and a screen reader before you treat any release as checked. Record the date, the browser and device, and the result next to each item.

Status at handover: **not yet done by a person.** The scripted keyboard walk (`npm run test:keyboard`) passes, but a script is not a manual check.

## Keyboard only (no mouse or trackpad)

Use Chrome or Edge and Safari, in English and then in Arabic.

- [ ] On each page, the first Tab shows "Skip to content", and Enter moves to the main content.
- [ ] Focus is always visible and never lands on something hidden. The order follows the reading order, right to left in Arabic.
- [ ] Home: complete the brief wizard and the match demo with the keyboard only.
- [ ] Workflow: select steps with the keyboard, and use play, pause and step.
- [ ] Platform, buyer:
  - [ ] Create an objective from a sentence.
  - [ ] Tick and untick merge rows.
  - [ ] Apply the selected rows.
  - [ ] Submit the objective.
- [ ] Plan tabs: Left and Right arrows move between tabs, Home and End jump to the first and last, and the panel changes with the tab.
- [ ] Open listing details, Compare and the data controls dialog. Tab stays inside the dialog, Escape closes it, and focus returns to the button you started from.
- [ ] Supplier: edit a listing, including the date fields and the weekday checkboxes. Answer an RFQ line.
- [ ] Operations: review a verification with the checklist, and release an eligible payout.
- [ ] Form errors: submit an empty required field. The error is read out and linked to the field, and focus moves to the first error.

## Screen reader

Use VoiceOver on macOS or iOS, and NVDA on Windows.

- [ ] Dialogs announce their title. Content behind a dialog cannot be reached.
- [ ] Tabs announce "tab, selected, n of m".
- [ ] Toasts and status updates are announced: draft restored, offer revised, payment simulated.
- [ ] The map view has a table alternative that reads sensibly.
- [ ] Amounts read correctly in Arabic, for example "1,123.84 د.إ".

## Small screens and zoom

Test on a real phone in both languages, and at 200% and 400% browser zoom on a desktop.

- [ ] The demo banner stays visible and readable.
- [ ] There is no sideways scrolling except inside data tables, which scroll within their own frame.
- [ ] Primary actions (submit, approve, checkout, release) can be reached and tapped. Targets are 24 px or larger.

## Content and honesty

- [ ] Every primary call to action has a prototype notice next to it.
- [ ] No page claims a real operating company, clients, testimonials, partnerships, verified reach or performance.
- [ ] The early-access confirmation says nothing has been sent until you send the email yourself.
- [ ] The privacy page controls do what their labels say. Afterwards, check in DevTools that only `con.*` keys are gone.
- [ ] Arabic copy is reviewed by a native-speaking editor. No English text is presented as Arabic.

## Live API (staging only, never production data)

- [ ] `GET /api/health` lists every provider as configured or not.
- [ ] Each unconfigured action returns 503 and creates nothing.
- [ ] A user in one organisation cannot read or change another organisation's objectives, RFQs, payments or bookings. Test by changing the ids in the requests.
- [ ] Upload the EICAR test file once a scanner is configured. It must be marked infected and cannot be approved.
- [ ] Do a backup and restore drill (`docs/BACKUP_RESTORE.md`).
