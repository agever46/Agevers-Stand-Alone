import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props { onSuccess: () => void; }

const WholesaleForm = ({ onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    company_name: "", contact_email: "", tax_id: "", business_address: "",
    sales_channels: "online", website_url: "", monthly_order_volume: "",
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name || !form.contact_email || !form.business_address || !form.monthly_order_volume) {
      toast.error("Please fill in all required fields"); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)) {
      toast.error("Please enter a valid email"); return;
    }
    if (form.website_url && !/^https?:\/\/.+/.test(form.website_url)) {
      toast.error("Website URL must start with http:// or https://"); return;
    }
    setLoading(true);
    const { error } = await supabase.from("wholesale_inquiries").insert(form);
    setLoading(false);
    if (error) { toast.error("Submission failed. Please try again."); return; }
    onSuccess();
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="Company Name *">
        <Input value={form.company_name} onChange={set("company_name")} placeholder="Acme Corp" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
      </Field>
      <Field label="Contact Email *">
        <Input type="email" value={form.contact_email} onChange={set("contact_email")} placeholder="contact@acme.com" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
      </Field>
      <Field label="Tax ID / VAT Number">
        <Input value={form.tax_id} onChange={set("tax_id")} placeholder="Optional" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
      </Field>
      <Field label="Business Address *">
        <Input value={form.business_address} onChange={set("business_address")} placeholder="123 Business St, City, Country" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
      </Field>
      <Field label="Sales Channels *">
        <Select value={form.sales_channels} onValueChange={v => setForm(p => ({ ...p, sales_channels: v }))}>
          <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="online">Online Only</SelectItem>
            <SelectItem value="physical">Physical Only</SelectItem>
            <SelectItem value="both">Both Online & Physical</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Website URL">
        <Input value={form.website_url} onChange={set("website_url")} placeholder="https://acme.com" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
      </Field>
      <Field label="Estimated Monthly Order Volume *">
        <Select value={form.monthly_order_volume} onValueChange={v => setForm(p => ({ ...p, monthly_order_volume: v }))}>
          <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Select volume" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="50-200">50 – 200 units</SelectItem>
            <SelectItem value="200-500">200 – 500 units</SelectItem>
            <SelectItem value="500-1000">500 – 1,000 units</SelectItem>
            <SelectItem value="1000+">1,000+ units</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Button type="submit" disabled={loading} className="w-full bg-white text-black hover:bg-white/90 h-12 text-sm font-semibold">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Wholesale Inquiry"}
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

export default WholesaleForm;
