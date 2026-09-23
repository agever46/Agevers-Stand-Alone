import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Save, Pencil, Upload, Send, CheckCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import AgeversLoader from "@/components/AgeversLoader";
import { useTranslation } from "react-i18next";

interface Profile {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  address: string | null;
  phone: string | null;
  email_verified: boolean;
}

const AVATAR_OPTIONS = [
  { style: 'fun-emoji', seeds: ['Felix','Bella','Luna','Sunny','Joy','Lucky','Buddy','Happy','Coco','Milo','Daisy','Peach','Star','Ziggy','Boo','Nala'] },
  { style: 'adventurer', seeds: ['Jack','James','Oliver','Leo','Milo','Charlie','Arthur','Freddie'] },
  { style: 'avataaars', seeds: ['Willow','Luna','Nova','Lyra','Aria','Maya','Jade','Cleo'] },
  { style: 'bottts', seeds: ['Z4','X1','T8','R2','D9','P5','V3','K7'] },
  { style: 'pixel-art', seeds: ['Hero','Knight','Mage','Rogue','Ghost','Alien','Robot','Dragon'] },
];

const AccountSettings = () => {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile>({ display_name: "", username: "", avatar_url: "", address: "", phone: "", email_verified: false });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("display_name, username, avatar_url, address, phone, email_verified")
      .eq("user_id", user!.id)
      .single();
    if (data) setProfile({ ...data, email_verified: data.email_verified ?? false });
    setLoading(false);
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    if (error) { toast.error(t("account.settings.toast.uploadFailed", { message: error.message })); return; }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    const url = data.publicUrl;
    await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
    setProfile(prev => ({ ...prev, avatar_url: url }));
    toast.success(t("account.settings.toast.avatarUpdated"));
  };

  const handlePickAvatar = async (style: string, seed: string) => {
    if (!user) return;
    const url = `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}`;
    await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
    setProfile(prev => ({ ...prev, avatar_url: url }));
    setShowAvatarPicker(false);
    toast.success(t("account.settings.toast.avatarUpdated"));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: profile.display_name,
        username: profile.username,
        address: profile.address,
      })
      .eq("user_id", user!.id);
    setSaving(false);
    if (error) toast.error(t("account.settings.toast.saveError"));
    else {
      toast.success(t("account.settings.toast.saved"));
      setEditing(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      toast.success(t("account.settings.deleteSuccess"));
      await signOut();
      navigate("/");
    } catch {
      toast.error(t("account.settings.deleteError"));
      setDeleting(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendingVerification) return;
    setResendingVerification(true);
    try {
      const { error } = await supabase.functions.invoke("send-verification-email");
      if (error) throw error;
      toast.success(t("account.settings.toast.verificationSent"));
    } catch (e: any) {
      if (e?.message?.includes("429")) {
        toast.error(t("account.settings.toast.rateLimited"));
      } else {
        toast.error(t("account.settings.toast.verificationFailed"));
      }
    } finally {
      setResendingVerification(false);
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
    <div>
      <div className="mb-6">
        <h2 className="font-display text-2xl font-black tracking-wider text-foreground">{t("account.settings.title")}</h2>
        <p className="text-muted-foreground text-sm mt-1">{t("account.settings.subtitle")}</p>
      </div>

      <div className="glass rounded-xl p-6 space-y-5 max-w-2xl">
        {/* Avatar */}
        <div>
          <label className="block text-sm font-body text-muted-foreground mb-2">{t("account.settings.avatar")}</label>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-border/50 shadow-inner">
              {profile.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt="" 
                  className="w-full h-full object-cover transition-opacity duration-300" 
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement?.classList.add('bg-primary/10');
                  }}
                />
              ) : (
                <span className="text-primary font-bold text-xl opacity-50">
                  {profile.display_name ? profile.display_name[0].toUpperCase() : "?"}
                </span>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleAvatarUpload(e.target.files[0]); }} />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => fileRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" /> {t("account.settings.uploadPhoto")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowAvatarPicker(!showAvatarPicker)}>
                {t("account.settings.pickAvatar")}
              </Button>
            </div>
          </div>

          {showAvatarPicker && (
            <div className="mt-4 p-4 rounded-lg border border-border bg-secondary/50">
              <p className="text-sm font-body text-muted-foreground mb-3">{t("account.settings.chooseAvatar")}</p>
              <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {AVATAR_OPTIONS.map(option => (
                  <div key={option.style}>
                    <p className="text-xs font-display font-bold text-primary/70 uppercase tracking-widest mb-3 border-b border-border/50 pb-1 flex justify-between items-center">
                      <span>{option.style.replace('-', ' ')}</span>
                      <span className="text-[10px] text-muted-foreground font-normal lowercase">{option.seeds.length} options</span>
                    </p>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                      {option.seeds.map(seed => (
                        <button
                          key={`${option.style}-${seed}`}
                          onClick={() => handlePickAvatar(option.style, seed)}
                          className="h-12 w-12 rounded-full overflow-hidden border-2 border-transparent hover:border-primary transition-all hover:scale-110 bg-secondary/80 flex items-center justify-center p-0.5"
                          title={`${option.style}: ${seed}`}
                        >
                          <img
                            src={`https://api.dicebear.com/9.x/${option.style}/svg?seed=${seed}`}
                            alt={seed}
                            className="w-full h-full"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-body text-muted-foreground mb-1">{t("account.settings.email")}</label>
          <div className="flex items-center gap-3">
            <input
              type="email"
              disabled
              value={user?.email || ""}
              className="flex-1 h-10 px-3 rounded-md bg-muted/50 border border-border/50 text-sm text-muted-foreground/70 font-body cursor-not-allowed"
            />
            {profile.email_verified ? (
              <span className="inline-flex items-center gap-1 text-xs font-display font-bold text-green-500 shrink-0">
                <CheckCircle className="h-4 w-4" /> {t("account.settings.verified")}
              </span>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-amber-500 border-amber-500/50 hover:bg-amber-500/10 shrink-0"
                onClick={handleResendVerification}
                disabled={resendingVerification}
              >
                <Send className="h-3.5 w-3.5" />
                {resendingVerification ? t("account.common.sending") : t("account.settings.verifyEmail")}
              </Button>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm font-body text-muted-foreground mb-1">{t("account.settings.username")}</label>
          <input
            type="text"
            value={profile.username || ""}
            onChange={(e) => setProfile({ ...profile, username: e.target.value })}
            disabled={!editing}
            className={`w-full h-10 px-3 rounded-md border border-border text-sm font-body focus:outline-none focus:ring-1 focus:ring-primary ${
              editing ? "bg-secondary text-foreground" : "bg-muted text-muted-foreground"
            }`}
          />
        </div>
        <div>
          <label className="block text-sm font-body text-muted-foreground mb-1">{t("account.settings.displayName")}</label>
          <input
            type="text"
            value={profile.display_name || ""}
            onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
            disabled={!editing}
            className={`w-full h-10 px-3 rounded-md border border-border text-sm font-body focus:outline-none focus:ring-1 focus:ring-primary ${
              editing ? "bg-secondary text-foreground" : "bg-muted text-muted-foreground"
            }`}
          />
        </div>
        <div>
          <label className="block text-sm font-body text-muted-foreground mb-1">{t("account.settings.phone")}</label>
          <input
            type="tel"
            value={profile.phone || ""}
            disabled
            className="w-full h-10 px-3 rounded-md bg-muted/50 border border-border/50 text-sm text-muted-foreground/70 font-body cursor-not-allowed"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {t("account.settings.phoneHint")}{" "}
            <a href="/account" className="text-primary hover:underline" onClick={(e) => { e.preventDefault(); window.location.href = "/account"; }}>
              {t("account.settings.phoneHintLink")}
            </a>
            {t("account.settings.phoneHintSuffix")}
          </p>
        </div>
        <div>
          <label className="block text-sm font-body text-muted-foreground mb-1">{t("account.settings.address")}</label>
          <input
            type="text"
            value={profile.address || ""}
            onChange={(e) => setProfile({ ...profile, address: e.target.value })}
            disabled={!editing}
            className={`w-full h-10 px-3 rounded-md border border-border text-sm font-body focus:outline-none focus:ring-1 focus:ring-primary ${
              editing ? "bg-secondary text-foreground" : "bg-muted text-muted-foreground"
            }`}
          />
        </div>
        {editing ? (
          <div className="flex gap-3">
            <Button variant="hero" className="gap-2" onClick={handleSaveProfile} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? t("account.common.saving") : t("account.settings.saveNow")}
            </Button>
            <Button variant="ghost" className="text-muted-foreground" onClick={() => { setEditing(false); fetchProfile(); }}>
              {t("account.common.cancel")}
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="gap-2" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
            {t("account.settings.editProfile")}
          </Button>
        )}
      </div>

      {/* Danger Zone — GDPR right to erasure */}
      <div className="glass rounded-xl p-6 max-w-2xl mt-6 border border-destructive/30">
        <h3 className="font-display text-sm font-bold tracking-wider text-destructive mb-1">
          {t("account.settings.dangerZone")}
        </h3>
        <p className="text-xs text-muted-foreground mb-4">{t("account.settings.deleteAccountDesc")}</p>
        {!confirmDelete ? (
          <Button variant="destructive" size="sm" className="gap-2" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" />
            {t("account.settings.deleteAccount")}
          </Button>
        ) : (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 space-y-3">
            <p className="font-display text-sm font-bold text-foreground">{t("account.settings.deleteConfirmTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("account.settings.deleteConfirmDesc")}</p>
            <div className="flex gap-3">
              <Button variant="destructive" size="sm" onClick={handleDeleteAccount} disabled={deleting}>
                {deleting ? t("account.settings.deleting") : t("account.settings.deleteConfirmButton")}
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                {t("account.common.cancel")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountSettings;
