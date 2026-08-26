# gastos-app

Monorepo con app móvil (Expo), panel de escritorio (React + Vite + Tauri) y backend (Supabase), compartiendo lógica de dominio en `packages/core`.

## Estructura

- `apps/mobile` — app principal (Expo + expo-router)
- `apps/desktop` — panel de organización (React + Vite + Tauri)
- `packages/core` — tipos, esquemas (zod), repositorios y casos de uso compartidos
- `supabase` — migraciones, seed y config del backend

## Primeros pasos

```bash
pnpm install
pnpm supabase:start        # levanta Supabase local (requiere Supabase CLI)
pnpm supabase:types        # genera packages/core/src/types/database.ts
pnpm dev:mobile            # corre la app Expo
pnpm dev:desktop           # corre el panel de escritorio
```
