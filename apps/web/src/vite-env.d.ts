/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the API server when it differs from the web app's origin. */
  readonly VITE_SOCKET_URL?: string;
}
