---
name: profiles_public_select_policy
description: Customer phone numbers, addresses, and personal details exposed to the entire internet
type: constraint
---

Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.

Security Finding: [Customer phone numbers, addresses, and personal details exposed to the entire internet
Internal ID: profiles_public_select_policy
Scanner: supabase_lov
Level: error
Description: The 'profiles' table has a policy 'Public profiles are viewable by everyone' with USING condition 'true' for the public role, which allows anyone (including unauthenticated users) to read every user's phone, address, city, state, zip_code, and account_status alongside their display name and username. This is a direct PII leak. Remove this permissive public SELECT policy and rely on the existing 'Users can view their own profile' and admin policies instead, exposing only non-sensitive fields (e.g., display_name, username, avatar_url) via a separate public view if public profile display is required.]
