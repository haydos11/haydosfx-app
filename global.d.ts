// Allow importing images as strings
declare module "*.png" {
  const src: string;
  export default src;
}
declare module "*.jpg" {
  const src: string;
  export default src;
}
declare module "*.jpeg" {
  const src: string;
  export default src;
}
declare module "*.svg" {
  const src: string;
  export default src;
}

// If you import JSON files (we mostly fetch now, but this is safe):
declare module "*.json" {
  const value: unknown;
  export default value;
}

// Example: if you had window fields typed as any, use unknown instead.
// Remove this block if you don't need it.
declare global {
  interface Window {
    // dataLayer?: any[];   // ❌
    dataLayer?: unknown[];  // ✅
  }
}

export {};
