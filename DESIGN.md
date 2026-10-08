---
name: EMeta
description: A quiet local workspace for inspecting and removing image metadata.
colors:
  bg: "#f8f9f7"
  surface: "#ffffff"
  layer: "#f0f3ef"
  line: "#dce2dc"
  ink: "#232b27"
  muted: "#59665e"
  accent: "#22634b"
  accent-hover: "#194d3b"
  accent-soft: "#eaf3ee"
  warning: "#855015"
  warning-bg: "#fff5e6"
  error: "#a02f2b"
  error-bg: "#fff0ed"
  focus: "#257451"
  drop-line: "#a3b3a7"
  dark-bg: "#151b18"
  dark-surface: "#1b231f"
  dark-layer: "#222d26"
  dark-line: "#38463c"
  dark-ink: "#e8eee9"
  dark-muted: "#abb8ae"
  dark-accent: "#9bd5b5"
  dark-accent-hover: "#b5e3c9"
  dark-accent-soft: "#263c30"
  dark-warning: "#f0c38c"
  dark-warning-bg: "#32291d"
  dark-error: "#ffb4a9"
  dark-error-bg: "#382420"
  dark-focus: "#a5d9bc"
typography:
  headline:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "28px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.028em"
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "17px"
    fontWeight: 620
    lineHeight: 1.4
    letterSpacing: "-0.015em"
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "12px"
    fontWeight: 550
    lineHeight: 1.5
  tag:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.5
rounded:
  tag: "4px"
  control: "6px"
  button: "7px"
  compact-drop: "8px"
  workspace: "12px"
spacing:
  micro: "4px"
  tight: "6px"
  small: "8px"
  control: "10px"
  compact: "12px"
  medium: "16px"
  section: "20px"
  pane: "24px"
  shell: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "10px 14px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "10px 14px"
  button-secondary-hover:
    backgroundColor: "{colors.layer}"
  button-small:
    rounded: "{rounded.button}"
    padding: "7px 10px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    padding: "4px 0"
  search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
  theme-select:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "6px"
  file-row-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "11px 8px"
  container-tag:
    backgroundColor: "{colors.layer}"
    textColor: "{colors.ink}"
    typography: "{typography.tag}"
    rounded: "{rounded.tag}"
    padding: "2px 6px"
  dropzone:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.workspace}"
    padding: "36px 24px"
  version-switch:
    backgroundColor: "{colors.layer}"
    rounded: "{rounded.button}"
    padding: "3px"
  verification:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "16px"
---

# Design System: EMeta

## Overview

**Creative North Star: "Metadata workspace"**

The workspace makes the hidden contents of an image legible and keeps the next action explicit. The user-pinned Emil Kowalski + Impeccable direction lands as a compact English utility: warm green-gray neutrals, a restrained forest-green action and native controls. The working file and its information supply the visual interest.

The system uses plain hierarchy, hairline separators and tonal state changes. Light and dark modes preserve the same semantic roles. Local system typography supports the product's no-remote-font commitment. Motion is limited to brief control feedback; there are no entrance animations.

**Key Characteristics:**

- Compact type and readable metadata rows.
- Green actions and selected states; amber exposure cues.
- Flat surfaces separated by tone and hairlines.
- Explicit original/cleaned comparison and verified downloads.
- Native controls, visible keyboard focus and stacked mobile flow.

This document records `src/styles.css`, `src/App.tsx` and the three built components. FORM records a degraded concept seed without quality-bar boards; no approved comp is claimed. The finish verdict ships the two scored fixes and explicitly does not certify the whole surface. Generated fixture imagery in review captures is test content, not UI illustration. There are no shipping raster assets requiring provenance; the favicon is authored SVG geometry.

## Colors

The palette is neutral first, with a quiet green action and separate amber and red feedback roles. The frontmatter holds exact values; CSS custom properties are the runtime source.

### Primary

- **Forest action** (`accent`, `accent-hover`): selection, cleaning, links, checkbox accent and primary controls. Hover deepens the action in light mode and lightens it in dark mode.
- **Soft forest** (`accent-soft`): selected file, drag-over surface and verified result background.
- **Focus green** (`focus`): keyboard outline, independent of component backgrounds.

### Secondary

- **Exposure amber** (`warning`, `warning-bg`): sensitive-value labels and preservation/format warnings. Text and a label or icon communicate the state as well as color.
- **Refusal red** (`error`, `error-bg`): errors that prevent processing or inspection.

