import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNoIndex } from "@/hooks/useNoIndex";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Shield,
  Trash2,
  UserPlus,
  KeyRound,
  Mail,
  CheckCircle,
  ShieldCheck,
  Store,
  X,
  Loader2,
  LogOut,
  Plus,
  Package,
  Pencil,
  Inbox,
  CheckCircle2,
  XCircle,
  ClipboardList,
  AlertTriangle } from
"lucide-react";
import { Coins, Gamepad2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { KinguinManager } from "@/components/admin/KinguinManager";
import AgeverBot from "@/components/admin/AgeverBot";
import { Crown, Users, MessageSquare, Wand2 } from "lucide-react";
import { Clock } from "lucide-react";
import AdminNavButtons from "@/components/admin/AdminNavButtons";
import LiveChatPanel from "@/components/LiveChatPanel";

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  email_confirmed_at: string | null;
  email_verified?: boolean;
  last_sign_in_at: string | null;
  roles: string[];
  username?: string | null;
  is_blocked?: boolean;
  is_online?: boolean;
  new_account_limit_exempt?: boolean;
  new_account_limit_cap?: number | null;
}

interface UserDetails {
  profile: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    address: string | null;
    phone: string | null;
  } | null;
  orders: {
    id: string;
    game_title: string;
    platform: string;
    price: number;
    status: string;
    game_code: string | null;
    created_at: string;
  }[];
  wishlist: {
    id: string;
    game_title: string;
    platform: string;
    price: number | null;
    image_url: string | null;
    created_at: string;
  }[];
  roles: string[];
}

interface EditingProfile {
  username: string;
  display_name: string;
  phone: string;
  address: string;
  email: string;
}

import { usePlatformCategories } from "@/hooks/usePlatformCategories";

