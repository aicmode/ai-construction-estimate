/**
 * Test double for the `server-only` package.
 *
 * `server-only` throws when imported outside a React Server Component graph,
 * which would make server modules untestable under Vitest. Aliasing it here
 * keeps the real import (and therefore the real build-time guarantee) in place
 * for the application while letting the unit tests import those modules.
 */
export {};
