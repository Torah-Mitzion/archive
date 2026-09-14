/* Anon key + project URL are safe to ship in the client — RLS on the tmz_
   tables is what actually enforces access. The anon key is worthless without a
   logged-in session for anything a viewer isn't already permitted to see. */
window.TMZ_SUPABASE_URL = 'https://difiipnhpujbwhpyownr.supabase.co';
window.TMZ_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpZmlpcG5ocHVqYndocHlvd25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTkxOTAsImV4cCI6MjEwNDM3NTE5MH0.N40pUirH7MLqJGwPmIRQghS-nWeXnKa5XEJgSQFsJFQ';
