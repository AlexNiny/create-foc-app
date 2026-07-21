/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FILECOIN_NETWORK?: "calibration" | "mainnet";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
