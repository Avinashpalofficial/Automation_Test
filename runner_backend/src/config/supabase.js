"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runnerSupabaseClient = void 0;
var supabase_js_1 = require("@supabase/supabase-js");
exports.runnerSupabaseClient = (0, supabase_js_1.createClient)(process.env.RUNNER_SUPABASE_URL, process.env.RUNNER_SUPABASE_ANON_KEY);
