import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { motion, AnimatePresence } from "framer-motion";
import {
  HelpCircle, ShieldCheck, CreditCard, Key, RefreshCw, Clock,
  Tag, Globe, Users, MessageSquare, ChevronRight, ChevronDown,
  Search, ArrowLeft, Gamepad2, Monitor, ShoppingCart, AlertTriangle
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface Article {
  question: string;
  answer: string;
}

interface Topic {
  icon: any;
  title: string;
  desc: string;
  articles: Article[];
}

const topics: Topic[] = [
  {
    icon: ShoppingCart,
    title: "Ordering & Checkout",
    desc: "Everything about placing orders and payments.",
    articles: [
      {
        question: "How do I place an order?",
        answer: "Browse our catalog, find the product you want, and click 'Add to Cart'. When you're ready, go to your cart and click 'Checkout'. You'll be redirected to PayPal to complete your payment securely. Once payment is confirmed, your key will be delivered instantly."
      },
      {
        question: "What payment methods do you accept?",
        answer: "We accept PayPal, which includes payment via PayPal balance, credit cards, debit cards, and bank accounts linked to your PayPal account. All transactions are protected by PayPal's Buyer Protection program."
      },
      {
        question: "Is it safe to buy from Agever's?",
        answer: "Absolutely. All transactions are processed through PayPal with SSL encryption. Your payment details are never stored on our servers. We also offer PayPal Buyer Protection on all eligible purchases, so you're covered if anything goes wrong."
      },
      {
        question: "Can I buy multiple keys at once?",
        answer: "Yes! You can add multiple products to your cart and check out in a single transaction. Each key will be delivered separately and can be found in your order history."
      },
      {
        question: "Why was my order cancelled?",
        answer: "Orders may be cancelled if payment verification fails, if the product goes out of stock during checkout, or if suspicious activity is detected. If your order was cancelled unexpectedly, please contact our support team for assistance."
      },
    ],
  },
  {
    icon: Key,
    title: "Key Delivery & Activation",
    desc: "How to receive and activate your game keys.",
    articles: [
      {
        question: "How do I receive my key after purchase?",
        answer: "Keys are delivered instantly after payment confirmation. You can find your key in the 'Orders' section of your account. You'll also see it on the order confirmation page right after checkout."
      },
      {
        question: "How do I activate a key on Steam?",
        answer: "Open the Steam client → click 'Games' in the top menu → select 'Activate a Product on Steam' → follow the prompts and enter your key. Alternatively, you can click the '+' button in the bottom-left of Steam and select 'Activate a Product on Steam'."
      },
      {
        question: "How do I activate a key on PlayStation?",
        answer: "On your PS console, go to PlayStation Store → scroll down to 'Redeem Codes' → enter your key. Or visit store.playstation.com, sign in, click your avatar → 'Redeem Code', and enter the key."
      },
      {
        question: "How do I activate a key on Xbox?",
        answer: "On your Xbox console, press the Xbox button → go to Store → select 'Use a code'. Or visit microsoft.com/redeem, sign in with your Microsoft account, and enter your key."
      },
      {
        question: "How do I activate a key on Nintendo eShop?",
        answer: "On your Nintendo Switch, open the eShop → select your profile icon → scroll down and select 'Enter Code' → type in your key and confirm."
      },
      {
        question: "How do I activate a key on Epic Games?",
        answer: "Open the Epic Games Launcher → click your profile name (top right) → select 'Redeem Code' → enter your key and click 'Redeem'."
      },
      {
        question: "How do I activate a key on GOG?",
        answer: "Go to gog.com/redeem or open GOG Galaxy → click the '+' icon → select 'Redeem a GOG code' → enter your key."
      },
      {
        question: "My key isn't working. What should I do?",
        answer: "First, double-check that you're entering the key on the correct platform (Steam, PlayStation, Xbox, etc.) and in the correct region. Make sure there are no extra spaces. If it still doesn't work, take a screenshot of the error message and contact our support team — we'll resolve it quickly."
      },
    ],
  },
  {
    icon: Globe,
    title: "Region & Compatibility",
    desc: "Understand regional restrictions and compatibility.",
    articles: [
      {
        question: "What does 'region' mean?",
        answer: "Game keys are sometimes restricted to specific geographic regions. A 'Global' key works worldwide, while region-specific keys (like 'Europe' or 'North America') can only be activated in those regions. Always check the region listed on the product page before purchasing."
      },
      {
        question: "How do I know if a key works in my country?",
        answer: "Each product page displays the supported region. 'Global' means it works everywhere. If a specific region is listed, check if your country is included. If you're unsure, contact our support team before purchasing."
      },
      {
        question: "What happens if I buy a key for the wrong region?",
        answer: "If you accidentally purchase a key that doesn't work in your region, contact our support team immediately. Depending on the situation, we may be able to offer an exchange or a refund according to our refund policy."
      },
      {
        question: "Can I use a VPN to activate a region-locked key?",
        answer: "We strongly advise against using VPNs to bypass regional restrictions. This violates the terms of service of most platforms (Steam, PlayStation, Xbox, etc.) and may result in your account being banned. Always purchase a key that matches your region."
      },
    ],
  },
  {
    icon: RefreshCw,
    title: "Refunds & Returns",
    desc: "Our refund policy and how to request one.",
    articles: [
      {
        question: "Can I get a refund?",
        answer: "Yes, under certain conditions. If you received a duplicate key, an invalid key, or a key for the wrong product, you're eligible for a refund or replacement. Please note that once a key has been revealed and is valid, we cannot offer a refund as digital goods cannot be 'returned'."
      },
      {
        question: "How do I request a refund?",
        answer: "Go to your account → Orders → find the order in question → open a support ticket describing the issue. Include screenshots if possible. Our team will review your request and respond within 24-48 hours."
      },
      {
        question: "How long does a refund take?",
        answer: "Once approved, refunds are processed back to your original payment method (PayPal) within 3-5 business days. You'll receive an email notification when the refund has been initiated."
      },
      {
        question: "I bought the wrong product. Can I exchange it?",
        answer: "If the key hasn't been revealed/used yet, contact our support team. We'll do our best to help you exchange it for the correct product, subject to availability and price difference."
      },
    ],
  },
  {
    icon: ShieldCheck,
    title: "Account & Security",
    desc: "Manage your account and stay secure.",
    articles: [
      {
        question: "How do I create an account?",
        answer: "Click 'Sign Up' in the top navigation bar, enter your email address and choose a password. You'll receive a verification email — click the link to activate your account. Once verified, you can start shopping immediately."
      },
      {
        question: "I forgot my password. How do I reset it?",
        answer: "On the login page, click 'Forgot Password'. Enter your email address and we'll send you a password reset link. Check your spam folder if you don't see it within a few minutes."
      },
      {
        question: "How do I change my email address?",
        answer: "Go to your Account → Settings → update your email address. You'll need to verify the new email address before the change takes effect."
      },
      {
        question: "Is my personal information safe?",
        answer: "Yes. We use industry-standard SSL encryption to protect all data. We never share your personal information with third parties. Payment processing is handled entirely by PayPal, so we never see or store your financial details."
      },
      {
        question: "How do I delete my account?",
        answer: "Please contact our support team at support@agevers.com with your account deletion request. Note that this action is permanent and cannot be undone."
      },
    ],
  },
  {
    icon: CreditCard,
    title: "Pricing & Discounts",
    desc: "Understanding our pricing, deals, and coins.",
    articles: [
      {
        question: "Why are your prices lower than official stores?",
        answer: "We work with authorized distributors and sellers worldwide who supply keys at competitive prices. Regional pricing differences, bulk purchasing, and promotional deals from publishers allow us to offer lower prices while maintaining legitimacy."
      },
      {
        question: "Do you offer discount codes or coupons?",
        answer: "Yes! We occasionally offer promotional discount codes through our newsletter and social media channels. Subscribe to our newsletter at the bottom of the homepage to stay updated on deals."
      },
      {
        question: "Why did the price change after I added it to my cart?",
        answer: "Prices are dynamic and can change based on supply and demand. The final price is always shown at checkout. If you notice a significant price change, the seller may have updated their listing."
      },
    ],
  },
  {
    icon: Users,
    title: "Sellers & Marketplace",
    desc: "How our marketplace and sellers work.",
    articles: [
      {
        question: "Who are the sellers on Agever's?",
        answer: "Agever's is a marketplace where verified sellers list their digital product keys. All sellers go through an application and verification process before being allowed to sell on our platform. You can view seller ratings and reviews on their store page."
      },
      {
        question: "How do I know if a seller is trustworthy?",
        answer: "Each seller has a public profile with ratings and reviews from verified buyers. Look for sellers with high ratings and positive feedback. Our platform also monitors seller activity and removes sellers who violate our quality standards."
      },
      {
        question: "I have an issue with a seller. What do I do?",
        answer: "If you have a problem with a product from a specific seller, open a support ticket from your order. Our team mediates between buyers and sellers to ensure fair resolution. You're always protected by our buyer protection policies."
      },
      {
        question: "Can I become a seller on Agever's?",
        answer: "Yes! Visit the 'Sell on Agever's' page to learn about the requirements and apply. You'll need to provide identification documents and go through our verification process."
      },
    ],
  },
  {
    icon: Monitor,
    title: "Platform & Software Keys",
    desc: "Info about software, subscriptions, and gift cards.",
    articles: [
      {
        question: "Do you sell software keys (Windows, Office, etc.)?",
        answer: "Yes, we offer a wide range of software keys including Windows licenses, Microsoft Office, antivirus software, VPN subscriptions, and more. Check our Software category for the full selection."
      },
      {
        question: "Do you sell gift cards?",
        answer: "Yes! We offer gift cards for various platforms including Steam, PlayStation Store, Xbox, Nintendo eShop, and more. Gift cards are a great way to give someone the freedom to choose their own games."
      },
      {
        question: "Do you sell in-game items or currency?",
        answer: "Yes, we offer select in-game items, DLCs, season passes, and virtual currency for popular games. Browse our 'In-Game Items' category to see what's available."
      },
      {
        question: "Are subscription keys (Game Pass, PS Plus) available?",
        answer: "Yes, we offer subscription keys for services like Xbox Game Pass, PlayStation Plus, Nintendo Online, EA Play, and more. These are one-time activation codes for the subscription period listed."
      },
    ],
  },
  {
    icon: AlertTriangle,
    title: "Troubleshooting",
    desc: "Common issues and how to fix them.",
    articles: [
      {
        question: "I completed payment but didn't receive my key.",
        answer: "In most cases, keys are delivered instantly. If you don't see your key, first check your Account → Orders section. If the order appears but the key is missing, wait a few minutes as some orders require manual processing. If the issue persists after 30 minutes, contact our support team."
      },
      {
        question: "The key says it's already been used.",
        answer: "This is rare but can happen. Take a screenshot of the error message showing the key has been redeemed, and immediately open a support ticket. We'll investigate and provide a replacement key or full refund."
      },
      {
        question: "I'm getting an error during checkout.",
        answer: "Try the following: clear your browser cache, try a different browser, make sure your PayPal account is in good standing, and check that you're not using an ad-blocker that might interfere with the payment process. If the issue persists, contact support."
      },
      {
        question: "The game isn't showing in my library after activation.",
        answer: "After activating a key, try restarting the platform client (Steam, Epic, etc.). Check that you activated the key on the correct account. Some games may take a few minutes to appear. If it still doesn't show, contact the platform's support."
      },
      {
        question: "How do I contact support?",
        answer: "You can reach us by opening a support ticket from your Account → Orders, by emailing support@agevers.com, or by visiting our Contact Us page. Our team typically responds within 24 hours."
      },
    ],
  },
];

const HelpCenter = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [expandedArticle, setExpandedArticle] = useState<number | null>(null);

  const filteredTopics = searchQuery.trim()
    ? topics
        .map((topic) => ({
          ...topic,
          articles: topic.articles.filter(
            (a) =>
              a.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
              a.answer.toLowerCase().includes(searchQuery.toLowerCase())
          ),
        }))
        .filter((topic) => topic.articles.length > 0)
    : topics;

  const totalResults = filteredTopics.reduce((sum, t) => sum + t.articles.length, 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <section className="pt-32 pb-16">
        <div className="container mx-auto px-4 max-w-5xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Header */}
            <div className="text-center mb-10">
              <div className="flex items-center justify-center gap-3 mb-4">
                <HelpCircle className="h-8 w-8 text-primary" />
                <h1 className="font-display text-3xl md:text-5xl font-black tracking-wider text-foreground">
                  HELP CENTER
                </h1>
              </div>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Find answers to your questions and get the support you need.
              </p>
            </div>

            {/* Search */}
            <div className="relative max-w-xl mx-auto mb-12">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search for help articles..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedTopic(null);
                  setExpandedArticle(null);
                }}
                className="pl-12 h-12 bg-card border-border/50 text-foreground placeholder:text-muted-foreground text-base rounded-xl"
              />
              {searchQuery && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  {totalResults} result{totalResults !== 1 ? "s" : ""} found
                </p>
              )}
            </div>

            <AnimatePresence mode="wait">
              {selectedTopic ? (
                /* Article list view */
                <motion.div
                  key="articles"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <button
                    onClick={() => {
                      setSelectedTopic(null);
                      setExpandedArticle(null);
                    }}
                    className="flex items-center gap-2 text-primary hover:underline mb-6 text-sm font-medium"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to topics
                  </button>

                  <div className="flex items-center gap-3 mb-6">
                    <selectedTopic.icon className="h-6 w-6 text-primary" />
                    <h2 className="font-display text-2xl font-bold text-foreground">
                      {selectedTopic.title}
                    </h2>
                  </div>

                  <div className="space-y-3">
                    {selectedTopic.articles.map((article, idx) => (
                      <div
                        key={idx}
                        className="glass rounded-xl border border-border/50 overflow-hidden"
                      >
                        <button
                          onClick={() =>
                            setExpandedArticle(expandedArticle === idx ? null : idx)
                          }
                          className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-colors"
                        >
                          <span className="font-medium text-foreground pr-4">
                            {article.question}
                          </span>
                          <ChevronDown
                            className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-200 ${
                              expandedArticle === idx ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                        <AnimatePresence>
                          {expandedArticle === idx && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-5 pb-5 text-muted-foreground text-sm leading-relaxed border-t border-border/30 pt-4">
                                {article.answer}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : (
                /* Topics grid / Search results */
                <motion.div
                  key="topics"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {searchQuery ? (
                    /* Search results - flat list */
                    <div className="space-y-3">
                      {filteredTopics.map((topic) =>
                        topic.articles.map((article, idx) => (
                          <div
                            key={`${topic.title}-${idx}`}
                            className="glass rounded-xl border border-border/50 overflow-hidden"
                          >
                            <button
                              onClick={() =>
                                setExpandedArticle(
                                  expandedArticle === `${topic.title}-${idx}` as any
                                    ? null
                                    : (`${topic.title}-${idx}` as any)
                                )
                              }
                              className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-colors"
                            >
                              <div>
                                <span className="text-xs text-primary font-medium uppercase tracking-wider">
                                  {topic.title}
                                </span>
                                <p className="font-medium text-foreground mt-1">
                                  {article.question}
                                </p>
                              </div>
                              <ChevronDown
                                className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-200 ${
                                  expandedArticle === (`${topic.title}-${idx}` as any)
                                    ? "rotate-180"
                                    : ""
                                }`}
                              />
                            </button>
                            <AnimatePresence>
                              {expandedArticle === (`${topic.title}-${idx}` as any) && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-5 pb-5 text-muted-foreground text-sm leading-relaxed border-t border-border/30 pt-4">
                                    {article.answer}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    /* Topic cards grid */
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {filteredTopics.map((topic) => {
                        const Icon = topic.icon;
                        return (
                          <button
                            key={topic.title}
                            onClick={() => setSelectedTopic(topic)}
                            className="glass rounded-xl p-6 border border-border/50 hover:border-primary/50 transition-all duration-200 text-left group hover:bg-white/5"
                          >
                            <Icon className="h-7 w-7 text-primary mb-3" />
                            <h3 className="font-display text-lg font-bold text-foreground mb-1.5 flex items-center gap-2">
                              {topic.title}
                              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </h3>
                            <p className="text-muted-foreground text-sm">{topic.desc}</p>
                            <p className="text-xs text-primary/70 mt-3">
                              {topic.articles.length} articles
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Still need help */}
            <div className="mt-14 glass rounded-xl p-8 border border-border/50 text-center">
              <MessageSquare className="h-7 w-7 text-primary mx-auto mb-3" />
              <p className="text-foreground font-display text-lg mb-2">Still need help?</p>
              <p className="text-muted-foreground text-sm mb-4">
                Can't find what you're looking for? Our support team is here for you.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href="mailto:support@agevers.com"
                  className="inline-flex items-center justify-center px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors"
                >
                  Email Support
                </a>
                <a
                  href="/contact"
                  className="inline-flex items-center justify-center px-6 py-2.5 border border-border rounded-lg text-foreground font-medium text-sm hover:bg-white/5 transition-colors"
                >
                  Contact Us
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default HelpCenter;
