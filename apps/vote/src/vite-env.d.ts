/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" selects the in-memory mock client at build time. */
  readonly VITE_LIVE_MOCK?: string;
  /**
   * "1" builds in `?local=1`: the real WebAssembly over the committed test
   * election (throwaway keys), for checks before the console transport.
   */
  readonly VITE_LIVE_LOCAL?: string;
  /**
   * "1" lets `?mock=1` select the mock (a practice election) in a built
   * bundle. The Vite dev server always allows it; the shipped build never.
   */
  readonly VITE_LIVE_MOCK_SWITCH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
