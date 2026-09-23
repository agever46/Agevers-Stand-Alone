# Plan - SEO CMS with Google Gemini Integration

Build an automated, SEO-optimized Blog and CMS for Agever's, isolated from existing news/guides sections.

## User Review Required

> [!IMPORTANT]
> - A `GEMINI_API_KEY` must be provided in the project settings (Secrets) for the generator to work.
> - The `/blog` and `/blog/[slug]` routes will be public and indexed by search engines.

- [ ] Approve database schema for `seo_articles`.
- [ ] Approve UI placement of the SEO Generator in the admin sidebar.

## Technical Details

### 1. Database Schema
Create a new `seo_articles` table to ensure complete isolation:
- `id` (uuid, pk)
- `title` (text)
- `slug` (text, unique)
- `content` (text, HTML/Markdown)
- `excerpt` (text, for meta descriptions)
- `status` (text: 'draft', 'published')
- `created_at` (timestamp)
- `updated_at` (timestamp)
- RLS: Public read for 'published', Admin-only write.

### 2. Edge Function: `seo-article-generator`
- Uses `google/gemini-1.5-flash` model.
- Prompt designed for long-form SEO content with semantic HTML (H2/H3, bolding).
- Includes logic to suggest internal links to Agever's commercial routes.

### 3. Admin Dashboard (`/admin/seo-generator`)
- Input for target keywords.
- Generator interface with preview.
- "Publish" action saving to `seo_articles`.

### 4. Public Blog Hub & Detail Pages
- `/blog`: Listing hub with SEO-friendly cards and JSON-LD metadata.
- `/blog/:slug`: Dynamic article page with high-quality semantic rendering and meta tags.
- Design: Inherits the glassmorphism dark gaming theme (purple accents, sleek cards).

## Database Grants & Security
- Enable RLS on `seo_articles`.
- Grant `SELECT` to `anon` and `authenticated` for `status = 'published'`.
- Grant `ALL` to `authenticated` where `has_role(auth.uid(), 'admin')`.
- Security definer functions for internal operations if needed.
