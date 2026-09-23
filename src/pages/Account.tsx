import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import logo from "@/assets/logo.png";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNoIndex } from "@/hooks/useNoIndex";
import { Gamepad2 } from "lucide-react";
import AccountSidebar, { type AccountSection } from "@/components/account/AccountSidebar";
import AccountOverview from "@/components/account/AccountOverview";
import AccountOrders from "@/components/account/AccountOrders";
import AccountTickets from "@/components/account/AccountTickets";
import AccountSettings from "@/components/account/AccountSettings";
import AccountAchievements from "@/components/account/AccountAchievements";
import SellerFavorites from "@/components/seller/SellerFavorites";
import { useTranslation } from "react-i18next";

const Account = () => {
  useNoIndex();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  // Map old tab names to new section names
  const stateSection = (location.state as any)?.section || (location.state as any)?.tab;
  const mapSection = (s: string | undefined): AccountSection => {
    if (s === "wishlist" || s === "favorites") return "favorites";
    if (s === "profile") return "overview";
    if (s === "orders" || s === "tickets" || s === "settings" || s === "achievements") return s as AccountSection;
    return "overview";
  };

  const [activeSection, setActiveSection] = useState<AccountSection>(mapSection(stateSection));
  const [overviewKey, setOverviewKey] = useState(0);
  const handleSectionChange = (section: AccountSection) => {
    if (section === "overview") setOverviewKey(k => k + 1);
    setActiveSection(section);
  };
  const [openTicketCount, setOpenTicketCount] = useState(0);

  useEffect(() => {
    const section = (location.state as any)?.section || (location.state as any)?.tab;
    if (section) setActiveSection(mapSection(section));
  }, [location.state]);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    const fromAdmin = (location.state as any)?.fromAdmin;

    const ticketCountPromise = (supabase.from("support_tickets" as any)
      .select("*", { count: "exact", head: true })
      .eq("buyer_id", user.id)
      .eq("status", "open") as any);

    if (fromAdmin) {
      ticketCountPromise.then(({ count }: any) => setOpenTicketCount(count || 0));
      return;
    }

    // user_roles has no direct SELECT grant (by design), so role checks go
    // through check_my_role() instead of a table query.
    Promise.all([
      supabase.rpc("check_my_role" as any, { _role: "seller" }),
      supabase.rpc("check_my_role" as any, { _role: "admin" }),
      ticketCountPromise,
    ]).then(([sellerRes, adminRes, ticketsRes]: any[]) => {
      const isSeller = sellerRes.data ?? false;
      const isAdminOrSuper = adminRes.data ?? false; // check_my_role('admin') is already true for super_admin too
      if (!stateSection && isSeller && !isAdminOrSuper) {
        navigate("/seller", { state: { section: mapSection(stateSection) } });
      }
      setOpenTicketCount(ticketsRes.count || 0);
    });
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Gamepad2 className="h-10 w-10 text-primary animate-pulse-glow" />
      </div>
    );
  }

  const renderContent = () => {
    switch (activeSection) {
      case "overview":
        return <AccountOverview key={overviewKey} onNavigate={handleSectionChange} />;
      case "orders":
        return <AccountOrders />;
      case "favorites":
        return <SellerFavorites />;
      case "achievements":
        return <AccountAchievements />;
      case "tickets":
        return <AccountTickets />;
      case "settings":
        return <AccountSettings />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Mobile header */}
      <div className="md:hidden flex items-center gap-2 p-4 border-b border-border bg-background sticky top-0 z-40">
        <Link to="/">
          <img src={logo} alt="Agever" className="h-10 w-auto" />
        </Link>
        <div className="flex-1" />
        <select
          value={activeSection}
          onChange={(e) => handleSectionChange(e.target.value as AccountSection)}
          className="bg-card text-foreground border border-border rounded-lg px-3 py-2 text-sm font-display"
        >
          <option value="overview">{t("account.sidebar.overview")}</option>
          <option value="orders">{t("account.sidebar.orders")}</option>
          <option value="favorites">{t("account.sidebar.wishlist")}</option>
          <option value="achievements">{t("account.sidebar.achievements")}</option>
          <option value="tickets">{t("account.sidebar.mySupport")}{openTicketCount > 0 ? ` (${openTicketCount})` : ''}</option>
          <option value="settings">{t("account.sidebar.settings")}</option>
        </select>
      </div>

      <div className="flex flex-1">
        <div className="hidden md:block">
          <AccountSidebar activeSection={activeSection} onSectionChange={handleSectionChange} openTicketCount={openTicketCount} />
        </div>
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Account;
