import ComparePageLayout from "./ComparePageLayout";

const AgeversVsG2A = () => (
  <ComparePageLayout
    competitor="G2A"
    competitorTagline="G2A is one of the largest game-key marketplaces in the world. Here's how Agever's stacks up — and where G2A still has the upper hand."
    slug="agevers-vs-g2a"
    metaTitle="Agever's vs G2A (2026) — Honest Comparison of Game Key Stores"
    metaDescription="Detailed Agever's vs G2A comparison: prices, fees, delivery speed, refund policy, regional warnings, and fraud protection. See which CD-key store is right for you."
    intro={
      <>
        <p>
          <strong className="text-foreground">G2A</strong> launched in 2010 and grew into the world's largest open marketplace for game keys, with thousands of third-party sellers and tens of millions of buyers. The trade-off: a marketplace model means quality varies by seller, and G2A has historically faced criticism over chargebacks and grey-market keys.
        </p>
        <p>
          <strong className="text-foreground">Agever's</strong> is a direct-sales storefront — we source every key from authorised distributors and ship instantly. No marketplace fees, no per-seller risk. We're smaller and newer than G2A, but every order is handled by one team with full accountability.
        </p>
      </>
    }
    rows={[
      { feature: "Business model", agevers: "Direct sales", competitor: "Open marketplace" },
      { feature: "Number of products", agevers: "10,000+", competitor: "75,000+", note: "G2A has more long-tail catalogue depth" },
      { feature: "Source of keys", agevers: "Authorised distributors + verified suppliers", competitor: "Third-party sellers" },
      { feature: "Per-key buyer protection fee", agevers: "None", competitor: "G2A Plus subscription required for full protection" },
      { feature: "Instant delivery", agevers: true, competitor: true },
      { feature: "Region-mismatch warning before checkout", agevers: true, competitor: false, note: "Agever's blocks region-incompatible purchases automatically" },
      { feature: "Email + SMS verification on every order", agevers: true, competitor: false },
      { feature: "PayPal Buyer Protection", agevers: true, competitor: "Limited", note: "PayPal restricts G2A merchant accounts in many regions" },
      { feature: "Fraud screening (IPQS + Cloudflare)", agevers: true, competitor: "Varies by seller" },
      { feature: "14-day refund window on undelivered keys", agevers: true, competitor: "Seller-dependent" },
      { feature: "Live chat support", agevers: "24/7 AI + human", competitor: "G2A Plus tier only" },
      { feature: "Delivery proof logging (forensic chargeback evidence)", agevers: true, competitor: false, note: "Every key reveal is logged with IP, device fingerprint and timestamp" },
      { feature: "News & Guides hub (original editorial content)", agevers: true, competitor: false },
      { feature: "Unique AI-written product descriptions", agevers: true, competitor: "Copy from Steam / publishers" },
      { feature: "Real-time multi-currency (30+ currencies)", agevers: true, competitor: "Limited" },
      { feature: "Automatic quantity discounts", agevers: true, competitor: false },
      { feature: "Curated bundles at a discount", agevers: true, competitor: false },
      { feature: "Restock email notifications", agevers: true, competitor: false },
      { feature: "Personalised 'Just For You' & Recently Viewed", agevers: true, competitor: "Basic" },
      { feature: "Pre-order countdown on every upcoming title", agevers: true, competitor: false },
      { feature: "Wishlist & favourites", agevers: true, competitor: true },
      { feature: "Business portal (wholesale, affiliate, partnerships)", agevers: true, competitor: "Affiliate only" },
      { feature: "Seller program (become a verified reseller)", agevers: true, competitor: true },
      { feature: "Founded", agevers: "2018", competitor: "2010" },
    ]}
    agevePros={[
      "Single accountable team — no 'contact the seller' runaround if something goes wrong.",
      "Every key sourced from authorised distributors, never from anonymous resellers.",
      "Built-in region warning prevents you from buying a key that won't activate in your country.",
      "PayPal Buyer Protection works on every order without a paid subscription.",
      "Multi-layer fraud prevention (IPQS, SMS OTP, device 2FA) protects your account even if your password leaks.",
    ]}
    competitorPros={[
      "Bigger long-tail catalogue — niche or older titles are easier to find.",
      "Marketplace pricing can occasionally beat ours on heavily-discounted titles.",
      "Established brand with millions of historical reviews.",
    ]}
    whenToChooseUs={"You want a single trustworthy storefront, accountable support, and built-in protection against region-locked or fraudulent keys — without paying extra for a 'Plus' subscription."}
    whenToChooseThem="You're hunting for an obscure or out-of-print title we don't carry, and you're comfortable evaluating individual seller ratings before each purchase."
    verdict={
      <>
        <p>
          For mainstream releases, gift cards and major-platform keys, <strong className="text-foreground">Agever's offers a tighter, safer experience</strong> with no per-order protection fee. Our region-warning system alone prevents the most common cause of "my key doesn't work" disputes.
        </p>
        <p>
          G2A is still worth checking for very niche back-catalogue titles, but for everything else — especially if you value PayPal protection, fast support, and a single accountable seller — Agever's is the simpler and safer choice.
        </p>
      </>
    }
    faqs={[
      {
        q: "Is Agever's cheaper than G2A?",
        a: "On most mainstream titles our prices match or beat G2A once you factor in G2A's per-order Shield/Plus protection fees. On obscure long-tail titles G2A marketplace sellers can sometimes go lower, but you take on more risk per order.",
      },
      {
        q: "Are Agever's keys legit?",
        a: "Yes. Every key is sourced from authorised B2B distributors and verified suppliers. We do not list grey-market keys or accept anonymous third-party sellers.",
      },
      {
        q: "Does Agever's charge a buyer protection fee like G2A Shield / G2A Plus?",
        a: "No. PayPal Buyer Protection, our 14-day undelivered-key refund and 24/7 support are included free on every order — there is no subscription tier.",
      },
      {
        q: "What if my key doesn't work?",
        a: "Open a support ticket within 14 days and we'll either replace the key or issue a full refund. Because we source from authorised distributors, replacements are usually issued the same day.",
      },
      {
        q: "Is G2A safe to use?",
        a: "G2A is a legitimate company, but because it's an open marketplace the experience varies by seller. Buyer protection requires the optional G2A Plus subscription, and chargeback disputes have historically been harder to win there than on a direct-sales store like Agever's.",
      },
    ]}
  />
);

export default AgeversVsG2A;
