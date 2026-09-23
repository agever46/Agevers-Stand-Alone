import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Pencil, CheckCircle, Save, X, Upload, Link2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import paypalLogo from "@/assets/paypal-logo.png";
import payoneerLogo from "@/assets/payoneer-logo.png";

interface Profile {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  phone: string | null;
  address: string | null;
  zip_code: string | null;
  country: string | null;
  city: string | null;
  state: string | null;
}

const emptyProfile: Profile = {
  display_name: null, username: null, avatar_url: null, phone: null,
  address: null, zip_code: null, country: null, city: null, state: null,
};

const SellerSettings = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [editing, setEditing] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(false);
  const [form, setForm] = useState<Profile>(emptyProfile);
  const [invoiceForm, setInvoiceForm] = useState({ vat_id: "", company_id: "", company_name: "" });
  const [saving, setSaving] = useState(false);
  const [sellerApp, setSellerApp] = useState<{ status: string; updated_at: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Payment accounts
  const [paypalEmail, setPaypalEmail] = useState("");
  const [payoneerEmail, setPayoneerEmail] = useState("");
  const [savedPaypal, setSavedPaypal] = useState<string | null>(null);
  const [savedPayoneer, setSavedPayoneer] = useState<string | null>(null);
  const [editingPayment, setEditingPayment] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles")
      .select("display_name, username, avatar_url, phone, address, zip_code, country, city, state")
      .eq("user_id", user.id).single()
      .then(({ data }) => {
        if (data) { setProfile(data as any); setForm(data as any); }
      });
    supabase.from("seller_applications").select("status, updated_at").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(1).single()
      .then(({ data }) => { if (data) setSellerApp(data as any); });

    // Fetch payment accounts
    supabase.from("seller_payment_accounts" as any)
      .select("paypal_email, payoneer_email")
      .eq("seller_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const d = data as any;
          setSavedPaypal(d.paypal_email);
          setSavedPayoneer(d.payoneer_email);
          setPaypalEmail(d.paypal_email || "");
          setPayoneerEmail(d.payoneer_email || "");
        }
      });
  }, [user]);

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    if (error) { toast({ title: "Upload failed", description: error.message, variant: "destructive" }); return; }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    const url = data.publicUrl;
    await supabase.from("profiles").update({ avatar_url: url } as any).eq("user_id", user.id);
    setProfile(prev => ({ ...prev, avatar_url: url }));
    setForm(prev => ({ ...prev, avatar_url: url }));
    toast({ title: "Avatar updated" });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      display_name: form.display_name,
      username: form.username,
      phone: form.phone,
      address: form.address,
      zip_code: form.zip_code,
      country: form.country,
      city: form.city,
      state: form.state,
    } as any).eq("user_id", user.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setProfile(form);
      setEditing(false);
      toast({ title: "Profile updated" });
    }
    setSaving(false);
  };

  const handleSavePayment = async () => {
    if (!user) return;
    setSavingPayment(true);

    const payload = {
      seller_id: user.id,
      paypal_email: paypalEmail.trim() || null,
      payoneer_email: payoneerEmail.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("seller_payment_accounts" as any)
      .select("id")
      .eq("seller_id", user.id)
      .single();

    let error;
    if (existing) {
      ({ error } = await supabase
        .from("seller_payment_accounts" as any)
        .update(payload as any)
        .eq("seller_id", user.id));
    } else {
      ({ error } = await supabase
        .from("seller_payment_accounts" as any)
        .insert(payload as any));
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSavedPaypal(paypalEmail.trim() || null);
      setSavedPayoneer(payoneerEmail.trim() || null);
      setEditingPayment(false);
      toast({ title: "Payment accounts updated" });
    }
    setSavingPayment(false);
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-black tracking-wider text-foreground mb-6">MY PERSONAL INFO</h1>

      {/* Personal Details */}
      <div className="glass rounded-xl p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xs font-bold tracking-widest text-muted-foreground uppercase">Personal Details</h2>
          {!editing ? (
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => { setEditing(false); setForm(profile); }}>
                <X className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-primary hover:text-primary" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="mb-4 pb-4 border-b border-border/30">
          <label className="text-xs text-muted-foreground mb-1 block">Email</label>
          <p className="text-sm text-foreground/60">{user?.email}</p>
        </div>

        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Avatar</label>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden shrink-0">
                  {form.avatar_url ? (
                    <img src={form.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-primary font-bold text-xl">{(form.display_name && form.display_name !== user?.email) ? form.display_name[0].toUpperCase() : "?"}</span>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleAvatarUpload(e.target.files[0]); }} />
                <Button variant="outline" size="sm" className="gap-2" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" /> Upload
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="text-xs text-muted-foreground mb-1 block">Full Name</label><Input value={(form.display_name && form.display_name !== user?.email) ? form.display_name : ""} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Nickname / Username</label><Input value={form.username || ""} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Phone Number</label><Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Zip Code</label><Input value={form.zip_code || ""} onChange={(e) => setForm({ ...form, zip_code: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Country</label><Input value={form.country || ""} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">City</label><Input value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">State</label><Input value={form.state || ""} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground mb-1 block">Address</label><Input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden shrink-0">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-primary font-bold text-lg">{(profile.display_name && profile.display_name !== user?.email) ? profile.display_name[0].toUpperCase() : "?"}</span>
                )}
              </div>
              <div>
                <p className="text-sm text-foreground font-medium">{(profile.display_name && profile.display_name !== user?.email) ? profile.display_name : "-"}</p>
                {profile.username && <p className="text-xs text-muted-foreground">@{profile.username}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div><p className="text-xs text-muted-foreground">Phone</p><p className="text-sm text-foreground">{profile.phone || "-"}</p></div>
              <div><p className="text-xs text-muted-foreground">Country</p><p className="text-sm text-foreground">{profile.country || "-"}</p></div>
              <div><p className="text-xs text-muted-foreground">City</p><p className="text-sm text-foreground">{profile.city || "-"}</p></div>
              <div><p className="text-xs text-muted-foreground">State</p><p className="text-sm text-foreground">{profile.state || "-"}</p></div>
              <div><p className="text-xs text-muted-foreground">Zip Code</p><p className="text-sm text-foreground">{profile.zip_code || "-"}</p></div>
              <div><p className="text-xs text-muted-foreground">Address</p><p className="text-sm text-foreground">{profile.address || "-"}</p></div>
            </div>
          </div>
        )}
      </div>

      {/* Payment Accounts */}
      <div className="glass rounded-xl p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xs font-bold tracking-widest text-muted-foreground uppercase">Linked Payment Accounts</h2>
          {!editingPayment ? (
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={() => setEditingPayment(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => { setEditingPayment(false); setPaypalEmail(savedPaypal || ""); setPayoneerEmail(savedPayoneer || ""); }}>
                <X className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-primary hover:text-primary" onClick={handleSavePayment} disabled={savingPayment}>
                <Save className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground mb-4">Link your payment accounts to auto-fill withdrawal requests. PayPal withdrawals will be processed automatically.</p>

        {editingPayment ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-lg border border-[#0070ba]/30 bg-[#0070ba]/5">
              <img src={paypalLogo} alt="PayPal" className="h-10 w-10 object-contain" />
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">PayPal Email</label>
                <Input type="email" value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} placeholder="your@paypal-email.com" />
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-lg border border-[#FF6C00]/30 bg-[#FF6C00]/5">
              <img src={payoneerLogo} alt="Payoneer" className="h-10 w-10 object-contain mix-blend-multiply dark:mix-blend-normal" />
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Payoneer Email</label>
                <Input type="email" value={payoneerEmail} onChange={(e) => setPayoneerEmail(e.target.value)} placeholder="your@payoneer-email.com" />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50">
              <img src={paypalLogo} alt="PayPal" className="h-10 w-10 object-contain" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">PayPal</p>
                <p className="text-sm text-foreground font-medium">{savedPaypal || "Not linked"}</p>
              </div>
              {savedPaypal ? (
                <span className="inline-flex items-center gap-1 text-xs text-neon-green font-medium"><Link2 className="h-3.5 w-3.5" /> Linked</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Unlink className="h-3.5 w-3.5" /> Not linked</span>
              )}
            </div>
            <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50">
              <img src={payoneerLogo} alt="Payoneer" className="h-10 w-10 object-contain mix-blend-multiply dark:mix-blend-normal" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Payoneer</p>
                <p className="text-sm text-foreground font-medium">{savedPayoneer || "Not linked"}</p>
              </div>
              {savedPayoneer ? (
                <span className="inline-flex items-center gap-1 text-xs text-neon-green font-medium"><Link2 className="h-3.5 w-3.5" /> Linked</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Unlink className="h-3.5 w-3.5" /> Not linked</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Invoice Details */}
      <div className="glass rounded-xl p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xs font-bold tracking-widest text-muted-foreground uppercase">Invoice Details For Your Purchase</h2>
          {!editingInvoice ? (
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={() => setEditingInvoice(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => setEditingInvoice(false)}>
                <X className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-primary hover:text-primary" onClick={() => { setEditingInvoice(false); toast({ title: "Invoice details saved" }); }}>
                <Save className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        {editingInvoice ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="text-xs text-muted-foreground mb-1 block">Company Name</label><Input value={invoiceForm.company_name} onChange={(e) => setInvoiceForm({ ...invoiceForm, company_name: e.target.value })} /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">VAT ID</label><Input value={invoiceForm.vat_id} onChange={(e) => setInvoiceForm({ ...invoiceForm, vat_id: e.target.value })} /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Company ID</label><Input value={invoiceForm.company_id} onChange={(e) => setInvoiceForm({ ...invoiceForm, company_id: e.target.value })} /></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><p className="text-xs text-muted-foreground">Company Name</p><p className="text-sm text-foreground">{invoiceForm.company_name || "-"}</p></div>
            <div><p className="text-xs text-muted-foreground">VAT ID</p><p className="text-sm text-foreground">{invoiceForm.vat_id || "-"}</p></div>
            <div><p className="text-xs text-muted-foreground">Company ID</p><p className="text-sm text-foreground">{invoiceForm.company_id || "-"}</p></div>
          </div>
        )}
      </div>

      {/* Account Verification */}
      <div className="glass rounded-xl p-6">
        <h2 className="font-display text-xs font-bold tracking-widest text-muted-foreground uppercase mb-4">Account Verification</h2>
        <div className="rounded-lg bg-neon-green/10 p-4 mb-3">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-neon-green" />
            <span className="text-sm font-bold text-neon-green">Active</span>
          </div>
        </div>
        {sellerApp && (
          <p className="text-xs text-muted-foreground">
            Last updated: <span className="font-semibold text-foreground">{new Date(sellerApp.updated_at).toLocaleString()}</span>
          </p>
        )}
      </div>
    </div>
  );
};

export default SellerSettings;
