---
name: SalesLedger
description: 暖奢记账 — 米白底 + 金色点缀 + 深绿利润
colors:
  primary: "#B8860B"
  primarySoft: "#FAF2DC"
  primaryText: "#6B520A"
  primaryLine: "#CAA94E"
  
  background: "#F4F1EA"
  surface: "#FFFFFF"
  surface2: "#FAF7F2"
  surface3: "#F0EBE1"
  
  text: "#1C1A17"
  text2: "#6A645C"
  text3: "#8C867C"
  
  border: "#E5DED4"
  borderStrong: "#D0C8BA"
  
  accent: "#2A231C"
  accentSoft: "#E6DFD4"
  
  success: "#3A7D3A"
  successSoft: "#E6F0E6"
  
  info: "#4A7D9E"
  infoSoft: "#E4EDF3"
  
  recovery: "#7A6BA0"
  recoverySoft: "#EDE9F5"
  
  danger: "#C4554D"
  dangerSoft: "#FAE8E6"

  # 风华记账工作区：现代东方编辑感
  fenghuaBackground: "#F2F0E9"
  fenghuaPaper: "#FBFAF6"
  fenghuaInk: "#1E2824"
  fenghuaMuted: "#59635E"
  fenghuaLine: "#D9D4C9"
  fenghuaGreen: "#17382F"
  fenghuaGreenSoft: "#DFE8E3"
  fenghuaRed: "#B54735"
  fenghuaRedSoft: "#F4E3DE"

typography:
  fontFamily:
    sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    serif: "'Iowan Old Style', 'Palatino Linotype', 'URW Palladio L', P052, serif"
    numeric: "'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace"
  fontSize:
    xs: "0.68rem"
    sm: "0.75rem"
    base: "0.82rem"
    md: "0.85rem"
    lg: "1rem"
    xl: "1.15rem"
    xxl: "1.5rem"
  fontWeight:
    normal: "400"
    medium: "500"
    semibold: "600"
    bold: "700"
  lineHeight:
    tight: "1.3"
    base: "1.6"
    relaxed: "1.75"

rounded:
  sm: "6px"
  compact: "7px"
  ledger: "8px"
  md: "10px"
  lg: "14px"
  full: "9999px"

spacing:
  xs: "3px"
  sm: "6px"
  md: "8px"
  base: "10px"
  lg: "12px"
  xl: "14px"
  xxl: "18px"
  xxxl: "20px"

components:
  button:
    height: "44px"
    padding: "0 18px"
    borderRadius: "var(--radius-md)"
    fontSize: "0.9rem"
    fontWeight: "600"
  
  input:
    height: "44px"
    padding: "0 14px"
    borderRadius: "var(--radius-sm)"
    fontSize: "0.88rem"
  
  card:
    padding: "14px"
    borderRadius: "var(--radius-md)"
    border: "1px solid var(--border)"
    background: "var(--surface)"
  
  statsCard:
    padding: "12px 14px"
    borderRadius: "var(--radius-md)"
    background: "var(--surface)"
---

# Visual Identity

**Concept:** 暖奢记账 (Warm Luxury Ledger) — A personal finance tracker for luxury resale sales staff that combines warmth with sophistication.

**Aesthetic:** Warm neutrals (米白/beige backgrounds) with strategic gold accents for premium feel, deep green for profit emphasis. Inspired by high-end stationery and boutique receipt aesthetics.

**Mood:** Professional yet approachable, efficient but not clinical. Feels like a personal assistant rather than corporate accounting software.

## Fenghua Workspace

风华记账与 Joeyzou 共用应用框架、登录和基础交互规范，但拥有独立视觉身份。页面使用暖灰纸张色、墨绿主界面与少量朱红操作色，形成现代东方编辑感；不把风华配色带入 Joeyzou 的销售记账区域。

- 墨绿用于风华顶栏、月度结余和主要操作。
- 朱红用于支出、当前页签和新增账目。
- 收支明细采用无卡片的日期分组列表，待办采用清单行。
- 紧凑操作使用 6–8px 圆角，只有浮动新增按钮和完成勾选保持圆形。

## Colors

**Foundation:**
- **Background** `#F4F1EA` — Warm off-white, like premium stationery
- **Surface** `#FFFFFF` — Pure white for cards and elevated elements
- **Surface variants** `#FAF7F2`, `#F0EBE1` — Subtle layers for segmented controls and disabled states

**Text hierarchy:**
- **Primary text** `#1C1A17` — Near-black, high contrast for readability
- **Secondary text** `#6A645C` — Medium gray for labels and meta info
- **Tertiary text** `#8C867C` — Light gray for hints and disabled states

**Brand accent — Gold:**
- **Primary gold** `#B8860B` (DarkGoldenRod) — Luxury accent, used sparingly
- **Gold line** `#CAA94E` — Lighter variant for borders and decorative lines
- **Gold soft** `#FAF2DC` — Subtle background for gold-themed elements
- **Gold text** `#6B520A` — Dark gold for text on soft backgrounds

