import ComparePageLayout from "./ComparePageLayout";

const AgeversVsCDKeys = () => (
  <ComparePageLayout
    competitor="CDKeys"
    competitorTagline="CDKeys is a long-running direct-sales game key store based in the UK. Here's how Agever's compares — and where CDKeys still leads."
    slug="agevers-vs-cdkeys"
    metaTitle="Agever's vs CDKeys (2026) — Honest Comparison of Game Key Stores"
    metaDescription="Side-by-side Agever's vs CDKeys comparison: prices, regional warnings, payment methods, refund policy, and product catalogue. Find the best CD-key store for you."
    intro={
      <>
        <p>
          <strong className="text-foreground">CDKeys</strong> launched in 2008 and is one of the most established direct-sales (non-marketplace) key stores. They built their reputation on consistent stock of mainstream Steam, Xbox and PlayStation titles, and they've delivered millions of orders — they have the brand recognition we don't have yet.
        </p>
        <p>
          <strong className="text-foreground">Agever's</strong> follows the same direct-sales model — no third-party sellers, no marketplace risk — but adds modern protections that most legacy stores skip: automatic region-mismatch warnings, SMS-OTP on every checkout, real-time fraud scoring and a 24/7 AI support agent that escalates to humans.
        </p>
      </>
    }
    rows={[
      { feature: "Business model", agevers: "Direct sales", competitor: "Direct sales" },
      { feature: "Founded", agevers: "2018", competitor: "2008" },
      { feature: "Region-mismatch warning before checkout", agevers: true, competitor: false, note: "CDKeys lists region in the title but does not block incompatible purchases" },
      { feature: "Real-time stock from authorised distributors", agevers: true, competitor: "Internal stock only" },
      { feature: "PayPal Buyer Protection", agevers: true, competitor: true },
      { feature: "SMS OTP verification on every order", agevers: true, competitor: false },
      { feature: "Multi-layer fraud screening (IPQS + Cloudflare)", agevers: true, competitor: "Standard processor checks" },
      { feature: "24/7 live chat (AI + human escalation)", agevers: true, competitor: "Email ticket queue" },
      { feature: "Multi-currency display (real-time FX)", agevers: true, competitor: "Limited" },
      { feature: "Delivery proof logging (forensic chargeback evidence)", agevers: true, competitor: false },
      { feature: "News & Guides hub (original editorial content)", agevers: true, competitor: false },
      { feature: "Unique AI-written product descriptions", agevers: true, competitor: "Mostly publisher copy" },
      { feature: "Automatic quantity discounts (10%+ on bulk)", agevers: true, competitor: false },
      { feature: "Curated bundles at a discount", agevers: true, competitor: false },
      { feature: "Discount codes for registered users", agevers: true, competitor: "Email-only" },
      { feature: "Restock email notifications", agevers: true, competitor: false },
      { feature: "Personalised 'Just For You' & Recently Viewed", agevers: true, competitor: false },
      { feature: "Pre-order countdown on every upcoming title", agevers: true, competitor: false },
      { feature: "Wishlist & favourites", agevers: true, competitor: true },
      { feature: "Business portal (wholesale, affiliate, partnerships)", agevers: true, competitor: false },
      { feature: "Seller program (become a verified reseller)", agevers: true, competitor: false },
      { feature: "Catalogue size", agevers: "10,000+", competitor: "20,000+" },
    ]}
    agevePros={[
      "Region-mismatch warning is enforced before checkout — you can't accidentally buy a key that won't activate in your country.",
      "SMS OTP on every order blocks credit-card fraud at the checkout step, not after the fact.",
      "24/7 AI chat with full order context — no waiting overnight for a ticket reply.",
      "Real-time multi-currency pricing including ILS, EUR, GBP, USD with live FX from Frankfurter API.",
    ]}
    competitorPros={[
      "Bigger catalogue — more legacy and back-catalogue titles in stock.",
      "Established brand recognition with millions of historical orders and Trustpilot reviews.",
      "Mature mobile app and email-newsletter ecosystem.",
    ]}
    whenToChooseUs="You want stronger anti-fraud protection at checkout, automatic region warnings, and instant 24/7 support."
    whenToChooseThem="You're shopping for a niche older title we don't carry, or you specifically want a brand with a decade more of public reviews behind it."
    verdict={
      <>
        <p>
          CDKeys and Agever's both run the same trustworthy <strong className="text-foreground">direct-sales model</strong> — no marketplace risk, no anonymous resellers — so the choice comes down to features and feel. CDKeys wins on catalogue depth and brand age. Agever's wins on modern protections: region warnings, SMS OTP, fraud scoring and instant support.
        </p>
        <p>
          For day-to-day mainstream purchases where you want fewer surprises and faster help, Agever's is the more polished experience. For the longest possible catalogue, keep CDKeys bookmarked as a backup.
        </p>
      </>
    }
    faqs={[
      {
        q: "Is Agever's as trustworthy as CDKeys?",
        a: "We use the same direct-sales model (no marketplace), source keys from authorised distributors, accept PayPal with full Buyer Protection, and offer a 14-day refund on undelivered keys. CDKeys has more years of public history, but the underlying model and protections are equivalent.",
      },
      {
        q: "Does CDKeys warn you if a key won't work in your region?",
        a: "CDKeys typically lists the region in the product title (e.g. 'EU', 'Global'), but it does not actively block you from buying a region-incompatible key at checkout. Agever's blocks the purchase and prompts you to confirm before continuing.",
      },
      {
        q: "Is Agever's cheaper than CDKeys?",
        a: "Pricing is competitive on most mainstream titles, and Agever's frequently ends up the cheaper net option once you factor in buyer protection and fraud screening included at no extra cost.",
      },
      {
        q: "What payment methods does Agever's accept?",
        a: "PayPal (with full Buyer Protection) and major credit/debit cards via PayPal's checkout, in your local currency including USD, EUR, GBP and ILS.",
      },
      {
        q: "How fast is delivery compared to CDKeys?",
        a: "Both stores deliver instantly for in-stock keys. For pre-orders, our system tracks the release date and auto-fulfils as soon as the key becomes available from the distributor.",
      },
    ]}
  />
);

export default AgeversVsCDKeys;
