import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mhwooneftllvxkmoshjb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1od29vbmVmdGxsdnhrbW9zaGpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MDcwNzUsImV4cCI6MjA5NTI4MzA3NX0.LK3KeqcrYEJP9DZi4xfrvNUKlvXOD5PvFY15oG1bO_0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);