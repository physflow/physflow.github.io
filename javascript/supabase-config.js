import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://hmzcipbchhsdycgozhzd.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtemNpcGJjaGhzZHljZ296aHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1ODIzNDksImV4cCI6MjA4NjE1ODM0OX0.5rMQnPHo6haSnJwdagPOt9c4MnLWJWKx5gk8eKRO66A'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
