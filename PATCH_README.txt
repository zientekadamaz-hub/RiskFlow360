Patch contents:
- Fixes invalid tsconfig.json (valid JSON, consistent paths)
- Standardizes imports from "@/app/lib/supabaseBrowser" -> "@app/lib/supabaseBrowser"
- Updates middleware cookies interface to getAll/setAll (recommended for @supabase/ssr)

Apply:
  1) Unzip into project root (same level as package.json)
  2) Delete .next
  3) npm run dev

Verification:
  - /login should return 200
  - build should not complain about '@/app/lib/supabaseBrowser'