const Admin = () => {
  useNoIndex();
  const { subPlatformMap: SUB_PLATFORM_MAP, getSubPlatforms } = usePlatformCategories();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isSeller, setIsSeller] = useState(false);
  const [expiringProducts, setExpiringProducts] = useState<{id: string; title: string; expiration_date: string}[]>([]);

  // Create user modal
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);
  const [newAvatarPreview, setNewAvatarPreview] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Reset password modal
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  // Admin-initiated live chat with a user
  const [activeChatUser, setActiveChatUser] = useState<{ id: string; email: string; requestId: string } | null>(null);

  const startChatWithUser = async (targetUser: AdminUser) => {
    if (!user) return;
    try {
      const { data: existing } = await supabase
        .from("live_support_requests" as any)
        .select("id, status")
        .eq("user_id", targetUser.id)
        .in("status", ["pending", "active"])
        .order("created_at", { ascending: false })
        .limit(1) as any;

      let request: any = existing?.[0];
      if (!request) {
        const { data: created, error } = await supabase
          .from("live_support_requests" as any)
          .insert({
            user_id: targetUser.id,
            user_email: targetUser.email,
            status: "active",
            initiated_by: "admin",
          } as any)
          .select()
          .single() as any;
        if (error || !created) {
          toast.error("Could not start live chat");
          return;
        }
        request = created;
      } else if (request.status !== "active") {
        await supabase
          .from("live_support_requests" as any)
          .update({ status: "active" } as any)
          .eq("id", request.id);
      }

      setActiveChatUser({ id: targetUser.id, email: targetUser.email, requestId: request.id });

      // Notify the user by email — unlike the ticket-initiated flow, this
      // request is created with no prior action from the user, so without
      // this they have no way to know a chat is waiting for them if they
      // aren't already on the site with the widget's realtime channel alive.
      supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "live-chat-invite",
          recipientEmail: targetUser.email,
          idempotencyKey: `live-chat-invite-admin-${targetUser.id}-${request.id}`,
          templateData: {},
        },
      }).catch((e) => console.error("Failed to send live-chat invite email", e));

      toast.success(`Live chat opened with ${targetUser.email}`);
    } catch (e: any) {
      toast.error(e?.message || "Could not start live chat");
    }
  };

  // User detail panel
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [editingProfile, setEditingProfile] = useState<EditingProfile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [coinsToAdd, setCoinsToAdd] = useState("");
  const [playsToAdd, setPlaysToAdd] = useState("");
  const [grantingCoins, setGrantingCoins] = useState(false);
  const [grantingPlays, setGrantingPlays] = useState(false);
  const [userCoinsBalance, setUserCoinsBalance] = useState<number | null>(null);
  const [userPlaysRemaining, setUserPlaysRemaining] = useState<number | null>(null);
  const [userFreePlaysLeft, setUserFreePlaysLeft] = useState<number | null>(null);
  const [freePlaysInput, setFreePlaysInput] = useState("");
  const [grantingFreePlays, setGrantingFreePlays] = useState(false);
  const [loadingCoinsPlays, setLoadingCoinsPlays] = useState(false);

  // Multi-select
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [usersTab, setUsersTab] = useState<"active" | "blocked">("active");

  // Allowed products
  const [showProducts, setShowProducts] = useState(false);
  const [allowedProducts, setAllowedProducts] = useState<{id: string;title: string;platform: string;store: string;region: string;image_url: string | null;description: string | null;description_paraphrased: boolean;}[]>([]);
  const [newProductTitle, setNewProductTitle] = useState("");
  const [newProductPlatform, setNewProductPlatform] = useState("PC");
  const [newProductImage, setNewProductImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [newProductDescription, setNewProductDescription] = useState("");
  const [newProductRegion, setNewProductRegion] = useState("Global");
  const [newProductStore, setNewProductStore] = useState("Steam");
  const [addingProduct, setAddingProduct] = useState(false);
  const [generatingDescriptions, setGeneratingDescriptions] = useState(false);

  // Edit product
  const [editingProduct, setEditingProduct] = useState<{id: string;title: string;platform: string;store: string;region: string;image_url: string | null;description: string | null;} | null>(null);
  const [originalProduct, setOriginalProduct] = useState<{title: string;platform: string;store: string;} | null>(null);
  const [editProductImage, setEditProductImage] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);

  // Product requests
  const [productRequests, setProductRequests] = useState<{id: string;title: string;platform: string;store: string;region: string;description: string | null;status: string;admin_note: string | null;created_at: string;requested_by: string;}[]>([]);
  const [showRequests, setShowRequests] = useState(false);

  // Seller applications
  const [sellerApps, setSellerApps] = useState<any[]>([]);
  const [showSellerApps, setShowSellerApps] = useState(false);
  const [showKinguin, setShowKinguin] = useState(false);
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [sellerProducts, setSellerProducts] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  // Refresh online status every 30s without reloading the full user list
  useEffect(() => {
    if (!isAdmin) return;
    const refreshOnline = async () => {
      const sinceIso = new Date(Date.now() - 3 * 60 * 1000).toISOString();
      const { data: onlineRows } = await supabase
        .from("page_views")
        .select("user_id")
        .gte("created_at", sinceIso)
        .not("user_id", "is", null);
      const onlineSet = new Set((onlineRows || []).map((r: any) => r.user_id));
      setUsers((prev) => prev.map((u) => ({ ...u, is_online: onlineSet.has(u.id) })));
    };
    const id = setInterval(refreshOnline, 30_000);
    return () => clearInterval(id);
  }, [isAdmin]);

  useEffect(() => {
    if (user) {
      checkAdminAndLoad();
      fetchProductRequests();
      fetchSellerApps();
      fetchExpiringProducts();
      // user_roles has no direct SELECT grant (by design), so role checks go
      // through security-definer functions instead of a table query.
      supabase.rpc("check_my_role" as any, { _role: "seller" }).then(({ data }) => setIsSeller((data as any) || false));
      supabase.rpc("check_my_role" as any, { _role: "admin" }).then(({ data }) => setIsAdmin((data as any) || false));
      supabase.rpc("is_super_admin" as any, { _user_id: user.id }).then(({ data }) => setIsSuperAdmin((data as any) || false));
    }
  }, [user]);

  // Lazy-load the heavy allowed_products list only when the admin opens that section
  useEffect(() => {
    if (user && showProducts && allowedProducts.length === 0) {
      fetchAllowedProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, showProducts]);


  const fetchExpiringProducts = async () => {
    const { data } = await supabase
      .from("allowed_products")
      .select("id, title, expiration_date")
      .not("expiration_date", "is", null)
      .gte("expiration_date", new Date().toISOString())
      .order("expiration_date", { ascending: true });
    if (data) setExpiringProducts(data.filter((p: any) => p.expiration_date) as any);
  };

  const fetchProductRequests = async () => {
    const { data } = await supabase.
    from("product_requests").
    select("*").
    order("created_at", { ascending: false });
    if (data) setProductRequests(data as any);
  };

  const fetchSellerApps = async () => {
    const { data } = await supabase.
    from("seller_applications").
    select("*").
    order("created_at", { ascending: false });
    if (data) setSellerApps(data);
  };

  const handleApproveSellerApp = async (app: any) => {
    // Grant seller role
    try {
      await callAdmin({ action: "set_role", userId: app.user_id, role: "seller", remove: false });
    } catch (err: any) {
      toast.error("Failed to grant seller role: " + err.message);
      return;
    }
    // Update application status
    await supabase.from("seller_applications").update({ status: "approved" } as any).eq("id", app.id);
    toast.success(`Application approved — ${app.full_name} is now a seller`);
    fetchSellerApps();
  };

  const handleRejectSellerApp = async (id: string) => {
    const note = prompt("Rejection reason (optional):");
    await supabase.from("seller_applications").update({ status: "rejected", admin_note: note || "Rejected" } as any).eq("id", id);
    toast.success("Application rejected");
    fetchSellerApps();
  };

  const handleDeleteSellerApp = async (id: string) => {
    if (!confirm("Delete this application permanently?")) return;
    await supabase.from("seller_applications").delete().eq("id", id);
    toast.success("Application deleted");
    fetchSellerApps();
  };

  const handleApproveRequest = async (req: typeof productRequests[0]) => {
    // Add to allowed_products
    const { error: insertErr } = await supabase.from("allowed_products").insert({
      title: req.title,
      platform: req.platform,
      store: req.store,
      region: req.region,
      description: req.description
    } as any);
    if (insertErr) {
      toast.error(insertErr.message);
      return;
    }
    // Update request status
    await supabase.from("product_requests").update({ status: "approved" } as any).eq("id", req.id);
    toast.success(`"${req.title}" approved and added to catalog`);
    fetchProductRequests();
    fetchAllowedProducts();
  };

  const handleRejectRequest = async (id: string, note?: string) => {
    await supabase.from("product_requests").update({ status: "rejected", admin_note: note || "Rejected by admin" } as any).eq("id", id);
    toast.success("Request rejected");
    fetchProductRequests();
  };

  const handleDeleteRequest = async (id: string) => {
    await supabase.from("product_requests").delete().eq("id", id);
    fetchProductRequests();
  };

  const fetchAllowedProducts = async () => {
    // Cap at 500 newest products to keep the Admin home page snappy.
    // Full catalog management lives in /admin/products which has pagination + search.
    const { data } = await supabase
      .from("allowed_products")
      .select("id, title, platform, store, region, image_url, description, description_paraphrased")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data) setAllowedProducts(data as any);
  };

  const handleAddAllowedProduct = async () => {
    if (!newProductTitle.trim()) return;
    setAddingProduct(true);

    let imageUrl: string | null = null;

    // Upload image if selected
    if (newProductImage) {
      const fileExt = newProductImage.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.
      from("product-images").
      upload(fileName, newProductImage);
      if (uploadError) {
        toast.error("Image upload failed: " + uploadError.message);
        setAddingProduct(false);
        return;
      }
      const { data: urlData } = supabase.storage.
      from("product-images").
      getPublicUrl(fileName);
      imageUrl = urlData.publicUrl;
    }

    const { error } = await supabase.
    from("allowed_products").
    insert({
      title: newProductTitle.trim().toUpperCase(),
      platform: newProductPlatform,
      store: newProductStore,
      region: newProductRegion,
      image_url: imageUrl,
      description: newProductDescription.trim() || null
    } as any);
    if (error) {
      toast.error(error.code === "23505" ? "Product already exists" : error.message);
    } else {
      toast.success("Product added to allowed list");
      setNewProductTitle("");
      setNewProductPlatform("PC");
      setNewProductImage(null);
      setImagePreview(null);
      setNewProductDescription("");
      setNewProductRegion("Global");
      setNewProductStore("Steam");
      fetchAllowedProducts();
    }
    setAddingProduct(false);
  };

  const handleRemoveAllowedProduct = async (id: string, title: string) => {
    if (!confirm(`Remove "${title}" from allowed list?`)) return;
    await supabase.from("kinguin_products").delete().eq("allowed_product_id", id);
    await supabase.from("products").delete().eq("title", title);
    const { error } = await supabase.from("allowed_products").delete().eq("id", id);
    if (error) toast.error(error.message);else
    {
      toast.success("Removed");
      fetchAllowedProducts();
    }
  };

  const handleStartEdit = (p: typeof allowedProducts[0]) => {
    setEditingProduct({ ...p });
    setOriginalProduct({ title: p.title, platform: p.platform, store: p.store });
    setEditProductImage(null);
    setEditImagePreview(p.image_url);
  };

  const handleSaveProduct = async () => {
    if (!editingProduct) return;
    setSavingProduct(true);

    let imageUrl = editingProduct.image_url;

    if (editProductImage) {
      const fileExt = editProductImage.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.
      from("product-images").
      upload(fileName, editProductImage);
      if (uploadError) {
        toast.error("Image upload failed: " + uploadError.message);
        setSavingProduct(false);
        return;
      }
      const { data: urlData } = supabase.storage.
      from("product-images").
      getPublicUrl(fileName);
      imageUrl = urlData.publicUrl;
    }

    const { error } = await supabase.
    from("allowed_products").
    update({
      title: editingProduct.title.trim().toUpperCase(),
      platform: editingProduct.platform,
      store: editingProduct.store,
      region: editingProduct.region,
      image_url: imageUrl,
      description: editingProduct.description?.trim() || null
    } as any).
    eq("id", editingProduct.id);

    if (error) {
      toast.error(error.message);
    } else {
      // Sync seller products if platform/store/title changed
      if (originalProduct) {
        const newTitle = editingProduct.title.trim().toUpperCase();
        const platformChanged = originalProduct.platform !== editingProduct.platform;
        const storeChanged = originalProduct.store !== editingProduct.store;
        const titleChanged = originalProduct.title !== newTitle;

        if (platformChanged || storeChanged || titleChanged) {
          const updateFields: Record<string, string> = {};
          if (platformChanged) updateFields.platform = editingProduct.platform;
          if (storeChanged) updateFields.store = editingProduct.store;
          if (titleChanged) updateFields.title = newTitle;

          // Update category for console platforms
          if (platformChanged || storeChanged) {
            const consolePlatforms = ["PlayStation", "Xbox", "Nintendo"];
            if (consolePlatforms.includes(editingProduct.platform)) {
              const sub = editingProduct.store.toLowerCase();
              if (sub === "games") updateFields.category = "games";else
              if (sub === "subscriptions") updateFields.category = "subscriptions";else
              if (sub === "top ups") updateFields.category = "topups";
            }
          }

          await supabase.
          from("products").
          update(updateFields as any).
          eq("title", originalProduct.title).
          eq("platform", originalProduct.platform).
          eq("store", originalProduct.store);
        }
      }

      toast.success("Product updated");
      setEditingProduct(null);
      setOriginalProduct(null);
      fetchAllowedProducts();
    }
    setSavingProduct(false);
  };

  const callAdmin = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const checkAdminAndLoad = async () => {
    try {
      const data = await callAdmin({ action: "list_users" });
      setIsAdmin(true);

      // Check if current user is super_admin. user_roles has no direct SELECT
      // grant (by design), so this goes through the is_super_admin() function.
      if (user) {
        const { data } = await supabase.rpc("is_super_admin" as any, { _user_id: user.id });
        setIsSuperAdmin((data as any) ?? false);
      }

      // Fetch usernames from profiles
      const { data: profiles } = await supabase.
      from("profiles").
      select("user_id, username");
      const usernameMap = new Map(
        (profiles || []).map((p: any) => [p.user_id, p.username])
      );

      // Fetch online users (active in the last 3 minutes via page_views)
      const sinceIso = new Date(Date.now() - 3 * 60 * 1000).toISOString();
      const { data: onlineRows } = await supabase
        .from("page_views")
        .select("user_id")
        .gte("created_at", sinceIso)
        .not("user_id", "is", null);
      const onlineSet = new Set((onlineRows || []).map((r: any) => r.user_id));

      const enrichedUsers = (data.users as AdminUser[]).map((u) => ({
        ...u,
        username: usernameMap.get(u.id) || null,
        is_online: onlineSet.has(u.id),
      }));

      // Sort by role priority: super_admin > admin > seller > user/none
      const rolePriority: Record<string, number> = { super_admin: 0, admin: 1, seller: 2, user: 3 };
      enrichedUsers.sort((a, b) => {
        const aMin = a.roles.length ? Math.min(...a.roles.map(r => rolePriority[r] ?? 4)) : 5;
        const bMin = b.roles.length ? Math.min(...b.roles.map(r => rolePriority[r] ?? 4)) : 5;
        return aMin - bMin;
      });

      setUsers(enrichedUsers);
    } catch {
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newEmail || !newPassword) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }
    const pwRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|<>?,./`~]).{8,}$/;
    if (!pwRegex.test(newPassword)) {
      toast.error("Password must be 8+ chars with lowercase, uppercase, number & special character");
      return;
    }
    setCreating(true);
    try {
      let avatarUrl: string | null = null;
      if (newAvatarFile) {
        const fileExt = newAvatarFile.name.split(".").pop();
        const fileName = `avatars/${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.
        from("product-images").
        upload(fileName, newAvatarFile);
        if (uploadError) {
          toast.error("Avatar upload failed: " + uploadError.message);
          setCreating(false);
          return;
        }
        const { data: urlData } = supabase.storage.
        from("product-images").
        getPublicUrl(fileName);
        avatarUrl = urlData.publicUrl;
      }

      await callAdmin({
        action: "create_user",
        email: newEmail,
        password: newPassword,
        username: newUsername.trim() || undefined,
        avatarUrl: avatarUrl || undefined
      });
      toast.success("User created");
      setShowCreate(false);
      setNewEmail("");
      setNewPassword("");
      setNewUsername("");
      setNewAvatarFile(null);
      setNewAvatarPreview(null);
      checkAdminAndLoad();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Delete user ${email}?`)) return;
    try {
      await callAdmin({ action: "delete_user", userId });
      toast.success("User deleted");
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleVerifyEmail = async (userId: string) => {
    try {
      await callAdmin({ action: "verify_email", userId });
      toast.success("Email verified");
      checkAdminAndLoad();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleResendVerificationEmail = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-resend-verification", {
        body: { user_ids: [userId] }
      });
      if (error) throw new Error(error.message);
      const result = data?.results?.[0];
      if (!result?.ok) throw new Error(result?.error || "Failed to send verification email");
      toast.success("Verification email sent");
      checkAdminAndLoad();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleResetPassword = async () => {
    if (!resetUserId || !resetPassword) return;
    try {
      await callAdmin({
        action: "reset_password",
        userId: resetUserId,
        newPassword: resetPassword
      });
      toast.success("Password reset");
      setResetUserId(null);
      setResetPassword("");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleNewAccountLimit = async (userId: string, currentlyExempt: boolean) => {
    const exempt = !currentlyExempt;
    const msg = exempt
      ? "Remove the €20 / 24h new-account purchase limit for this user?"
      : "Re-enable the €20 / 24h new-account purchase limit for this user?";
    if (!confirm(msg)) return;
    const { error } = await supabase.functions.invoke("fraud-check", {
      body: { action: "set_new_account_exempt", target_user_id: userId, exempt },
    });
    if (error) {
      toast.error("Failed to update new-account limit");
      return;
    }
    toast.success(exempt ? "24h limit removed for user" : "24h limit re-enabled for user");
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, new_account_limit_exempt: exempt } : u)));
  };

  const handleToggleRole = async (
  userId: string,
  role: string,
  hasRole: boolean,
  currentRoles: string[] = []) =>
  {
    // Prevent admin from setting super_admin
    if (role === "super_admin" && !isSuperAdmin) {
      toast.error("Only super admins can grant super admin role");
      return;
    }

    // If adding super_admin, remove admin first (mutual exclusivity)
    if (role === "super_admin" && !hasRole && currentRoles.includes("admin")) {
      try {
        await callAdmin({ action: "set_role", userId, role: "admin", remove: true });
      } catch {}
    }

    // If adding admin, remove super_admin first (mutual exclusivity)
    if (role === "admin" && !hasRole && currentRoles.includes("super_admin")) {
      // Only super_admin can remove super_admin
      if (!isSuperAdmin) {
        toast.error("Cannot change super admin to admin");
        return;
      }
      try {
        await callAdmin({ action: "set_role", userId, role: "super_admin", remove: true });
      } catch {}
    }

    try {
      await callAdmin({
        action: "set_role",
        userId,
        role,
        remove: hasRole
      });
      toast.success(hasRole ? `${role} role removed` : `${role} role added`);
      checkAdminAndLoad();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.size === users.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(users.map(u => u.id)));
    }
  };

  const getManageableSelected = () => {
    return users.filter(u => selectedUserIds.has(u.id) && (isSuperAdmin || !u.roles.includes("super_admin")));
  };

  const handleBulkDelete = async () => {
    const targets = getManageableSelected();
    if (targets.length === 0) return;
    if (!confirm(`Delete ${targets.length} users?`)) return;
    setBulkLoading(true);
    for (const u of targets) {
      try { await callAdmin({ action: "delete_user", userId: u.id }); } catch {}
    }
    setSelectedUserIds(new Set());
    setBulkLoading(false);
    toast.success(`${targets.length} users deleted`);
    checkAdminAndLoad();
  };

  const handleBulkVerify = async () => {
    const targets = getManageableSelected().filter(u => !u.email_confirmed_at);
    if (targets.length === 0) return;
    setBulkLoading(true);
    for (const u of targets) {
      try { await callAdmin({ action: "verify_email", userId: u.id }); } catch {}
    }
    setSelectedUserIds(new Set());
    setBulkLoading(false);
    toast.success(`${targets.length} emails verified`);
    checkAdminAndLoad();
  };

  const handleBulkSetRole = async (role: string, remove: boolean) => {
    if (role === "super_admin" && !isSuperAdmin) {
      toast.error("Only super admins can manage super admin role");
      return;
    }
    const targets = getManageableSelected().filter(u => remove ? u.roles.includes(role) : !u.roles.includes(role));
    if (targets.length === 0) return;
    setBulkLoading(true);
    for (const u of targets) {
      try {
        // Handle mutual exclusivity
        if (!remove && role === "super_admin" && u.roles.includes("admin")) {
          await callAdmin({ action: "set_role", userId: u.id, role: "admin", remove: true });
        }
        if (!remove && role === "admin" && u.roles.includes("super_admin")) {
          if (!isSuperAdmin) continue;
          await callAdmin({ action: "set_role", userId: u.id, role: "super_admin", remove: true });
        }
        await callAdmin({ action: "set_role", userId: u.id, role, remove });
      } catch {}
    }
    setSelectedUserIds(new Set());
    setBulkLoading(false);
    toast.success(`Role "${role}" ${remove ? "removed from" : "added to"} ${targets.length} users`);
    checkAdminAndLoad();
  };

  const handleSelectUser = async (u: AdminUser) => {
    setSelectedUser(u);

    setLoadingDetails(true);
    setEditingProfile(null);
    setSellerProducts([]);
    setUserCoinsBalance(null);
    setUserPlaysRemaining(null);
    loadCoinsAndPlays(u.id);
    try {
      const data = await callAdmin({ action: "get_user_details", userId: u.id });
      setUserDetails(data);
      setEditingProfile({
        username: data.profile?.username || "",
        display_name: data.profile?.display_name || "",
        phone: data.profile?.phone || "",
        address: data.profile?.address || "",
        email: u.email || ""
      });
      // Fetch seller products if user has seller role
      if (data.roles?.includes("seller") || data.roles?.includes("admin")) {
        const { data: products } = await supabase.
        from("products").
        select("*").
        eq("seller_id", u.id).
        order("created_at", { ascending: false });
        if (products) setSellerProducts(products);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingDetails(false);
    }
  };

  const loadCoinsAndPlays = async (userId: string) => {
    setLoadingCoinsPlays(true);
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [{ data: coins }, { data: plays }, freeCountRes] = await Promise.all([
        supabase.from("user_coins").select("balance").eq("user_id", userId).maybeSingle(),
        supabase.from("play_purchases").select("plays_remaining").eq("user_id", userId),
        supabase
          .from("game_plays")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_paid", false)
          .gte("created_at", since),
      ]);
      const balance = coins?.balance ?? 0;
      const total = (plays || []).reduce((s: number, p: any) => s + (p.plays_remaining || 0), 0);
      const freeLeft = Math.max(0, 2 - (freeCountRes.count || 0));
      setUserCoinsBalance(balance);
      setUserPlaysRemaining(total);
      setUserFreePlaysLeft(freeLeft);
      setCoinsToAdd(String(balance));
      setPlaysToAdd(String(total));
      setFreePlaysInput(String(freeLeft));
    } catch {
      setUserCoinsBalance(0);
      setUserPlaysRemaining(0);
      setUserFreePlaysLeft(0);
      setCoinsToAdd("0");
      setPlaysToAdd("0");
      setFreePlaysInput("0");
    } finally {
      setLoadingCoinsPlays(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!selectedUser || !editingProfile) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase.
      from("profiles").
      update({
        username: editingProfile.username.trim() || null,
        display_name: editingProfile.display_name.trim() || null,
        phone: editingProfile.phone.trim() || null,
        address: editingProfile.address.trim() || null
      }).
      eq("user_id", selectedUser.id);
      if (error) throw error;
      // Update email via auth admin if changed
      const newEmail = editingProfile.email.trim().toLowerCase();
      const emailChanged = newEmail && newEmail !== (selectedUser.email || "").toLowerCase();
      if (emailChanged) {
        await callAdmin({ action: "update_email", userId: selectedUser.id, email: newEmail });
      }
      toast.success("Profile updated");
      // Refresh in users list
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id
            ? { ...u, username: editingProfile.username.trim() || null, email: emailChanged ? newEmail : u.email }
            : u
        )
      );
      if (emailChanged) {
        setSelectedUser({ ...selectedUser, email: newEmail });
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleGrantCoins = async () => {
    if (!selectedUser) return;
    const target = parseInt(coinsToAdd, 10);
    if (!Number.isFinite(target) || target < 0) {
      toast.error("Enter a valid non-negative number");
      return;
    }
    setGrantingCoins(true);
    try {
      const { data: existing } = await supabase
        .from("user_coins")
        .select("balance, total_earned")
        .eq("user_id", selectedUser.id)
        .maybeSingle();
      const oldBalance = existing?.balance || 0;
      const oldEarned = existing?.total_earned || 0;
      const delta = target - oldBalance;
      const newEarned = delta > 0 ? oldEarned + delta : oldEarned;
      if (existing) {
        const { error } = await supabase
          .from("user_coins")
          .update({ balance: target, total_earned: newEarned, updated_at: new Date().toISOString() })
          .eq("user_id", selectedUser.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_coins")
          .insert({ user_id: selectedUser.id, balance: target, total_earned: target });
        if (error) throw error;
      }
      toast.success(`Balance set to ${target} Blaze Coins`);
      loadCoinsAndPlays(selectedUser.id);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGrantingCoins(false);
    }
  };

  const handleGrantPlays = async () => {
    if (!selectedUser) return;
    const target = parseInt(playsToAdd, 10);
    if (!Number.isFinite(target) || target < 0) {
      toast.error("Enter a valid non-negative number");
      return;
    }
    setGrantingPlays(true);
    try {
      // Clear existing purchases, then insert a single row with the target total
      const { error: delErr } = await supabase
        .from("play_purchases")
        .delete()
        .eq("user_id", selectedUser.id);
      if (delErr) throw delErr;
      if (target > 0) {
        const { error } = await supabase.from("play_purchases").insert({
          user_id: selectedUser.id,
          plays_bought: target,
          plays_remaining: target,
          amount_paid: 0,
        });
        if (error) throw error;
      }
      toast.success(`Paid plays set to ${target}`);
      loadCoinsAndPlays(selectedUser.id);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGrantingPlays(false);
    }
  };

  const handleSetFreePlays = async () => {
    if (!selectedUser) return;
    const target = parseInt(freePlaysInput, 10);
    if (!Number.isFinite(target) || target < 0 || target > 2) {
      toast.error("Free plays must be between 0 and 2");
      return;
    }
    setGrantingFreePlays(true);
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      // Delete all free plays in the last 24h
      const { error: delErr } = await supabase
        .from("game_plays")
        .delete()
        .eq("user_id", selectedUser.id)
        .eq("is_paid", false)
        .gte("created_at", since);
      if (delErr) throw delErr;
      // Insert (2 - target) "used" plays so that freeLeft = target
      const toInsert = 2 - target;
      if (toInsert > 0) {
        const rows = Array.from({ length: toInsert }, () => ({
          user_id: selectedUser.id,
          game_type: "admin_adjust",
          coins_won: 0,
          is_paid: false,
        }));
        const { error } = await supabase.from("game_plays").insert(rows);
        if (error) throw error;
      }
      toast.success(`Free plays set to ${target}`);
      loadCoinsAndPlays(selectedUser.id);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGrantingFreePlays(false);
    }
  };


  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>);

  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Shield className="h-16 w-16 text-destructive mx-auto" />
            <h1 className="font-display text-2xl text-foreground">
              Access Denied
            </h1>
            <p className="text-muted-foreground font-body">
              You don't have admin privileges.
            </p>
          </div>
        </div>
        <Footer />
      </div>);

  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/50 px-6 py-3">
        <AdminNavButtons isSeller={isSeller} onCreateUser={() => setShowCreate(true)} />
      </div>
      <main className="flex-1 w-full px-6 py-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button 
            variant="outline" 
            className="h-24 flex flex-col gap-2 bg-card/50 border-primary/20 hover:border-primary transition-all group"
            onClick={() => navigate("/admin/seo-generator")}
          >
            <Wand2 className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
            <div className="flex flex-col items-center">
              <span className="font-bold">SEO Generator</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">AI System</span>
            </div>
          </Button>
          
          <Button 
            variant="outline" 
            className="h-24 flex flex-col gap-2 bg-card/50 border-primary/20 hover:border-primary transition-all group"
            onClick={() => setShowProducts(true)}
          >
            <Package className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
            <span className="font-bold">Allowed Products</span>
          </Button>

          <Button 
            variant="outline" 
            className="h-24 flex flex-col gap-2 bg-card/50 border-primary/20 hover:border-primary transition-all relative group"
            onClick={() => setShowRequests(true)}
          >
            <Inbox className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
            <span className="font-bold">Product Requests</span>
            {productRequests.filter(r => r.status === 'pending').length > 0 && (
              <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center animate-pulse shadow-lg">
                {productRequests.filter(r => r.status === 'pending').length}
              </span>
            )}
          </Button>

          <Button 
            variant="outline" 
            className="h-24 flex flex-col gap-2 bg-card/50 border-primary/20 hover:border-primary transition-all relative group"
            onClick={() => setShowSellerApps(true)}
          >
            <ClipboardList className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
            <span className="font-bold">Seller Applications</span>
            {sellerApps.filter(a => a.status === 'pending').length > 0 && (
              <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center animate-pulse shadow-lg">
                {sellerApps.filter(a => a.status === 'pending').length}
              </span>
            )}
          </Button>
        </div>

        {/* Create User Modal */}
        {showCreate &&
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
            <div className="bg-background rounded-2xl shadow-2xl border border-border p-6 w-full max-w-md space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-foreground">
                  Create User
                </h2>
                <button
                onClick={() => setShowCreate(false)}
                className="text-muted-foreground hover:text-foreground">
                
                  <X className="h-5 w-5" />
                </button>
              </div>
              <input
              type="email"
              placeholder="Email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary" />
            
              <input
              type="password"
              placeholder="Password (e.g. MyPass1!)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary" />

              <input
              type="text"
              placeholder="Username (optional)"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary" />

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Avatar (optional)</label>
                <div className="flex items-center gap-3">
                  {newAvatarPreview &&
                <img src={newAvatarPreview} alt="Avatar preview" className="h-10 w-10 rounded-full object-cover border border-border" />
                }
                  <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setNewAvatarFile(file);
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setNewAvatarPreview(reader.result as string);
                      reader.readAsDataURL(file);
                    } else {
                      setNewAvatarPreview(null);
                    }
                  }}
                  className="w-full text-sm text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-sm file:text-primary-foreground" />
                
                </div>
              </div>
            
              <Button
              variant="hero"
              className="w-full"
              onClick={handleCreateUser}
              disabled={creating}>
              
                {creating ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        }

        {/* Reset Password Modal */}
        {resetUserId &&
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
            <div className="bg-background rounded-2xl shadow-2xl border border-border p-6 w-full max-w-md space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-foreground">
                  Reset Password
                </h2>
                <button
                onClick={() => setResetUserId(null)}
                className="text-muted-foreground hover:text-foreground">
                
                  <X className="h-5 w-5" />
                </button>
              </div>
              <input
              type="password"
              placeholder="New password (e.g. MyPass1!)"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary" />
            
              <Button
              variant="hero"
              className="w-full"
              onClick={handleResetPassword}>
              
                Reset
              </Button>
            </div>
          </div>
        }

        {/* Allowed Products Modal */}
        {showProducts &&
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
            <div className="bg-background rounded-2xl shadow-2xl border border-border p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-lg font-bold text-foreground">Manage Allowed Products</h2>
                </div>
                <button onClick={() => setShowProducts(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Sellers can only list products from this list.</p>
                {(() => {
                  const missingCount = allowedProducts.filter(p => !p.description).length;
                  return missingCount > 0 ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs"
                      disabled={generatingDescriptions}
                      onClick={async () => {
                        setGeneratingDescriptions(true);
                        try {
                          const res = await supabase.functions.invoke("generate-descriptions", { body: { limit: 50 } });
                          if (res.error) throw new Error(res.error.message);
                          if (res.data?.error) throw new Error(res.data.error);
                          toast.success(`Generated ${res.data.generated} descriptions (${res.data.failed} failed)`);
                          fetchAllowedProducts();
                        } catch (err: any) {
                          toast.error("Failed: " + err.message);
                        } finally {
                          setGeneratingDescriptions(false);
                        }
                      }}
                    >
                      {generatingDescriptions ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pencil className="h-3 w-3" />}
                      Generate Descriptions ({missingCount} missing)
                    </Button>
                  ) : null;
                })()}
              </div>

              {/* Expiring Products Alert */}
              {(() => {
                const urgentProducts = expiringProducts.filter((p) => {
                  const daysLeft = Math.ceil((new Date(p.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return daysLeft <= 30;
                });
                return urgentProducts.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Expiring Soon ({urgentProducts.length})
                  </h3>
                  {expiringProducts.map((p) => {
                    const expDate = new Date(p.expiration_date);
                    const now = new Date();
                    const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const isExpired = daysLeft <= 0;
                    const isUrgent = daysLeft > 0 && daysLeft <= 7;
                    const isWarning = daysLeft > 7 && daysLeft <= 30;
                    if (!isExpired && !isUrgent && !isWarning) return null;
                    return (
                      <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                        isExpired ? 'bg-destructive/10 border-destructive/30' :
                        isUrgent ? 'bg-amber-500/10 border-amber-500/30' :
                        isWarning ? 'bg-amber-500/5 border-amber-500/20' :
                        'bg-muted/30 border-border'
                      }`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <AlertTriangle className={`h-4 w-4 shrink-0 ${
                            isExpired ? 'text-destructive' : isUrgent ? 'text-amber-500' : 'text-muted-foreground'
                          }`} />
                          <span className="text-sm font-medium text-foreground truncate">{p.title}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-xs font-bold ${
                            isExpired ? 'text-destructive' : isUrgent ? 'text-amber-500' : 'text-muted-foreground'
                          }`}>
                            {isExpired ? '⚠️ EXPIRED' : `${daysLeft} days left`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {expDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                          </span>
                          {isExpired && (
                            <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => handleRemoveAllowedProduct(p.id, p.title)}>
                              <Trash2 className="h-3 w-3 mr-1" /> Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                ) : null;
              })()}

              {/* Add new product form */}
              <div className="space-y-3 border border-border rounded-lg p-4 bg-secondary/30">
                <h3 className="font-display text-sm font-semibold text-foreground">Add New Product</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground font-body mb-1 block">Title *</label>
                    <Input
                    value={newProductTitle}
                    onChange={(e) => setNewProductTitle(e.target.value)}
                    placeholder="e.g. GTA V" />
                  
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-body mb-1 block">Platform *</label>
                    <select
                    value={newProductPlatform}
                    onChange={(e) => {
                      const p = e.target.value;
                      setNewProductPlatform(p);
                      setNewProductStore(getSubPlatforms(p)[0]);
                    }}
                    className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary">
                    
                      {Object.keys(SUB_PLATFORM_MAP).map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-body mb-1 block">Region *</label>
                    <select
                    value={newProductRegion}
                    onChange={(e) => setNewProductRegion(e.target.value)}
                    className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary">
                    
                      <option value="Global">Global</option>
                      <option value="Europe">Europe (EU)</option>
                      <option value="North America">North America (NA)</option>
                      <option value="Latin America">Latin America (LATAM)</option>
                      <option value="UK">United Kingdom (UK)</option>
                      <option value="Asia">Asia</option>
                      <option value="Japan">Japan (JP)</option>
                      <option value="China">China (CN)</option>
                      <option value="Korea">Korea (KR)</option>
                      <option value="Oceania">Oceania (AU/NZ)</option>
                      <option value="Middle East">Middle East (ME)</option>
                      <option value="Africa">Africa</option>
                      <option value="India">India (IN)</option>
                      <option value="Russia">Russia/CIS</option>
                      <option value="Southeast Asia">Southeast Asia (SEA)</option>
                      <option value="Turkey">Turkey (TR)</option>
                      <option value="Brazil">Brazil (BR)</option>
                      <option value="Argentina">Argentina (AR)</option>
                     </select>
                   </div>
                   <div>
                    <label className="text-xs text-muted-foreground font-body mb-1 block">Sub Platform *</label>
                    <select
                    value={newProductStore}
                    onChange={(e) => setNewProductStore(e.target.value)}
                    className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary">
                    
                      {getSubPlatforms(newProductPlatform).map((sp) =>
                    <option key={sp} value={sp}>{sp}</option>
                    )}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground font-body mb-1 block">Image</label>
                    <div className="flex items-center gap-3">
                      <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-md bg-secondary border border-border text-sm text-foreground font-body hover:bg-accent transition-colors">
                        <Plus className="h-4 w-4" />
                        {newProductImage ? newProductImage.name : "Choose file"}
                        <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setNewProductImage(file);
                          if (file) {
                            setImagePreview(URL.createObjectURL(file));
                          } else {
                            setImagePreview(null);
                          }
                        }} />
                      
                      </label>
                      {imagePreview &&
                    <img src={imagePreview} alt="Preview" className="w-10 h-10 rounded object-cover border border-border" />
                    }
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground font-body mb-1 block">Description</label>
                    <textarea
                    value={newProductDescription}
                    onChange={(e) => setNewProductDescription(e.target.value)}
                    placeholder="Product description..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
                  
                  </div>
                </div>
                <Button onClick={handleAddAllowedProduct} disabled={addingProduct} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {addingProduct ? "Adding..." : "Add Product"}
                </Button>
              </div>

              {/* Existing products list */}
              <div className="space-y-3">
                <h3 className="font-display text-sm font-semibold text-foreground">
                  Products ({allowedProducts.length})
                </h3>
                {allowedProducts.length > 0 ?
              <div className="space-y-2">
                    {allowedProducts.map((p) =>
                <div key={p.id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3 border border-border/50">
                        <div className="flex items-center gap-3">
                          {p.image_url &&
                    <img src={p.image_url} alt={p.title} className="w-10 h-10 rounded object-cover" />
                    }
                          <div>
                            <span className="text-sm font-body font-medium text-foreground">{p.title}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs font-body px-2 py-0.5 rounded-full bg-primary/10 text-primary">{p.platform}</span>
                              <span className="text-xs font-body px-2 py-0.5 rounded-full bg-secondary text-foreground">{p.store}</span>
                              <span className="text-xs font-body px-2 py-0.5 rounded-full bg-accent/10 text-accent">{p.region}</span>
                              {p.description_paraphrased && <span className="text-xs font-display font-bold px-2 py-0.5 rounded-full bg-neon-green/15 text-neon-green border border-neon-green/30">✓ PR</span>}
                              {p.description &&
                        <span className="text-xs text-muted-foreground font-body truncate max-w-[200px]">{p.description}</span>
                        }
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                      onClick={(e) => {e.stopPropagation();handleStartEdit(p);}}
                      className="text-muted-foreground hover:text-primary transition-colors p-1.5">
                      
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                      onClick={(e) => {e.stopPropagation();handleRemoveAllowedProduct(p.id, p.title);}}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1.5">
                      
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                )}
                  </div> :

              <p className="text-sm text-muted-foreground font-body">No products in the allowed list yet.</p>
              }
              </div>
            </div>
          </div>
        }

        {/* Edit Product Modal */}
        {editingProduct &&
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
            <div className="bg-background rounded-2xl shadow-2xl border border-border p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-foreground">Edit Product</h2>
                <button onClick={() => setEditingProduct(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-body mb-1 block">Title *</label>
                  <Input value={editingProduct.title} onChange={(e) => setEditingProduct({ ...editingProduct, title: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-body mb-1 block">Platform *</label>
                  <select value={editingProduct.platform} onChange={(e) => {
                  const p = e.target.value;
                  setEditingProduct({ ...editingProduct, platform: p, store: getSubPlatforms(p)[0] });
                }} className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary">
                    {Object.keys(SUB_PLATFORM_MAP).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-body mb-1 block">Region *</label>
                  <select value={editingProduct.region} onChange={(e) => setEditingProduct({ ...editingProduct, region: e.target.value })} className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="Global">Global</option>
                    <option value="Europe">Europe (EU)</option>
                    <option value="North America">North America (NA)</option>
                    <option value="Latin America">Latin America (LATAM)</option>
                    <option value="UK">United Kingdom (UK)</option>
                    <option value="Asia">Asia</option>
                    <option value="Japan">Japan (JP)</option>
                    <option value="China">China (CN)</option>
                    <option value="Korea">Korea (KR)</option>
                    <option value="Oceania">Oceania (AU/NZ)</option>
                    <option value="Middle East">Middle East (ME)</option>
                    <option value="Africa">Africa</option>
                    <option value="India">India (IN)</option>
                    <option value="Russia">Russia/CIS</option>
                    <option value="Southeast Asia">Southeast Asia (SEA)</option>
                    <option value="Turkey">Turkey (TR)</option>
                    <option value="Brazil">Brazil (BR)</option>
                    <option value="Argentina">Argentina (AR)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-body mb-1 block">Sub Platform *</label>
                  <select value={editingProduct.store} onChange={(e) => setEditingProduct({ ...editingProduct, store: e.target.value })} className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary">
                    {getSubPlatforms(editingProduct.platform).map((sp) =>
                  <option key={sp} value={sp}>{sp}</option>
                  )}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground font-body mb-1 block">Image</label>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-md bg-secondary border border-border text-sm text-foreground font-body hover:bg-accent transition-colors">
                      <Plus className="h-4 w-4" />
                      {editProductImage ? editProductImage.name : "Change image"}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setEditProductImage(file);
                      if (file) setEditImagePreview(URL.createObjectURL(file));
                    }} />
                    </label>
                    {editImagePreview &&
                  <img src={editImagePreview} alt="Preview" className="w-10 h-10 rounded object-cover border border-border" />
                  }
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground font-body mb-1 block">Description</label>
                  <textarea value={editingProduct.description || ""} onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })} placeholder="Product description..." rows={3} className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveProduct} disabled={savingProduct} className="gap-2">
                  {savingProduct ? "Saving..." : "Save Changes"}
                </Button>
                <Button variant="ghost" onClick={() => setEditingProduct(null)}>Cancel</Button>
              </div>
            </div>
          </div>
        }

        {/* Bulk Actions Bar */}
        {selectedUserIds.size > 0 && (
          <div className="glass rounded-xl p-3 mb-3 flex items-center gap-3 flex-wrap border border-primary/30 bg-primary/5">
            <span className="font-display text-sm font-bold text-foreground">
              {selectedUserIds.size} selected
            </span>
            <div className="h-5 w-px bg-border" />
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" disabled={bulkLoading}
              onClick={handleBulkVerify}>
              <CheckCircle className="h-3.5 w-3.5" /> Verify Email
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" disabled={bulkLoading}
              onClick={() => handleBulkSetRole("seller", false)}>
              <Store className="h-3.5 w-3.5" /> + Seller
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" disabled={bulkLoading}
              onClick={() => handleBulkSetRole("seller", true)}>
              <Store className="h-3.5 w-3.5" /> - Seller
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" disabled={bulkLoading}
              onClick={() => handleBulkSetRole("admin", false)}>
              <ShieldCheck className="h-3.5 w-3.5" /> + Admin
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" disabled={bulkLoading}
              onClick={() => handleBulkSetRole("admin", true)}>
              <ShieldCheck className="h-3.5 w-3.5" /> - Admin
            </Button>
            {isSuperAdmin && (
              <>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" disabled={bulkLoading}
                  onClick={() => handleBulkSetRole("super_admin", false)}>
                  <Crown className="h-3.5 w-3.5" /> + Super Admin
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" disabled={bulkLoading}
                  onClick={() => handleBulkSetRole("super_admin", true)}>
                  <Crown className="h-3.5 w-3.5" /> - Super Admin
                </Button>
              </>
            )}
            <div className="h-5 w-px bg-border" />
            <Button size="sm" variant="destructive" className="h-7 text-xs gap-1.5" disabled={bulkLoading}
              onClick={handleBulkDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
            {bulkLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            <Button size="sm" variant="ghost" className="h-7 text-xs ml-auto" onClick={() => setSelectedUserIds(new Set())}>
              Clear
            </Button>
          </div>
        )}

        {/* Users Table */}
        {(() => {
          const blockedCount = users.filter(u => u.is_blocked).length;
          const activeCount = users.length - blockedCount;
          const filteredUsers = usersTab === "blocked"
            ? users.filter(u => u.is_blocked)
            : users.filter(u => !u.is_blocked);
          return (
        <>
        <div className="flex items-center justify-between gap-3 mb-3 px-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setUsersTab("active")}
              className={`text-xs font-display tracking-wider uppercase px-3 py-1.5 rounded-full border transition-colors ${
                usersTab === "active"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              Active <span className="ml-1 font-bold">({activeCount})</span>
            </button>
            <button
              onClick={() => setUsersTab("blocked")}
              className={`text-xs font-display tracking-wider uppercase px-3 py-1.5 rounded-full border transition-colors ${
                usersTab === "blocked"
                  ? "bg-red-600 text-white border-red-600"
                  : "bg-transparent text-red-500 border-red-500/40 hover:bg-red-500/10"
              }`}
            >
              🚫 Blocked <span className="ml-1 font-bold">({blockedCount})</span>
            </button>
          </div>
        </div>
        <div className="glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={filteredUsers.length > 0 && filteredUsers.every(u => selectedUserIds.has(u.id))}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                    />
                  </th>
                  <th className="text-left text-xs font-display text-muted-foreground uppercase tracking-wider px-4 py-3">
                    User
                  </th>
                  <th className="text-left text-xs font-display text-muted-foreground uppercase tracking-wider px-4 py-3">
                    Joined
                  </th>
                  <th className="text-left text-xs font-display text-muted-foreground uppercase tracking-wider px-4 py-3">
                    Verified
                  </th>
                  <th className="text-left text-xs font-display text-muted-foreground uppercase tracking-wider px-4 py-3">
                    Roles
                  </th>
                  <th className="text-right text-xs font-display text-muted-foreground uppercase tracking-wider px-4 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-[sidebar-primary-foreground] bg-muted">
                {filteredUsers.map((u) =>
                <tr
                  key={u.id}
                  onClick={() => handleSelectUser(u)}
                  className={`border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer ${selectedUserIds.has(u.id) ? 'bg-primary/5' : ''}`}>
                  
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedUserIds.has(u.id)}
                        onChange={() => toggleSelectUser(u.id)}
                        className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col text-amber-50">
                        {u.username &&
                      <span className="text-base font-display font-bold text-foreground">{u.username}</span>
                      }
                        <span className={`font-body ${u.username ? 'text-sm text-muted-foreground' : 'text-base font-display font-bold text-foreground'}`}>

                          {u.email}
                        </span>
                        {u.is_online && (
                          <span
                            className="mt-1 inline-flex items-center gap-1 text-[10px] font-display font-bold px-2 py-0.5 rounded-full bg-green-600/20 text-green-500 border border-green-500/50 tracking-wider uppercase w-fit"
                            title="Active on the site within the last 3 minutes"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                            Online
                          </span>
                        )}
                        {u.is_blocked && (
                          <span
                            onClick={(e) => { e.stopPropagation(); navigate('/admin/fraud'); }}
                            className="mt-1 text-[10px] font-display font-bold px-2 py-0.5 rounded-full bg-red-600/30 text-red-400 border border-red-500/50 tracking-wider uppercase w-fit cursor-pointer hover:bg-red-600/50 transition-colors"
                            title="View in Fraud Dashboard"
                          >
                            🚫 Blocked
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-body text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {(u.email_verified || u.email_confirmed_at) ?
                    <span className="text-xs font-display font-bold px-2 py-0.5 rounded-full bg-green-700/20 text-green-700 tracking-wide">
                          ✓ Verified
                        </span> :
                    <span className="text-xs font-display font-bold px-2 py-0.5 rounded-full bg-yellow-600/20 text-yellow-700 tracking-wide">
                          ⏳ Pending
                        </span>
                    }

                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {u.roles.length > 0 ?
                      u.roles.map((r) =>
                      <span
                        key={r}
                        className={`text-xs font-display font-bold px-2 py-0.5 rounded-full tracking-wide uppercase ${
                        r === "super_admin" ?
                        "bg-amber-600/20 text-amber-600" :
                        r === "admin" ?
                        "bg-red-700/20 text-red-700" :
                        r === "seller" ?
                        "bg-blue-700/20 text-blue-700" :
                        "bg-foreground/10 text-foreground"}`
                        }>
                        
                              {r === "super_admin" ? "👑 Super Admin" : r === "admin" ? "🛡 Admin" : r === "seller" ? "🏪 Seller" : r}
                            </span>
                      ) :

                      <span className="text-xs font-display font-bold px-2 py-0.5 rounded-full tracking-wide uppercase bg-foreground/10 text-foreground">
                            👤 User
                          </span>
                      }
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const targetIsSuperAdmin = u.roles.includes("super_admin");
                        const canManageUser = isSuperAdmin || !targetIsSuperAdmin;
                        return (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); startChatWithUser(u); }}
                          className="p-1.5 rounded text-muted-foreground hover:text-primary transition-colors"
                          title="Start live chat with user"
                        >
                          <MessageSquare className="h-5 w-5" />
                        </button>
                        {!(u.email_verified || u.email_confirmed_at) && canManageUser &&
                      <button
                        onClick={(e) => {e.stopPropagation();handleResendVerificationEmail(u.id);}}
                        className="p-1.5 rounded text-muted-foreground hover:text-primary transition-colors"
                        title="Resend verification email">
                            <Mail className="h-5 w-5" />
                          </button>
                      }
                        {!(u.email_verified || u.email_confirmed_at) && canManageUser &&
                      <button
                        onClick={(e) => {e.stopPropagation();handleVerifyEmail(u.id);}}
                        className="p-1.5 rounded text-muted-foreground hover:text-green-400 transition-colors"
                        title="Mark email as verified">
                            <CheckCircle className="h-5 w-5" />
                          </button>
                      }
                        {canManageUser && (
                        <button
                        onClick={(e) => {e.stopPropagation();setResetUserId(u.id);}}
                        className="p-1.5 rounded text-muted-foreground hover:text-primary transition-colors"
                        title="Reset password">
                          <KeyRound className="h-5 w-5" />
                        </button>
                        )}
                        {canManageUser && (() => {
                          const ageHours = (Date.now() - new Date(u.created_at).getTime()) / 3_600_000;
                          const limitApplies = ageHours >= 0 && ageHours < 24;
                          const exempt = !!u.new_account_limit_exempt;
                          if (!limitApplies) return null;
                          const limitCap = u.new_account_limit_cap ?? 20;
                          return (
                            <button
                              onClick={(e) => {e.stopPropagation();handleToggleNewAccountLimit(u.id, exempt);}}
                              className={`p-1.5 rounded transition-colors ${
                                exempt
                                  ? "text-muted-foreground hover:text-amber-400"
                                  : "text-amber-400 hover:text-amber-300"
                              }`}
                              title={exempt
                                ? `€${limitCap} / 24h limit is OFF for this user — click to re-enable`
                                : `New account (~${ageHours.toFixed(1)}h old) — €${limitCap} / 24h limit is active. Click to remove.`}
                            >
                              <Clock className="h-5 w-5" />
                            </button>
                          );
                        })()}
                        {canManageUser && (
                        <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleRole(u.id, "seller", u.roles.includes("seller"), u.roles);
                        }}
                        className={`p-1.5 rounded transition-colors ${
                        u.roles.includes("seller") ?
                        "text-destructive hover:text-muted-foreground drop-shadow-[0_0_6px_hsl(var(--destructive))]" :
                        "text-muted-foreground hover:text-accent"}`
                        }
                        title={u.roles.includes("seller") ? "Remove seller" : "Make seller"}>
                          <Store className="h-5 w-5" />
                        </button>
                        )}
                        {canManageUser && (
                        <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleRole(u.id, "admin", u.roles.includes("admin"), u.roles);
                        }}
                        className={`p-1.5 rounded transition-colors ${
                        u.roles.includes("admin") ?
                        "text-destructive hover:text-muted-foreground drop-shadow-[0_0_6px_hsl(var(--destructive))]" :
                        "text-muted-foreground hover:text-primary"}`
                        }
                        title={u.roles.includes("admin") ? "Remove admin" : "Make admin"}>
                          <ShieldCheck className="h-5 w-5" />
                        </button>
                        )}
                        {isSuperAdmin && (
                        <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleRole(u.id, "super_admin", u.roles.includes("super_admin"), u.roles);
                        }}
                        className={`p-1.5 rounded transition-colors ${
                        u.roles.includes("super_admin") ?
                        "text-amber-600 hover:text-muted-foreground drop-shadow-[0_0_6px_rgba(217,119,6,0.6)]" :
                        "text-muted-foreground hover:text-amber-600"}`
                        }
                        title={u.roles.includes("super_admin") ? "Remove super admin" : "Make super admin"}>
                          <Crown className="h-5 w-5" />
                        </button>
                        )}
                        {canManageUser && (
                        <button
                        onClick={(e) => {e.stopPropagation();handleDeleteUser(u.id, u.email || "");}}
                        className="p-1.5 rounded text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete user">
                          <Trash2 className="h-5 w-5" />
                        </button>
                        )}
                        {!canManageUser && (
                          <span className="text-xs text-muted-foreground italic">Protected</span>
                        )}
                      </div>
                        );
                      })()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
        );
        })()}

        {/* User Detail Modal */}
        {selectedUser &&
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
            <div className="bg-background rounded-2xl shadow-2xl border border-border p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-foreground">
                  {selectedUser.username || selectedUser.email}
                </h2>
                <button
                onClick={() => {setSelectedUser(null);setUserDetails(null);}}
                className="text-muted-foreground hover:text-foreground">
                
                  <X className="h-5 w-5" />
                </button>
              </div>

              {loadingDetails ?
            <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div> :
            userDetails ?
            <>
                  {/* Editable Profile */}
                  {editingProfile &&
              <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-display text-sm font-semibold text-primary uppercase tracking-wider">Profile</h3>
                        <Button size="sm" onClick={handleSaveProfile} disabled={savingProfile} className="h-7 text-xs">
                          {savingProfile ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="text-xs text-muted-foreground font-body mb-1 block">Email</label>
                          <input
                      type="email"
                      value={editingProfile.email}
                      onChange={(e) => setEditingProfile({ ...editingProfile, email: e.target.value })}
                      className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary"
                      maxLength={200} />

                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground font-body mb-1 block">Username</label>
                          <input
                      value={editingProfile.username}
                      onChange={(e) => setEditingProfile({ ...editingProfile, username: e.target.value })}
                      className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary"
                      maxLength={20} />
                    
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground font-body mb-1 block">Display Name</label>
                          <input
                      value={editingProfile.display_name}
                      onChange={(e) => setEditingProfile({ ...editingProfile, display_name: e.target.value })}
                      className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary"
                      maxLength={100} />
                    
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground font-body mb-1 block">Phone</label>
                          <input
                      value={editingProfile.phone}
                      onChange={(e) => setEditingProfile({ ...editingProfile, phone: e.target.value })}
                      className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary"
                      maxLength={20} />
                    
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground font-body mb-1 block">Address</label>
                          <input
                      value={editingProfile.address}
                      onChange={(e) => setEditingProfile({ ...editingProfile, address: e.target.value })}
                      className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary"
                      maxLength={200} />
                    
                        </div>
                      </div>
                    </div>
              }

                  {/* Roles */}
                  <div className="space-y-2">
                    <h3 className="font-display text-sm font-semibold text-primary uppercase tracking-wider">Roles</h3>
                    <div className="flex gap-2">
                      {userDetails.roles.length > 0 ? userDetails.roles.map((r) =>
                  <span key={r} className={`text-xs font-body px-2 py-0.5 rounded-full ${
                  r === "admin" ? "bg-primary/10 text-primary" : r === "seller" ? "bg-accent/10 text-accent" : "bg-secondary text-muted-foreground"}`
                  }>{r}</span>
                  ) : <span className="text-xs text-muted-foreground font-body">user</span>}
                    </div>
                  </div>

                  {/* Grant Coins & Plays — Blaze Coins / games disabled site-wide
                      (2026-09-08 incident); kept editable for admin cleanup but
                      visually marked disabled per explicit request. */}
                  <div className="space-y-3">
                    <h3 className="font-display text-sm font-semibold text-primary uppercase tracking-wider">Coins & Plays</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="relative bg-secondary/50 rounded-lg p-3">
                        <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider bg-destructive/20 text-destructive px-1.5 py-0.5 rounded">Disabled</span>
                        <div className="space-y-2 grayscale opacity-50">
                          <div className="flex items-center gap-2 text-foreground text-sm font-body">
                            <Coins className="h-4 w-4 text-amber-500" />
                            <span>Blaze Coins</span>
                          </div>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              min={0}
                              placeholder="0"
                              value={coinsToAdd}
                              onChange={(e) => setCoinsToAdd(e.target.value)}
                              className="h-9 text-sm"
                            />
                            <Button size="sm" onClick={handleGrantCoins} disabled={grantingCoins} className="h-9">
                              {grantingCoins ? "..." : "Save"}
                            </Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground font-body">
                            {loadingCoinsPlays ? "Loading…" : `Current: ${userCoinsBalance ?? 0}. Edit to set new balance.`}
                          </p>
                        </div>
                      </div>
                      <div className="relative bg-secondary/50 rounded-lg p-3">
                        <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider bg-destructive/20 text-destructive px-1.5 py-0.5 rounded">Disabled</span>
                        <div className="space-y-2 grayscale opacity-50">
                          <div className="flex items-center gap-2 text-foreground text-sm font-body">
                            <Gamepad2 className="h-4 w-4 text-emerald-500" />
                            <span>Free Plays (24h)</span>
                          </div>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              min={0}
                              max={2}
                              placeholder="0-2"
                              value={freePlaysInput}
                              onChange={(e) => setFreePlaysInput(e.target.value)}
                              className="h-9 text-sm"
                            />
                            <Button size="sm" onClick={handleSetFreePlays} disabled={grantingFreePlays} className="h-9">
                              {grantingFreePlays ? "..." : "Save"}
                            </Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground font-body">
                            {loadingCoinsPlays ? "Loading…" : `Current: ${userFreePlaysLeft ?? 0} / 2 left.`}
                          </p>
                        </div>
                      </div>
                      <div className="relative bg-secondary/50 rounded-lg p-3">
                        <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider bg-destructive/20 text-destructive px-1.5 py-0.5 rounded">Disabled</span>
                        <div className="space-y-2 grayscale opacity-50">
                          <div className="flex items-center gap-2 text-foreground text-sm font-body">
                            <Gamepad2 className="h-4 w-4 text-primary" />
                            <span>Paid Plays</span>
                          </div>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              min={0}
                              placeholder="0"
                              value={playsToAdd}
                              onChange={(e) => setPlaysToAdd(e.target.value)}
                              className="h-9 text-sm"
                            />
                            <Button size="sm" onClick={handleGrantPlays} disabled={grantingPlays} className="h-9">
                              {grantingPlays ? "..." : "Save"}
                            </Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground font-body">
                            {loadingCoinsPlays ? "Loading…" : `Current: ${userPlaysRemaining ?? 0}. Edit to set new total.`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Seller Products */}
                  {sellerProducts.length > 0 &&
              <div className="space-y-2">
                      <h3 className="font-display text-sm font-semibold text-primary uppercase tracking-wider">
                        Seller Products ({sellerProducts.length})
                      </h3>
                      <div className="space-y-2">
                        {sellerProducts.map((p: any) => {
                    const codeCount = p.game_code?.split("\n").filter((c: string) => c.trim()).length || 0;
                    return (
                      <div key={p.id} className="bg-secondary/50 rounded-lg px-3 py-2 text-sm font-body space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-foreground font-medium">{p.title}</span>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                            p.status === "active" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`
                            }>{p.status}</span>
                                  <button
                              onClick={async () => {
                                if (!confirm(`Delete "${p.title}" from this seller?`)) return;
                                // Delete the seller product
                                await supabase.from("products").delete().eq("id", p.id);
                                // Check if any other sellers still have this product
                                const { data: remaining } = await supabase.
                                from("products").
                                select("id").
                                eq("title", p.title).
                                eq("platform", p.platform).
                                eq("store", p.store).
                                eq("status", "active");
                                // If no sellers remain, deactivate kinguin product too
                                if (!remaining || remaining.length === 0) {
                                  const { data: allAllowed } = await supabase.
                                  from("allowed_products").
                                  select("id").
                                  eq("title", p.title).
                                  eq("platform", p.platform).
                                  eq("store", p.store);
                                  if (allAllowed && allAllowed.length > 0) {
                                    for (const ap of allAllowed) {
                                      await supabase.
                                      from("kinguin_products").
                                      update({ is_active: false }).
                                      eq("allowed_product_id", ap.id);
                                    }
                                  }
                                }
                                setSellerProducts((prev) => prev.filter((sp: any) => sp.id !== p.id));
                                toast.success("Product deleted");
                              }}
                              className="text-destructive hover:text-destructive/80 transition-colors">
                              
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{p.platform}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-foreground">{p.store}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent-foreground">{p.category}</span>
                                <span className="text-primary font-medium">€{p.price}</span>
                                {p.original_price &&
                          <span className="text-xs text-muted-foreground line-through">€{p.original_price}</span>
                          }
                                <span className={`text-xs ${codeCount > 0 ? "text-primary" : "text-muted-foreground"}`}>
                                  {codeCount} codes
                                </span>
                              </div>
                            </div>);

                  })}
                      </div>
                    </div>
              }

                  {/* Account Info */}
                  <div className="space-y-2">
                    <h3 className="font-display text-sm font-semibold text-primary uppercase tracking-wider">Account</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm font-body">
                      <div>
                        <span className="text-muted-foreground">Joined: </span>
                        <span className="text-foreground">{new Date(selectedUser.created_at).toLocaleDateString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Last Login: </span>
                        <span className="text-foreground">{selectedUser.last_sign_in_at ? new Date(selectedUser.last_sign_in_at).toLocaleString() : "—"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email Verified: </span>
                        <span className="text-foreground">{selectedUser.email_confirmed_at ? "Yes" : "No"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Orders */}
                  <div className="space-y-2">
                    <h3 className="font-display text-sm font-semibold text-primary uppercase tracking-wider">
                      Orders ({userDetails.orders.length})
                    </h3>
                    {userDetails.orders.length > 0 ?
                <div className="space-y-2">
                        {userDetails.orders.map((o) =>
                  <div key={o.id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2 text-sm font-body">
                            <div>
                              <span className="text-foreground">{o.game_title}</span>
                              <span className="text-muted-foreground ml-2">({o.platform})</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-primary font-medium">€{o.price}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                      o.status === "completed" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`
                      }>{o.status}</span>
                            </div>
                          </div>
                  )}
                      </div> :

                <p className="text-sm text-muted-foreground font-body">No orders yet.</p>
                }
                  </div>

                  {/* Wishlist */}
                  <div className="space-y-2">
                    <h3 className="font-display text-sm font-semibold text-primary uppercase tracking-wider">
                      Wishlist ({userDetails.wishlist.length})
                    </h3>
                    {userDetails.wishlist.length > 0 ?
                <div className="space-y-2">
                        {userDetails.wishlist.map((w) =>
                  <div key={w.id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2 text-sm font-body">
                            <div>
                              <span className="text-foreground">{w.game_title}</span>
                              <span className="text-muted-foreground ml-2">({w.platform})</span>
                            </div>
                            {w.price && <span className="text-primary font-medium">€{w.price}</span>}
                          </div>
                  )}
                      </div> :

                <p className="text-sm text-muted-foreground font-body">Empty wishlist.</p>
                }
                  </div>
                </> :
            null}
            </div>
          </div>
        }

        {/* Product Requests Modal */}
        {showRequests &&
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
            <div className="bg-background rounded-2xl shadow-2xl border border-border p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Inbox className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-lg font-bold text-foreground">Product Requests</h2>
                </div>
                <button onClick={() => setShowRequests(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {productRequests.length === 0 ?
            <p className="text-sm text-muted-foreground font-body text-center py-8">No product requests yet.</p> :

            <div className="space-y-3">
                  {productRequests.map((r) =>
              <div key={r.id} className={`rounded-lg border p-4 space-y-2 ${
              r.status === "pending" ? "border-yellow-500/30 bg-yellow-500/5" :
              r.status === "approved" ? "border-green-500/30 bg-green-500/5" :
              "border-destructive/30 bg-destructive/5"}`
              }>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{r.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{r.platform}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-foreground">{r.store}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent-foreground">{r.region}</span>
                          </div>
                          {r.description &&
                    <p className="text-xs text-muted-foreground mt-2">{r.description}</p>
                    }
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(r.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`text-xs font-medium capitalize px-2 py-0.5 rounded-full ${
                  r.status === "pending" ? "bg-yellow-500/20 text-yellow-400" :
                  r.status === "approved" ? "bg-green-500/20 text-green-400" :
                  "bg-destructive/20 text-destructive"}`
                  }>{r.status}</span>
                      </div>
                      {r.status === "pending" &&
                <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                          <Button size="sm" className="gap-1 h-7 text-xs" onClick={() => handleApproveRequest(r)}>
                            <CheckCircle2 className="h-3 w-3" />
                            Approve & Add
                          </Button>
                          <Button size="sm" variant="destructive" className="gap-1 h-7 text-xs" onClick={() => {
                    const note = prompt("Rejection reason (optional):");
                    handleRejectRequest(r.id, note || undefined);
                  }}>
                            <XCircle className="h-3 w-3" />
                            Reject
                          </Button>
                        </div>
                }
                      {r.status !== "pending" &&
                <div className="flex justify-end pt-1">
                          <button onClick={() => handleDeleteRequest(r.id)} className="text-xs text-muted-foreground hover:text-destructive">
                            Remove
                          </button>
                        </div>
                }
                    </div>
              )}
                </div>
            }
            </div>
          </div>
        }

        {/* Seller Applications List Modal */}
        {showSellerApps && !selectedApp &&
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
            <div className="bg-background rounded-2xl shadow-2xl border border-border p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-lg font-bold text-foreground">Seller Applications</h2>
                </div>
                <button onClick={() => setShowSellerApps(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {sellerApps.length === 0 ?
            <p className="text-sm text-muted-foreground font-body text-center py-8">No seller applications yet.</p> :

            <div className="space-y-1">
                  {sellerApps.map((app) =>
              <button
                key={app.id}
                onClick={() => setSelectedApp(app)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-secondary/60 transition-colors text-left">
                
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{app.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{app.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground">{new Date(app.created_at).toLocaleDateString()}</span>
                        <span className={`text-xs font-display font-bold px-2 py-0.5 rounded-full capitalize ${
                  app.status === "pending" ? "bg-yellow-600/20 text-yellow-700" :
                  app.status === "approved" ? "bg-green-700/20 text-green-700" :
                  "bg-destructive/20 text-destructive"}`
                  }>{app.status}</span>
                      </div>
                    </button>
              )}
                </div>
            }
            </div>
          </div>
        }

        {/* Seller Application Detail Modal */}
        {selectedApp &&
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
            <div className="bg-background rounded-2xl shadow-2xl border border-border p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-lg font-bold text-foreground">{selectedApp.full_name}</h2>
                </div>
                <button onClick={() => setSelectedApp(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-3 text-sm font-body">
                <div>
                  <span className="text-muted-foreground">Email: </span>
                  <span className="text-foreground">{selectedApp.email || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone: </span>
                  <span className="text-foreground">{selectedApp.phone || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Country: </span>
                  <span className="text-foreground">{selectedApp.country || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Business Name: </span>
                  <span className="text-foreground">{selectedApp.business_name || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Applied: </span>
                  <span className="text-foreground">{new Date(selectedApp.created_at).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status: </span>
                  <span className={`text-xs font-display font-bold px-2 py-0.5 rounded-full capitalize ${
                selectedApp.status === "pending" ? "bg-yellow-600/20 text-yellow-700" :
                selectedApp.status === "approved" ? "bg-green-700/20 text-green-700" :
                "bg-destructive/20 text-destructive"}`
                }>{selectedApp.status}</span>
                </div>
              </div>

              {/* Details */}
              <div className="bg-secondary/50 rounded-lg p-4 space-y-3 text-sm">
                <div>
                  <span className="font-semibold text-foreground">Products they want to sell:</span>
                  <p className="text-muted-foreground mt-0.5">{selectedApp.product_types || "—"}</p>
                </div>
                <div>
                  <span className="font-semibold text-foreground">Selling Experience:</span>
                  <p className="text-muted-foreground mt-0.5">{selectedApp.experience || "—"}</p>
                </div>
                <div>
                  <span className="font-semibold text-foreground">Why they want to sell with us:</span>
                  <p className="text-muted-foreground mt-0.5">{selectedApp.why_sell || "—"}</p>
                </div>
              </div>

              {/* Documents */}
              {(selectedApp.id_document_url || selectedApp.selfie_url || selectedApp.business_document_url || selectedApp.supplier_receipts_urls && selectedApp.supplier_receipts_urls.length > 0) &&
            <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">📎 Documents</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedApp.id_document_url &&
                <button
                  type="button"
                  className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
                  onClick={async () => {
                    const { data } = await supabase.storage.from("seller-documents").createSignedUrl(selectedApp.id_document_url, 300);
                    if (data?.signedUrl) window.open(data.signedUrl, "_blank");else
                    toast.error("Failed to load document");
                  }}>
                  
                        🪪 ID Document
                      </button>
                }
                    {selectedApp.selfie_url &&
                <button
                  type="button"
                  className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
                  onClick={async () => {
                    const { data } = await supabase.storage.from("seller-documents").createSignedUrl(selectedApp.selfie_url, 300);
                    if (data?.signedUrl) window.open(data.signedUrl, "_blank");else
                    toast.error("Failed to load document");
                  }}>
                  
                        🤳 Selfie
                      </button>
                }
                    {selectedApp.business_document_url &&
                <button
                  type="button"
                  className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
                  onClick={async () => {
                    const { data } = await supabase.storage.from("seller-documents").createSignedUrl(selectedApp.business_document_url, 300);
                    if (data?.signedUrl) window.open(data.signedUrl, "_blank");else
                    toast.error("Failed to load document");
                  }}>
                  
                        🏢 Business Doc
                      </button>
                }
                    {selectedApp.supplier_receipts_urls && selectedApp.supplier_receipts_urls.map((url: string, idx: number) =>
                <button
                  key={idx}
                  type="button"
                  className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
                  onClick={async () => {
                    const { data } = await supabase.storage.from("seller-documents").createSignedUrl(url, 300);
                    if (data?.signedUrl) window.open(data.signedUrl, "_blank");else
                    toast.error("Failed to load document");
                  }}>
                  
                        🧾 Receipt #{idx + 1}
                      </button>
                )}
                  </div>
                </div>
            }

              {/* Rejection note */}
              {selectedApp.admin_note && selectedApp.status === "rejected" &&
            <p className="text-sm text-destructive">Note: {selectedApp.admin_note}</p>
            }

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                {selectedApp.status === "pending" &&
              <>
                    <Button size="sm" className="gap-1" onClick={() => {handleApproveSellerApp(selectedApp);setSelectedApp(null);}}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" className="gap-1" onClick={() => {handleRejectSellerApp(selectedApp.id);setSelectedApp(null);}}>
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                  </>
              }
                {selectedApp.status !== "pending" &&
              <Button size="sm" variant="destructive" className="gap-1" onClick={() => {handleDeleteSellerApp(selectedApp.id);setSelectedApp(null);}}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
              }
                <Button size="sm" variant="ghost" onClick={() => setSelectedApp(null)}>Back</Button>
              </div>
            </div>
          </div>
        }

        {/* Kinguin Modal */}
        {showKinguin &&
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
            <div className="bg-background rounded-2xl shadow-2xl border border-border p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  Kinguin Integration
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setShowKinguin(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <KinguinManager />
            </div>
          </div>
        }
      </main>
      <Footer />
      <AgeverBot />
      {activeChatUser && user && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-[420px] max-w-full h-[600px] max-h-[90vh] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <LiveChatPanel
              requestId={activeChatUser.requestId}
              currentUserId={user.id}
              currentRole="admin"
              userEmail={activeChatUser.email}
              onClose={() => setActiveChatUser(null)}
            />
          </div>
        </div>
      )}
    </div>);

};

export default Admin;