import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SUPABASE_URL = "https://wtyxoufpbabvqsjiipuu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_8zvxlupeNDmKnctNdkNN_w_0eqL_bYH";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
