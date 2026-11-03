# Guía de diseño · FUNDIGSAC Marketing

Objetivo: una interfaz limpia, fácil de entender y fácil de mejorar. Referencias (21st.dev y práctica de Linear/Notion):
Kanban *Arunjdass* y *uvain* (columnas grises suaves, tarjetas blancas con etiquetas pequeñas), *Dashboard Sidebar* y *ShadcnStore App Dashboard* (barra lateral plana, encabezado simple).

## Estructura

- Navegación en una isla flotante arriba (escritorio) y una isla abajo (móvil); sin barra lateral. Ref. 21st.dev "Morphing Island Navbar".
- Inicio e Ideas en una sola columna (máx. 768 px), contenido en filas separadas por líneas finas, sin cuadrículas de tarjetas. Ref. 21st.dev "Inbox Calendar".
- Videos y Calendario usan un contenedor más ancho (máx. 1152 px) porque necesitan columnas.

## Reglas
1. **Superficies planas**: fondo `--background`, tarjetas `--card` con borde fino (`--border`) y sombra mínima.
2. **Un solo color de acción**: azul `--primary` (botón principal, elemento activo). El naranja (`--brand`) solo para detalles de marca (avisos, "hoy").
3. **Sin degradados, brillos ni fondos animados.** El movimiento es corto (≤250 ms) y solo comunica estado: entrada de tarjetas, indicador de pestaña, menús.
4. **Una acción principal por tarjeta** y el resto dentro del menú `⋯` (`Menu` / `MenuItem`).
5. **Texto**: Inter 14 px; títulos de página 24 px; secundario en `--muted-foreground`.

## Dónde cambiar cosas
- Colores, radios y sombras: `src/app/globals.css` (tokens `:root` y `.dark`).
- Componentes base: `src/components/ui/primitives.tsx` (Button, Card, Badge, Dialog, Menu…) y `blocks.tsx` (PageHeader, EmptyState, Seg, Ring).
- Estructura de pantallas: `src/app/{page,calendario,ideas,videos}`; navegación en `src/lib/nav.ts`.
- Acciones de una idea (convertir, mejorar, guion, programar): `src/components/idea-actions.tsx`.

## Para agregar una pantalla o sección
Sigue el patrón: `PageHeader` o encabezado simple → tarjetas `Card` con listas separadas por `divide-y` → un botón principal. Evita añadir indicadores o gráficas que no respondan a una decisión de Fabrizio.
