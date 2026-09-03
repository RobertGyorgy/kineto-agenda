# What's next

## iOS PWA fullscreen / background
- [x] Add `scope: "/"` + white `theme_color` to `manifest.json`.
- [x] Set `<meta name="theme-color" content="#ffffff">`.
- [x] Shrink blob sizes and keep them corner-anchored.
- [ ] **Test on a real iOS device after deleting the home-screen icon and re-adding it.**
  - iOS caches the PWA state per home-screen icon; two identical bookmarks can behave differently if added at different times.
  - Remove both icons → clear Safari cache (Settings → Safari → Clear History and Website Data) → re-add one icon.
- [ ] If still not fullscreen, inspect `window.navigator.standalone` value and compare between the two icons.

## Calendar
- [ ] Keep visible month in the top row when extending the calendar.
- [ ] Show the full month, not partial dates like "Vineri, 14 Augu".
- [ ] Single visible border around all weeks (not per week/day), thicker/wider, only for the active month, hidden by default for past/future months.
- [ ] Smaller gap between weeks and slightly larger day letters.
- [ ] Current date: always display it; hide today dot when today is already selected.
- [ ] Fix pill/circle positioning so the small circle/date sits centered inside the pill in both collapsed and extended modes.

## Skeleton loading
- [ ] Remove skeleton background; keep only card skeletons.
- [ ] Ensure skeleton layer renders *before* real cards appear (no original-card flash).

## Statistics page
- [ ] Draw chart line only up to the current day.
- [ ] Move Y-axis labels to the right side with a bit more right spacing.

## Settings / UX
- [ ] "Jurnal erori": wrap text normally instead of two words per row.
- [ ] Back arrow inside each settings page should point backwards.
- [ ] Block Safari swipe-back/forward globally inside the PWA (secondary pages too).
- [ ] Disable long-press text selection / copy globally.
- [ ] Move confirmation toasts ("notificări permise", "pauză de masă actualizată", etc.) below the notch.

## Patients / subscriptions
- [ ] Creating a patient with "ședință single" should grant exactly 1 session, not 10.
- [ ] Renewal must reset the session counter to 0 + selected subscription count (not `current + new`).
- [ ] On reset, keep patient in history but reset count to 0.
- [ ] Renewal should allow upgrading to a larger subscription package.
- [ ] Add a "Do not reset" button so renewal notifications don't appear when not needed.
- [ ] Make "Reînnoiește abonamentul" button wider with same padding as other card elements.

## Home page
- [ ] Show in-app notification on home if any action is required.

## Popups / navigation
- [ ] Popups should close when dragging the bar, not only when tapping at the very top.
- [ ] Deleting a patient should not reload the whole page.
- [ ] Moving a patient in calendar should not shift the whole screen.
- [ ] Add go-back handling inside third-party/settings pages.

## Polish
- [ ] Smoother page/element loading transitions across the app.
