import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AgeversLoader from "@/components/AgeversLoader";
import { toast } from "sonner";
import { RotateCcw, Search, Receipt, Package, ShieldAlert, Clock, CheckCircle, XCircle, Globe, Monitor, Truck, ShoppingCart, ExternalLink, FileText } from "lucide-react";
import { MessageCircle, Trash2, Star } from "lucide-react";
import LiveChatPanel from "@/components/LiveChatPanel";
import { useAuth } from "@/hooks/useAuth";

interface RefundRecord {
  id: string;
  refund_type: string;
  amount: number | null;
  currency: string;
  status: string;
  refunded_at: string;
  paypal_refund_id: string | null;
}

interface AdminOrder {
  id: string;
  user_id: string;
  game_title: string;
  platform: string;
  price: number;
  quantity: number;
  status: string;
  paypal_order_id: string | null;
  created_at: string;
  game_code: string | null;
  codes_viewed: boolean;
  buyer_name: string | null;
  buyer_email: string | null;
  source: "kinguin" | "manual" | "aliexpress" | "unknown";
  kinguin_order_id: string | null;
  refunds: RefundRecord[];
  refunded_total: number;
  remaining_refundable: number;
  ip_address: string | null;
  user_agent: string | null;
  buyer_country: string | null;
  buyer_city: string | null;
  code_viewed_at: string | null;
  is_held: boolean;
  held_until: string | null;
  held_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  // Physical product fields
  shipping_full_name: string | null;
  shipping_address_line1: string | null;
  shipping_city: string | null;
  shipping_country: string | null;
  shipping_phone: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  carrier_name: string | null;
  shipped_at: string | null;
  aliexpress_order_id: string | null;
  aliexpress_product_id: string | null;
  review_invite_sent_at: string | null;
  review_reward_sent_at: string | null;
  buy_cost: number | null;
  net_profit: number | null;
  payment_method: "paypal" | "crypto" | "unknown";
  coins_used: number;
  coin_discount_eur: number;
  total_paid: number | null;
  paid_currency: string | null;
  payment_source_type: "paypal_account" | "card" | null;
  payment_source_detail: string | null;
}