**Semantic colors:**
- **Success/Profit** `#3A7D3A` — Forest green for earnings and positive outcomes
- **Info** `#4A7D9E` — Muted blue for neutral information
- **Recovery** `#7A6BA0` — Purple-gray for consignment/buyback channel
- **Danger** `#C4554D` — Muted red for errors and destructive actions

**Usage rules:**
- Gold is reserved for earnings, premium actions, and brand moments
- Profit amounts always use success green
- Channel badges use semantic colors: quota=info, direct=gold, recovery=recovery, other=accent
- Borders default to subtle `#E5DED4`, use strong `#D0C8BA` only for emphasis

## Typography

**Font stack:**
- **Sans-serif** (body): System fonts optimized for each platform
- **Serif** (titles): Iowan Old Style / Palatino for warmth and sophistication
- **Monospace** (numbers): SF Mono / Cascadia Code for tabular figures

**Hierarchy:**
- **App title** 1.15rem serif, semibold — Header branding
- **Section titles** 1rem serif, semibold — Content area headers
- **Large numbers** 1.5rem numeric, bold — Earnings display
- **Body text** 0.82–0.88rem sans, regular — Default UI text
- **Labels** 0.75rem sans, medium — Form labels and metadata
- **Hints** 0.68rem sans, regular — Helper text and disclaimers

**Number formatting:**
- Currency always formatted as `¥14,760` or `¥14,760.00` with monospace font
- Use native `Intl.NumberFormat` for consistency
- Profit/loss shown with color (green/red) but no +/− prefix in primary display

## Layout

**Container:**
- Max width: 430px (optimal for iPhone Pro Max)
- Centered on desktop with subtle side borders
- Full-width on mobile with safe-area-inset padding

**Spacing system:**
- Content padding: 18px horizontal
- Card gap: 8px vertical for list items, 10px for section spacing
- Section margin: 18px top, 12px bottom for headers
- Form field gap: 14px vertical

**Safe areas:**
- Top: `env(safe-area-inset-top)` for notched iPhones
- Bottom: `env(safe-area-inset-bottom) + 88px` for FAB clearance

**Grid & rhythm:**
- Stats grid: 3 columns on landscape, 2 on portrait narrow
- Transaction list: Single column, full-width cards
- Form fields: Single column, full-width inputs

## Components

### Buttons

**Primary button:**
```css
height: 44px; padding: 0 18px;
background: var(--gold); color: #fff;
border-radius: 10px; font-size: 0.9rem; font-weight: 600;
box-shadow: 0 2px 6px rgba(184,134,11,0.25);
```
- Used for: Save transaction, confirm actions
- Hover: Darker gold, raised shadow
- Active: Scale 0.98, reduced shadow

**Secondary button:**
```css
height: 44px; padding: 0 18px;
background: var(--surface); color: var(--text);
border: 1px solid var(--border); border-radius: 10px;
```
- Used for: Cancel, neutral actions
- Hover: Border turns gold, soft gold background

**Icon-only button (month nav, delete):**
```css
width: 38px; height: 38px;
border: 1px solid var(--border); border-radius: 6px;
```

**FAB (Add transaction):**
```css
width: 60px; height: 60px; border-radius: 50%;
background: var(--gold); color: #fff;
box-shadow: 0 4px 12px rgba(184,134,11,0.30);
position: fixed; right: 18px; bottom: calc(env(safe-area-inset-bottom) + 20px);
```

### Cards

**Transaction card:**
```css
padding: 14px; border: 1px solid var(--border);
border-radius: 10px; background: var(--surface);
margin-bottom: 8px;
```
- Layout: Icon left, main content center, actions right
- Hover: Subtle lift (scale 1.005, shadow)
- Active (mobile tap): Scale 0.995

**Stats card:**
```css
padding: 12px 14px; border-radius: 10px;
background: var(--surface); border: none;
box-shadow: 0 1px 2px rgba(28,26,23,0.08);
```
- Variants: base (gray), commission (gold), profit (gold)
- Label: 0.68rem, uppercase, letter-spacing 0.03em

**Monthly summary card:**
```css
padding: 16px; border: 1px solid var(--border);
border-radius: 10px; cursor: pointer;
```
- Tap to drill into month details
- Shows: Month label, transaction count, earnings breakdown

### Forms

**Text input:**
```css
height: 44px; padding: 0 14px;
border: 1px solid var(--border); border-radius: 6px;
background: var(--surface); font-size: 0.88rem;
```
- Focus: Gold border, subtle gold shadow `0 0 0 3px rgba(184,134,11,0.10)`
- Error: Red border, danger-soft background

**Textarea:**
```css
min-height: 80px; padding: 12px 14px;
border: 1px solid var(--border); border-radius: 6px;
resize: vertical;
```

**Select dropdown:**
```css
height: 44px; padding: 0 12px;
appearance: none; /* Custom arrow via SVG background */
```