### Neutral

- **Quiet ground** (`bg`), **working surface** (`surface`) and **inset layer** (`layer`): page, primary workspace and subordinate containers.
- **Hairline** (`line`): section dividers, borders and rail separation.
- **Reading ink** (`ink`) and **supporting ink** (`muted`): primary information and explanatory text.
- **Drop boundary** (`drop-line`): the dashed drop target border; this literal stays the same in both themes.

The `dark-` tokens map one-to-one to the same roles when the root has `data-theme="dark"`. System follows the operating-system preference; Light and Dark override it. Only the theme preference is saved locally. Components reference the semantic CSS properties instead of fixing themselves to a light color.

Sidecar tonal ramps are synthesized swatch aids for the design panel, not additional colors used by the application.

**The Semantic State Rule.** Use green for actions, selection and verified results, amber for exposure or limits, and red for processing errors; retain a textual state cue.

## Typography

**Body and heading font:** Local system sans, using the stack recorded in frontmatter. This is the explicit OWN-WORLD choice; no separate decorative display face is used.

**Raw-data font:** The browser's native monospace for the preformatted metadata view; the source does not define a custom monospace stack.

The hierarchy is compact and sentence case. Moderate weight changes distinguish controls and headings without turning the utility into a presentation surface.

### Hierarchy

- **Headline:** Main task heading; changes to (25px) at the mobile breakpoint. Its line wraps are balanced.
- **Title:** Section and file headings. The empty drop target heading is (20px); compact drop target and explanatory headings use (14px).
- **Body:** Main interface copy. Secondary explanation commonly uses (13px), metadata rows and controls (12px), and fine guidance (11px).
- **Label:** File names, removal choices and small links. Button text uses weight (550) with line height (1.3); standard buttons retain the body size.
- **Tag:** Metadata-family tags. Sensitive badges use (10px), normal inherited weight and a smaller corner.

Supporting paragraphs generally cap at (65ch); format/privacy detail may reach (75ch). Counts, dimensions, byte sizes and metadata values use tabular numerals. Field names and values wrap anywhere; values preserve meaningful whitespace. The raw view is keyboard-focusable and scrolls within a maximum height of (420px).

**The Data Legibility Rule.** Preserve tabular numerals and wrapping for technical values; truncate only compact rail filenames, while the selected file heading wraps.

## Layout

The centered shell caps at (1168px), including horizontal padding of (32px). The desktop header is (84px) tall. A task heading and drop area precede the loaded workspace, whose grid is a (230px) file rail and a flexible inspection pane. The pane has (24px) padding. The overview pairs a contained image preview (144 × 120px) with its privacy summary.

Metadata definition rows use a two-column grid: labels are at least (110px), typically (38%) of the row, and the remaining width holds the value. Hairlines divide rows. Removal rules sit below the details in a (1fr / 1.2fr) layout, followed by the action row. A native in-document link beside the privacy summary exposes this next step and targets the focusable removal heading.

At (850px) and below, shell padding becomes (24px), the rail (190px), pane padding (20px) and the preview (100 × 100px); file identity and comparison controls stack. At (640px) and below, shell padding becomes (18px), the header (70px), the file rail sits above inspection with a scrollable list capped at (186px), and pane padding becomes (18px 16px). The preview is (80 × 90px); rules stack while choices remain in two columns. Action buttons become full width. At (360px) and below, choices become one column and the preview spans its row at (130px) height.

The rhythm mixes small control gaps with larger section gaps; the spacing frontmatter records repeated values rather than claiming a rigid grid. Explanatory empty-state columns stack on mobile. Only secondary descriptions and rail notes hide; core selection, inspection, cleaning and download controls remain accessible.

## Elevation & Depth

There are no box shadows, gradients or blurred overlays. Background, surface, inset layer and one-pixel borders provide depth. The selected comparison segment changes to a working surface, the rail selection uses soft forest, and focus is an outline rather than a glow.

**The Flat Surface Rule.** Separate working areas with tone and hairlines; express selection through semantic fills rather than added shadows.

## Shapes

Containers have quiet rounded corners: the workspace and empty drop target use the largest radius, the compact drop target uses a smaller one, and controls and image previews use the control radius. Primary and secondary buttons share their own radius. Tags and comparison segments use the small radius. Sensitive badges use a local corner of (3px). Most borders are solid hairlines; the drop target is dashed. Images are contained, with their preview clipping to its rounded boundary. Icons are stroke-based SVGs, never text glyph substitutes.

