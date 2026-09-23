import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props { onSuccess: () => void; }

const AffiliateForm = ({ onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "", email: "", instagram_handle: "", tiktok_handle: "", youtube_handle: "",
    primary_niche: "", follower_count: "", promotion_plan: "",
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.primary_niche || !form.follower_count || !form.promotion_plan) {
      toast.error("Please fill in all required fields"); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error("Please enter a valid email"); return;
    }
    setLoading(true);
    const { error } = await supabase.from("affiliate_applications").insert(form);
    setLoading(false);
    if (error) { toast.error("Submission failed. Please try again."); return; }
    onSuccess();
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="Full Name *">
        <Input value={form.full_name} onChange={set("full_name")} placeholder="John Doe" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
      </Field>
      <Field label="Email *">
        <Input type="email" value={form.email} onChange={set("email")} placeholder="john@example.com" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Instagram">
          <Input value={form.instagram_handle} onChange={set("instagram_handle")} placeholder="@handle" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
        </Field>
        <Field label="TikTok">
          <Input value={form.tiktok_handle} onChange={set("tiktok_handle")} placeholder="@handle" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
        </Field>
        <Field label="YouTube">
          <Input value={form.youtube_handle} onChange={set("youtube_handle")} placeholder="@channel" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
        </Field>
      </div>
      <Field label="Primary Niche *">
        <Select value={form.primary_niche} onValueChange={v => setForm(p => ({ ...p, primary_niche: v }))}>
          <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Select niche" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="gaming">Gaming</SelectItem>
            <SelectItem value="tech">Tech & Reviews</SelectItem>
            <SelectItem value="lifestyle">Lifestyle</SelectItem>
            <SelectItem value="entertainment">Entertainment</SelectItem>
            <SelectItem value="deals">Deals & Coupons</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Total Reach / Follower Count *">
        <Select value={form.follower_count} onValueChange={v => setForm(p => ({ ...p, follower_count: v }))}>
          <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Select range" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1k-10k">1K – 10K</SelectItem>
            <SelectItem value="10k-50k">10K – 50K</SelectItem>
            <SelectItem value="50k-100k">50K – 100K</SelectItem>
            <SelectItem value="100k-500k">100K – 500K</SelectItem>
            <SelectItem value="500k+">500K+</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="How will you promote us? *">
        <Textarea value={form.promotion_plan} onChange={set("promotion_plan")} placeholder="Describe your promotion strategy..." rows={4} className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none" />
      </Field>
      <Button type="submit" disabled={loading} className="w-full bg-white text-black hover:bg-white/90 h-12 text-sm font-semibold">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Affiliate Application"}
      </Button>
    </form>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <Label className="text-white/70 text-sm">{label}</Label>
    {children}
  </div>
);

export default AffiliateForm;
