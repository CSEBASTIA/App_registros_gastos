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
```

Antes de correr las apps, copiá las variables de entorno de ejemplo y completalas
con la URL y el `anon key` que imprime `supabase start` (o las de tu proyecto en
supabase.com si no usás el stack local):

```bash
cp apps/mobile/.env.example apps/mobile/.env
cp apps/desktop/.env.example apps/desktop/.env
```

```bash
pnpm dev:mobile            # corre la app Expo
pnpm dev:desktop           # corre el panel de escritorio
```

> Nota: las tablas `gastos` y `presupuestos` tienen RLS activado y policies que
> exigen un usuario autenticado (`auth.uid() = usuario_id`). Para ver datos hay
> que crear una cuenta desde la pantalla de registro; los datos del `seed.sql`
> (categorías) son de lectura pública una vez logueado.
