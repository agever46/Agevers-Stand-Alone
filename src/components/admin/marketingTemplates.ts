// Field-based marketing email templates.
// Each template exposes a list of friendly fields + a build() that produces {subject, html}.
// This lets admins fill in a form instead of editing raw HTML.

export type FieldType = "text" | "textarea" | "url" | "image" | "number";

export interface TemplateField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  help?: string;
}

export interface RepeatableGroup {
  key: string; // e.g. "games"
  label: string; // "Games"
  itemLabel: string; // "Game"
  min: number;
  max: number;
  fields: TemplateField[];
}

export interface MarketingTemplate {
  key: string;
  name: string;
  description: string;
  fields: TemplateField[];
  repeatable?: RepeatableGroup;
  defaults: Record<string, any>;
  build: (values: Record<string, any>) => { subject: string; html: string };
}

const esc = (s: any) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const safeUrl = (s: any) => {
  const v = String(s ?? "").trim();
  if (!v) return "#";
  if (!/^https?:\/\//i.test(v)) return "https://" + v;
  return v;
};

const ctaButton = (href: string, label: string, color = "#7c3aed") =>
  `<p style="text-align:center;margin:30px 0"><a href="${esc(safeUrl(href))}" style="background:${color};color:white;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block">${esc(label)}</a></p>`;

export const MARKETING_TEMPLATES: MarketingTemplate[] = [
  {
    key: "promo",
    name: "Promo / Sale",
    description: "Headline + offer + CTA button.",
    fields: [
      { key: "subject", label: "Email subject", type: "text", placeholder: "🎮 Limited Time: 20% Off All Games!" },
      { key: "headline", label: "Headline", type: "text", placeholder: "Mega Sale Alert! 🚀" },
      { key: "body", label: "Body text", type: "textarea", placeholder: "Get 20% OFF on all games this weekend only." },
      { key: "ctaLabel", label: "Button text", type: "text", placeholder: "Shop Now →" },
      { key: "ctaUrl", label: "Button link", type: "url", placeholder: "https://agevers.com" },
      { key: "footer", label: "Small footer line (optional)", type: "text", placeholder: "Use code SAVE20 at checkout. Ends Sunday." },
    ],
    defaults: {
      subject: "🎮 Limited Time: 20% Off All Games!",
      headline: "Mega Sale Alert! 🚀",
      body: "Get 20% OFF on all games this weekend only.",
      ctaLabel: "Shop Now →",
      ctaUrl: "https://agevers.com",
      footer: "Use code SAVE20 at checkout. Ends Sunday at midnight.",
    },
    build: (v) => ({
      subject: v.subject || "",
      html: `<h1 style="color:#7c3aed;font-size:28px;margin-bottom:16px">${esc(v.headline)}</h1>
<p style="font-size:16px;line-height:1.6">${esc(v.body)}</p>
${ctaButton(v.ctaUrl, v.ctaLabel)}
${v.footer ? `<p style="color:#666;font-size:14px;text-align:center">${esc(v.footer)}</p>` : ""}`,
    }),
  },
  {
    key: "newsletter",
    name: "Newsletter",
    description: "Weekly update with bullet points and a CTA.",
    fields: [
      { key: "subject", label: "Email subject", type: "text", placeholder: "📰 What's new at Agever's this week" },
      { key: "headline", label: "Headline", type: "text", placeholder: "This week's hot picks" },
      { key: "intro", label: "Intro paragraph", type: "textarea", placeholder: "Check out the trending releases..." },
      { key: "bullets", label: "Bullet points (one per line)", type: "textarea", placeholder: "New AAA release: GAME TITLE\nSteam Wallet cards back in stock" },
      { key: "ctaLabel", label: "Button text", type: "text", placeholder: "Explore the store" },
      { key: "ctaUrl", label: "Button link", type: "url", placeholder: "https://agevers.com" },
    ],
    defaults: {
      subject: "📰 What's new at Agever's this week",
      headline: "This week's hot picks",
      intro: "Check out the trending releases, new gift cards, and pre-orders.",
      bullets: "New AAA release: GAME TITLE\nSteam Wallet cards back in stock\nPre-order bonus on UPCOMING TITLE",
      ctaLabel: "Explore the store",
      ctaUrl: "https://agevers.com",
    },
    build: (v) => {
      const items = String(v.bullets || "")
        .split("\n")
        .map((l: string) => l.trim())
        .filter(Boolean)
        .map((l: string) => `<li>${esc(l)}</li>`)
        .join("");
      return {
        subject: v.subject || "",
        html: `<h1 style="color:#222;font-size:24px">${esc(v.headline)}</h1>
<p style="font-size:15px;line-height:1.6">${esc(v.intro)}</p>
<ul style="font-size:15px;line-height:1.8">${items}</ul>
${ctaButton(v.ctaUrl, v.ctaLabel, "#222")}`,
      };
    },
  },
  {
    key: "launch",
    name: "New Launch",
    description: "Simple announcement for a new release.",
    fields: [
      { key: "subject", label: "Email subject", type: "text", placeholder: "🎉 New launch — get it first at Agever's" },
      { key: "headline", label: "Headline", type: "text", placeholder: "Launching today" },
      { key: "body", label: "Body text", type: "textarea", placeholder: "Be among the first to grab this new release..." },
      { key: "ctaLabel", label: "Button text", type: "text", placeholder: "Get Yours Now" },
      { key: "ctaUrl", label: "Button link", type: "url", placeholder: "https://agevers.com" },
    ],
    defaults: {
      subject: "🎉 New launch — get it first at Agever's",
      headline: "Launching today",
      body: "Be among the first to grab this new release at the lowest price.",
      ctaLabel: "Get Yours Now",
      ctaUrl: "https://agevers.com",
    },
    build: (v) => ({
      subject: v.subject || "",
      html: `<h1 style="color:#222;font-size:26px">${esc(v.headline)}</h1>
<p style="font-size:16px">${esc(v.body)}</p>
${ctaButton(v.ctaUrl, v.ctaLabel, "#10b981")}`,
    }),
  },
  {
    key: "referral_boost",
    name: "Referral Boost",
    description: "Invite friends → bonus giveaway entries.",
    fields: [
      { key: "subject", label: "Email subject", type: "text", placeholder: "🎁 Boost your odds — invite 2 friends..." },
      { key: "headline", label: "Headline", type: "text", placeholder: "Want to win the next giveaway? 🎯" },
      { key: "intro", label: "Intro paragraph", type: "textarea" },
      { key: "offer", label: "The offer (the highlighted box)", type: "textarea", help: "Use <strong>...</strong> if you want bold." },
      { key: "subtext", label: "Sub-text below the box", type: "textarea" },
      { key: "ctaLabel", label: "Button text", type: "text", placeholder: "Share my link →" },
      { key: "outro", label: "Closing line", type: "text" },
    ],
    defaults: {
      subject: "🎁 Boost your odds — invite 2 friends, get 3 extra giveaway entries",
      headline: "Want to win the next giveaway? 🎯",
      intro: "Thanks for being part of the Agever's community. We have a limited-time offer just for you:",
      offer: "<strong>Invite 2 friends</strong> to sign up at Agever's using your personal link, and we'll add <strong>3 bonus entries</strong> to the active giveaway draw — instantly.",
      subtext: "More entries = more chances to win. Each new friend who signs up via your link counts.",
      ctaLabel: "Share my link →",
      outro: "Good luck — and may the best gamer win. 🎮",
    },
    build: (v) => ({
      subject: v.subject || "",
      // Note: {{referral_link}} is replaced per-recipient on the server.
      html: `<h1 style="color:#7c3aed;font-size:26px;margin-bottom:12px">${esc(v.headline)}</h1>
<p style="font-size:16px;line-height:1.6">${esc(v.intro)}</p>
<div style="background:#f5f3ff;border-left:4px solid #7c3aed;padding:18px 22px;margin:24px 0;border-radius:6px">
  <p style="margin:0;font-size:17px;line-height:1.6">${v.offer || ""}</p>
</div>
<p style="font-size:15px;line-height:1.6">${esc(v.subtext)}</p>
<p style="text-align:center;margin:30px 0"><a href="{{referral_link}}" style="background:#7c3aed;color:white;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;font-size:16px">${esc(v.ctaLabel)}</a></p>
<p style="font-size:13px;color:#666;text-align:center">Or copy &amp; share: <a href="{{referral_link}}" style="color:#7c3aed">{{referral_link}}</a></p>
<p style="font-size:14px;color:#555;line-height:1.6;margin-top:30px">${esc(v.outro)}</p>`,
    }),
  },
  {
    key: "new_games",
    name: "New Games + Giveaway",
    description: "Purple giveaway banner + grid of new game cards.",
    fields: [
      { key: "subject", label: "Email subject", type: "text", placeholder: "🎮 Fresh Drops + €100 Steam Wallet Giveaway!" },
      { key: "giveawayTitle", label: "Giveaway headline", type: "text", placeholder: "Win a €100 Steam Wallet Card! 🎁" },
      { key: "giveawayBody", label: "Giveaway sub-text", type: "textarea", placeholder: "Enter our active giveaway and use it on any Steam game worldwide..." },
      { key: "giveawayCta", label: "Giveaway button text", type: "text", placeholder: "Enter Giveaway →" },
      { key: "giveawayUrl", label: "Giveaway button link", type: "url", placeholder: "https://agevers.com/giveaway" },
      { key: "sectionTitle", label: "Games section title", type: "text", placeholder: "🆕 Fresh on Agever's" },
      { key: "browseLabel", label: "Bottom button text", type: "text", placeholder: "Browse All Games →" },
      { key: "browseUrl", label: "Bottom button link", type: "url", placeholder: "https://agevers.com" },
    ],
    repeatable: {
      key: "games",
      label: "Game cards",
      itemLabel: "Game",
      min: 1,
      max: 8,
      fields: [
        { key: "title", label: "Game title", type: "text", placeholder: "Cyberpunk 2077" },
        { key: "price", label: "Price label", type: "text", placeholder: "€29.99" },
        { key: "image", label: "Image URL", type: "image", placeholder: "https://..." },
        { key: "url", label: "Product link", type: "url", placeholder: "https://agevers.com/..." },
      ],
    },
    defaults: {
      subject: "🎮 Fresh Drops + €100 Steam Wallet Giveaway!",
      giveawayTitle: "Win a €100 Steam Wallet Card! 🎁",
      giveawayBody: "Enter our active giveaway and use it on any Steam game worldwide — instant delivery.",
      giveawayCta: "Enter Giveaway →",
      giveawayUrl: "https://agevers.com/giveaway",
      sectionTitle: "🆕 Fresh on Agever's",
      browseLabel: "Browse All Games →",
      browseUrl: "https://agevers.com",
      games: [
        { title: "Game 1", price: "€XX.XX", image: "https://via.placeholder.com/400x220?text=Game+1", url: "https://agevers.com" },
        { title: "Game 2", price: "€XX.XX", image: "https://via.placeholder.com/400x220?text=Game+2", url: "https://agevers.com" },
        { title: "Game 3", price: "€XX.XX", image: "https://via.placeholder.com/400x220?text=Game+3", url: "https://agevers.com" },
        { title: "Game 4", price: "€XX.XX", image: "https://via.placeholder.com/400x220?text=Game+4", url: "https://agevers.com" },
      ],
    },
    build: (v) => {
      const games: any[] = Array.isArray(v.games) ? v.games : [];
      // Build 2-column grid (pairs of rows)
      const rows: string[] = [];
      for (let i = 0; i < games.length; i += 2) {
        const cells = [games[i], games[i + 1]].map((g, idx) => {
          if (!g) return `<td style="width:50%;${idx === 0 ? "padding-right:8px" : "padding-left:8px"};vertical-align:top"></td>`;
          return `<td style="width:50%;${idx === 0 ? "padding-right:8px" : "padding-left:8px"};vertical-align:top">
      <div style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
        <img src="${esc(safeUrl(g.image))}" alt="${esc(g.title)}" style="width:100%;display:block" />
        <div style="padding:12px">
          <div style="font-weight:bold;font-size:14px;color:#111;margin-bottom:4px">${esc(g.title)}</div>
          <div style="color:#7c3aed;font-size:15px;font-weight:bold;margin-bottom:8px">${esc(g.price)}</div>
          <a href="${esc(safeUrl(g.url))}" style="display:inline-block;background:#7c3aed;color:white;padding:8px 16px;text-decoration:none;border-radius:6px;font-size:13px;font-weight:bold">Get Now →</a>
        </div>
      </div>
    </td>`;
        }).join("");
        rows.push(`  <tr>${cells}</tr>`);
      }
      return {
        subject: v.subject || "",
        html: `<div style="background:linear-gradient(135deg,#4c1d95,#7c3aed);padding:28px 24px;border-radius:12px;text-align:center;margin-bottom:24px">
  <h1 style="color:#ffffff;font-size:26px;margin:0 0 8px">${esc(v.giveawayTitle)}</h1>
  <p style="color:#e9d5ff;font-size:15px;margin:0;line-height:1.5">${esc(v.giveawayBody)}</p>
  <a href="${esc(safeUrl(v.giveawayUrl))}" style="display:inline-block;background:#ffffff;color:#7c3aed;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:bold;margin-top:16px">${esc(v.giveawayCta)}</a>
</div>

<h2 style="font-size:20px;color:#222;margin:0 0 16px">${esc(v.sectionTitle)}</h2>
<table style="width:100%;border-collapse:separate;border-spacing:0 12px">
${rows.join("\n")}
</table>

<p style="text-align:center;margin:28px 0">
  <a href="${esc(safeUrl(v.browseUrl))}" style="display:inline-block;background:#222;color:white;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold">${esc(v.browseLabel)}</a>
</p>`,
      };
    },
  },
];

export const getTemplate = (key: string) =>
  MARKETING_TEMPLATES.find((t) => t.key === key);