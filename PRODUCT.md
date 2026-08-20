# Market tool starter

## Register

**product.** This is a working instrument, not a marketing page. Nobody is being persuaded
here — the person looking at it already decided, cloned the repo and put in a key. Design
serves the numbers on the screen and gets out of the way. Nothing on this page should be
trying to be impressive.

## Users

One person: a **builder with a reason**. An indie dev, a quant hobbyist, a finance student
assembling a portfolio for a fintech job, an analyst who codes. They can read a chart and
they can read TypeScript. They are here because hunting the same six numbers across ten
tabs every morning has become annoying enough to fix.

They are **not** a beginner being onboarded, and they are not a trader. Nothing here should
explain what a stock is, and nothing here should imply the tool knows what they should do.

## Product purpose

Prove the wiring works, then get out of the learner's way so they can vibe-code their own
instrument on top of it.

Two jobs, in this order:

1. **Show that the key reached EODHD from the server and never left it.** A person who has
   just deployed this needs to know, in one glance, that it works.
2. **Be a real watchlist that is worth keeping open.** Not a demo of a watchlist. If it is
   not genuinely useful on day one, the course's whole premise — build the one tool you
   actually need — is a claim rather than an experience.

A third job runs underneath both: make the free tier's limits **visible before they bite**.
A limit you meet only by hitting it is a limit that breaks your tool without warning.

## Brand personality

Instrument-panel plain. Quiet, dense, numeric, legible at a glance and at 6am. Closer to a
terminal readout or a well-made dashboard than to a fintech landing page.

It is a **starter**, and it should look like one: finished enough to be worth keeping,
plainly incomplete enough that editing it feels like the obvious next move. It should never
look so polished that the learner is afraid to touch it.

## Anti-references

- Robinhood / consumer trading apps — gamified, celebratory, opinionated about what you
  should do. This tool has no opinion.
- Crypto dashboards — neon, glow, gradient, animated counters.
- Bloomberg pastiche — orange-on-black cosplay of professionalism.
- The stock `create-next-app` page, which is what this replaced: it proved nothing and
  told the person who just deployed it nothing about their own data.
- Any "your portfolio is up! 🎉" affect. Numbers go down too, and this thing does not know
  whose money it is.

## Design principles

- **The number is the interface.** Type, spacing and alignment exist to make figures
  scannable. Everything else is chrome and should be nearly invisible.
- **Tabular numerals everywhere**, always. Columns of figures that do not align are worse
  than no columns.
- **Green and red mean up and down, and never mean good and bad.** Always paired with a
  sign, so the meaning survives colour blindness and a bad screen.
- **State the age of every number.** A price with no timestamp is a price you cannot trust.
  This is also what makes the free-tier limits honest rather than a sales pitch.
- **Failure is named, never blank.** A key that is missing, rejected, or out of quota each
  say so specifically. A blank panel is the one outcome that teaches nothing.
- **No decoration that implies a recommendation.** No arrows suggesting momentum, no
  highlight on "movers", no ranking that is not the learner's own ordering.

## Accessibility

- WCAG AA for all text and controls. The up/down colours must pass as text against their
  background, and must not be the only carrier of direction.
- Full keyboard reachability; a visible focus ring that is never removed.
- `prefers-reduced-motion` respected — and there is very little motion to begin with.
- Dark mode is a first-class rendering, not an inverted afterthought: this is a thing people
  open at 6am.

## Motion

**This page deliberately has none, and that is the decision, not an omission.**

It is server-rendered with no client state. There is no modal, drawer, toast, dropdown or
tooltip; nothing on it changes while you look at it. The only candidate was a load-in
stagger on the watchlist rows and a fill on the quota bar, and both fail the same test:
motion is here to convey a state change, and neither of those is a change. The bar's value
was already true when the page was requested. A page that plays a sequence while it loads
is asking to be watched, and this one is meant to be read and closed.

It is also opened many times a day. Anything that animates at that frequency stops being
polish and becomes latency.

When you add motion on top of this starter, the rules that apply:

- Only `transform` and `opacity`. They skip layout and paint.
- Under 300 ms for anything in the UI; 150-250 ms is the normal band.
- `--ease-out-strong` for things entering, never `ease-in` (it delays the first frame,
  which is the frame the eye is on).
- Transitions rather than keyframes for anything that can be re-triggered before it
  finishes, because a keyframe restarts from zero and a transition retargets.
- Never `transition: all`.
- Never enter from `scale(0)`. Nothing appears out of nothing; start at `0.95` with
  opacity.
- A pressable thing gets `transform: scale(0.97)` on `:active`. That is the whole
  vocabulary for "the interface heard you".
- Gate hover behind `(hover: hover) and (pointer: fine)`, or it fires on tap and sticks.
- `prefers-reduced-motion` is already honoured globally in `globals.css`. Do not defeat it.

## Shape and surface

One radius system, applied everywhere:

- Panels and callouts: `rounded-lg`.
- Inline code chips and skeleton bars: `rounded` / `rounded-sm`, small enough to read as a
  different class of object rather than a small panel.
- The quota bar: `rounded-full`, because it is a bar.

Surfaces are off-white and off-black, never `#fff` or `#000`: pure values flatten depth and
leave a panel nothing to lift off. The page is `zinc-50` / `zinc-950`; a panel is one step
brighter than the page it sits on, in both themes.

## Copy

No em dashes anywhere a reader can see them. Use a period, a comma, a colon, or
parentheses. It is the most reliable tell that a machine wrote the sentence, and this
product's whole argument is that its numbers can be trusted.
