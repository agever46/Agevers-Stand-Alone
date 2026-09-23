---
name: profiles_public_insert_arbitrary_user_id
description: Anyone can plant fake profile data for any user account
type: constraint
---

Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.

Security Finding: [Anyone can plant fake profile data for any user account
Internal ID: profiles_public_insert_arbitrary_user_id
Scanner: supabase_lov
Level: error
Description: The 'profiles' table has a policy 'Allow system profile creation' that permits INSERT from the public role (including unauthenticated users) with a WITH CHECK condition of 'true' — meaning any request can insert a profile row for any arbitrary user_id, including PII fields like phone, address, city, and zip_code. An attacker could pre-create or overwrite profile data tied to another user's account before that user signs up or updates their profile, potentially interfering with verification flows or impersonating account details. Restrict this INSERT policy so it only allows the system/service_role to create profiles (or scope WITH CHECK to auth.uid() = user_id like the other profile insert policy already does), and remove the overly permissive public policy.]