**Segmented control (Seller tabs, View tabs):**
```css
display: flex; background: var(--surface-2);
border-radius: 10px; padding: 3px;
```
- Button: flex: 1, height: 38px, inner radius 8px
- Active: White background, subtle shadow

### Badges

**Channel badge:**
```css
padding: 4px 10px; border-radius: 6px;
font-size: 0.7rem; font-weight: 600;
text-transform: uppercase; letter-spacing: 0.03em;
```
- Quota: info colors (blue background)
- Direct: gold colors
- Recovery: purple-gray colors
- Other: accent colors (dark gray)

### Login screen

**Numeric keypad:**
```css
grid: 3 columns × 4 rows; gap: 16px;
max-width: 280px; centered;
```
- Key: Circular button, aspect-ratio 1, 1.5rem font
- Tap: Scale 0.95, darker background
- Delete key: Light gray, smaller font (1.1rem)

**Password dots:**
```css
4 dots; gap: 12px; 16px diameter;
border: 2px solid var(--border-strong);
```
- Filled: Gold background and border, scale 1.1
- Error: Red, shake animation

## Motion

**Timing function:** `cubic-bezier(0.4, 0, 0.2, 1)` — Default ease for all transitions

**Transitions:**
- **Fast** (150ms): Button press, card tap feedback
- **Standard** (200ms): Hover states, border color changes
- **Moderate** (300ms): List item entry animations, panel slides
- **Slow** (400ms): Modal open/close, page transitions

**Animations:**
- **List items:** Fade in + translateY(6px → 0) on load, staggered by 50ms
- **Modal:** Scale(0.95 → 1) + fade in on open, reverse on close
- **Error shake:** 400ms ease, translateX oscillation (0 → −8px → 8px → 0)
- **Loading spinner:** 700ms linear infinite rotation

**Interaction feedback:**
- Buttons: Scale 0.98 on active (primary), 0.995 on tap (cards)
- Cards: Lift on hover (scale 1.005), press on mobile tap
- Inputs: Expand focus ring over 200ms

## Accessibility

**Contrast:**
- Text on background: 10:1 (primary), 7:1 (secondary), 4.5:1 (tertiary)
- Gold text on gold-soft: 7:1
- All interactive elements meet WCAG AA touch target size (44×44px minimum)

**Focus indicators:**
- Visible 3px gold ring on all focusable elements
- Never suppressed, even on mouse interaction

**Motion:**
- Respects `prefers-reduced-motion` — transitions reduced to 50ms, no translateY
- Essential feedback (error shake, loading spinner) preserved

**Screen readers:**
- All form fields have associated `<label>` or `aria-label`
- Loading states announced with `aria-live="polite"`
- Error messages announced immediately with `aria-live="assertive"`

## Responsive

**Breakpoints:**
- Mobile: < 431px (single column, full-bleed)
- Desktop: ≥ 431px (max-width container, side borders)

**Layout shifts:**
- Stats grid: 3 columns → 2 columns on narrow portrait
- Form: Always single column, stacks vertically
- Pagination: Collapses to icon-only buttons < 360px

**iOS specifics:**
- Uses `100dvh` for viewport height (accounts for Safari address bar)
- Safe area insets for notched devices and home indicator
- `-webkit-tap-highlight-color: transparent` to suppress default tap feedback
- `user-scalable=no` to prevent zoom on input focus

## Assets

**Icons:** Emoji for quick implementation, no external icon library
- Add: ➕ or + symbol
- Edit: ✏️ or pencil icon
- Delete: 🗑️ or × symbol
- Calendar: 📅
- Filter: ⚙️ or funnel icon

**No custom images in v1** — All visuals are CSS-based (gradients, borders, shadows)

## Patterns

**Empty states:**
- Centered icon (emoji), title, and hint text
- Muted colors (text-3)
- CTA button to add first item

**Loading states:**
- Inline spinner for button actions (gold on primary buttons)
- Skeleton screens for list loading (pulsing gray cards)
- "加载中..." text for longer operations

**Error states:**
- Inline validation below field (red text, danger-soft background)
- Toast notification for API errors (slides from top, auto-dismiss 3s)
- Form-level errors above submit button

**Success feedback:**
- Toast notification "已保存" (saved) with checkmark
- Brief scale animation on updated card
- No blocking success modals

## Implementation notes

**CSS architecture:**
- Joeyzou legacy CSS remains in the `<style>` block
- Visually isolated workspaces may use a dedicated static stylesheet such as `public/fenghua.css`
- CSS custom properties for all tokens
- BEM-style naming for components
- Mobile-first, desktop enhancements via min-width queries

**Performance:**
- Critical CSS inlined in `<head>`
- No CSS-in-JS or runtime styles
- `will-change` avoided (use `transform` for animations)
- Animations use `transform` and `opacity` only (GPU-accelerated)

**Browser support:**
- iOS Safari 15+ (primary target)
- Chrome on iOS 15+
- Desktop browsers (graceful degradation)
- No IE11 support

---

**Version:** 1.0  
**Last updated:** 2026-08-07  
**Maintained by:** Product owner & Claude Opus 4.8
