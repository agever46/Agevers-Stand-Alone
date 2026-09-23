import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import SellerSidebar, { type SellerSection } from "@/components/seller/SellerSidebar";
import SellerProducts from "@/components/seller/SellerProducts";
import SellerRequests from "@/components/seller/SellerRequests";
import SellerOverview from "@/components/seller/SellerOverview";
import SellerSales from "@/components/seller/SellerSales";
import SellerSettings from "@/components/seller/SellerSettings";
import SellerTickets from "@/components/seller/SellerTickets";
import SellerFavorites from "@/components/seller/SellerFavorites";
import SellerReviewsManager from "@/components/seller/SellerReviewsManager";
import SellerWithdrawals from "@/components/seller/SellerWithdrawals";
import { Package, ShoppingCart, Key, Settings } from "lucide-react";
import AgeversLoader from "@/components/AgeversLoader";

interface Product {
  id: string;
  title: string;
  platform: string;
  store: string;
  price: number;
  original_price: number | null;
  image_url: string | null;
  game_code: string | null;
  category: string;
  status: string;
  created_at: string;
}

interface ProductRequest {
  id: string;
  title: string;
  platform: string;
  store: string;
  region: string;
  description: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
}

const SellerDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSeller, setIsSeller] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeSection, setActiveSection] = useState<SellerSection>(
    (location.state as any)?.section || "overview"
  );

  // Update section when navigating from navbar dropdown
  useEffect(() => {
    const section = (location.state as any)?.section;
    if (section) setActiveSection(section);
  }, [location.state]);

  const [products, setProducts] = useState<Product[]>([]);
  const [allowedProductsData, setAllowedProductsData] = useState<{ id: string; title: string; platform: string; store: string; region: string; image_url: string | null; description: string | null }[]>([]);
  const [kinguinLinkedIds, setKinguinLinkedIds] = useState<Record<string, { kinguin_stock: number | null; sell_price: number }>>({});
  const [productRequests, setProductRequests] = useState<ProductRequest[]>([]);
  const [openTicketCount, setOpenTicketCount] = useState(0);
  const [withdrawalUpdateCount, setWithdrawalUpdateCount] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    // user_roles has no direct SELECT grant (by design), so role checks go
    // through check_my_role() instead of a table query. check_my_role treats
    // super_admin as satisfying any role check, matching how the rest of the
    // app already treats super_admin as a superset of admin.
    Promise.all([
      supabase.rpc("check_my_role" as any, { _role: "seller" }),
      supabase.rpc("check_my_role" as any, { _role: "admin" }),
    ]).then(([sellerRes, adminRes]: any[]) => {
      const hasSeller = sellerRes.data ?? false;
      const hasAdmin = adminRes.data ?? false;
      if (!hasSeller && hasAdmin) { navigate("/admin"); return; }
      if (!hasSeller) { navigate("/"); return; }
      setIsSeller(true);
      setIsAdmin(hasAdmin);
      setLoading(false);
      fetchProducts();
      fetchAllowedTitles();
      fetchProductRequests();
      fetchOpenTicketCount();
      fetchWithdrawalUpdates();
      if (hasAdmin) fetchKinguinLinks();

      // Realtime for withdrawal updates
      const channel = supabase
        .channel("seller-withdrawal-updates")
        .on("postgres_changes", { event: "*", schema: "public", table: "withdrawal_requests" }, () => {
          fetchWithdrawalUpdates();
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    });
  }, [user, authLoading]);

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("*").eq("seller_id", user!.id).order("created_at", { ascending: false });
    if (data) setProducts(data);
  };

  const fetchAllowedTitles = async () => {
    const { data } = await supabase.from("allowed_products").select("id, title, platform, store, region, image_url, description").order("title");
    if (data) setAllowedProductsData(data as any);
  };

  const fetchKinguinLinks = async () => {
    const { data } = await supabase.from("kinguin_products").select("allowed_product_id, kinguin_stock, sell_price").eq("is_active", true);
    if (data) {
      const map: Record<string, { kinguin_stock: number | null; sell_price: number }> = {};
      (data as any).forEach((kp: any) => { map[kp.allowed_product_id] = { kinguin_stock: kp.kinguin_stock, sell_price: kp.sell_price }; });
      setKinguinLinkedIds(map);
    }
  };

  const fetchProductRequests = async () => {
    const { data } = await supabase.from("product_requests").select("*").eq("requested_by", user!.id).order("created_at", { ascending: false });
    if (data) setProductRequests(data as any);
  };

  const fetchOpenTicketCount = async () => {
    const { count } = await supabase
      .from("support_tickets" as any)
      .select("*", { count: "exact", head: true })
      .eq("seller_id", user!.id)
      .eq("status", "open") as any;
    setOpenTicketCount(count || 0);
  };

  const fetchWithdrawalUpdates = async () => {
    const { count } = await supabase
      .from("withdrawal_requests")
      .select("*", { count: "exact", head: true })
      .eq("seller_id", user!.id)
      .neq("status", "pending")
      .eq("seller_seen", false);
    setWithdrawalUpdateCount(count || 0);
  };

  const markWithdrawalsSeen = async () => {
    const { data: unseen } = await supabase
      .from("withdrawal_requests")
      .select("id")
      .eq("seller_id", user!.id)
      .eq("seller_seen", false)
      .neq("status", "pending");
    if (unseen) {
      await Promise.all(
        unseen.map((w: any) =>
          supabase.rpc("mark_withdrawal_seen" as any, { _withdrawal_id: w.id })
        )
      );
    }
    setWithdrawalUpdateCount(0);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <AgeversLoader />
      </div>
    );
  }

  if (!isSeller) return null;

  const renderContent = () => {
    switch (activeSection) {
      case "overview":
        return <SellerOverview products={products} onViewSelling={() => setActiveSection("products")} onEditProfile={() => setActiveSection("settings")} />;
      case "products":
        return (
          <SellerProducts
            products={products}
            allowedProductsData={allowedProductsData}
            kinguinLinkedIds={kinguinLinkedIds}
            isAdmin={isAdmin}
            onRefresh={fetchProducts}
          />
        );
      case "sales":
        return <SellerSales />;
      case "withdrawals":
        return <SellerWithdrawals />;
      case "reviews":
        return <SellerReviewsManager />;
      case "orders":
        return (
          <div className="text-center py-20">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="font-display text-2xl font-black tracking-wider text-foreground mb-2">ORDERS</h2>
            <p className="text-muted-foreground">Your order history will appear here.</p>
          </div>
        );
      case "keys":
        return (
          <div className="text-center py-20">
            <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="font-display text-2xl font-black tracking-wider text-foreground mb-2">KEYS LIBRARY</h2>
            <p className="text-muted-foreground">Manage your game keys inventory here.</p>
          </div>
        );
      case "requests":
        return <SellerRequests productRequests={productRequests} onRefresh={fetchProductRequests} />;
      case "tickets":
        return <SellerTickets />;
      case "favorites":
        return <SellerFavorites />;
      case "settings":
        return <SellerSettings />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex flex-1">
        <SellerSidebar activeSection={activeSection} onSectionChange={(s) => { setActiveSection(s); if (s === "withdrawals") markWithdrawalsSeen(); }} openTicketCount={openTicketCount} withdrawalUpdateCount={withdrawalUpdateCount} />
        <main className="flex-1 p-8 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default SellerDashboard;
