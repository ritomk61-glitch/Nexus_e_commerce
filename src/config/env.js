// Central API configuration. Set these in a .env file when the Express backend is ready:
//   VITE_API_BASE_URL=http://localhost:5000/api
//   VITE_USE_MOCK=false
// Central API configuration. In browser, relative /api works through Vite proxy or same-host API.
// In SSR or Node runtime, defaults to direct Express port http://localhost:5000/api.
const isBrowser = typeof window !== "undefined";
const defaultBaseUrl = isBrowser ? "/api" : "http://localhost:5000/api";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL &&
  !import.meta.env.VITE_API_BASE_URL.includes("localhost:5000")
    ? import.meta.env.VITE_API_BASE_URL
    : defaultBaseUrl;

export const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? "true") !== "false";
