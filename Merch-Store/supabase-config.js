// Fill these in with your Supabase project credentials.
window.DBHS_SUPABASE_URL = "https://idkvexlzglpkdjnykagj.supabase.co";
window.DBHS_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlka3ZleGx6Z2xwa2RqbnlrYWdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MTIwMjMsImV4cCI6MjA4NzA4ODAyM30.J76H7M9t2up1n8vgODKwSvesKh3QmvrrqV8DsKtRZaQ";

window.dbhsSupabase = window.supabase.createClient(
  window.DBHS_SUPABASE_URL,
  window.DBHS_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