## Components

### Buttons

Compact, explicit controls pair a verb with an optional SVG icon.

- **Primary:** Forest action fill and working-surface text; minimum height (40px), gap (8px), padding and corners recorded in frontmatter.
- **Secondary:** Working surface, reading ink and a hairline border. Small buttons reduce minimum height to (34px) and text to (12px).
- **Text:** Underlined action text with no filled background. Icon-only controls are (36 × 36px), transparent and rounded; compact remove buttons have their own smaller desktop target, expanded on mobile.
- **Hover / press:** On fine pointers with hover, the primary uses its hover token, secondary and icon controls use the inset layer, and enabled buttons press to scale (0.98). Transform and background transitions last (140ms), with a spring-like transform easing and ordinary ease for background. No entrance or loading animation is defined.
- **Focus / disabled:** Visible focus is a (2px) semantic outline offset (3px). Disabled buttons use opacity (0.48) and a not-allowed cursor; hover/press action variants exclude them. Reduced motion sets transition durations to zero.

### Chips

Metadata-family tags are passive inset labels, not filters. They wrap with a gap of (6px). A separate amber “Sensitive” badge is attached to exposed values, so its meaning is explicit.

### Cards / Containers

The workspace is one bordered container with a toned file rail, rather than a dashboard of repeated cards. The empty drop area is tall and centered; after selection it becomes a compact horizontal add-files strip. Drag-over changes its fill and border to semantic selection colors. The visible Choose images button opens the native file picker, preserving keyboard access to the hidden file input.

The preview always uses `object-fit: contain`; unsupported or failed previews show an icon and explanation. Generated review imagery belongs to test fixtures, not the interface's visual identity.

### Inputs / Fields

The metadata search is a bordered control with an inline SVG and an accessible hidden label. Its input is transparent and uses the reading ink, muted placeholder and action-colored caret. Native checkboxes retain browser behavior with semantic accent and visible labels; removal-choice descriptions remain beside them. The native theme select has a hairline border and minimum height of (34px). These controls share the global focus treatment. Processing disables affected controls; errors appear in separate textual notices rather than an invented field-error variant.

### Navigation

The brand returns to the main surface. The file rail is a labeled list of real buttons; the active file uses `aria-current`, soft forest fill and action text. Default rows are transparent; unselected rows hover to the working surface on fine pointers. Remove actions have explicit accessible names. Mobile stacks the same list above inspection rather than hiding navigation. A skip link becomes visible on focus and reaches the main content. There is no app-wide tab bar or sidebar navigation beyond the file rail.

### Original / Cleaned switch

A compact labeled group exposes two buttons with `aria-pressed`; it appears when verified output exists. The selected segment uses the working surface and reading ink inside an inset track. It switches inspection of the same file. Grouped / Raw is a separate pressed-state button; raw data is a focusable preformatted block.

### Verification and notices

A soft forest result panel combines a shield icon, “Cleaned copy verified,” removed counts, before/after container counts and a separate download action. Amber and red notices pair SVGs with wrapping text. Session progress uses a polite live status, errors use alerts, and decorative SVGs are hidden from assistive technology. Native details disclose format and privacy limits without a custom modal.

## Do's and Don'ts

### Do:

- **Do** use semantic theme properties so light and dark surfaces preserve the same roles.
- **Do** keep technical values readable with tabular numerals, wrapping and plain field labels.
- **Do** pair sensitive, error and verified colors with explicit text.
- **Do** retain native controls, accessible labels, visible focus and reduced-motion behavior.
- **Do** keep cleaning rules beside their action and expose the removal link near the loaded privacy summary.

### Don't:

- **Don't** replace the compact workspace with promotional heroes or decorative dashboard cards.
- **Don't** add decorative shadows, gradients, remote fonts or entrance animations to this settled utility direction.
- **Don't** turn test fixture imagery into a recurring UI illustration or claim it is a shipping brand asset.
- **Don't** use color alone to claim metadata has been removed; preserve explicit verification and original/cleaned inspection.

Not canonized or repaired: no unresolved defect is asserted by this documentation pass. The finish ship verdict applies only to its two scored fixes; unavailable quality-bar boards and whole-surface review remain limits on the evidence, not design rules.
