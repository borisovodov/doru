# Design system

The UI is built from `@doru/ui` (`packages/ui`). The package owns the shared
control language, the style tokens and the component gallery; feature packages
compose screens from it.

## Tiers

- **Atoms** — buttons, form controls, chips, avatars, progress, feedback text.
- **Patterns** — section cards, entity cards, editor shells, action bars.
- **Domain** — components that know the data model but never fetch it:
  date/fact/citation editors and the reusable attachment sections.

The root entry point (`@doru/ui`) exports atoms, patterns and the style entry.
Domain components, draft helpers and domain types live in `@doru/ui/domain`:

```tsx
import { Button, Field, Input } from '@doru/ui';
import { DateEditor, displayName } from '@doru/ui/domain';
```

`@doru/ui` may import types and pure helpers from `@doru/core`, and NLS from
`@doru/platform`. It must not import `@doru/features`, `@doru/workbench`,
Electron APIs or services. `@doru/features` exports screens only; it does not
re-export the library.

## Styling rules

1. Component styles live next to the component in a `*.module.css` file and are
   imported by the component itself.
2. The global stylesheet `@doru/ui/styles.css` contains only tokens and base
   styles. It is imported once by the app entry point and by Storybook.
3. Feature CSS is layout-only (`display`, `grid`, `gap`, `padding`, sizing of
   containers). It must not skin buttons, inputs, selects or textareas.
4. Components accept `className` for layout; they do not expose internal
   classes for restyling.
5. Theme values come from `--doru-*` custom properties. Do not hardcode colors
   in component styles.

## Using a component

```tsx
import { Button, Field, Input, SectionCard } from '@doru/ui';

<SectionCard title="Details">
  <Field label="Given name">
    <Input value={name} onChange={(event) => setName(event.target.value)} />
  </Field>
  <Button variant="primary">Save</Button>
</SectionCard>;
```

## Gallery

```bash
npm run ui          # Storybook at http://localhost:6006
npm run ui:build    # static build, also runs in CI
```

The toolbar switches between all bundled themes, dark/light mode and the 17
UI locales.

User themes are discovered from `<DORU_USER_DATA>/themes` at Storybook start:

```bash
DORU_USER_DATA="$HOME/Library/Application Support/Doru" npm run ui
```

Without the variable only bundled themes are shown. A user theme with the same
id as a bundled theme overrides it, matching the app.

## E2E

Playwright tests use roles and accessible names only. Do not select by CSS
class or `data-testid`. Add a real label, `aria-label` or landmark instead.
The specs launch the app with `--lang=en-US` so accessible names are stable.

## Adding a component

1. Put it in `src/atoms`, `src/patterns` or `src/domain`.
2. Give it a scoped CSS module and import that module from the component.
3. Keep user-facing strings out of the component; accept them as props
   (domain components may use the `@doru/ui` NLS instance).
4. Add a story with the relevant variants and states.
5. Run `npm run typecheck`, `npm run check:nls` and `npm run ui:build`.
