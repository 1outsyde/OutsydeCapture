# Full screen pass 2b: add-on pop-ups — design

Date: 2026-11-07 · Base: main a29484d · Owner: Legend · Follows 2a (`2026-11-07-full-screen-pass-2a-design.md`)

## Intent
Same rule as 2a: no partial-height sheets on iPhone. 2b covers the add-on pop-ups.

## Goals
These open as full pages on `components/FullScreenSheet`:
1. Storefront New/Edit Add-on (`screens/StorefrontEditorScreen.tsx` ~4708, nested in the service modal)
2. Storefront "Add to other services" (`StorefrontEditorScreen.tsx` ~4868, nested)
3. Photographer "Add to other services" (`components/ServiceAddonsEditor.tsx` ~452, nested in ServiceEditorModal)
4. Add-ons tab checklist: attach / turn on-off / delete (`components/addons/AddonLibraryTab.tsx` ~374)
5. Add-ons tab New/Edit Add-on (`AddonLibraryTab.tsx` ~578)
6. Photographer New/Edit Add-on (`ServiceAddonsEditor.tsx` ~341, already full screen) moves onto the same layout.

## Decided by Legend (2026-11-07)
- Add-on editors (1, 5, 6): **Cancel top left, Done top right** (Done hides the keyboard, as today), **full-width Save at the bottom**. The bottom Cancel goes.
- Photographer editor (6) moves onto the shared layout.
- Android keyboard: not tested in 2a, so the add-on editors keep their current Android setting (KeyboardAvoidingView `"height"`).

## Non-goals
- No change to what any pop-up saves or calls (create, edit, copy, attach, toggle, delete).
- 2c, 2d, backend, web and vendor sites.

## Anti-goals
- Closing a pop-up mid-save or mid-copy when it blocks that today.
- Un-nesting a pop-up that iOS needs nested to show over the service editor.

## Constraints
- Same as 2a: tsc error list = main's; all tests pass; both exports build; no new ESLint rules.
- Each pop-up keeps its palette (Storefront and Add-ons tab: brand tokens; photographer: theme + accentColor).
- Header Cancel does exactly what that pop-up's Cancel does today (for editors: close and clear the form error), and is blocked in exactly the states it is blocked today.

## Approach
Picked in 2a and reused: the shared `FullScreenSheet`. Two additions:
- `closeDisabled?: boolean`: disables the header close and makes Android back a no-op.
- `androidKeyboardBehavior?: "height"`: forwarded to its KeyboardAvoidingView on Android (default stays undefined).
Pop-ups stay where they are in the tree (nesting kept).

## Left to the builder
- Spacing inside the existing tokens.
