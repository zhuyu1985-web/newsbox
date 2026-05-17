// These will be replaced by Vite's define at build time
// For development, set these in a .env file in extension/
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
export const NEWSBOX_API_URL = import.meta.env.VITE_NEWSBOX_API_URL || "http://localhost:3000";
