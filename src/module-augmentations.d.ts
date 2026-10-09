// Module augmentations for packages that exist at runtime but lack complete type declarations.
// This file must remain a module (has import/export) so declare module statements augment
// existing types rather than replacing them.
export {};

declare module '@sentry/react' {
  export type Event = {
    user?: { id?: string };
    tags?: Record<string, string>;
    [key: string]: unknown;
  };
  export function browserTracingIntegration(options?: Record<string, unknown>): unknown;
  export function replayIntegration(options?: Record<string, unknown>): unknown;
  export function startInactiveSpan(options: { name: string; op?: string }): { end(): void };
  export function addBreadcrumb(breadcrumb: Record<string, unknown>): void;
  export function captureException(exception: unknown, captureContext?: Record<string, unknown>): string;
  export function captureMessage(message: string, captureContext?: Record<string, unknown>): string;
  export function getCurrentScope(): { setMeasurement(name: string, value: number, unit: string): void };
}
