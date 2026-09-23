import { Package, ShoppingCart, Send, Settings, Key, Store, ChevronDown, ChevronRight, LogOut, Plus, User, Receipt, Home, MessageSquare, Heart, Star, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

export type SellerSection = "overview" | "products" | "sales" | "withdrawals" | "requests" | "orders" | "keys" | "settings" | "tickets" | "favorites" | "reviews";

interface SellerSidebarProps {
  activeSection: SellerSection;
  onSectionChange: (section: SellerSection) => void;
  openTicketCount?: number;
  withdrawalUpdateCount?: number;
}

const SellerSidebar = ({ activeSection, onSectionChange, openTicketCount = 0, withdrawalUpdateCount = 0 }: SellerSidebarProps) => {
  const { signOut } = useAuth();
  const [openGroup, setOpenGroup] = useState<string | null>("account");

  const accountSubItems: { id: SellerSection; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: User },
    { id: "orders", label: "Orders", icon: ShoppingCart },
    { id: "favorites", label: "Favorites", icon: Heart },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const sellingSubItems: { id: SellerSection; label: string; icon: React.ElementType }[] = [
    { id: "products", label: "My Products", icon: Package },
    { id: "sales", label: "My Sales", icon: Receipt },
    { id: "withdrawals", label: "Withdrawals", icon: Wallet },
    { id: "reviews", label: "My Reviews", icon: Star },
    { id: "tickets", label: "Support Tickets", icon: MessageSquare },
    { id: "requests", label: "Ask for New Product", icon: Plus },
  ];

  const otherItems: { id: SellerSection; label: string; icon: React.ElementType }[] = [
    { id: "keys", label: "Keys Library", icon: Key },
  ];

  const renderItem = (item: { id: SellerSection; label: string; icon: React.ElementType }, indent = false, insideOpen = false, extraClick?: () => void) => {
    const Icon = item.icon;
    const isActive = activeSection === item.id;
    return (
      <button
        key={item.id}
        onClick={() => { extraClick?.(); onSectionChange(item.id); }}
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
        <span className="font-display tracking-wide">{item.label}</span>
        {item.id === "tickets" && openTicketCount > 0 && (
          <span className="ml-auto h-5 min-w-[20px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
            {openTicketCount}
          </span>
        )}
        {item.id === "withdrawals" && withdrawalUpdateCount > 0 && (
          <span className="ml-auto h-5 min-w-[20px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
            {withdrawalUpdateCount}
          </span>
        )}
        {isActive && item.id !== "tickets" && item.id !== "withdrawals" && <ChevronRight className="h-4 w-4 ml-auto" />}
        {isActive && (item.id === "tickets" || item.id === "withdrawals") && openTicketCount === 0 && withdrawalUpdateCount === 0 && <ChevronRight className="h-4 w-4 ml-auto" />}
      </button>
    );
  };

  const renderGroup = (label: string, icon: React.ElementType, isOpen: boolean, toggle: () => void, items: { id: SellerSection; label: string; icon: React.ElementType }[], badgeCount = 0) => {
    const GroupIcon = icon;
    return (
      <div className={cn("rounded-lg transition-all duration-200", isOpen && "bg-white/20")}>
        <button
          onClick={toggle}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3.5 rounded-lg text-sm font-medium transition-all",
            isOpen
              ? "text-white"
              : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
          )}
        >
          <GroupIcon className="h-5 w-5 shrink-0" />
          <span className="font-display tracking-wide">{label}</span>
          {!isOpen && badgeCount > 0 && (
            <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {badgeCount}
            </span>
          )}
          <ChevronDown className={cn("h-4 w-4 ml-auto transition-transform", isOpen && "rotate-180")} />
        </button>
        {isOpen && (
          <div className="space-y-0.5 pb-2">
            {items.map((item) => renderItem(item, true, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="w-64 h-[calc(100vh-7.5rem)] sticky top-[7.5rem] bg-background flex flex-col shrink-0 border-r border-border overflow-y-auto">
      {/* Logo */}
      <div className="px-6 py-4 flex items-center justify-center bg-white rounded-lg mx-3 mt-1">
        <Link to="/">
          <img src={logo} alt="Agever" className="h-24 w-auto object-contain" />
        </Link>
      </div>

      {/* Back to Store */}
      <div className="px-3 pt-1">
        <Link
          to="/"
          className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive transition-all"
        >
          <Home className="h-5 w-5 shrink-0" />
          <span className="font-display tracking-wide">Back to Store</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {renderGroup("My Account", User, openGroup === "account", () => setOpenGroup(openGroup === "account" ? null : "account"), accountSubItems)}
        {renderGroup("Selling", Store, openGroup === "selling", () => setOpenGroup(openGroup === "selling" ? null : "selling"), sellingSubItems, openTicketCount)}
        {otherItems.map((item) => renderItem(item, false, false, () => setOpenGroup(null)))}
      </nav>

      {/* Bottom section */}
      <div className="px-3 py-4 border-t border-border space-y-1">
        <button
          onClick={async () => { await signOut(); }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span className="font-display tracking-wide">Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default SellerSidebar;
