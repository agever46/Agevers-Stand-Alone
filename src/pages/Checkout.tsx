import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import logo from "@/assets/logo.png";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { useNoIndex } from "@/hooks/useNoIndex";
import { useCurrency } from "@/hooks/useCurrency";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Trash2, ShieldCheck, Lock, CreditCard, ArrowLeft, FlaskConical, CheckSquare, Pencil, Truck, Tag, Loader2, X, HelpCircle } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { isHumanAvailable } from "@/components/HelpChatWidget";
import { MessageCircle, Mail, Clock } from "lucide-react";
import AppealForm from "@/components/AppealForm";
import { useTranslation, Trans } from "react-i18next";

interface ProcessorFee {
  name: string;
  label: string;
  fee_pct: number;
  fee_fixed: number;
}

// PayPal supported currency codes
const PAYPAL_CURRENCIES = new Set([
  "AUD", "BRL", "CAD", "CHF", "CZK", "DKK", "EUR", "GBP", "HUF",
  "ILS", "JPY", "MXN", "NOK", "NZD", "PHP", "PLN", "SEK", "SGD",
  "THB", "TRY", "USD",
]);

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  "Afghanistan":"AF","Albania":"AL","Algeria":"DZ","Andorra":"AD","Angola":"AO","Argentina":"AR","Armenia":"AM","Australia":"AU","Austria":"AT","Azerbaijan":"AZ",
  "Bahrain":"BH","Bangladesh":"BD","Belarus":"BY","Belgium":"BE","Bolivia":"BO","Bosnia and Herzegovina":"BA","Brazil":"BR","Brunei":"BN","Bulgaria":"BG",
  "Cambodia":"KH","Cameroon":"CM","Canada":"CA","Chile":"CL","China":"CN","Colombia":"CO","Costa Rica":"CR","Croatia":"HR","Cyprus":"CY","Czech Republic":"CZ","Czechia":"CZ",
  "Denmark":"DK","Dominican Republic":"DO","Ecuador":"EC","Egypt":"EG","El Salvador":"SV","Estonia":"EE","Ethiopia":"ET",
  "Finland":"FI","France":"FR","Georgia":"GE","Germany":"DE","Ghana":"GH","Greece":"GR","Guatemala":"GT",
  "Honduras":"HN","Hong Kong":"HK","Hungary":"HU","Iceland":"IS","India":"IN","Indonesia":"ID","Iran":"IR","Iraq":"IQ","Ireland":"IE","Israel":"IL","Italy":"IT",
  "Jamaica":"JM","Japan":"JP","Jordan":"JO","Kazakhstan":"KZ","Kenya":"KE","Kuwait":"KW","Kyrgyzstan":"KG",
  "Latvia":"LV","Lebanon":"LB","Libya":"LY","Lithuania":"LT","Luxembourg":"LU","Macau":"MO","Malaysia":"MY","Maldives":"MV","Malta":"MT","Mexico":"MX",
  "Moldova":"MD","Mongolia":"MN","Montenegro":"ME","Morocco":"MA","Mozambique":"MZ","Myanmar":"MM","Nepal":"NP","Netherlands":"NL","New Zealand":"NZ",
  "Nigeria":"NG","North Macedonia":"MK","Norway":"NO","Oman":"OM","Pakistan":"PK","Palestine":"PS","Panama":"PA","Paraguay":"PY","Peru":"PE","Philippines":"PH",
  "Poland":"PL","Portugal":"PT","Qatar":"QA","Romania":"RO","Russia":"RU","Saudi Arabia":"SA","Senegal":"SN","Serbia":"RS","Singapore":"SG","Slovakia":"SK",
  "Slovenia":"SI","South Africa":"ZA","South Korea":"KR","Spain":"ES","Sri Lanka":"LK","Sweden":"SE","Switzerland":"CH","Taiwan":"TW","Tanzania":"TZ",
  "Thailand":"TH","Tunisia":"TN","Turkey":"TR","Türkiye":"TR","Uganda":"UG","Ukraine":"UA","United Arab Emirates":"AE","United Kingdom":"GB","United States":"US",
  "Uruguay":"UY","Uzbekistan":"UZ","Venezuela":"VE","Vietnam":"VN","Yemen":"YE","Zambia":"ZM","Zimbabwe":"ZW",
};

const getCountryCode = (country: string): string => {
  if (!country) return "US";
  if (country.length === 2) return country.toUpperCase();
  return COUNTRY_NAME_TO_CODE[country] || "US";
};

// Returns a valid access token, proactively refreshing the session when it is
// missing/expired/near-expiry. Long-lived checkout tabs otherwise send stale
// JWTs and edge functions reject them with "Not authenticated".
const getFreshAccessToken = async (): Promise<string | null> => {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    const expiresAtMs = (session?.expires_at ?? 0) * 1000;
    if (!session || !session.access_token || (expiresAtMs && expiresAtMs - Date.now() < 120_000)) {
      const { data: refreshed, error } = await supabase.auth.refreshSession();
      if (error || !refreshed.session?.access_token) return null;
      return refreshed.session.access_token;
    }
    return session.access_token;
  } catch {
    return null;
  }
};


const generateFakeCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const segments = Array.from({ length: 4 }, () =>
    Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
  );
  return segments.join("-");
};

const PAYPAL_SDK_SCRIPT_ID = "paypal-sdk";
let paypalSdkPromise: Promise<void> | null = null;
let paypalSdkKey: string | null = null;

// Standard PayPal Smart Buttons only (no advanced/hosted card fields).
// `components=buttons` keeps the SDK on the standard integration, so the black
// card button goes through PayPal's standard guest-card flow instead of ACDC.
const getPayPalSdkSrc = (clientId: string, currency: string) =>
  `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=${currency}&intent=capture&locale=en_US&components=buttons&enable-funding=card&disable-funding=credit,paylater`;

const waitForPayPalButtons = (expectedKey: string, attempt = 0): Promise<void> =>
  new Promise((resolve, reject) => {
    const poll = (nextAttempt: number) => {
      const paypal = (window as any).paypal_sdk;
      if (paypalSdkKey !== expectedKey) {
        reject(new Error("PayPal SDK was replaced before initialization finished."));
        return;
      }
      if (paypal && typeof paypal.Buttons === "function") {
        resolve();
        return;
      }
      if (nextAttempt >= 120) {
        paypalSdkPromise = null;
        reject(new Error("PayPal button failed to initialize."));
        return;
      }
      window.setTimeout(() => poll(nextAttempt + 1), 150);
    };

    poll(attempt);
  });

const ensurePayPalSdk = (clientId: string, currency: string) => {
  const nextKey = `${clientId}:${currency}`;
  const nextSrc = getPayPalSdkSrc(clientId, currency);

  if ((window as any).paypal_sdk && paypalSdkKey === nextKey && typeof (window as any).paypal_sdk.Buttons === "function") {
    return Promise.resolve();
  }

  if (paypalSdkPromise && paypalSdkKey === nextKey) {
    return paypalSdkPromise;
  }

  const existingScript = document.getElementById(PAYPAL_SDK_SCRIPT_ID) as HTMLScriptElement | null;
  if (existingScript && paypalSdkKey !== nextKey) {
    existingScript.remove();
    delete (window as any).paypal_sdk;
    delete (window as any).paypal;
    paypalSdkPromise = null;
  }

  paypalSdkKey = nextKey;
  paypalSdkPromise = new Promise((resolve, reject) => {
    const handleReady = () => {
      waitForPayPalButtons(nextKey)
        .then(resolve)
        .catch(reject);
    };

    const currentScript = document.getElementById(PAYPAL_SDK_SCRIPT_ID) as HTMLScriptElement | null;
    if (currentScript) {
      handleReady();
      return;
    }

    const script = document.createElement("script");
    script.id = PAYPAL_SDK_SCRIPT_ID;
    script.src = nextSrc;
    script.setAttribute("data-namespace", "paypal_sdk");
    script.async = true;
    script.onload = handleReady;
    script.onerror = () => {
      paypalSdkPromise = null;
      reject(new Error("Could not load PayPal SDK."));
    };
    document.body.appendChild(script);
  });

  return paypalSdkPromise;
};