const AdminOrders = () => {
  const { user: adminUser } = useAuth();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [refundingOrderId, setRefundingOrderId] = useState<string | null>(null);
  const [reviewInviteOrderId, setReviewInviteOrderId] = useState<string | null>(null);
  const [reviewRewardOrderId, setReviewRewardOrderId] = useState<string | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [buyingOrderId, setBuyingOrderId] = useState<string | null>(null);
  const [shippingOrderId, setShippingOrderId] = useState<string | null>(null);
  const [receiptOrderId, setReceiptOrderId] = useState<string | null>(null);
  const [openingChatOrderId, setOpeningChatOrderId] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<{ requestId: string; email: string } | null>(null);

  const [idProofOrderId, setIdProofOrderId] = useState<string | null>(null);
  const [idProofSent, setIdProofSent] = useState<Record<string, boolean>>({});
  const [proofViewer, setProofViewer] = useState<{ orderId: string; title: string } | null>(null);
  const [proofFiles, setProofFiles] = useState<any[]>([]);
  const [proofLoading, setProofLoading] = useState(false);
  const [proofCounts, setProofCounts] = useState<Record<string, number>>({});

  // Opens (or reuses) a live support thread for the buyer of this order.
  const ensureChatRequest = async (order: AdminOrder, seedMessage?: string) => {
    const { data: existing } = await supabase
      .from("live_support_requests" as any)
      .select("id, user_email, status")
      .eq("user_id", order.user_id)
      .in("status", ["pending", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle() as any;

    let requestId: string | null = existing?.id ?? null;

    if (!requestId) {
      const { data: created, error } = await supabase
        .from("live_support_requests" as any)
        .insert({
          user_id: order.user_id,
          user_email: order.buyer_email || "",
          status: "pending",
          initiated_by: "admin",
        } as any)
        .select("id")
        .single() as any;
      if (error || !created) throw new Error(error?.message || "Failed to open chat");
      requestId = created.id;
      // Seed a system message so the buyer sees context in their widget
      await supabase.from("live_chat_messages").insert({
        request_id: requestId,
        sender_id: adminUser?.id || order.user_id,
        sender_role: "system",
        content: seedMessage || `An Agever's agent started a chat regarding your order ${order.id.slice(0, 8)}.`,
      });
    }
    return { requestId: requestId as string, email: order.buyer_email || existing?.user_email || "Buyer" };
  };

  const handleOpenBuyerChat = async (order: AdminOrder) => {
    if (!order.user_id) {
      toast.error("This order has no registered buyer to chat with");
      return;
    }
    setOpeningChatOrderId(order.id);
    try {
      const chat = await ensureChatRequest(order);
      setActiveChat(chat);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open chat");
    } finally {
      setOpeningChatOrderId(null);
    }
  };

  // Builds the verification request text based on WHY the order was held.
  const buildIdProofMessage = (order: AdminOrder) => {
    const reason = (order.held_reason || "").toLowerCase();
    let cause: string;
    let docs: string[];

    if (reason.includes("mismatch") || reason.includes("paypal") || reason.includes("email") || reason.includes("phone")) {
      cause =
        "the contact details used on our site (email / phone) do not match the details on the PayPal payment";
      docs = [
        "A screenshot of the PayPal transaction confirmation showing the payment amount and date",
        "A government-issued photo ID (passport / driver's license / national ID) — you may hide the document number",
        "A short written confirmation that you personally authorized this payment",
      ];
    } else if (reason.includes("fraud") || reason.includes("risk") || reason.includes("ip") || reason.includes("vpn")) {
      cause = "our automated risk system flagged unusual activity on this transaction";
      docs = [
        "A government-issued photo ID (passport / driver's license / national ID)",
        "A screenshot of the PayPal transaction confirmation for this order",
        "A selfie holding your ID (optional, speeds up approval)",
      ];
    } else if (reason.includes("amount") || reason.includes("high") || reason.includes("value") || reason.includes("limit")) {
      cause = "this is a high-value order and requires manual verification before delivery";
      docs = [
        "A government-issued photo ID (passport / driver's license / national ID)",
        "A screenshot of the PayPal transaction confirmation for this order",
        "Proof that the payment method belongs to you (e.g. PayPal account page showing your name)",
      ];
    } else if (reason.includes("new account") || reason.includes("first")) {
      cause = "this is a first purchase from a newly created account";
      docs = [
        "A government-issued photo ID (passport / driver's license / national ID)",
        "A screenshot of the PayPal transaction confirmation for this order",
      ];
    } else {
      cause = "your order is going through a routine security review before we can release the code";
      docs = [
        "A government-issued photo ID (passport / driver's license / national ID)",
        "A screenshot of the PayPal transaction confirmation for this order",
      ];
    }

    const list = docs.map((d, i) => `${i + 1}. ${d}`).join("\n");
    return (
      `Hi${order.buyer_name ? ` ${order.buyer_name}` : ""}! Your order "${order.game_title}" (€${Number(order.price).toFixed(2)}) is on hold because ${cause}.\n\n` +
      `To release your code, please send us the following:\n${list}\n\n` +
      `You can upload the files directly here in this chat using the paperclip button, or reply to our email. ` +
      `Your documents are stored privately and used only to verify this purchase. ` +
      `We usually approve within a few minutes of receiving them.`
    );
  };

  // Held order → ask the buyer for identity proof (chat message + email).
  const handleRequestIdProof = async (order: AdminOrder) => {
    if (!order.is_held && order.status !== "held") {
      toast.error("Identity proof can only be requested for held orders");
      return;
    }
    setIdProofOrderId(order.id);
    try {
      // Generate a one-time upload URL (works for guests too — token, not auth).
      let uploadUrl: string | null = null;
      const { data: linkData, error: linkErr } = await supabase.functions.invoke(
        "id-verification-request",
        { body: { order_id: order.id } },
      );
      if (linkErr || linkData?.error) {
        console.error("ID proof link failed:", linkData?.error || linkErr?.message);
      } else {
        uploadUrl = linkData?.uploadUrl || null;
      }

      const baseMessage = buildIdProofMessage(order);
      const message = uploadUrl
        ? `${baseMessage}\n\n📎 Secure upload link (only you can use it):\n${uploadUrl}`
        : baseMessage;

      let chatDelivered = false;
      if (order.user_id) {
        const chat = await ensureChatRequest(order, message);
        const { error: msgError } = await supabase.from("live_chat_messages").insert({
          request_id: chat.requestId,
          sender_id: adminUser?.id || order.user_id,
          sender_role: "admin",
          content: message,
        });
        if (msgError) {
          console.error("ID proof chat message failed:", msgError.message);
        } else {
          chatDelivered = true;
        }
      }

      let emailDelivered = false;
      if (order.buyer_email) {
        const { data, error } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "order-verification-required",
            recipientEmail: order.buyer_email,
            idempotencyKey: `id-proof-${order.id}-${new Date().toISOString().slice(0, 10)}`,
            templateData: {
              customerName: order.buyer_name || null,
              productTitle: order.game_title,
              orderId: order.paypal_order_id || order.id,
              amount: `€${Number(order.price).toFixed(2)}`,
              verificationMessage: message,
              uploadUrl,
            },
          },
        });
        if (error || data?.error) {
          console.error("ID proof email failed:", data?.error || error?.message);
        } else {
          emailDelivered = true;
        }
      }

      if (!chatDelivered && !emailDelivered) {
        toast.error("Could not deliver the identity verification request");
        return;
      }
      setIdProofSent((prev) => ({ ...prev, [order.id]: true }));
      toast.success(
        `Identity proof requested${chatDelivered ? " in chat" : ""}${chatDelivered && emailDelivered ? " and" : ""}${emailDelivered ? ` by email (${order.buyer_email})` : ""}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to request identity proof");
    } finally {
      setIdProofOrderId(null);
    }
  };

  // Load per-order ID-proof upload counts once orders are known (best-effort).
  // Not scoped to currently-held orders: once an admin approves a hold after
  // reviewing the proof, is_held flips to false and this query would stop
  // finding it — silently hiding the "View ID Proofs" button on an order
  // whose files are still sitting in storage.
  useEffect(() => {
    if (!orders.length) return;
    const orderIds = orders.map(o => o.id);
    (async () => {
      const { data } = await supabase
        .from("order_id_verifications" as any)
        .select("order_id")
        .in("order_id", orderIds) as any;
      const counts: Record<string, number> = {};
      (data || []).forEach((r: any) => { counts[r.order_id] = (counts[r.order_id] || 0) + 1; });
      setProofCounts(counts);
    })();
  }, [orders]);

  const openProofViewer = async (order: AdminOrder) => {
    setProofViewer({ orderId: order.id, title: order.game_title });
    setProofLoading(true);
    setProofFiles([]);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/id-verification-list?order_id=${order.id}`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
            Authorization: `Bearer ${sess?.session?.access_token || ""}`,
          },
        },
      );
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error || "Failed to load files");
      setProofFiles(data?.files || []);

    } catch (e: any) {
      toast.error(e.message || "Failed to load files");
    } finally {
      setProofLoading(false);
    }
  };


  const handleCreateReceipt = async (orderId: string) => {
    setReceiptOrderId(orderId);
    try {
      const { data, error } = await supabase.functions.invoke("generate-receipt", {
        body: { order_id: orderId, language: "he" },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Failed to create receipt");
        return;
      }
      const url = data?.pdf_original;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      toast.success(data?.cached ? "Receipt already exists — opened" : "Hebrew receipt created in Invoice Maven");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create receipt");
    } finally {
      setReceiptOrderId(null);
    }
  };

  const handleSendReviewInvite = async (order: AdminOrder) => {
    if (order.status !== "completed") {
      toast.error("Review links can only be sent for completed orders");
      return;
    }
    if (!order.buyer_email) {
      toast.error("No buyer email on this order");
      return;
    }
    setReviewInviteOrderId(order.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "review-request-trustpilot",
          recipientEmail: order.buyer_email,
          templateData: {
            customerName: order.buyer_name || "there",
            gameTitle: order.game_title,
            rewardLabel: "$2",
          },
          idempotencyKey: `review-invite-${order.id}`,
        },
      });
      if (error) {
        // supabase-js gives a generic FunctionsHttpError on non-2xx responses —
        // the actual { error: "..." } body send-transactional-email sent back
        // is only reachable via error.context (the raw, unconsumed Response).
        let serverMessage: string | null = null;
        try {
          const ctx = (error as any)?.context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.clone().json();
            serverMessage = body?.error || null;
          }
        } catch (parseErr) {
          console.error("Could not parse send-transactional-email error body:", parseErr);
        }
        console.error("send-transactional-email error detail:", serverMessage || error.message);
        toast.error(serverMessage || error.message || "Failed to send review invite");
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      const sentAt = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("orders")
        .update({ review_invite_sent_at: sentAt } as any)
        .eq("id", order.id);
      if (updateError) {
        toast.error(updateError.message || "Email sent, but failed to mark order");
        return;
      }
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, review_invite_sent_at: sentAt } : o)));
      toast.success(`Review invite sent to ${order.buyer_email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send review invite");
    } finally {
      setReviewInviteOrderId(null);
    }
  };

  // Admin confirms the buyer actually posted a Trustpilot review:
  // mint a single-use $2 coupon and email it.
  const handleSendReviewReward = async (order: AdminOrder) => {
    if (order.status !== "completed") {
      toast.error("Vouchers can only be sent for completed orders");
      return;
    }
    if (!order.buyer_email) {
      toast.error("No buyer email on this order");
      return;
    }
    setReviewRewardOrderId(order.id);
    try {
      const code = `REVIEW2-${order.id.replace(/-/g, "").slice(0, 6).toUpperCase()}${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`;
      const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

      const { error: codeError } = await supabase.from("discount_codes").insert({
        code,
        discount_type: "fixed",
        discount_value: 2,
        max_uses: 1,
        expires_at: expiresAt.toISOString(),
        is_active: true,
        created_by: adminUser?.id ?? null,
      } as any);
      if (codeError) {
        toast.error(codeError.message || "Failed to create coupon");
        return;
      }

      const { data, error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "review-reward-voucher",
          recipientEmail: order.buyer_email,
          templateData: {
            customerName: order.buyer_name || "there",
            couponCode: code,
            rewardLabel: "$2",
            expiresOn: expiresAt.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
            shopLink: "https://agevers.com",
          },
          idempotencyKey: `review-reward-${order.id}`,
        },
      });
      if (error) {
        let serverMessage: string | null = null;
        try {
          const ctx = (error as any)?.context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.clone().json();
            serverMessage = body?.error || null;
          }
        } catch (parseErr) {
          console.error("Could not parse send-transactional-email error body:", parseErr);
        }
        toast.error(serverMessage || error.message || "Failed to send voucher");
        return;
      }
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const sentAt = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("orders")
        .update({ review_reward_sent_at: sentAt } as any)
        .eq("id", order.id);
      if (updateError) {
        toast.error(updateError.message || "Voucher sent, but failed to mark order");
        return;
      }
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, review_reward_sent_at: sentAt } : o)));
      toast.success(`$2 voucher ${code} sent to ${order.buyer_email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send voucher");
    } finally {
      setReviewRewardOrderId(null);
    }
  };


  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "list_orders", limit: 200 },
    });

    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Failed to load orders");
      setLoading(false);
      return;
    }

    setOrders((data?.orders || []) as AdminOrder[]);
    setLoading(false);
  };

  const handleDeleteOrder = async (order: AdminOrder) => {
    if (!window.confirm(`Delete order ${order.id.slice(0, 8)} (${order.game_title})? This cannot be undone.`)) return;
    setDeletingOrderId(order.id);
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "delete_order", orderId: order.id },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Failed to delete order");
        return;
      }
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      toast.success("Order deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete order");
    } finally {
      setDeletingOrderId(null);
    }
  };

  useEffect(() => {
    fetchOrders();
    // Keep the stat tiles live: any order or refund change re-pulls the list.
    const channel = supabase
      .channel("admin-orders-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchOrders())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_refunds" }, () => fetchOrders())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter === "refunded_all") {
        if (order.status !== "refunded" && order.status !== "partially_refunded" && order.refunded_total <= 0) return false;
      } else if (statusFilter !== "all" && order.status !== statusFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;

      const query = searchQuery.toLowerCase();
      return [
        order.game_title,
        order.platform,
        order.status,
        order.paypal_order_id || "",
        order.buyer_name || "",
        order.buyer_email || "",
        order.id,
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [orders, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    // An order counts as refunded if its status says so OR money was actually
    // sent back through PayPal (e.g. a "rejected" order that was refunded).
    const isRefunded = (order: AdminOrder) =>
      order.status === "refunded" ||
      order.status === "partially_refunded" ||
      Number(order.refunded_total || 0) > 0;

    return {
      total: orders.length,
      completed: orders.filter((order) => order.status === "completed" && !isRefunded(order)).length,
      refunded: orders.filter(isRefunded).length,
      kinguin: orders.filter((order) => order.source === "kinguin").length,
      // is_held stays true forever once set (it's never reset when an order
      // later gets refunded/resolved another way), so also require the status
      // to still be unresolved — otherwise a refunded order that started as a
      // hold double-counts into both "Refunded" and "On Hold".
      held: orders.filter(
        (order) =>
          order.is_held &&
          order.status !== "completed" &&
          order.status !== "rejected" &&
          !isRefunded(order),
      ).length,
    };
  }, [orders]);

  const getBadgeClasses = (value: string, type: "status" | "source") => {
    if (type === "source") {
      if (value === "kinguin") return "bg-primary/10 text-primary border-primary/20";
      if (value === "manual") return "bg-secondary text-foreground border-border";
      return "bg-destructive/10 text-destructive border-destructive/20";
    }

    if (value === "completed") return "bg-primary/10 text-primary border-primary/20";
    if (value === "refunded") return "bg-destructive/10 text-destructive border-destructive/20";
    if (value === "partially_refunded") return "bg-accent/10 text-accent border-accent/20";
    if (value === "held") return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    if (value === "rejected") return "bg-destructive/10 text-destructive border-destructive/20";
    return "bg-secondary text-foreground border-border";
  };

  const [approvingOrderId, setApprovingOrderId] = useState<string | null>(null);

  const handleApproveOrder = async (orderId: string) => {
    setApprovingOrderId(orderId);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "approve_held_order", orderId },
    });
    setApprovingOrderId(null);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Failed to approve order");
      return;
    }
    toast.success("Order approved and released to buyer");
    fetchOrders();
  };

  const handleRejectOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to reject this order? The buyer won't receive the code and the payment will be refunded automatically.")) return;
    setApprovingOrderId(orderId);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "reject_held_order", orderId },
    });
    setApprovingOrderId(null);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Failed to reject order");
      return;
    }
    if (data?.refund?.error) {
      toast.warning(data?.message || "Order rejected, but the automatic refund failed — refund manually");
    } else {
      toast.success(data?.message || "Order rejected");
    }
    fetchOrders();
  };


  const handleMarkShipped = async (orderId: string) => {
    const trackingNumber = prompt("Enter tracking number:");
    if (!trackingNumber) return;
    const trackingUrl = prompt("Enter tracking URL (optional):", "") || "";
    const carrierName = prompt("Enter carrier name (optional):", "") || "";

    setShippingOrderId(orderId);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: {
        action: "mark_shipped",
        orderId,
        tracking_number: trackingNumber,
        tracking_url: trackingUrl,
        carrier_name: carrierName,
      },
    });
    setShippingOrderId(null);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Failed to mark as shipped");
      return;
    }
    toast.success("Order marked as shipped — customer notified by email");
    fetchOrders();
  };

  const handleBuyAliexpress = async (orderId: string) => {
    if (!confirm("Place an order on AliExpress for this product with the customer's shipping address?")) return;
    setBuyingOrderId(orderId);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "buy_aliexpress", orderId },
    });
    setBuyingOrderId(null);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Failed to place AliExpress order");
      return;
    }
    toast.success(`AliExpress order placed! Order ID: ${data?.aliexpress_order_id}`);
    fetchOrders();
  };

  const handleRefund = async (order: AdminOrder, refundType: "full" | "partial") => {
    if (!order.paypal_order_id) {
      toast.error("This order has no PayPal payment to refund");
      return;
    }

    if (order.remaining_refundable <= 0) {
      toast.error("This order is already fully refunded");
      return;
    }

    let amount: number | undefined;
    if (refundType === "partial") {
      const amountText = prompt("Partial refund amount (EUR):", order.remaining_refundable.toFixed(2));
      if (!amountText) return;
      amount = Number(amountText);

      if (!Number.isFinite(amount) || amount <= 0) {
        toast.error("Invalid refund amount");
        return;
      }

      if (amount > order.remaining_refundable) {
        toast.error("Refund amount exceeds remaining refundable total");
        return;
      }
    }

    const reason = prompt(
      refundType === "full" ? "Reason for full refund (optional):" : "Reason for partial refund (optional):",
      ""
    ) || "";

    setRefundingOrderId(order.id);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: {
        action: "refund_order",
        orderId: order.id,
        refundType,
        amount,
        reason,
        adminNote: reason,
      },
    });

    setRefundingOrderId(null);

    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Refund failed");
      return;
    }

    toast.success(refundType === "full" ? "Full refund completed" : "Partial refund completed");
    fetchOrders();
  };

  const [exportingOrderId, setExportingOrderId] = useState<string | null>(null);

  const handleExportEvidence = async (order: AdminOrder) => {
    setExportingOrderId(order.id);
    try {
      const { data: proofLogs, error } = await supabase
        .from("delivery_proof_logs")
        .select("*")
        .eq("order_id", order.id)
        .order("revealed_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      const proof = proofLogs?.[0];
      const revealTime = proof?.revealed_at ? new Date(proof.revealed_at).toUTCString() : "N/A";
      const termsAccepted = proof?.terms_accepted ? "Yes" : "No record";

      const template = `Subject: Response to Case [DISPUTE_ID] — Digital Goods Delivery Proof

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TRANSACTION DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Transaction ID (PayPal): ${order.paypal_order_id || "N/A"}
Order ID: ${order.id}
Customer Name: ${order.buyer_name || "N/A"}
Customer Email: ${order.buyer_email || "N/A"}
Product: ${order.game_title} (${order.platform})
Amount: €${Number(order.price).toFixed(2)}
Order Date: ${new Date(order.created_at).toUTCString()}
Delivery Status: Delivered (Digital Code Revealed)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROOF OF DELIVERY & SECURITY VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The customer purchased a digital product (Product Key). Our system includes a mandatory 10-minute security "Cooling Period" and explicit delivery confirmation to prevent unauthorized use and fraud.

Identity Verification: The customer's identity was verified via SMS (Twilio) to the phone number associated with the account (${proof?.phone || "on file"}).

Explicit Consent: On ${revealTime}, after the cooling period ended, the customer explicitly checked a mandatory box stating:
"I understand that this digital product is non-refundable once revealed."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIGITAL FINGERPRINT (FORENSIC LOG)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Action: Code Revealed
Timestamp (UTC): ${revealTime}
Customer IP Address: ${proof?.ip_address || order.ip_address || "N/A"}
Device Fingerprint: ${proof?.device_fingerprint || "N/A"}
User Agent: ${proof?.user_agent || order.user_agent || "N/A"}
Geolocation: ${[proof?.city || order.buyer_city, proof?.country || order.buyer_country].filter(Boolean).join(", ") || "N/A"}
Terms Accepted: ${termsAccepted} (Field: terms_accepted = ${proof?.terms_accepted ?? "N/A"})
Code Viewed At: ${order.code_viewed_at ? new Date(order.code_viewed_at).toUTCString() : "N/A"}

Paper Trail: A confirmation email containing these delivery details was sent to the customer's PayPal-verified email address immediately upon reveal.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MERCHANT CONCLUSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The product was successfully delivered and accessed by the customer following a secure verification process. Per our Terms of Service (which the customer accepted at checkout and before reveal), digital goods are non-refundable once the secret key has been exposed.

Generated by Agevers Security System — ${new Date().toUTCString()}
`;

      const blob = new Blob([template], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dispute-evidence-${order.id.slice(0, 8)}.txt`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Evidence exported successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to export evidence");
    } finally {
      setExportingOrderId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <AgeversLoader />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="rounded-xl border-2 border-white/20 bg-black p-4 text-center">
          <Receipt className="mx-auto mb-2 h-5 w-5 text-primary" />
          <p className="text-2xl font-black text-white">{stats.total}</p>
          <p className="text-[10px] uppercase tracking-wider text-white/60">Orders</p>
        </div>
        <div className="rounded-xl border-2 border-white/20 bg-black p-4 text-center">
          <Package className="mx-auto mb-2 h-5 w-5 text-primary" />
          <p className="text-2xl font-black text-white">{stats.completed}</p>
          <p className="text-[10px] uppercase tracking-wider text-white/60">Completed</p>
        </div>
        <div className="rounded-xl border-2 border-white/20 bg-black p-4 text-center">
          <Clock className="mx-auto mb-2 h-5 w-5 text-yellow-500" />
          <p className="text-2xl font-black text-white">{stats.held}</p>
          <p className="text-[10px] uppercase tracking-wider text-white/60">On Hold</p>
        </div>
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "refunded_all" ? "all" : "refunded_all")}
          className={`rounded-xl border-2 bg-black p-4 text-center transition-colors ${
            statusFilter === "refunded_all" ? "border-destructive" : "border-white/20 hover:border-destructive/60"
          }`}
        >
          <RotateCcw className="mx-auto mb-2 h-5 w-5 text-destructive" />
          <p className="text-2xl font-black text-white">{stats.refunded}</p>
          <p className="text-[10px] uppercase tracking-wider text-white/60">Refunded</p>
        </button>
        <div className="rounded-xl border-2 border-white/20 bg-black p-4 text-center">
          <ShieldAlert className="mx-auto mb-2 h-5 w-5 text-primary" />
          <p className="text-2xl font-black text-white">{stats.kinguin}</p>
          <p className="text-[10px] uppercase tracking-wider text-white/60">Kinguin</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by title, buyer, PayPal ID..."
            className="pl-10"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-10 rounded-md border border-border bg-secondary px-3 text-sm text-foreground"
        >
          <option value="all">All statuses</option>
          <option value="refunded_all">💸 REFUND (all refunded)</option>
          <option value="held">🔒 On Hold</option>
          <option value="completed">Completed</option>
          <option value="processing">Processing</option>
          <option value="shipped">🚚 Shipped</option>
          <option value="refunded">Refunded</option>
          <option value="partially_refunded">Partially refunded</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="rounded-xl border-2 border-white/20 bg-black py-16 text-center text-white/60">
          No orders found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border-2 border-white/20">
          <style>{`
            .admin-orders-table tbody tr { background-color: #000000; }
          `}</style>
          <table className="admin-orders-table w-full min-w-[1180px] text-sm">
            <thead className="bg-black">
              <tr className="border-b-2 border-white/20 text-left">
                <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Product</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Buyer</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Source</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Net Profit</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Payment</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Code</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Ordered</th>
                <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground">Refunds</th>
                <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id} className="border-b-2 border-primary align-top">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">{order.game_title}</p>
                    <p className="text-xs text-muted-foreground">{order.platform} • Qty {order.quantity}</p>
                    <p className="text-[11px] text-muted-foreground">{order.id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-foreground">{order.buyer_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{order.buyer_email || order.user_id}</p>
                    {order.ip_address && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Globe className="h-3 w-3" />
                        {order.ip_address}
                        {order.buyer_country && ` • ${order.buyer_country}`}
                        {order.buyer_city && ` / ${order.buyer_city}`}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${getBadgeClasses(order.status, "status")}`}>
                      {order.status.replace(/_/g, " ")}
                    </span>
                    {order.is_held && order.held_until && (
                      <p className="mt-1 text-[10px] text-yellow-500">{order.held_reason}</p>
                    )}
                    {order.refunded_total > 0 && (
                      <span className="mt-1 inline-flex rounded-full border border-destructive/40 bg-destructive/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-destructive">
                        Refund €{order.refunded_total.toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${getBadgeClasses(order.source, "source")}`}>
                      {order.source}
                    </span>
                    {order.kinguin_order_id && (
                      <p className="mt-1 text-[11px] text-muted-foreground">KG #{order.kinguin_order_id}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">€{Number(order.price).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {order.net_profit != null ? (
                      <>
                        <p className={`font-bold ${order.net_profit >= 0 ? "text-neon-green" : "text-destructive"}`}>
                          {order.net_profit >= 0 ? "+" : "-"}€{Math.abs(order.net_profit).toFixed(2)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">Cost: €{Number(order.buy_cost).toFixed(2)}</p>
                      </>
                    ) : (
                      <p className="text-muted-foreground text-xs" title="No purchase cost recorded (manual keys / AliExpress)">—</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${order.payment_method === "crypto" ? "bg-accent/10 text-accent border-accent/20" : "bg-primary/10 text-primary border-primary/20"}`}>
                      {order.payment_method === "crypto" ? "Crypto" : order.payment_method === "paypal" ? "PayPal" : "Unknown"}
                    </span>
                    <p className="mt-1 text-foreground">{order.paypal_order_id || "—"}</p>
                    {order.coins_used > 0 && (
                      <p className="mt-1 text-[11px] font-bold text-orange-500">
                        🪙 {order.coins_used} coins (−€{order.coin_discount_eur.toFixed(2)})
                      </p>
                    )}
                    {order.total_paid != null && (
                      <p className="text-[11px] text-muted-foreground">
                        Paid: {order.total_paid.toFixed(2)} {order.paid_currency || ""}
                      </p>
                    )}
                    {order.payment_source_type && (
                      <p className="text-[11px] text-muted-foreground" title="PayPal doesn't expose how a PayPal-account payment was actually funded (balance vs. a linked card/bank) to merchants — only this top-level distinction.">
                        {order.payment_source_type === "card"
                          ? `💳 Card${order.payment_source_detail ? ` (${order.payment_source_detail})` : ""} — no PayPal account`
                          : "PayPal account"}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground">Remaining: €{order.remaining_refundable.toFixed(2)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${order.game_code ? "bg-primary/10 text-primary border-primary/20" : "bg-secondary text-muted-foreground border-border"}`}>
                      {order.game_code ? (order.codes_viewed ? "Viewed" : "Delivered") : "Missing"}
                    </span>
                    {order.game_code && (
                      <div className="mt-1 max-w-[180px]">
                        {order.game_code.split('\n').map((code, i, arr) => (
                          <p key={i} className="text-[11px] font-mono text-white break-all bg-black border border-white/10 rounded px-1.5 py-0.5 mt-0.5 select-all">
                            {arr.length > 1 && <span className="text-muted-foreground font-sans text-[9px] mr-1">#{i + 1}</span>}
                            {code}
                          </p>
                        ))}
                      </div>
                    )}
                    {order.code_viewed_at && (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Viewed: {new Date(order.code_viewed_at).toLocaleString()}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground">{new Date(order.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {order.refunds.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="space-y-1">
                        {order.refunds.map((refund) => (
                          <div key={refund.id} className="text-[11px] text-muted-foreground">
                            {refund.refund_type}: {refund.amount ? `€${Number(refund.amount).toFixed(2)}` : "—"}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col gap-1.5 items-end">
                      {order.is_held && (
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-primary hover:bg-primary/90"
                            disabled={approvingOrderId === order.id}
                            onClick={() => handleApproveOrder(order.id)}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {approvingOrderId === order.id ? "..." : "Approve"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs"
                            disabled={approvingOrderId === order.id}
                            onClick={() => handleRejectOrder(order.id)}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                      {order.is_held && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10"
                          disabled={idProofOrderId === order.id}
                          onClick={() => handleRequestIdProof(order)}
                          title="Send the buyer the hold reason and the documents needed to verify identity"
                        >
                          <ShieldAlert className="h-3 w-3 mr-1" />
                          {idProofOrderId === order.id
                            ? "Sending..."
                            : idProofSent[order.id]
                              ? "ID Request Sent ✓"
                              : "Request ID Proof"}
                        </Button>
                      )}
                      {(proofCounts[order.id] || 0) > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() => openProofViewer(order)}
                          title="View identity proof uploaded by the buyer (admin only)"
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          View ID Proofs ({proofCounts[order.id]})
                        </Button>
                      )}


                      {/* Buy Product from AliExpress */}
                      {order.source === "aliexpress" && order.status === "processing" && !order.aliexpress_order_id && (
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                            disabled={buyingOrderId === order.id}
                            onClick={() => handleBuyAliexpress(order.id)}
                          >
                            <ShoppingCart className="h-3 w-3 mr-1" />
                            {buyingOrderId === order.id ? "Buying..." : "Auto Buy"}
                          </Button>
                          {order.aliexpress_product_id && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              asChild
                            >
                              <a
                                href={`https://www.aliexpress.com/item/${order.aliexpress_product_id}.html`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Manual
                              </a>
                            </Button>
                          )}
                        </div>
                      )}
                      {/* Mark Shipped (after AliExpress purchase) */}
                      {order.source === "aliexpress" && order.status === "processing" && order.aliexpress_order_id && !order.shipped_at && (
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-orange-600 hover:bg-orange-700 text-white"
                          disabled={shippingOrderId === order.id}
                          onClick={() => handleMarkShipped(order.id)}
                        >
                          <Truck className="h-3 w-3 mr-1" />
                          {shippingOrderId === order.id ? "..." : "Mark Shipped"}
                        </Button>
                      )}
                      {order.aliexpress_order_id && !order.shipped_at && (
                        <div className="text-[10px] text-muted-foreground">
                          AE #{order.aliexpress_order_id}
                        </div>
                      )}
                      {order.shipped_at && (
                        <div className="text-[10px] text-primary">
                          🚚 Shipped {new Date(order.shipped_at).toLocaleDateString()}
                          {order.tracking_number && <p className="font-mono">#{order.tracking_number}</p>}
                        </div>
                      )}
                      {/* Shipping address preview */}
                      {order.shipping_address_line1 && (
                        <div className="text-[10px] text-muted-foreground mt-1">
                          📦 {order.shipping_full_name} — {order.shipping_city}, {order.shipping_country}
                        </div>
                      )}
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs"
                          disabled={!order.paypal_order_id || order.status === "refunded" || order.remaining_refundable <= 0 || refundingOrderId === order.id}
                          onClick={() => handleRefund(order, "full")}
                        >
                          {refundingOrderId === order.id ? "..." : "Refund"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={!order.paypal_order_id || order.status === "refunded" || order.remaining_refundable <= 0 || refundingOrderId === order.id}
                          onClick={() => handleRefund(order, "partial")}
                        >
                          Partial
                        </Button>
                      </div>
                      {order.codes_viewed && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={exportingOrderId === order.id}
                          onClick={() => handleExportEvidence(order)}
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          {exportingOrderId === order.id ? "..." : "Export Evidence"}
                        </Button>
                      )}
                      {order.status === "completed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-primary/40 text-primary hover:bg-primary/10"
                          disabled={receiptOrderId === order.id}
                          onClick={() => handleCreateReceipt(order.id)}
                          title="צור קבלה בעברית ב-Invoice Maven"
                        >
                          <Receipt className="h-3 w-3 mr-1" />
                          {receiptOrderId === order.id ? "..." : "Create Receipt (HE)"}
                        </Button>
                      )}
                      {order.user_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-accent/40 text-accent hover:bg-accent/10"
                          disabled={openingChatOrderId === order.id || !adminUser}
                          onClick={() => handleOpenBuyerChat(order)}
                          title="Open an internal live chat with the buyer"
                        >
                          <MessageCircle className="h-3 w-3 mr-1" />
                          {openingChatOrderId === order.id ? "..." : "Open Chat"}
                        </Button>
                      )}
                      {order.buyer_email && order.status === "completed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className={
                            order.review_invite_sent_at
                              ? "h-7 text-xs opacity-50 cursor-not-allowed"
                              : "h-7 text-xs border-yellow-500/40 text-yellow-500 hover:bg-yellow-500/10"
                          }
                          disabled={!!order.review_invite_sent_at || reviewInviteOrderId === order.id}
                          onClick={() => handleSendReviewInvite(order)}
                          title={
                            order.review_invite_sent_at
                              ? `Review invite sent ${new Date(order.review_invite_sent_at).toLocaleString()}`
                              : "Email the buyer a Trustpilot review link"
                          }
                        >
                          <Star className="h-3 w-3 mr-1" />
                          {order.review_invite_sent_at
                            ? "Review Sent ✓"
                            : reviewInviteOrderId === order.id
                              ? "..."
                              : "Send Review Link"}
                        </Button>
                      )}
                      {order.buyer_email && order.review_invite_sent_at && (
                        <Button
                          size="sm"
                          variant="outline"
                          className={
                            order.review_reward_sent_at
                              ? "h-7 text-xs opacity-50 cursor-not-allowed"
                              : "h-7 text-xs border-green-500/40 text-green-500 hover:bg-green-500/10"
                          }
                          disabled={!!order.review_reward_sent_at || reviewRewardOrderId === order.id}
                          onClick={() => handleSendReviewReward(order)}
                          title={
                            order.review_reward_sent_at
                              ? `$2 voucher sent ${new Date(order.review_reward_sent_at).toLocaleString()}`
                              : "Buyer posted a review — create and email a single-use $2 coupon"
                          }
                        >
                          <Star className="h-3 w-3 mr-1" />
                          {order.review_reward_sent_at
                            ? "Voucher Sent ✓"
                            : reviewRewardOrderId === order.id
                              ? "..."
                              : "Reviewed → $2 Coupon"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-destructive/50 text-destructive hover:bg-destructive/10"
                        disabled={deletingOrderId === order.id}
                        onClick={() => handleDeleteOrder(order)}
                        title="Delete this order permanently"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        {deletingOrderId === order.id ? "..." : "Delete"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeChat && adminUser && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-[420px] max-w-full h-[600px] max-h-[90vh] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <LiveChatPanel
              requestId={activeChat.requestId}
              currentUserId={adminUser.id}
              currentRole="admin"
              userEmail={activeChat.email}
              onClose={() => setActiveChat(null)}
            />
          </div>
        </div>
      )}

      {proofViewer && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setProofViewer(null)}
        >
          <div
            className="w-[720px] max-w-full max-h-[85vh] overflow-y-auto bg-background border border-border rounded-2xl shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="font-display font-bold text-foreground">Identity Verification Files</h3>
                <p className="text-xs text-muted-foreground">{proofViewer.title}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setProofViewer(null)}>
                <XCircle className="h-4 w-4" />
              </Button>
            </div>

            {proofLoading ? (
              <div className="py-10 flex justify-center"><AgeversLoader /></div>
            ) : proofFiles.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No files uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {proofFiles.map((f: any) => (
                  <div key={f.id} className="border border-border rounded-lg p-3 bg-secondary/40">
                    {String(f.file_type || "").startsWith("image/") ? (
                      <a href={f.signed_url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={f.signed_url}
                          alt={f.file_name}
                          className="w-full h-40 object-cover rounded-md mb-2 hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ) : (
                      <div className="h-40 flex items-center justify-center rounded-md bg-muted mb-2">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <p className="text-xs text-foreground truncate">{f.file_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(f.created_at).toLocaleString()} • {Math.round((f.file_size || 0) / 1024)} KB
                    </p>
                    {f.uploader_ip && (
                      <p className="text-[10px] text-muted-foreground">IP: {f.uploader_ip}</p>
                    )}
                    <a
                      href={f.signed_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 mt-1"
                    >
                      <ExternalLink className="h-3 w-3" /> Open / Download
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>

  );
};

export default AdminOrders;
