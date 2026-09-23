import { ShoppingCart, User, Menu, X, Search, ChevronDown, Store, LogOut, DollarSign, Trash2, LayoutDashboard, Shield, Heart, Package, Receipt, Key, Settings, MessageSquare, UserCircle, Send } from "lucide-react";
import CurrencySelector from "@/components/CurrencySelector";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/useCurrency";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useNavMenu } from "@/hooks/useNavMenu";
import { useWishlist } from "@/hooks/useWishlist";
import { useGameGroupMap, collapseByGameGroup } from "@/hooks/useGameGroupMap";
import { tokenizeSearchQuery } from "@/lib/searchTokenize";


const Navbar = () => {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileOpenSub, setMobileOpenSub] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSeller, setIsSeller] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const { data: gameGroupMap } = useGameGroupMap();
  const gameGroupMapRef = useRef(gameGroupMap);
  useEffect(() => { gameGroupMapRef.current = gameGroupMap; }, [gameGroupMap]);
  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null; username: string | null; email_verified: boolean }>({ display_name: null, avatar_url: null, username: null, email_verified: false });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const cartRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const { user, signOut } = useAuth();
  const { items, removeItem, updateQuantity, clearCart, count, total } = useCart();
  const { count: wishlistCount } = useWishlist();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  const { categories: navCategories } = useNavMenu();
  const categories = navCategories.filter((c) => c.is_visible).map((c) => ({
    name: c.name,
    href: c.href,
    subcategories: c.subcategories?.filter((s) => s.is_visible).length
      ? c.subcategories.filter((s) => s.is_visible).map((s) => ({ name: s.name, href: s.href }))
      : undefined,
  }));

  useEffect(() => {
    if (!user) {setIsAdmin(false);setIsSeller(false);return;}
    // user_roles has no direct SELECT grant (by design — roles can only be
    // read/written through security-definer functions), so this must go
    // through check_my_role(), not a table query.
    supabase.rpc("check_my_role" as any, { _role: "admin" }).then(({ data }) => setIsAdmin((data as any) ?? false));
    supabase.rpc("check_my_role" as any, { _role: "seller" }).then(({ data }) => setIsSeller((data as any) ?? false));
  }, [user]);

  // Fetch profile
  useEffect(() => {
    if (!user) { setProfile({ display_name: null, avatar_url: null, username: null, email_verified: false }); return; }
    
    // Initial fetch
    supabase.from("profiles").select("display_name, avatar_url, username, email_verified").eq("user_id", user.id).single()
      .then(({ data }) => { if (data) setProfile({ ...data, email_verified: data.email_verified ?? false }); });

    // Realtime subscription for profile changes
    const channel = supabase
      .channel(`profile-${user.id}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'profiles',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        if (payload.new) {
          setProfile(prev => ({ ...prev, ...payload.new }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpenDropdown(null);
      if (cartRef.current && !cartRef.current.contains(e.target as Node)) setCartOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    clearTimeout(searchTimerRef.current);
    if (!query.trim()) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      // Word-boundary match via the same RPC the full search results page
      // uses, so autocomplete suggestions never include products that
      // "Show All Results" would then exclude — e.g. searching "15" must
      // not suggest "315"/"415"/"150" just because they contain "15".
      const words = tokenizeSearchQuery(query);
      const { data } = await supabase.rpc("search_products_with_metadata" as any, { _words: words });
      const rows = (data as any[]) || [];

      // The RPC above only matches on title/developer/publisher — it has no
      // idea whether the product is actually purchasable. Cross-check the
      // same two stock sources SearchResults.tsx uses (an active Kinguin
      // offer with real stock, or a manual key) so a listing Kinguin has
      // deactivated (404'd, out of stock) never shows up as a suggestion.
      let purchasable = rows;
      if (rows.length > 0) {
        const ids = rows.map((r) => r.id);
        const [kpRes, mkRes] = await Promise.all([
          supabase.rpc("get_public_kinguin_by_ids" as any, { _ids: ids }),
          supabase.rpc("get_manual_key_counts" as any),
        ]);
        const inStockIds = new Set<string>();
        ((kpRes.data as any[]) || []).forEach((kp: any) => {
          if (kp.is_active && (kp.kinguin_stock ?? 0) > 0) inStockIds.add(kp.allowed_product_id);
        });
        ((mkRes.data as any[]) || []).forEach((mk: any) => {
          if (Number(mk.key_count) > 0) inStockIds.add(mk.allowed_product_id);
        });
        purchasable = rows.filter((r) => inStockIds.has(r.id));
      }

      const collapsed = collapseByGameGroup(purchasable.slice(0, 30), gameGroupMapRef.current);
      setSearchResults(collapsed);
      setSearchOpen(true);
    }, 300);
  };

  const handleResultClick = (item: any) => {
    if (typeof item.slug === "string" && item.slug.startsWith("__game__/")) {
      navigate(`/game/${item.slug.slice("__game__/".length)}`);
    } else {
      navigate(`/product/${item.slug || item.id}`);
    }
  };

  return (
    <nav className="fixed left-0 right-0 z-[2147483000] bg-white border-b border-border/30 top-[var(--new-account-banner-height,0px)]">
      {/* Row 1: Logo + Search + Actions */}
      <div className="container mx-auto flex items-center justify-between h-20 md:h-24 px-4 gap-4">
        {/* Logo - large but contained */}
        <Link to="/" className="flex items-center shrink-0 group">
          <img src={logo} alt="Agever's Digital Codes" className="h-14 md:h-20 lg:h-24 w-auto object-contain transition-[filter] duration-500 transform-none group-hover:animate-electric-color-shift" />
        </Link>

        {/* Desktop Search Bar */}
        <div className="hidden md:block flex-1 max-w-2xl" ref={searchRef}>
        <div className="relative border-primary border-2 border-solid">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-900 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => {if (searchResults.length > 0) setSearchOpen(true);}}
              className="w-full h-9 pl-9 pr-3 bg-white border border-gray-900 text-sm text-gray-900 font-body placeholder:text-gray-900 placeholder:font-bold focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              placeholder={t("nav.searchPlaceholder")} />
            
            <AnimatePresence>
              {searchOpen && searchResults.length > 0 &&
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-border/50 bg-background/95 backdrop-blur-md shadow-xl z-50 overflow-hidden">
                {searchResults.slice(0, 5).map((item) =>
                <button
                  key={item.id}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/50 transition-colors text-left"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery("");
                    setSearchResults([]);
                    handleResultClick(item);
                  }}>
                    {item.image_url ?
                  <img src={item.image_url} alt="" className="w-10 h-7 object-cover rounded shrink-0" /> :
                  <div className="w-10 h-7 bg-secondary rounded shrink-0" />
                  }
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-display font-bold text-foreground truncate">{item.title}</p>
                      <p className="text-[10px] text-muted-foreground">{item.platform} • {item.store}</p>
                    </div>
                  </button>
                )}
                {searchResults.length > 5 && (
                  <button
                    className="w-full px-3 py-2.5 text-center text-xs font-display font-bold text-primary hover:bg-secondary/50 transition-colors border-t border-border/30"
                    onClick={() => {
                      setSearchOpen(false);
                      const q = searchQuery;
                      setSearchQuery("");
                      setSearchResults([]);
                      navigate(`/search?q=${encodeURIComponent(q)}`);
                    }}>
                    {t("nav.showAll")}
                  </button>
                )}
              </motion.div>
              }
              {searchOpen && searchQuery.trim() && searchResults.length === 0 &&
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-border/50 bg-background/95 backdrop-blur-md shadow-lg z-50 p-4 text-center">
                <p className="text-xs text-muted-foreground">{t("nav.noResults")}</p>
              </motion.div>
              }
            </AnimatePresence>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 md:gap-2 shrink-0 md:mr-16">
          <Button variant="ghost" size="icon" className="md:hidden text-gray-900 hover:text-primary" onClick={() => setMobileSearchOpen(!mobileSearchOpen)} aria-label={t("nav.searchPlaceholder")}>
            <Search className="h-5 w-5" />
          </Button>
          {/* Wishlist shortcut */}
          <Link to="/account?tab=favorites" className="relative" title="My favorites">
            <Button
              variant="ghost"
              className="h-8 w-8 md:h-10 md:w-10 p-0 text-gray-900 hover:bg-transparent hover:text-primary transition-colors [&_svg]:size-5 md:[&_svg]:size-6 relative"
              aria-label={t("nav.wishlist")}
            >
              <Heart className={wishlistCount > 0 ? "fill-primary text-primary" : ""} />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </Button>
          </Link>
          <div className="relative" ref={cartRef}>
            <Button
              data-cart-icon
              variant="ghost"
              className="h-8 w-8 md:h-10 md:w-10 p-0 text-gray-900 hover:bg-transparent hover:text-primary transition-colors [&_svg]:size-5 md:[&_svg]:size-7 relative"
              onClick={() => setCartOpen(!cartOpen)}
              aria-label={t("nav.cart")}>
              <ShoppingCart />
              {count > 0 &&
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {count}
                </span>
              }
            </Button>

            <AnimatePresence>
              {cartOpen &&
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-border/50 bg-background/95 backdrop-blur-md shadow-xl z-50">
                <div className="p-3 border-b border-border/50">
                  <span className="font-display text-xs font-bold tracking-wider uppercase text-foreground">
                    {t("nav.cart")} ({count})
                  </span>
                </div>
                {items.length === 0 ?
                <div className="p-6 text-center">
                    <ShoppingCart className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">{t("nav.cartEmpty")}</p>
                  </div> :
                <>
                    <div className="max-h-64 overflow-y-auto">
                      {items.map((item) =>
                    <div key={item.cartItemId} className="flex items-center gap-2 p-3 border-[3px] border-primary hover:border-[hsl(var(--neon-gold))] transition-all duration-200 rounded-lg m-1 last:mb-1">
                          <button
                            onClick={() => {
                              setCartOpen(false);
                              navigate(`/product/${item.offerId}`);
                            }}
                            className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                          >
                            {item.image_url ?
                              <img src={item.image_url} alt="" className="w-10 h-7 object-cover rounded shrink-0" /> :
                              <div className="w-10 h-7 bg-secondary rounded shrink-0" />
                            }
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-display font-bold text-foreground truncate hover:text-primary transition-colors">{item.title}</p>
                              <p className="text-[10px] text-muted-foreground">{item.sellerName} • {item.platform}</p>
                            </div>
                          </button>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                          onClick={() => updateQuantity(item.offerId, -1)}
                          className="h-5 w-5 rounded bg-secondary text-foreground text-xs flex items-center justify-center hover:bg-secondary/80">−</button>
                            <span className="text-[11px] font-display font-bold text-foreground w-5 text-center">{item.quantity}</span>
                            <button
                          onClick={() => updateQuantity(item.offerId, 1)}
                          className="h-5 w-5 rounded bg-secondary text-foreground text-xs flex items-center justify-center hover:bg-secondary/80">+</button>
                          </div>
                          <span className="text-xs font-display font-bold text-foreground shrink-0 w-14 text-right">{formatPrice(item.price * item.quantity)}</span>
                          <button
                        onClick={() => removeItem(item.cartItemId)}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        aria-label={t("cart.remove")}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                    )}
                    </div>
                    <div className="p-3 border-t border-border/50 space-y-2">
                      <div className="flex justify-between text-xs font-display">
                        <span className="text-muted-foreground">{t("nav.total")}</span>
                        <span className="font-bold text-foreground">{formatPrice(total)}</span>
                      </div>
                      <Button
                      className="w-full h-9 font-display tracking-wider text-xs"
                      onClick={() => {
                        setCartOpen(false);
                        navigate("/checkout");
                      }}>
                        {t("nav.checkout")}
                      </Button>
                    </div>
                  </>
                }
              </motion.div>
              }
            </AnimatePresence>
          </div>
          {user ?
          <>
            <div className="relative" ref={accountRef}>
              <motion.div whileHover={{ rotate: [0, -10, 10, -10, 0], scale: 1.15 }} transition={{ duration: 0.5 }}>
              <Button
                variant="ghost"
                className="h-8 w-8 md:h-10 md:w-10 p-0 text-gray-900 hover:bg-transparent hover:text-primary transition-colors [&_svg]:size-5 md:[&_svg]:size-6 overflow-hidden rounded-full"
                onClick={() => setAccountOpen(!accountOpen)}
                title="My Account">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover rounded-full" />
                ) : isAdmin ? <Shield /> : isSeller ? <Store /> : <User />}
              </Button>
              </motion.div>

              <AnimatePresence>
                {accountOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-primary/30 bg-primary/95 backdrop-blur-md shadow-2xl z-50 overflow-hidden"
                  >
                    {/* Profile header */}
                    <div className="p-4 flex items-center gap-3 border-b border-primary-foreground/20">
                      <div className="h-10 w-10 rounded-full bg-primary-foreground/20 flex items-center justify-center overflow-hidden shrink-0">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-primary-foreground font-bold text-sm">
                            {(profile.display_name || profile.username || user.email)?.[0]?.toUpperCase() || "?"}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-display font-bold text-primary-foreground text-sm truncate">
                          {profile.display_name || profile.username || "User"}
                        </p>
                        <p className="text-[11px] text-primary-foreground/70 truncate">{user.email}</p>
                        {!profile.email_verified && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const { error } = await supabase.functions.invoke("send-verification-email");
                                if (error) throw error;
                                const { toast } = await import("sonner");
                                toast.success("Verification email sent! Check your inbox.");
                              } catch {
                                const { toast } = await import("sonner");
                                toast.error("Failed to send verification email.");
                              }
                            }}
                            className="flex items-center gap-1 mt-1 text-[11px] font-display font-bold text-amber-400 hover:text-amber-300 transition-colors"
                          >
                            <Send className="h-3 w-3" /> {t("nav.verifyEmail")}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Preferences: language + currency */}
                    <div className="p-3 flex items-center gap-2 border-b border-primary-foreground/20 bg-primary-foreground/5">
                      <LanguageSwitcher className="flex-1" />
                      <CurrencySelector className="flex-1" />
                    </div>

                    {/* Menu items */}
                    <div className="py-1">
                      {!isAdmin && (
                        <>
                          <button
                            onClick={() => { setAccountOpen(false); navigate(isSeller ? "/seller" : "/account", { state: { section: "overview" } }); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-primary-foreground/90 hover:bg-primary-foreground/10 transition-colors text-left"
                          >
                            <UserCircle className="h-4.5 w-4.5 shrink-0" />
                            <span className="font-display text-sm tracking-wide">{t("nav.myAccount")}</span>
                          </button>

                          <button
                            onClick={() => { setAccountOpen(false); navigate(isSeller ? "/seller" : "/account", { state: { section: "favorites" } }); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-primary-foreground/90 hover:bg-primary-foreground/10 transition-colors text-left"
                          >
                            <Heart className="h-4.5 w-4.5 shrink-0" />
                            <span className="font-display text-sm tracking-wide">{t("nav.wishlist")}</span>
                          </button>
                        </>
                      )}

                      {!isAdmin && (
                        <button
                          onClick={() => { setAccountOpen(false); navigate(isSeller ? "/seller" : "/account", { state: { section: "orders" } }); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-primary-foreground/90 hover:bg-primary-foreground/10 transition-colors text-left"
                        >
                          <ShoppingCart className="h-4.5 w-4.5 shrink-0" />
                          <span className="font-display text-sm tracking-wide">{t("nav.orders")}</span>
                        </button>
                      )}

                      {!isAdmin && (
                        <button
                          onClick={() => { setAccountOpen(false); navigate(isSeller ? "/seller" : "/account", { state: { section: "tickets" } }); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-primary-foreground/90 hover:bg-primary-foreground/10 transition-colors text-left"
                        >
                          <MessageSquare className="h-4.5 w-4.5 shrink-0" />
                          <span className="font-display text-sm tracking-wide">{t("nav.myTickets")}</span>
                        </button>
                      )}

                      {isSeller && !isAdmin && (
                        <>
                          <div className="my-1 mx-4 border-t border-primary-foreground/20" />
                          <button
                            onClick={() => { setAccountOpen(false); navigate("/seller", { state: { section: "keys" } }); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-primary-foreground/90 hover:bg-primary-foreground/10 transition-colors text-left"
                          >
                            <Key className="h-4.5 w-4.5 shrink-0" />
                            <span className="font-display text-sm tracking-wide">Keys library</span>
                          </button>
                          <button
                            onClick={() => { setAccountOpen(false); navigate("/seller", { state: { section: "products" } }); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-primary-foreground/90 hover:bg-primary-foreground/10 transition-colors text-left"
                          >
                            <Package className="h-4.5 w-4.5 shrink-0" />
                            <span className="font-display text-sm tracking-wide">Selling</span>
                          </button>
                          <button
                            onClick={() => { setAccountOpen(false); navigate("/seller", { state: { section: "tickets" } }); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-primary-foreground/90 hover:bg-primary-foreground/10 transition-colors text-left"
                          >
                            <MessageSquare className="h-4.5 w-4.5 shrink-0" />
                            <span className="font-display text-sm tracking-wide">Seller Tickets</span>
                          </button>
                        </>
                      )}

                      {isAdmin && (
                        <>
                          <div className="my-1 mx-4 border-t border-primary-foreground/20" />
                          <button
                            onClick={() => { setAccountOpen(false); navigate("/admin"); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-primary-foreground/90 hover:bg-primary-foreground/10 transition-colors text-left"
                          >
                            <Shield className="h-4.5 w-4.5 shrink-0" />
                            <span className="font-display text-sm tracking-wide">Admin Dashboard</span>
                          </button>
                          <button
                            onClick={() => { setAccountOpen(false); navigate("/admin/products"); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-primary-foreground/90 hover:bg-primary-foreground/10 transition-colors text-left"
                          >
                            <Package className="h-4.5 w-4.5 shrink-0" />
                            <span className="font-display text-sm tracking-wide">Manage Products</span>
                          </button>
                          <button
                            onClick={() => { setAccountOpen(false); navigate("/admin/tickets"); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-primary-foreground/90 hover:bg-primary-foreground/10 transition-colors text-left"
                          >
                            <MessageSquare className="h-4.5 w-4.5 shrink-0" />
                            <span className="font-display text-sm tracking-wide">Support Tickets</span>
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => { setAccountOpen(false); navigate(isSeller ? "/seller" : "/account", { state: { section: "settings" } }); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-primary-foreground/90 hover:bg-primary-foreground/10 transition-colors text-left"
                      >
                        <Settings className="h-4.5 w-4.5 shrink-0" />
                        <span className="font-display text-sm tracking-wide">{t("nav.settings")}</span>
                      </button>
                    </div>

                    {/* Logout */}
                    <div className="border-t border-primary-foreground/20">
                      <button
                        onClick={async () => { setAccountOpen(false); await signOut(); navigate("/"); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-primary-foreground/80 hover:bg-primary-foreground/10 transition-colors text-left"
                      >
                        <LogOut className="h-4.5 w-4.5 shrink-0" />
                        <span className="font-display text-sm tracking-wide">{t("nav.logout")}</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </> :
          <div className="relative" ref={accountRef}>
            <Button
              variant="ghost"
              className="h-8 w-8 md:h-10 md:w-10 p-0 text-gray-900 hover:bg-transparent hover:text-primary transition-colors [&_svg]:size-5 md:[&_svg]:size-7"
              title={t("nav.signIn")}
              onClick={() => setAccountOpen(!accountOpen)}>
              <User />
            </Button>
            <AnimatePresence>
              {accountOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full pt-2 w-48 z-50"
                >
                  <div className="rounded-lg border border-border/50 bg-background/95 backdrop-blur-md shadow-xl overflow-hidden">
                    <div className="p-3 flex items-center gap-2 border-b border-border/50 bg-secondary/40">
                      <LanguageSwitcher className="flex-1" />
                      <CurrencySelector className="flex-1" />
                    </div>
                    <button
                      onClick={() => { setAccountOpen(false); navigate("/auth", { state: { mode: "login" } }); }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm font-display font-bold text-foreground hover:bg-secondary/50 transition-colors text-left"
                    >
                      <User className="h-4 w-4" />
                      Log In
                    </button>
                    <div className="h-px bg-border/50" />
                    <button
                      onClick={() => { setAccountOpen(false); navigate("/auth", { state: { mode: "signup" } }); }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm font-display font-bold text-primary hover:bg-secondary/50 transition-colors text-left"
                    >
                      <UserCircle className="h-4 w-4" />
                      Sign Up
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          }
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-gray-900"
            onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Search Bar */}
      <AnimatePresence>
        {mobileSearchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden bg-white border-t border-border/30 px-4 py-3"
          >
            <div className="relative" ref={searchRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-900 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    setMobileSearchOpen(false);
                    setSearchOpen(false);
                    const q = searchQuery;
                    setSearchQuery("");
                    setSearchResults([]);
                    navigate(`/search?q=${encodeURIComponent(q)}`);
                  }
                }}
                autoFocus
                className="w-full h-10 pl-9 pr-3 bg-white border-2 border-primary text-sm text-gray-900 font-body placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-primary rounded-md"
                placeholder="Search for games, top-ups and more"
              />
              <AnimatePresence>
                {searchOpen && searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-border/50 bg-white shadow-xl z-50 overflow-hidden"
                  >
                    {searchResults.slice(0, 5).map((item) => (
                      <button
                        key={item.id}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-100 transition-colors text-left"
                        onClick={() => {
                          setSearchOpen(false);
                          setSearchQuery("");
                          setSearchResults([]);
                          setMobileSearchOpen(false);
                          handleResultClick(item);
                        }}
                      >
                        {item.image_url ? (
                          <img src={item.image_url} alt="" className="w-10 h-7 object-cover rounded shrink-0" />
                        ) : (
                          <div className="w-10 h-7 bg-gray-200 rounded shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-display font-bold text-gray-900 truncate">{item.title}</p>
                          <p className="text-[10px] text-gray-500">{item.platform} • {item.store}</p>
                        </div>
                      </button>
                    ))}
                    {searchResults.length > 5 && (
                      <button
                        className="w-full px-3 py-2.5 text-center text-xs font-display font-bold text-primary hover:bg-gray-100 transition-colors border-t border-gray-200"
                        onClick={() => {
                          setSearchOpen(false);
                          setMobileSearchOpen(false);
                          const q = searchQuery;
                          setSearchQuery("");
                          setSearchResults([]);
                          navigate(`/search?q=${encodeURIComponent(q)}`);
                        }}
                      >
                        Show All Results
                      </button>
                    )}
                  </motion.div>
                )}
                {searchOpen && searchQuery.trim() && searchResults.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-gray-200 bg-white shadow-lg z-50 p-4 text-center"
                  >
                    <p className="text-xs text-gray-500">No results found</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="hidden md:block border-t border-border/10 py-1 overflow-visible">
        <div className="container mx-auto px-4 overflow-visible">
          <div className="flex justify-center overflow-visible">
            <div
              className="inline-flex items-center justify-center rounded-full bg-gray-900 px-4 lg:px-6 shadow-xl"
              ref={dropdownRef}
            >
              {categories.map((cat, idx) =>
                <div key={cat.name} className="flex items-center gap-0 shrink-0 overflow-visible">
                  {idx > 0 && <span className="mx-0.5 lg:mx-1 h-4 w-px bg-gray-600" />}
                  {cat.subcategories ?
                    <div
                      className="relative"
                      onMouseEnter={() => setOpenDropdown(cat.name)}
                      onMouseLeave={() => setOpenDropdown(null)}>
                      <button
                        className="relative flex items-center gap-0.5 font-display text-[9px] md:text-[10px] lg:text-[11px] xl:text-xs font-bold tracking-wider text-white hover:text-primary transition-colors uppercase py-2 group whitespace-nowrap px-1.5 lg:px-2">
                        {cat.name}
                        <ChevronDown className={`h-2.5 w-2.5 transition-transform ${openDropdown === cat.name ? "rotate-180" : ""}`} />
                        <span className={`absolute bottom-1 left-1.5 right-1.5 h-0.5 bg-primary rounded-full transition-transform duration-300 origin-center ${openDropdown === cat.name ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`} />
                      </button>
                      <AnimatePresence>
                        {openDropdown === cat.name &&
                          <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.15 }}
                            className="absolute top-full left-1/2 mt-2 w-44 -translate-x-1/2 rounded-xl border border-border/50 bg-background/95 backdrop-blur-md shadow-lg py-1 z-50">
                            {cat.subcategories.map((sub) =>
                              sub.href.startsWith("/") ?
                                <Link
                                  key={sub.name}
                                  to={sub.href}
                                  onClick={() => setOpenDropdown(null)}
                                  className="block px-4 py-2 font-display text-xs tracking-wider text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors">
                                  {sub.name}
                                </Link> :
                                <a
                                  key={sub.name}
                                  href={sub.href}
                                  onClick={() => setOpenDropdown(null)}
                                  className="block px-4 py-2 font-display text-xs tracking-wider text-muted-foreground hover:text-primary hover:bg-secondary/50 transition-colors">
                                  {sub.name}
                                </a>
                            )}
                          </motion.div>
                        }
                      </AnimatePresence>
                    </div> :
                    cat.href.startsWith("/") ?
                      <Link
                        to={cat.href}
                        className="relative font-display text-[9px] md:text-[10px] lg:text-[11px] xl:text-xs font-bold tracking-wider text-white hover:text-primary transition-colors uppercase whitespace-nowrap py-2 px-1.5 lg:px-2 group">
                        {cat.name}
                        <span className="absolute bottom-1 left-1.5 right-1.5 h-0.5 bg-primary rounded-full transition-transform duration-300 origin-center scale-x-0 group-hover:scale-x-100" />
                      </Link> :
                      <a
                        href={cat.href}
                        className="relative font-display text-[9px] md:text-[10px] lg:text-[11px] xl:text-xs font-bold tracking-wider text-white hover:text-primary transition-colors uppercase whitespace-nowrap py-2 px-1.5 lg:px-2 group">
                        {cat.name}
                        <span className="absolute bottom-1 left-1.5 right-1.5 h-0.5 bg-primary rounded-full transition-transform duration-300 origin-center scale-x-0 group-hover:scale-x-100" />
                      </a>
                  }
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen &&
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="md:hidden bg-white border-t border-border/30 overflow-hidden text-gray-900">
          <div className="flex flex-col gap-2 p-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border/30">
              <span className="text-xs font-display font-bold text-gray-500">Currency:</span>
              <CurrencySelector className="bg-white border-gray-300 text-gray-900" />
            </div>
            {categories.map((cat) =>
            cat.subcategories ?
            <div key={cat.name}>
              <button
                onClick={() => setMobileOpenSub(mobileOpenSub === cat.name ? null : cat.name)}
                className="flex items-center gap-1 font-display text-sm font-bold tracking-widest text-gray-700 hover:text-primary py-2 uppercase w-full">
                {cat.name}
                <ChevronDown className={`h-3 w-3 transition-transform ${mobileOpenSub === cat.name ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {mobileOpenSub === cat.name &&
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="pl-4 flex flex-col gap-1 overflow-hidden">
                  {cat.subcategories.map((sub) =>
                  sub.href.startsWith("/") ?
                  <Link
                    key={sub.name}
                    to={sub.href}
                    className="font-display text-xs tracking-wider text-gray-500 hover:text-primary py-1.5"
                    onClick={() => {setMobileOpen(false);setMobileOpenSub(null);}}>
                      {sub.name}
                    </Link> :
                  <a
                    key={sub.name}
                    href={sub.href}
                    className="font-display text-xs tracking-wider text-gray-500 hover:text-primary py-1.5"
                    onClick={() => {setMobileOpen(false);setMobileOpenSub(null);}}>
                      {sub.name}
                    </a>
                  )}
                </motion.div>
                }
              </AnimatePresence>
            </div> :
            cat.href.startsWith("/") ?
            <Link
              key={cat.name}
              to={cat.href}
              className="font-display text-sm font-bold tracking-widest text-gray-700 hover:text-primary py-2 uppercase"
              onClick={() => setMobileOpen(false)}>
              {cat.name}
            </Link> :
            <a
              key={cat.name}
              href={cat.href}
              className="font-display text-sm font-bold tracking-widest text-gray-700 hover:text-primary py-2 uppercase"
              onClick={() => setMobileOpen(false)}>
              {cat.name}
            </a>
            )}
          </div>
        </motion.div>
        }
      </AnimatePresence>
    </nav>);

};

export default Navbar;