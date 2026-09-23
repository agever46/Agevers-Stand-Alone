// Auto-links well-known category / platform mentions in news article markdown
// to their internal store pages, formatted as markdown links so ReactMarkdown
// can render them. Matching is case-insensitive and only replaces the FIRST
// occurrence of each keyword to avoid spammy linking.
//
// Links use a special hash marker (#cta) so the markdown renderer can detect
// them and apply a prominent button style.

interface AutoLinkRule {
  // Regex pattern (case-insensitive). Use word boundaries.
  pattern: RegExp;
  href: string;
}

// Order matters: longest / most specific phrases FIRST so e.g. "Steam Gift Cards"
// matches before plain "Steam".
const RULES: AutoLinkRule[] = [
  // Gift card brand mentions → Gift Cards hub
  { pattern: /\bSteam\s+Gift\s+Cards?\b/i, href: "/gift-cards#steam" },
  { pattern: /\bPlayStation\s+(?:Store\s+)?Gift\s+Cards?\b/i, href: "/gift-cards#playstation" },
  { pattern: /\bPSN\s+Gift\s+Cards?\b/i, href: "/gift-cards#playstation" },
  { pattern: /\bXbox\s+Gift\s+Cards?\b/i, href: "/gift-cards#xbox" },
  { pattern: /\bNintendo\s+(?:eShop\s+)?Gift\s+Cards?\b/i, href: "/gift-cards#nintendo" },
  { pattern: /\bGoogle\s+Play\s+Gift\s+Cards?\b/i, href: "/gift-cards#google-play" },
  { pattern: /\bApp\s+Store\s+Gift\s+Cards?\b/i, href: "/gift-cards#apple" },
  { pattern: /\biTunes\s+Gift\s+Cards?\b/i, href: "/gift-cards#apple" },
  { pattern: /\bAmazon\s+Gift\s+Cards?\b/i, href: "/gift-cards#amazon" },
  { pattern: /\bGift\s+Cards?\b/i, href: "/gift-cards" },

  // Subscriptions / streaming
  { pattern: /\bXbox\s+Game\s+Pass\b/i, href: "/store/subscriptions" },
  { pattern: /\bPlayStation\s+Plus\b/i, href: "/store/subscriptions" },
  { pattern: /\bPS\s*Plus\b/i, href: "/store/subscriptions" },
  { pattern: /\bNintendo\s+Switch\s+Online\b/i, href: "/store/subscriptions" },
  { pattern: /\bNetflix\b/i, href: "/media-streaming" },
  { pattern: /\bSpotify\b/i, href: "/media-streaming" },
  { pattern: /\bDisney\+?\b/i, href: "/media-streaming" },

  // Platforms / stores → dedicated store pages
  { pattern: /\bSteam\b/i, href: "/steam" },
  { pattern: /\bPlayStation\b/i, href: "/playstation" },
  { pattern: /\bPS5\b/i, href: "/playstation" },
  { pattern: /\bPS4\b/i, href: "/playstation" },
  { pattern: /\bXbox\b/i, href: "/xbox" },
  { pattern: /\bNintendo\s+Switch\b/i, href: "/nintendo" },
  { pattern: /\bNintendo\b/i, href: "/nintendo" },
  { pattern: /\bEpic\s+Games?\b/i, href: "/epic-games" },
  { pattern: /\bGOG\b/, href: "/gog" }, // case-sensitive (acronym)
  { pattern: /\bBlizzard\b/i, href: "/blizzard" },
  { pattern: /\bRockstar\b/i, href: "/rockstar" },
  { pattern: /\bEA\s+Games?\b/i, href: "/ea-games" },
  { pattern: /\bOrigin\b/i, href: "/ea-games" },

  // Popular franchises / studios → search results page
  { pattern: /\bGrand\s+Theft\s+Auto(?:\s+(?:VI|V|IV|6|5|4))?\b/i, href: "/search?q=grand+theft+auto" },
  { pattern: /\bGTA(?:\s*(?:VI|V|IV|6|5|4))?\b/, href: "/search?q=gta" },
  { pattern: /\bRed\s+Dead\s+Redemption(?:\s+\d)?\b/i, href: "/search?q=red+dead+redemption" },
  { pattern: /\bCall\s+of\s+Duty\b/i, href: "/search?q=call+of+duty" },
  { pattern: /\bCyberpunk(?:\s+2077)?\b/i, href: "/search?q=cyberpunk" },
  { pattern: /\bThe\s+Witcher(?:\s+\d)?\b/i, href: "/search?q=witcher" },
  { pattern: /\bElden\s+Ring\b/i, href: "/search?q=elden+ring" },
  { pattern: /\bAssassin'?s?\s+Creed\b/i, href: "/search?q=assassins+creed" },
  { pattern: /\bFar\s+Cry(?:\s+\d)?\b/i, href: "/search?q=far+cry" },
  { pattern: /\bResident\s+Evil(?:\s+\d)?\b/i, href: "/search?q=resident+evil" },
  { pattern: /\bMonster\s+Hunter\b/i, href: "/search?q=monster+hunter" },
  { pattern: /\bStreet\s+Fighter(?:\s+\d)?\b/i, href: "/search?q=street+fighter" },
  { pattern: /\bDevil\s+May\s+Cry(?:\s+\d)?\b/i, href: "/search?q=devil+may+cry" },
  { pattern: /\bPragmata\b/i, href: "/search?q=pragmata" },
  { pattern: /\bFortnite\b/i, href: "/search?q=fortnite" },
  { pattern: /\bMinecraft\b/i, href: "/search?q=minecraft" },
  { pattern: /\bFIFA\b/, href: "/search?q=fifa" },
  { pattern: /\bEA\s+Sports\s+FC\b/i, href: "/search?q=ea+fc" },
  { pattern: /\bBattlefield(?:\s+\d)?\b/i, href: "/search?q=battlefield" },
  { pattern: /\bDoom\b/i, href: "/search?q=doom" },
  { pattern: /\bHalo\b/i, href: "/search?q=halo" },
  { pattern: /\bDiablo(?:\s+(?:IV|III|II|I|4|3|2))?\b/i, href: "/search?q=diablo" },
  { pattern: /\bWorld\s+of\s+Warcraft\b/i, href: "/search?q=world+of+warcraft" },
  { pattern: /\bOverwatch(?:\s+\d)?\b/i, href: "/search?q=overwatch" },
  { pattern: /\bStarfield\b/i, href: "/search?q=starfield" },
  { pattern: /\bHogwarts\s+Legacy\b/i, href: "/search?q=hogwarts+legacy" },
  { pattern: /\bBaldur'?s?\s+Gate(?:\s+\d)?\b/i, href: "/search?q=baldurs+gate" },

  // Publishers / studios → search
  { pattern: /\bCapcom\b/i, href: "/search?q=capcom" },
  { pattern: /\bUbisoft\b/i, href: "/search?q=ubisoft" },
  { pattern: /\bBethesda\b/i, href: "/search?q=bethesda" },
  { pattern: /\bSquare\s+Enix\b/i, href: "/search?q=square+enix" },
  { pattern: /\bActivision\b/i, href: "/search?q=activision" },
  { pattern: /\bRockstar\s+Games\b/i, href: "/rockstar" },
  { pattern: /\bCD\s+Projekt(?:\s+Red)?\b/i, href: "/search?q=cd+projekt" },
  { pattern: /\bFromSoftware\b/i, href: "/search?q=fromsoftware" },
  { pattern: /\bElectronic\s+Arts\b/i, href: "/ea-games" },
  { pattern: /\bWarner\s+Bros\.?(?:\s+Games)?\b/i, href: "/search?q=warner+bros" },
];

// CTA marker appended to internal links so the markdown <a> renderer
// can detect & style them as prominent buttons. The hash is harmless for routing.
const CTA_MARK = "#cta";

/**
 * Walks the markdown source and converts the FIRST occurrence of each
 * known keyword phrase (outside existing links/code) into a markdown link.
 * Skips matches that are already inside `[...](...)`, `<a ...>`, code spans,
 * or fenced code blocks.
 */
export function autoLinkNewsContent(markdown: string): string {
  if (!markdown) return markdown;

  // Tokenize into "protected" segments (code/links) and free text.
  // Pattern matches: fenced code ```...```, inline code `...`, markdown links [..](..),
  // images ![..](..), html anchors <a..>..</a>.
  const protectedRe =
    /(```[\s\S]*?```|`[^`]*`|!\[[^\]]*\]\([^)]*\)|\[[^\]]*\]\([^)]*\)|<a\b[\s\S]*?<\/a>)/g;

  const parts: { text: string; protected: boolean }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = protectedRe.exec(markdown)) !== null) {
    if (m.index > last) parts.push({ text: markdown.slice(last, m.index), protected: false });
    parts.push({ text: m[0], protected: true });
    last = m.index + m[0].length;
  }
  if (last < markdown.length) parts.push({ text: markdown.slice(last), protected: false });

  const usedRules = new Set<number>();

  const transformed = parts
    .map((p) => {
      if (p.protected) return p.text;
      let text = p.text;
      RULES.forEach((rule, idx) => {
        if (usedRules.has(idx)) return;
        const m2 = text.match(rule.pattern);
        if (!m2 || m2.index === undefined) return;
        const matched = m2[0];
        const replacement = `[${matched}](${rule.href}${CTA_MARK})`;
        text =
          text.slice(0, m2.index) +
          replacement +
          text.slice(m2.index + matched.length);
        usedRules.add(idx);
      });
      return text;
    })
    .join("");

  return transformed;
}

export const NEWS_CTA_MARK = CTA_MARK;
