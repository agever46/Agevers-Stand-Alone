import { ShoppingCart, Settings, ChevronDown, ChevronRight, LogOut, User, Home, MessageSquare, Heart, Shield, Store, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

export type AccountSection = "overview" | "orders" | "favorites" | "achievements" | "tickets" | "settings";

interface AccountSidebarProps {
  activeSection: AccountSection;
  onSectionChange: (section: AccountSection) => void;
  openTicketCount?: number;
}

const AccountSidebar = ({ activeSection, onSectionChange, openTicketCount = 0 }: AccountSidebarProps) => {
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  const [openGroup, setOpenGroup] = useState<string | null>("account");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSeller, setIsSeller] = useState(false);

  useEffect(() => {
    if (!user) return;
    // user_roles has no direct SELECT grant (by design), so role checks go
    // through check_my_role() instead of a table query.
    supabase.rpc("check_my_role" as any, { _role: "admin" }).then(({ data }) => setIsAdmin((data as any) ?? false));
    supabase.rpc("check_my_role" as any, { _role: "seller" }).then(({ data }) => setIsSeller((data as any) ?? false));
  }, [user]);

  const accountSubItems: { id: AccountSection; labelKey: string; icon: React.ElementType }[] = [
    { id: "overview", labelKey: "account.sidebar.overview", icon: User },
    { id: "orders", labelKey: "account.sidebar.orders", icon: ShoppingCart },
    { id: "favorites", labelKey: "account.sidebar.wishlist", icon: Heart },
    { id: "achievements", labelKey: "account.sidebar.achievements", icon: Trophy },
    { id: "tickets", labelKey: "account.sidebar.mySupport", icon: MessageSquare },
    { id: "settings", labelKey: "account.sidebar.settings", icon: Settings },
  ];

  const renderItem = (item: { id: AccountSection; labelKey: string; icon: React.ElementType }, indent = false, insideOpen = false) => {
    const Icon = item.icon;
    const isActive = activeSection === item.id;
    return (
      <button
        key={item.id}
        onClick={() => onSectionChange(item.id)}
        className={cn(
          "w-full flex items-center gap-3 py-3 rounded-lg text-sm font-medium transition-all duration-200",
          indent ? "px-8" : "px-4",
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : insideOpen
              ? "text-white/70 hover:bg-white/10 hover:text-white"
              : "text-muted-foreground hover:bg-accent/20 hover:text-accent-foreground"
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="font-display tracking-wide text-xs leading-tight">{t(item.labelKey)}</span>
        {item.id === "tickets" && openTicketCount > 0 && (
          <span className="ml-auto h-5 min-w-[20px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
            {openTicketCount}
          </span>
        )}
        {isActive && item.id !== "tickets" && <ChevronRight className="h-4 w-4 ml-auto" />}
      </button>
    );
  };

  const isOpen = openGroup === "account";

  return (
    <aside className="w-64 h-screen sticky top-0 bg-background flex flex-col shrink-0 border-r border-border overflow-y-auto z-40">
      <div className="px-6 py-4 flex items-center justify-center bg-white rounded-lg mx-3 mt-1">
        <Link to="/">
          <img src={logo} alt="Agever" className="h-24 w-auto object-contain" />
        </Link>
      </div>

      <div className="px-3 pt-1 space-y-1">
        <Link
          to="/"
          className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive transition-all"
        >
          <Home className="h-5 w-5 shrink-0" />
          <span className="font-display tracking-wide">{t("account.sidebar.backToStore")}</span>
        </Link>
        {isAdmin && (
          <Link
            to="/admin"
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 transition-all"
          >
            <Shield className="h-5 w-5 shrink-0" />
            <span className="font-display tracking-wide">{t("account.sidebar.adminPanel")}</span>
          </Link>
        )}
        {isSeller && !isAdmin && (
          <Link
            to="/seller"
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 transition-all"
          >
            <Store className="h-5 w-5 shrink-0" />
            <span className="font-display tracking-wide">{t("account.sidebar.sellerDashboard")}</span>
          </Link>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <div className={cn("rounded-lg transition-all duration-200", isOpen && "bg-white/20")}>
          <button
            onClick={() => setOpenGroup(isOpen ? null : "account")}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3.5 rounded-lg text-sm font-medium transition-all",
              isOpen
                ? "text-white"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
            )}
          >
            <User className="h-5 w-5 shrink-0" />
            <span className="font-display tracking-wide">{t("account.sidebar.myAccount")}</span>
            {!isOpen && openTicketCount > 0 && (
              <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {openTicketCount}
              </span>
            )}
            <ChevronDown className={cn("h-4 w-4 ml-auto transition-transform", isOpen && "rotate-180")} />
          </button>
          {isOpen && (
            <div className="space-y-0.5 pb-2">
              {accountSubItems.map((item) => renderItem(item, true, true))}
              <button
                onClick={async (e) => { e.stopPropagation(); await signOut(); }}
                className="w-full flex items-center gap-3 px-8 py-3 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all duration-200"
              >
                <LogOut className="h-5 w-5 shrink-0" />
                <span className="font-display tracking-wide">{t("account.sidebar.signOut")}</span>
              </button>
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
};

export default AccountSidebar;
