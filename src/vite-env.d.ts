/// <reference types="vite/client" />

declare global {
  interface Window {
    webhookStructures?: Record<string, any>;
  }
}

export {};