const Checkout = () => {
  useNoIndex();
  const { items, removeItem, updateQuantity, clearCart, total, count } = useCart();
  const { user, loading: authLoading } = useAuth();
  const { currency, convert, symbol, formatPrice, rates } = useCurrency();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [paypalContainer, setPaypalContainer] = useState<HTMLDivElement | null>(null);
  const paypalButtonsInstanceRef = useRef<any>(null);
  // Holds latest gating state so the always-mounted PayPal buttons can
  // validate at click-time without being re-created on every state change.
  const gateRef = useRef<{ check: () => string | null }>({ check: () => null });
  const [sdkReady, setSdkReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paypalClientId, setPaypalClientId] = useState<string | null>(null);
  const [paypalSdkError, setPaypalSdkError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [processorFees, setProcessorFees] = useState<ProcessorFee[]>([]);
  const [selectedProcessor, setSelectedProcessor] = useState<string>("paypal");
  const [preCheckBlocked, setPreCheckBlocked] = useState(false);
  const [preCheckMessage, setPreCheckMessage] = useState<string | null>(null);
  const [preCheckLoading, setPreCheckLoading] = useState(true);
  const [qtyDiscounts, setQtyDiscounts] = useState<{ min_quantity: number; discount_pct: number; label: string | null }[]>([]);

  // 2-step checkout: 1 = cart/discount, 2 = billing + payment
  const [step, setStep] = useState<1 | 2>(1);

  // Guest checkout is disabled — an account is required to purchase.
  // Send unauthenticated visitors to the auth page and bring them back here
  // after they sign in / sign up.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const redirectPath = encodeURIComponent(window.location.pathname + window.location.search);
      navigate(`/auth?redirect=${redirectPath}&reason=checkout_required`, { replace: true });
    }
  }, [authLoading, user, navigate]);

  // Payment method selector: PayPal vs Crypto Wallet, plus chosen crypto currency
  const [paymentMethod, setPaymentMethod] = useState<"paypal" | "crypto">("paypal");
  const [cryptoCurrency, setCryptoCurrency] = useState<"usdterc20" | "ltc" | "doge">("usdterc20");
  const [cryptoInvoiceUrl, setCryptoInvoiceUrl] = useState<string | null>(null);

  // Fetch quantity discounts
  useEffect(() => {
    supabase.from("quantity_discounts").select("min_quantity, discount_pct, label").eq("is_active", true).order("min_quantity", { ascending: false })
      .then(({ data }) => { if (data) setQtyDiscounts(data); });
  }, []);

  // Discount code state
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    id: string; code: string; discount_type: string; discount_value: number;
    min_order_amount: number; max_order_amount: number;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Shipping state for AliExpress products
  const [shippingOptions, setShippingOptions] = useState<Record<string, any[]>>({});
  const [selectedShipping, setSelectedShipping] = useState<Record<string, any>>({});
  const [shippingLoading, setShippingLoading] = useState(false);
  const [aliexpressItems, setAliexpressItems] = useState<Set<string>>(new Set());

  // Shipping address state for physical products
  const [shippingAddress, setShippingAddress] = useState({
    full_name: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    zip_code: "",
    country: "",
    phone: "",
  });
  const [editingAddress, setEditingAddress] = useState(false);
  const hasPhysicalItems = aliexpressItems.size > 0;
  const allPhysical = hasPhysicalItems && items.length > 0 && items.every(item => aliexpressItems.has(item.offerId));

  // Determine PayPal charge currency — use buyer's currency if PayPal supports it, else EUR
  const paypalCurrency = PAYPAL_CURRENCIES.has(currency) ? currency : "EUR";
  const handlePaypalContainerRef = useCallback((node: HTMLDivElement | null) => {
    setPaypalContainer((current) => (current === node ? current : node));
  }, []);

  // Calculate total shipping cost
  const shippingTotal = Object.values(selectedShipping).reduce((sum, opt) => sum + (parseFloat(opt?.freight_amount) || 0), 0);

  const activeProcessor = processorFees.find(p => p.name === selectedProcessor) || { fee_pct: 0, fee_fixed: 0, label: "PayPal" };

  // Coupon discount calculation
  const couponDiscount = appliedCoupon
    ? appliedCoupon.discount_type === "percentage"
      ? +(total * appliedCoupon.discount_value / 100).toFixed(2)
      : Math.min(appliedCoupon.discount_value, total)
    : 0;

  // Quantity discount: find the best matching tier based on cart item count
  const qtyDiscount = useMemo(() => {
    const totalQty = items.reduce((s, i) => s + i.quantity, 0);
    const match = qtyDiscounts.find((d) => totalQty >= d.min_quantity);
    return match ? +(total * match.discount_pct).toFixed(2) : 0;
  }, [items, qtyDiscounts, total]);

  const subtotal = Math.max(0, total - couponDiscount - qtyDiscount + shippingTotal);
  const paymentFee = allPhysical ? 0 : +(subtotal * (activeProcessor.fee_pct / 100) + activeProcessor.fee_fixed).toFixed(2);
  // Crypto network/processor fee (1% of subtotal) — only applies when paying with crypto
  const cryptoFee = paymentMethod === "crypto" && !allPhysical
    ? +(subtotal * 0.01).toFixed(2)
    : 0;
  const effectivePaymentFee = paymentMethod === "crypto" ? cryptoFee : paymentFee;
  const finalTotalEUR = +(subtotal + effectivePaymentFee).toFixed(2);

  // Validate coupon against order amount limits
  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponLoading(true);
    setCouponError(null);

    const { data: result, error } = await supabase.rpc("validate_discount_code", {
      _code: code,
      _order_total: total,
    });

    if (error || !result) {
      setCouponError(t("checkout.toast.invalidCoupon"));
      setCouponLoading(false);
      return;
    }

    const validation = result as { valid: boolean; error?: string; id?: string; discount_type?: string; discount_value?: number };

    if (!validation.valid) {
      setCouponError(validation.error || t("checkout.toast.invalidCoupon"));
      setCouponLoading(false);
      return;
    }

    setAppliedCoupon({
      id: validation.id!,
      code: code,
      discount_type: validation.discount_type!,
      discount_value: Number(validation.discount_value),
      min_order_amount: 0,
      max_order_amount: 0,
    });
    setCouponInput("");
    setCouponLoading(false);
    toast({ title: t("checkout.toast.couponApplied"), description: t("checkout.toast.couponAppliedDesc", { code }) });
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError(null);
  };

  // Convert EUR total to PayPal charge currency
  const finalTotalCharge = paypalCurrency === "EUR"
    ? finalTotalEUR
    : +(convert(finalTotalEUR)).toFixed(paypalCurrency === "JPY" || paypalCurrency === "HUF" ? 0 : 2);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
    supabase
      .from("payment_processors")
      .select("name, label, fee_pct, fee_fixed")
      .eq("is_active", true)
      .order("display_order")
      .then(({ data }) => {
        if (data && data.length > 0) {
          setProcessorFees(data as any);
          setSelectedProcessor(data[0].name);
        }
      });
  }, []);

  // SMS verification only happens AFTER successful payment (on OrderConfirmation page)
  // to confirm the buyer before revealing the digital code. No SMS on checkout entry.

  // Check if user is admin for test purchase. user_roles has no direct
  // SELECT grant (by design), so this goes through check_my_role().
  useEffect(() => {
    if (!user) return;
    supabase.rpc("check_my_role" as any, { _role: "admin" }).then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  // Fetch profile + pre-fill shipping address
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setProfile(data);
        setShippingAddress({
          full_name: data.display_name || data.username || "",
          address_line1: data.address || "",
          address_line2: "",
          city: data.city || "",
          state: data.state || "",
          zip_code: data.zip_code || "",
          country: data.country || "",
          phone: data.phone || "",
        });
      }
    });
  }, [user]);

  // Detect AliExpress items and fetch shipping options
  useEffect(() => {
    if (items.length === 0) return;

    const detectAliexpress = async () => {
      const offerIds = items.map(i => i.offerId);
      
      // Strategy 1: Direct match by allowed_products.id
      const { data: directMatches } = await supabase
        .from("allowed_products")
        .select("id, aliexpress_product_id")
        .in("id", offerIds)
        .not("aliexpress_product_id", "is", null);

      // Strategy 2: For Gaming Accessories items, match by title (offerId may be products.id)
      const accessoryItems = items.filter(i => i.platform === "Gaming Accessories");
      let titleMatches: { id: string; aliexpress_product_id: string; title: string }[] = [];
      if (accessoryItems.length > 0) {
        const titles = accessoryItems.map(i => i.title);
        const { data } = await supabase
          .from("allowed_products")
          .select("id, aliexpress_product_id, title")
          .in("title", titles)
          .not("aliexpress_product_id", "is", null);
        titleMatches = (data || []) as any;
      }

      // Merge results — map cart offerId to allowed_product_id
      const offerToAllowed: Record<string, string> = {};
      (directMatches || []).forEach(d => { offerToAllowed[d.id] = d.id; });
      accessoryItems.forEach(item => {
        if (!offerToAllowed[item.offerId]) {
          const match = titleMatches.find(t => t.title === item.title);
          if (match) offerToAllowed[item.offerId] = match.id;
        }
      });

      const allAeProducts = [
        ...(directMatches || []),
        ...titleMatches.filter(t => !(directMatches || []).some(d => d.id === t.id)),
      ];

      if (allAeProducts.length === 0) {
        setAliexpressItems(new Set());
        return;
      }

      const aeOfferIds = new Set(Object.keys(offerToAllowed));
      setAliexpressItems(aeOfferIds);

      // Fetch shipping for each AliExpress item
      const country = getCountryCode(profile?.country || "");
      setShippingLoading(true);

      try {
        const results = await Promise.all(
          Object.entries(offerToAllowed).map(async ([offerId, allowedId]) => {
            const item = items.find(i => i.offerId === offerId);
            const { data: shippingData } = await supabase.functions.invoke("aliexpress-api", {
              body: {
                action: "public_shipping",
                allowed_product_id: allowedId,
                country_code: country,
                quantity: String(item?.quantity || 1),
              },
            });
            return { id: offerId, options: shippingData?.shipping_options || [] };
          })
        );

        const optionsMap: Record<string, any[]> = {};
        const defaultSelections: Record<string, any> = {};
        results.forEach(r => {
          optionsMap[r.id] = r.options;
          if (r.options.length > 0) {
            const cheapest = r.options.reduce((min: any, o: any) =>
              parseFloat(o.freight_amount) < parseFloat(min.freight_amount) ? o : min
            , r.options[0]);
            defaultSelections[r.id] = cheapest;
          }
        });
        setShippingOptions(optionsMap);
        setSelectedShipping(prev => ({ ...defaultSelections, ...prev }));
      } catch { /* ignore */ }
      setShippingLoading(false);
    };

    detectAliexpress();
  }, [items, profile?.country]);

  // Pre-checkout fraud check — block PayPal if user is high risk
  // For guest users (no user yet), skip the pre-check; fraud-check runs at payment time once a session exists.
  useEffect(() => {
    if (!user || items.length === 0) {
      setPreCheckLoading(false);
      return;
    }
    let cancelled = false;
    setPreCheckLoading(true);
    (async () => {
      const accessToken = await getFreshAccessToken();
      if (cancelled) return;
      if (!accessToken) {
        setPreCheckLoading(false);
        toast({
          title: t("checkout.toast.checkoutError"),
          description: t("checkout.toast.sessionExpired"),
          variant: "destructive",
        });
        navigate("/auth?redirect=/checkout");
        return;
      }
      const { data, error } = await supabase.functions.invoke("fraud-check", {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          items: items.map((item) => ({ title: item.title, quantity: item.quantity, price: item.price })),
          total_amount: total,
        },
      });
      if (cancelled) return;
      if (error) {
        console.error("Pre-checkout fraud check error:", error);
        setPreCheckLoading(false);
        return;
      }
      if (data && !data.allowed) {
        setPreCheckBlocked(true);
        setPreCheckMessage(data.blocked_reason || t("checkout.pay.flaggedDefault"));
      } else {
        setPreCheckBlocked(false);
        setPreCheckMessage(null);
      }
      setPreCheckLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, items.length, total]);


  // Guest checkout has been fully removed — an authenticated session is required
  // to reach this page (the effect above redirects unauthenticated visitors to /auth).

  // Fetch PayPal Client ID
  useEffect(() => {
    supabase.functions.invoke("paypal-config").then(({ data }) => {
      if (data?.clientId) setPaypalClientId(data.clientId);
    });
  }, []);

  // Load PayPal SDK once per clientId+currency combination without tearing it down on re-renders.
  useEffect(() => {
    if (!paypalClientId) return;

    let cancelled = false;
    setSdkReady(false);
    setPaypalSdkError(null);

    ensurePayPalSdk(paypalClientId, paypalCurrency)
      .then(() => {
        if (cancelled) return;
        setSdkReady(true);
        setPaypalSdkError(null);
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setSdkReady(false);
        setPaypalSdkError(error.message || "Could not load PayPal SDK.");
        console.error("PayPal SDK init error:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [paypalClientId, paypalCurrency]);

  // Keep gating logic + payment context in refs so the always-mounted PayPal
  // buttons can read the freshest values at click-time without re-rendering.
  const paymentCtxRef = useRef<any>({});
  useEffect(() => {
    gateRef.current.check = () => {
      if (items.length === 0) return t("checkout.toast.reasonEmpty");
      if (profile?.account_status === 'suspended') return t("checkout.toast.reasonSuspended");
      if (preCheckBlocked) return preCheckMessage || t("checkout.toast.reasonFlagged");
      if (preCheckLoading) return t("checkout.toast.reasonWait");
      if (!agreedToTerms) return t("checkout.toast.reasonTerms");
      if (processing) return t("checkout.toast.reasonProcessing");
      return null;
    };
    paymentCtxRef.current = {
      items, finalTotalCharge, finalTotalEUR, count,
      hasPhysicalItems, shippingAddress, selectedShipping, appliedCoupon,
      user, paypalCurrency,
    };
  });

  // Render PayPal buttons only after both the SDK and the container exist.
  // Using container state avoids the first-load race where the ref is still null.
  useEffect(() => {
    if (!sdkReady || !paypalContainer) return;

    const paypal = (window as any).paypal_sdk;
    if (!paypal || typeof paypal.Buttons !== "function") {
      setPaypalSdkError("PayPal is not ready yet.");
      return;
    }

    setPaypalSdkError(null);
    paypalContainer.innerHTML = "";

    const baseConfig: any = {
      // NOTE: style.color is overridden per funding source below — the card
      // button only accepts "black"/"white" (the SDK throws on "gold").
      onClick: (_data: any, actions: any) => {
        const reason = gateRef.current.check();
        if (reason) {
          toast({ title: t("checkout.toast.cannotContinue"), description: reason, variant: "destructive" });
          return actions.reject();
        }
        return actions.resolve();
      },
      createOrder: async () => {
        const ctx = paymentCtxRef.current;
        const accessToken = await getFreshAccessToken();
        if (!accessToken) {
          const msg = t("checkout.toast.sessionMissing");
          toast({ title: t("checkout.toast.checkoutError"), description: msg, variant: "destructive" });
          navigate("/auth?redirect=/checkout");
          throw new Error(msg);
        }

        const authHeaders = { Authorization: `Bearer ${accessToken}` };
        const { data, error } = await supabase.functions.invoke("paypal-create-order", {
          headers: authHeaders,
          body: {
            items: ctx.items.map((item: any) => ({
              offerId: item.offerId, title: item.title, platform: item.platform,
              price: item.price, quantity: item.quantity, image_url: item.image_url, sellerName: item.sellerName,
            })),
            total_eur: ctx.finalTotalEUR,
            total_charge: ctx.finalTotalCharge,
            charge_currency: ctx.paypalCurrency,
            redeem_coins: 0,
            shipping_address: ctx.hasPhysicalItems ? ctx.shippingAddress : undefined,
            selected_shipping: Object.keys(ctx.selectedShipping || {}).length > 0 ? ctx.selectedShipping : undefined,
            applied_coupon: ctx.appliedCoupon || undefined,
            description: `${ctx.count} item(s) from Agever's Digital Codes`,
          },
        });
        if (error || !data?.id) {
          const msg = (data?.error) || error?.message || t("checkout.toast.paypalStartErr");
          toast({ title: t("checkout.toast.paymentError"), description: msg, variant: "destructive" });
          throw new Error(msg);
        }
        return data.id as string;
      },
      onApprove: async (data: any) => {
        setProcessing(true);
        const ctx = paymentCtxRef.current;
        try {
          const accessToken = await getFreshAccessToken();
          if (!accessToken) {
            throw new Error(t("checkout.toast.sessionExpired"));
          }

          const authHeaders = { Authorization: `Bearer ${accessToken}` };
          // NOTE: Duplicate post-approval fraud-check removed. It was silently blocking
          // paid PayPal orders (customer already charged) → no capture → orders stuck in
          // 'created' forever. Pre-check on load + fulfill-order's is_held logic + the
          // PayPal payer-identity check in paypal-capture-order handle risk after capture.
          const paypalOrderId = data?.orderID;
          if (!paypalOrderId) throw new Error("Missing PayPal order id");

          // Server-side capture + fulfillment (idempotent — webhook is a backup if browser disconnects).
          const { data: capData, error: capError } = await supabase.functions.invoke("paypal-capture-order", {
            headers: authHeaders,
            body: { paypal_order_id: paypalOrderId },
          });
          if (capError || (capData?.error && !capData?.success)) {
            throw new Error(capData?.error || capError?.message || t("checkout.toast.captureFailed"));
          }

          // Coupon usage is counted server-side by paypal-capture-order after the
          // payment is confirmed (prevents burning a coupon's usage limit without paying).


          clearCart();
          toast({ title: t("checkout.toast.paymentSuccess"), description: t("checkout.toast.orderConfirmed", { id: paypalOrderId }) });

          const recipientEmail = ctx.user?.email || "";
          if (recipientEmail) {
            const orderLink = `${window.location.origin}/order/${paypalOrderId}`;
            const firstItem = ctx.items[0];
            const totalPrice = ctx.items.reduce((sum: number, i: any) => sum + i.price * i.quantity, 0);
            supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "purchase-confirmation",
                recipientEmail,
                idempotencyKey: `purchase-confirm-${paypalOrderId}`,
                templateData: {
                  gameTitle: ctx.items.length === 1 ? firstItem.title : `${firstItem.title} + ${ctx.items.length - 1} more`,
                  platform: firstItem.platform,
                  quantity: ctx.items.reduce((sum: number, i: any) => sum + i.quantity, 0),
                  price: `€${totalPrice.toFixed(2)}`,
                  orderLink,
                  orderId: paypalOrderId,
                },
              },
            }).catch((err) => console.error("Failed to send confirmation email:", err));
          }

          navigate(`/order/${paypalOrderId}`);
        } catch (err: any) {
          const msg = err.message || t("checkout.toast.somethingWrong");
          const userFriendly = msg.includes("fetch") || msg.includes("network")
            ? t("checkout.toast.networkErr")
            : msg;
          toast({ title: t("checkout.toast.paymentFailed"), description: userFriendly, variant: "destructive" });
        } finally {
          setProcessing(false);
        }
      },
      onCancel: () => toast({ title: t("checkout.toast.cancelled"), description: t("checkout.toast.cancelledDesc"), variant: "destructive" }),
      onError: (err: any) => {
        console.error("PayPal error:", err);
        toast({ title: t("checkout.toast.paypalErrTitle"), description: t("checkout.toast.paypalErrDesc"), variant: "destructive" });
      },
    };

    // Standard integration: render the yellow PayPal button and the black
    // Debit/Credit card button as two separate standard Smart Button instances.
    const FUNDING = paypal.FUNDING || {};
    const sources = [FUNDING.PAYPAL, FUNDING.CARD].filter(Boolean);
    const instances: any[] = [];

    for (const fundingSource of sources) {
      const isCard = fundingSource === FUNDING.CARD;
      // Card buttons only accept black/white colors and no custom label
      // (the SDK throws on `label: "card"` — PayPal renders its own).
      const style = isCard
        ? { layout: "vertical", color: "black", shape: "rect", height: 45 }
        : { layout: "vertical", color: "gold", shape: "rect", label: "paypal", height: 45 };
      const btn = paypal.Buttons({ ...baseConfig, fundingSource, style });
      if (btn.isEligible && !btn.isEligible()) continue;
      const slot = document.createElement("div");
      slot.style.marginBottom = "8px";
      paypalContainer.appendChild(slot);
      instances.push(btn);
      btn.render(slot).catch((err: any) => {
        console.error("Failed to render PayPal Buttons:", err);
      });
    }

    if (instances.length === 0) {
      setPaypalSdkError("Could not render PayPal button.");
    }

    paypalButtonsInstanceRef.current = instances;

    return () => {
      for (const inst of instances) {
        try { inst.close?.(); } catch { /* ignore */ }
      }
      paypalButtonsInstanceRef.current = null;
    };
  }, [sdkReady, paypalContainer, paypalCurrency, paypalClientId, toast]);

  const userEmail = user?.email || "";
  const maskedEmail = userEmail.length > 4
    ? userEmail.substring(0, 2) + "*".repeat(userEmail.indexOf("@") - 2) + userEmail.substring(userEmail.indexOf("@"))
    : userEmail;

  return (
    <div className="kv-page min-h-screen bg-background">
      {step !== 1 && <Navbar />}
      {step === 1 && (
        <header className="border-b border-border/40 bg-background/95 backdrop-blur sticky top-0 z-40">
          <div className="container mx-auto px-4 max-w-6xl flex items-center justify-between py-4">
            <Link to="/" aria-label="Home">
              <img src={logo} alt="Agever's" className="h-12 md:h-14 w-auto object-contain" />
            </Link>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-display tracking-wider transition-colors text-base md:text-lg"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("checkout.back")}
            </button>
          </div>
        </header>
      )}
      <div className={`${step === 1 ? "pt-8" : "pt-40"} pb-16 container mx-auto px-4 max-w-5xl`}>
        {step !== 1 && (
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 font-display tracking-wider transition-colors text-xl"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("checkout.back")}
          </button>
        )}

        <h1 className="font-display text-3xl md:text-5xl font-black tracking-wider mb-3 text-center">
          <span className="text-gradient-neon">{t("checkout.title")}</span>
        </h1>
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.35em] text-primary/80 mb-8">
          {step === 1 ? "Step 01 / Cart" : "Step 02 / Checkout"}
        </p>

        {items.length > 0 && (
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center font-display font-bold text-sm transition-colors ${step === 1 ? "bg-gradient-to-br from-[hsl(var(--neon-glow))] to-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.5)]" : step >= 1 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground border border-border"}`}>
                {step > 1 ? "✓" : "1"}
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`font-display tracking-wider text-sm md:text-base ${step === 1 ? "text-foreground font-bold" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t("checkout.step1")}
              </button>
            </div>
            <div className="h-px w-12 md:w-24 bg-border" />
            <div className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center font-display font-bold text-sm transition-colors ${step === 2 ? "bg-gradient-to-br from-[hsl(var(--neon-glow))] to-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.5)]" : step >= 2 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground border border-border"}`}>
                2
              </div>
              <span className={`font-display tracking-wider text-sm md:text-base ${step === 2 ? "text-foreground font-bold" : "text-muted-foreground"}`}>
                {t("checkout.step2")}
              </span>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="text-center py-20 glass rounded-xl max-w-lg mx-auto">
            <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-display mb-4">{t("checkout.emptyCart")}</p>
            <Button onClick={() => navigate("/")} className="font-display tracking-wider">
              {t("checkout.browseProducts")}
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-5 gap-8 items-stretch">
            {/* Left Column - Billing + Payment */}
            <div className="md:col-span-3 space-y-8 flex flex-col">
              {/* Billing — authenticated buyers only (guest checkout removed). */}
              {step === 2 && (
                <div>
                  <h2 className="font-display text-lg md:text-xl font-bold tracking-wide text-foreground border-l-4 border-[hsl(var(--neon-purple))] pl-3 mb-4 uppercase text-xs tracking-[0.2em]">{t("checkout.billing.title")}</h2>
                  <div className="bg-gradient-to-b from-card to-card/70 rounded-xl border border-border shadow-xl shadow-black/50 ring-1 ring-white/[0.03] p-5 flex items-start justify-between">
                    <div>
                      <p className="font-display font-bold text-foreground text-base">
                        {profile?.display_name || profile?.username || user?.email?.split("@")[0]}
                      </p>
                      {profile?.address && <p className="text-sm text-muted-foreground mt-1">{profile.address}</p>}
                      {(profile?.city || profile?.country) && (
                        <p className="text-sm text-muted-foreground">
                          {[profile?.city, profile?.state, profile?.country].filter(Boolean).join(", ")}
                        </p>
                      )}
                      {!profile?.address && !profile?.city && (
                        <p className="text-sm text-muted-foreground mt-1">{t("checkout.billing.noAddress")}</p>
                      )}
                    </div>
                    <Link to="/account?section=settings" className="text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              )}

              {/* Shipping Address — Physical products only */}
              {step === 2 && hasPhysicalItems && (
                <div>
                  <h2 className="font-display text-lg md:text-xl font-bold tracking-wide text-foreground border-l-4 border-primary pl-3 mb-4 flex items-center gap-2 uppercase text-xs tracking-[0.2em]">
                    <Truck className="h-5 w-5" /> {t("checkout.ship.addrTitle")}
                  </h2>
                  {!editingAddress ? (
                    <div className="bg-gradient-to-b from-card to-card/70 rounded-xl border border-border shadow-xl shadow-black/50 ring-1 ring-white/[0.03] p-5 flex items-start justify-between">
                      <div>
                        <p className="font-display font-bold text-foreground text-base">{shippingAddress.full_name || "—"}</p>
                        {shippingAddress.address_line1 && <p className="text-sm text-muted-foreground mt-1">{shippingAddress.address_line1}</p>}
                        {shippingAddress.address_line2 && <p className="text-sm text-muted-foreground">{shippingAddress.address_line2}</p>}
                        <p className="text-sm text-muted-foreground">
                          {[shippingAddress.city, shippingAddress.state, shippingAddress.zip_code, shippingAddress.country].filter(Boolean).join(", ") || t("checkout.billing.noAddress")}
                        </p>
                        {shippingAddress.phone && <p className="text-sm text-muted-foreground">📞 {shippingAddress.phone}</p>}
                        {!shippingAddress.address_line1 && (
                          <p className="text-xs text-destructive mt-2">{t("checkout.ship.addWarn")}</p>
                        )}
                      </div>
                      <button onClick={() => setEditingAddress(true)} className="text-muted-foreground hover:text-foreground transition-colors">
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-b from-card to-card/70 rounded-xl border border-border shadow-xl shadow-black/50 ring-1 ring-white/[0.03] p-5 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="text-xs text-muted-foreground font-display">{t("checkout.ship.fullName")}</label>
                          <input
                            value={shippingAddress.full_name}
                            onChange={(e) => setShippingAddress(prev => ({ ...prev, full_name: e.target.value }))}
                            className="w-full mt-1 rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground"
                            placeholder={t("checkout.ship.namePh")}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-muted-foreground font-display">{t("checkout.ship.line1")}</label>
                          <input
                            value={shippingAddress.address_line1}
                            onChange={(e) => setShippingAddress(prev => ({ ...prev, address_line1: e.target.value }))}
                            className="w-full mt-1 rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground"
                            placeholder={t("checkout.ship.line1Ph")}
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-muted-foreground font-display">{t("checkout.ship.line2")}</label>
                          <input
                            value={shippingAddress.address_line2}
                            onChange={(e) => setShippingAddress(prev => ({ ...prev, address_line2: e.target.value }))}
                            className="w-full mt-1 rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground"
                            placeholder={t("checkout.ship.line2Ph")}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground font-display">{t("checkout.ship.city")}</label>
                          <input
                            value={shippingAddress.city}
                            onChange={(e) => setShippingAddress(prev => ({ ...prev, city: e.target.value }))}
                            className="w-full mt-1 rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground font-display">{t("checkout.ship.state")}</label>
                          <input
                            value={shippingAddress.state}
                            onChange={(e) => setShippingAddress(prev => ({ ...prev, state: e.target.value }))}
                            className="w-full mt-1 rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground font-display">{t("checkout.ship.zip")}</label>
                          <input
                            value={shippingAddress.zip_code}
                            onChange={(e) => setShippingAddress(prev => ({ ...prev, zip_code: e.target.value }))}
                            className="w-full mt-1 rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground font-display">{t("checkout.ship.country")}</label>
                          <input
                            value={shippingAddress.country}
                            onChange={(e) => setShippingAddress(prev => ({ ...prev, country: e.target.value }))}
                            className="w-full mt-1 rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-muted-foreground font-display">{t("checkout.ship.phone")}</label>
                          <input
                            value={shippingAddress.phone}
                            onChange={(e) => setShippingAddress(prev => ({ ...prev, phone: e.target.value }))}
                            className="w-full mt-1 rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground"
                            placeholder={t("checkout.ship.phonePh")}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" onClick={() => setEditingAddress(false)} className="font-display text-xs">
                          {t("checkout.ship.save")}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingAddress(false)} className="font-display text-xs">
                          {t("checkout.ship.cancel")}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Cart Items */}
              {step === 1 && (
              <div className="flex-1 flex flex-col">
                <div className="bg-gradient-to-b from-card to-card/70 rounded-xl border border-border shadow-xl shadow-black/50 ring-1 ring-white/[0.03] p-6 space-y-4 flex-1">
                  <h2 className="font-display text-lg md:text-xl font-bold tracking-wide text-foreground border-l-4 border-[hsl(var(--neon-gold))] pl-3 uppercase text-xs tracking-[0.2em]">{t("checkout.items.title")}</h2>
                  {items.map((item) => (
                    <motion.div
                      key={item.cartItemId}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-background/40 rounded-xl p-4 flex items-center gap-4 border-[3px] border-primary hover:border-[hsl(var(--neon-gold))] transition-all duration-200"
                    >
                      {item.image_url && (
                        <img src={item.image_url} alt={item.title} className="w-20 h-14 object-cover rounded-lg shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display font-bold text-sm text-foreground truncate">{item.title}</h3>
                        <p className="text-xs text-muted-foreground">{item.platform} • {item.sellerName}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => updateQuantity(item.offerId, -1)}
                          className="h-7 w-7 rounded-lg bg-background text-foreground text-sm flex items-center justify-center hover:bg-background/80 transition-colors"
                        >−</button>
                        <span className="text-sm font-display font-bold text-foreground w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={async () => {
                            // Enforce new account limit on quantity increase
                            if (user && item.price > 20) {
                              const createdTime = new Date(user.created_at).getTime();
                              const isWithin24h = (Date.now() - createdTime) < 24 * 60 * 60 * 1000;
                              if (isWithin24h) {
                                const { data: score } = await supabase.from("fraud_scores").select("new_account_limit_exempt").eq("user_id", user.id).maybeSingle();
                                if (!score?.new_account_limit_exempt) {
                                  toast({ title: "Account Security Limit", description: "New accounts are limited to items under €20.", variant: "destructive" });
                                  return;
                                }
                              }
                            }
                            updateQuantity(item.offerId, 1);
                          }}
                          disabled={!!(item.maxStock && item.quantity >= item.maxStock)}
                          className="h-7 w-7 rounded-lg bg-background text-foreground text-sm flex items-center justify-center hover:bg-background/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >+</button>
                        {item.maxStock && (
                          <span className="text-[10px] text-muted-foreground">{t("checkout.items.max", { n: item.maxStock })}</span>
                        )}
                      </div>
                      <span className="text-sm font-display font-bold text-foreground shrink-0 w-20">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                      <button onClick={() => removeItem(item.cartItemId)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
              )}

              {/* Shipping Selection for AliExpress items */}
              {step === 2 && aliexpressItems.size > 0 && (
                <div>
                  <h2 className="font-display text-lg md:text-xl font-bold tracking-wide text-foreground border-l-4 border-[hsl(var(--neon-purple))] pl-3 mb-4 flex items-center gap-2 uppercase text-xs tracking-[0.2em]">
                    <Truck className="h-5 w-5" /> {t("checkout.ship.title")}
                  </h2>
                  <div className="space-y-3">
                    {items.filter(item => aliexpressItems.has(item.offerId)).map((item) => {
                      const options = shippingOptions[item.offerId] || [];
                      const selected = selectedShipping[item.offerId];
                      return (
                        <div key={`ship-${item.offerId}`} className="bg-gradient-to-b from-card to-card/70 rounded-xl border border-border shadow-xl shadow-black/50 ring-1 ring-white/[0.03] p-4 space-y-3">
                          <p className="text-sm font-display font-bold text-foreground truncate">{item.title}</p>
                          {shippingLoading ? (
                            <p className="text-xs text-muted-foreground">{t("checkout.ship.loading")}</p>
                          ) : options.length === 0 ? (
                            <p className="text-xs text-muted-foreground">{t("checkout.ship.none")}</p>
                          ) : (
                            <div className="space-y-2">
                              {options.map((opt, idx) => (
                                <label
                                  key={idx}
                                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer border transition-colors ${
                                    selected?.service_name === opt.service_name
                                      ? "border-primary bg-primary/10"
                                      : "border-border/30 hover:border-border"
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <input
                                      type="radio"
                                      name={`shipping-${item.offerId}`}
                                      checked={selected?.service_name === opt.service_name}
                                      onChange={() => setSelectedShipping(prev => ({ ...prev, [item.offerId]: opt }))}
                                      className="accent-primary"
                                    />
                                    <div>
                                      <p className="text-sm font-display font-bold text-foreground">{opt.service_name?.replace(/AliExpress\s*/gi, "").replace(/Selection\s*/gi, "").trim() || t("checkout.ship.standard")}</p>
                                      {opt.estimated_delivery_time && (
                                        <p className="text-xs text-muted-foreground">{t("checkout.ship.est", { time: opt.estimated_delivery_time })}</p>
                                      )}
                                      {opt.tracking && <p className="text-[10px] text-primary">{t("checkout.ship.tracking")}</p>}
                                    </div>
                                  </div>
                                  <span className="text-sm font-bold text-foreground">
                                    {parseFloat(opt.freight_amount) === 0 ? t("checkout.ship.free") : formatPrice(parseFloat(opt.freight_amount))}
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 2 && (<>
              {/* Payment Buttons - always rendered in DOM so bots and users see them immediately.
                  The PayPal container stays mounted; an overlay disables interaction until ready. */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-lg md:text-xl font-bold tracking-wide text-foreground border-l-4 border-[hsl(var(--neon-green))] pl-3 uppercase text-xs tracking-[0.2em]">{t("checkout.pay.title")}</h2>
                  <div className="flex flex-col items-end text-right">
                    <div className="flex items-center gap-1.5 text-[hsl(var(--neon-green))] font-display font-bold text-[10px] uppercase tracking-wider">
                      <Lock className="h-3 w-3" />
                      {t("checkout.pay.secureTitle", "Secure Checkout")}
                    </div>
                    <p className="text-[9px] text-muted-foreground/80 font-medium">
                      {t("checkout.pay.secureSubtitle", "Keys revealed immediately after payment")}
                    </p>
                  </div>
                </div>
                <div className="bg-gradient-to-b from-card to-card/70 rounded-xl border border-border shadow-xl shadow-black/50 ring-1 ring-white/[0.03] p-5 space-y-4">
                  {/* Status messages — shown above the always-mounted PayPal container */}
                  {profile?.account_status === 'suspended' ? (
                    <div className="flex flex-col items-center py-4 gap-3 text-center">
                      <ShieldCheck className="h-10 w-10 text-destructive" />
                      <p className="text-sm text-destructive font-display font-bold">{t("checkout.pay.suspendedTitle")}</p>
                      <p className="text-sm text-muted-foreground max-w-md">
                        {t("checkout.pay.suspendedDesc")}
                      </p>
                      <div className="flex gap-3 mt-2">
                        <Link to="/account" className="text-primary hover:underline text-sm font-display">{t("checkout.pay.verifyEmail")}</Link>
                        <Link to="/contact" className="text-primary hover:underline text-sm font-display">{t("checkout.pay.contactSupport")}</Link>
                      </div>
                    </div>
                  ) : preCheckBlocked ? (
                    (() => {
                      const isNewAccountLimit = preCheckMessage?.startsWith("NEW_ACCOUNT_LIMIT|");
                      const cleanMessage = isNewAccountLimit
                        ? preCheckMessage!.replace("NEW_ACCOUNT_LIMIT|", "")
                        : (preCheckMessage || t("checkout.pay.flaggedDefault"));
                      const chatAvailable = isHumanAvailable();
                      return (
                        <div className="flex flex-col items-center py-4 gap-3 text-center">
                          {isNewAccountLimit ? (
                            <Clock className="h-10 w-10 text-amber-500" />
                          ) : (
                            <ShieldCheck className="h-10 w-10 text-destructive" />
                          )}
                          <p className={`text-sm font-display font-bold ${isNewAccountLimit ? "text-amber-500" : "text-destructive"}`}>
                            {isNewAccountLimit ? t("checkout.pay.newAccountTitle") : t("checkout.pay.flaggedTitle")}
                          </p>
                          <p className="text-sm text-muted-foreground max-w-md whitespace-pre-line">
                            {cleanMessage}
                          </p>
                          {isNewAccountLimit && (
                            <p className="text-xs text-muted-foreground/80 max-w-md italic">
                              {t("checkout.pay.appealHint")}
                            </p>
                          )}
                          <AppealForm
                            blockedReason={cleanMessage}
                            isNewAccountLimit={isNewAccountLimit}
                            userEmail={user?.email || ""}
                            userId={user?.id}
                          />
                          <div className="flex flex-wrap gap-2 justify-center mt-1">
                            {chatAvailable ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="default"
                                onClick={() => window.dispatchEvent(new CustomEvent("agevers:open-help-chat"))}
                                className="gap-2"
                              >
                                <MessageCircle className="h-4 w-4" />
                                {t("checkout.pay.liveChat")}
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="default"
                                asChild
                                className="gap-2"
                              >
                                <a href="mailto:support@agevers.com?subject=New%20Account%20Purchase%20Review&body=Hi%20Agevers%20team%2C%0A%0AMy%20account%20is%20new%20and%20my%20order%20was%20held.%20Please%20review%20and%20approve.%0A%0AAccount%20email%3A%20">
                                  <Mail className="h-4 w-4" />
                                  {t("checkout.pay.emailUs")}
                                </a>
                              </Button>
                            )}
                            <Button type="button" size="sm" variant="outline" asChild>
                              <Link to="/contact">{t("checkout.pay.contactPage")}</Link>
                            </Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground/60 mt-1">
                            {chatAvailable
                              ? t("checkout.pay.supportOnline")
                              : t("checkout.pay.supportOffline")}
                          </p>
                        </div>
                      );
                    })()
                  ) : paypalSdkError ? (
                    <p className="text-sm text-destructive text-center py-2">{paypalSdkError}</p>
                  ) : !paypalClientId || !sdkReady ? (
                    <p className="text-sm text-muted-foreground text-center py-2">{t("checkout.pay.loading")}</p>
                  ) : null}

                  {/* Terms/Privacy/Refund consent — gates both PayPal and crypto
                      via gateRef.current.check() (see the effect above). */}
                  <div className="flex items-start gap-2 pb-1">
                    <input
                      id="checkout-agree-terms"
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary shrink-0"
                    />
                    <label htmlFor="checkout-agree-terms" className="text-xs text-muted-foreground">
                      <Trans
                        i18nKey="checkout.pay.agreeToTermsLabel"
                        components={{
                          1: <Link to="/terms-of-service" target="_blank" className="text-primary hover:underline" />,
                          3: <Link to="/privacy-policy" target="_blank" className="text-primary hover:underline" />,
                          5: <Link to="/refund-policy" target="_blank" className="text-primary hover:underline" />,
                        }}
                      />
                    </label>
                  </div>

                  {/* Payment method selector — PayPal vs Crypto Wallet */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("paypal")}
                      className={`rounded-lg px-3 py-2.5 text-sm font-display font-bold tracking-wider border-2 transition-all ${
                        paymentMethod === "paypal"
                          ? "border-primary bg-primary/10 text-foreground shadow-[0_0_15px_hsl(var(--primary)/0.35)]"
                          : "border-border/50 bg-background/40 text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {t("checkout.pay.paypal")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("crypto")}
                      className={`rounded-lg px-3 py-2.5 text-sm font-display font-bold tracking-wider border-2 transition-all ${
                        paymentMethod === "crypto"
                          ? "border-primary bg-primary/10 text-foreground shadow-[0_0_15px_hsl(var(--primary)/0.35)]"
                          : "border-border/50 bg-background/40 text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {t("checkout.pay.crypto")}
                    </button>
                  </div>

                  {/* PayPal container — ALWAYS mounted and interactive so the SDK
                      renders the buttons immediately for users and Google bots.
                      Click-time validation (terms, guest fields) happens in the
                      PayPal onClick handler and surfaces a toast if blocked. */}
                  <div className="relative" style={{ display: paymentMethod === "paypal" ? "block" : "none" }}>
                    <div
                      ref={handlePaypalContainerRef}
                      aria-label="PayPal payment buttons"
                      className="min-h-[120px] bg-white rounded-lg p-3"
                    />
                    {(processing || preCheckLoading) && (
                      <div className="fixed inset-0 flex items-center justify-center bg-background/90 backdrop-blur-sm z-[120] p-4">
                        <div className="flex flex-col items-center gap-4 bg-card border border-border/60 rounded-xl px-8 py-7 shadow-[0_0_35px_hsl(var(--primary)/0.35)] max-w-sm w-full text-center">
                          <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                          <p className="text-sm text-foreground font-display tracking-wider">
                          {preCheckLoading ? t("checkout.pay.securityCheck") : t("checkout.pay.processing")}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-border/40 flex flex-col items-center gap-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-display font-bold text-muted-foreground/80 uppercase tracking-widest">
                      <ShieldCheck className="h-3.5 w-3.5 text-[hsl(var(--neon-green))]" />
                      {t("checkout.pay.guarantee", "Guaranteed Genuine Digital Codes • Instant Activation")}
                    </div>
                  </div>
                  {!agreedToTerms && (
                    <p className="text-[11px] text-muted-foreground text-center">
                    {t("checkout.pay.acceptTerms")}
                    </p>
                  )}

                  {/* --- Crypto Wallet payment panel --- */}
                  {paymentMethod === "crypto" && (
                  <div className="space-y-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground text-center">
                      {t("checkout.pay.cryptoTitle")}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { id: "usdterc20", label: "USDT", sub: "ERC20", symbol: "₮", color: "#26A17B" },
                        { id: "ltc", label: "Litecoin", sub: "LTC", symbol: "Ł", color: "#345D9D" },
                        { id: "doge", label: "Dogecoin", sub: "DOGE", symbol: "Ð", color: "#C2A633" },
                      ] as const).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setCryptoCurrency(c.id)}
                          className={`flex flex-col items-center gap-1 rounded-lg px-2 py-3 border-2 transition-all ${
                            cryptoCurrency === c.id
                              ? "border-primary bg-primary/10 shadow-[0_0_15px_hsl(var(--primary)/0.35)]"
                              : "border-border/50 bg-background/40 hover:border-primary/50"
                          }`}
                        >
                          <span
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white font-black text-sm"
                            style={{ backgroundColor: c.color }}
                          >
                            {c.symbol}
                          </span>
                          <span className="text-xs font-display font-bold text-foreground">{c.label}</span>
                          <span className="text-[10px] text-muted-foreground">{c.sub}</span>
                        </button>
                      ))}
                    </div>
                    <button
                    type="button"
                    disabled={processing || preCheckLoading}
                    onClick={async () => {
                      const reason = gateRef.current.check();
                      if (reason) {
                        toast({ title: t("checkout.toast.cannotContinue"), description: reason, variant: "destructive" });
                        return;
                      }
                      const ctx = paymentCtxRef.current;
                      setProcessing(true);
                      try {
                        const accessToken = await getFreshAccessToken();
                        if (!accessToken) throw new Error(t("checkout.toast.sessionExpired"));

                        const { data, error } = await supabase.functions.invoke("nowpayments-create-invoice", {
                          headers: { Authorization: `Bearer ${accessToken}` },
                          body: {
                            items: ctx.items.map((item: any) => ({
                              offerId: item.offerId, title: item.title, platform: item.platform,
                              price: item.price, quantity: item.quantity, image_url: item.image_url, sellerName: item.sellerName,
                            })),
                            total_eur: ctx.finalTotalEUR,
                            total_charge: ctx.finalTotalEUR,
                            redeem_coins: 0,
                            shipping_address: ctx.hasPhysicalItems ? ctx.shippingAddress : undefined,
                            selected_shipping: Object.keys(ctx.selectedShipping || {}).length > 0 ? ctx.selectedShipping : undefined,
                            applied_coupon: ctx.appliedCoupon || undefined,
                            description: `${ctx.count} item(s) from Agever's Digital Codes`,
                            pay_currency: cryptoCurrency,
                            success_url: `${window.location.origin}/order/`,
                            cancel_url: `${window.location.origin}/checkout`,
                          },
                        });
                        console.log('[crypto] invoke result', { data, error });
                        if (error || !data?.invoice_url) {
                          let serverMessage: string | undefined = data?.error;
                          const ctxRes = (error as any)?.context;
                          if (!serverMessage && ctxRes && typeof ctxRes.json === "function") {
                            try {
                              const body = await ctxRes.clone().json();
                              serverMessage = body?.error;
                            } catch { /* ignore */ }
                          }
                          throw new Error(serverMessage || error?.message || t("checkout.toast.cryptoCreateErr"));
                        }
                        const url = data.invoice_url as string;
                        setCryptoInvoiceUrl(url);
                        setProcessing(false);
                      } catch (err: any) {
                        console.error('[crypto] checkout failed', err);
                        toast({ title: t("checkout.toast.cryptoFailed"), description: err?.message || t("checkout.toast.cryptoTryAgain"), variant: "destructive" });
                        setProcessing(false);
                      }
                    }}
                      className="w-full flex items-center justify-center gap-3 rounded-lg px-4 py-3 font-display tracking-wider text-sm font-bold transition-all bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_hsl(var(--primary)/0.35)]"
                    >
                      {t("checkout.pay.payWith", { name: cryptoCurrency === "usdterc20" ? "USDT (ERC20)" : cryptoCurrency === "ltc" ? "Litecoin" : "Dogecoin" })}
                    </button>
                    <p className="text-[11px] text-muted-foreground text-center">
                      {t("checkout.pay.powered")}
                    </p>
                  </div>
                  )}

                  {/* In-site floating crypto payment modal */}
                  <Dialog open={!!cryptoInvoiceUrl} onOpenChange={(open) => { if (!open) setCryptoInvoiceUrl(null); }}>
                    <DialogContent className="max-w-2xl w-[95vw] h-[85vh] p-0 overflow-hidden bg-background">
                      <DialogHeader className="px-4 py-2 border-b">
                        <DialogTitle className="text-sm font-display">{t("checkout.pay.cryptoModal")}</DialogTitle>
                      </DialogHeader>
                      {cryptoInvoiceUrl && (
                        <iframe
                          src={cryptoInvoiceUrl}
                          title="NOWPayments checkout"
                          className="w-full h-full border-0"
                          allow="clipboard-write; payment *"
                        />
                      )}
                      <p className="text-[11px] text-muted-foreground text-center px-3 py-2 border-t">
                        <Trans i18nKey="checkout.pay.cryptoOpenNew" components={{ 1: <a href={cryptoInvoiceUrl ?? '#'} target="_blank" rel="noopener noreferrer" className="text-primary underline" /> }} />
                      </p>
                    </DialogContent>
                  </Dialog>

                  <p className="text-[11px] text-muted-foreground text-center pt-2">
                    {t("checkout.pay.identityNote")}
                  </p>
                </div>
              </div>

              {/* Bonus note */}
              <p className="text-muted-foreground/90 leading-relaxed text-base text-center">
                <Trans i18nKey="checkout.bonus" components={{ 1: <span className="text-foreground font-semibold" />, 3: <Link to="/giveaway" target="_blank" className="text-primary hover:underline font-semibold" /> }} />
              </p>

              {/* Trust badges row */}
              <div className="bg-gradient-to-b from-card to-card/70 rounded-xl border border-border shadow-xl shadow-black/50 ring-1 ring-white/[0.03] p-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <ShieldCheck className="h-8 w-8 text-primary" />
                    <p className="text-sm font-display font-bold text-foreground">{t("checkout.trust.secure")}</p>
                    <p className="text-xs text-muted-foreground">{t("checkout.trust.secureDesc")}</p>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <CheckSquare className="h-8 w-8 text-primary" />
                    <p className="text-sm font-display font-bold text-foreground">{t("checkout.trust.instant")}</p>
                    <p className="text-xs text-muted-foreground">{t("checkout.trust.instantDesc")}</p>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <ShieldCheck className="h-8 w-8 text-primary" />
                    <p className="text-sm font-display font-bold text-foreground">{t("checkout.trust.verified")}</p>
                    <p className="text-xs text-muted-foreground">{t("checkout.trust.verifiedDesc")}</p>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <CheckSquare className="h-8 w-8 text-primary" />
                    <p className="text-sm font-display font-bold text-foreground">{t("checkout.trust.support")}</p>
                    <p className="text-xs text-muted-foreground">{t("checkout.trust.supportDesc")}</p>
                  </div>
                </div>
              </div>
              </>)}
            </div>

            {/* Summary Column */}
            <div className="md:col-span-2 order-first md:order-none space-y-4 flex flex-col">
              <div className={`bg-gradient-to-b from-card to-card/80 rounded-xl border border-primary/25 shadow-xl shadow-primary/10 ring-1 ring-primary/10 p-6 space-y-4 ${step === 1 ? "flex-1" : "sticky top-40"}`}>
                <h2 className="font-display text-lg md:text-xl font-bold tracking-wide text-foreground border-l-4 border-primary pl-3 uppercase text-xs tracking-[0.2em]">{t("checkout.summary.title")}</h2>

                {/* Item list */}
                <div className="space-y-3 border-b border-border/30 pb-4">
                  {items.map((item) => (
                    <div key={item.cartItemId} className="flex justify-between items-start gap-3 p-3 border-[3px] border-primary hover:border-[hsl(var(--neon-gold))] transition-all duration-200 rounded-lg">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground font-display font-bold truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.platform}</p>
                      </div>
                      <span className="text-sm text-foreground font-bold shrink-0">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>


                {/* Discount Code */}
                <div className="border-b border-border/30 pb-4 space-y-2">
                  <label className="flex items-center gap-2 text-sm font-display font-bold text-foreground">
                    <Tag className="h-4 w-4 text-primary" /> {t("checkout.summary.discountCode")}
                  </label>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between bg-primary/10 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5 text-primary" />
                        <span className="text-sm font-mono font-bold text-primary">{appliedCoupon.code}</span>
                        <span className="text-xs text-primary/70">
                          (-{appliedCoupon.discount_type === "percentage" ? `${appliedCoupon.discount_value}%` : `€${appliedCoupon.discount_value}`})
                        </span>
                      </div>
                      <button onClick={handleRemoveCoupon} className="text-muted-foreground hover:text-destructive transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        value={couponInput}
                        onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(null); }}
                        onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                        placeholder={t("checkout.summary.discountPh")}
                        className="flex-1 rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <Button
                        size="sm"
                        onClick={handleApplyCoupon}
                        disabled={couponLoading || !couponInput.trim()}
                        className="font-display text-xs px-4"
                      >
                        {couponLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("checkout.summary.apply")}
                      </Button>
                    </div>
                  )}
                  {couponError && <p className="text-xs text-destructive">{couponError}</p>}
                </div>

                {/* Fees breakdown */}
                <div className="space-y-2">
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-primary flex items-center gap-1"><Tag className="h-3 w-3" /> {t("checkout.summary.coupon")}</span>
                      <span className="text-primary font-bold">-{formatPrice(couponDiscount)}</span>
                    </div>
                  )}
                  {qtyDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-primary flex items-center gap-1"><Tag className="h-3 w-3" /> {t("checkout.summary.quantity")}</span>
                      <span className="text-primary font-bold">-{formatPrice(qtyDiscount)}</span>
                    </div>
                  )}
                  {shippingTotal > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1"><Truck className="h-3 w-3" /> {t("checkout.summary.shipping")}</span>
                      <span className="text-foreground">{formatPrice(shippingTotal)}</span>
                    </div>
                  )}
                  {!allPhysical && paymentMethod === "paypal" && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        {t("checkout.summary.digitalFee")}
                        <Popover>
                          <PopoverTrigger asChild>
                            <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                              <HelpCircle className="h-3.5 w-3.5" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="text-xs leading-relaxed max-w-[240px]">
                            {t("checkout.summary.digitalFeeTip")}
                          </PopoverContent>
                        </Popover>
                      </span>
                      <span className="text-foreground">{formatPrice(paymentFee)}</span>
                    </div>
                  )}
                  {!allPhysical && paymentMethod === "crypto" && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        {t("checkout.summary.cryptoFee")}
                        <Popover>
                          <PopoverTrigger asChild>
                            <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                              <HelpCircle className="h-3.5 w-3.5" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="text-xs leading-relaxed max-w-[240px]">
                            {t("checkout.summary.cryptoFeeTip")}
                          </PopoverContent>
                        </Popover>
                      </span>
                      <span className="text-foreground">{formatPrice(cryptoFee)}</span>
                    </div>
                  )}
                </div>

                {/* Total */}
                <div className="border-t border-primary/20 pt-4 flex justify-between items-center">
                  <span className="font-display text-base font-bold text-foreground">{t("checkout.summary.total")}</span>
                  <span className="font-display text-3xl font-black gradient-text">{formatPrice(finalTotalEUR)}</span>
                </div>

                {step === 1 ? (
                  <Button
                    onClick={() => { setStep(2); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="w-full h-12 font-display text-base tracking-wider bg-gradient-to-r from-[hsl(var(--neon-glow))] via-primary to-[hsl(var(--neon-purple))] hover:brightness-110 text-primary-foreground shadow-[0_8px_30px_-4px_hsl(var(--primary)/0.55)] border-0 transition-all"
                  >
                    {t("checkout.summary.next")}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => { setStep(1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="w-full font-display text-sm tracking-wider"
                  >
                    {t("checkout.summary.backToCart")}
                  </Button>
                )}


                {/* Test Purchase - Admin only */}
                {isAdmin && (
                  <div className="border-t border-border/30 pt-3">
                    <Button
                      variant="outline"
                      className="w-full gap-2 border-dashed border-primary/40 text-primary hover:bg-primary/10 font-display text-xs tracking-wider"
                      disabled={processing || !agreedToTerms}
                      onClick={async () => {
                        setProcessing(true);
                        try {
                          const { data: fraudData, error: fraudError } = await supabase.functions.invoke("fraud-check", {
                            body: {
                              items: items.map((item) => ({ title: item.title, quantity: item.quantity, price: item.price })),
                              total_amount: finalTotalEUR,
                            },
                          });
                          if (fraudError) console.error("Fraud check error:", fraudError);
                          else if (fraudData && !fraudData.allowed) {
                            toast({ title: "Purchase Blocked", description: fraudData.blocked_reason || "Flagged for review.", variant: "destructive" });
                            setProcessing(false);
                            return;
                          } else if (fraudData) {
                            console.log("🔍 Fraud check result:", fraudData);
                            toast({ title: `Fraud Check: ${fraudData.risk_level?.toUpperCase()}`, description: `Score: ${fraudData.risk_score}/100 | Flags: ${fraudData.flags?.length || 0}` });
                          }

                          const testOrderId = `TEST-${Date.now()}`;
                          const orderRows = items.map((item) => ({
                            user_id: user!.id,
                            game_title: item.title,
                            platform: item.platform,
                            price: item.price * item.quantity,
                            quantity: item.quantity,
                            paypal_order_id: testOrderId,
                            image_url: item.image_url,
                            status: "completed",
                            game_code: Array.from({ length: item.quantity }, () => generateFakeCode()).join("\n"),
                          }));

                          const { error } = await supabase.from("orders").insert(orderRows);
                          if (error) throw error;

                          clearCart();
                          toast({ title: "Test purchase complete!", description: "Fake codes generated." });
                          navigate(`/order/${testOrderId}`);
                        } catch (err: any) {
                          toast({ title: "Test failed", description: err.message, variant: "destructive" });
                        } finally {
                          setProcessing(false);
                        }
                      }}
                    >
                      <FlaskConical className="h-4 w-4" />
                      TEST PURCHASE (Fake Codes)
                    </Button>
                    <p className="text-[10px] text-primary/60 text-center mt-1">Admin only — skips PayPal</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {step !== 1 && <Footer />}
    </div>
  );
};

export default Checkout;
