// Package delivery is served by the unified PackagesPage.
// This barrel keeps the folder non-empty and provides a named re-export
// so any future deep-link to /app/package-delivery resolves cleanly.
export { PackagesPage as default } from '../packages/PackagesPage';
