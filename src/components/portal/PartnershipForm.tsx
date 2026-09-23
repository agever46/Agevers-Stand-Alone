import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props { onSuccess: () => void; }

const GOALS = [
  "Revenue Growth", "Market Expansion", "Brand Awareness",
  "Technology Integration", "Content Collaboration", "Distribution Partnership",
];

const PartnershipForm = ({ onSuccess }: Props) => {
  const [loading, setLoading] = useState(false);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [form, setForm] = useState({
    representative_name: "", email: "", job_title: "",
    company_industry: "", proposal: "",
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const toggleGoal = (goal: string) => {
    setSelectedGoals(prev => prev.includes(goal) ? prev.filter(g => g !== goal) : [...prev, goal]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.representative_name || !form.email || !form.job_title || !form.company_industry || !form.proposal) {
      toast.error("Please fill in all required fields"); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error("Please enter a valid email"); return;
    }
    if (selectedGoals.length === 0) {
      toast.error("Please select at least one strategic goal"); return;
    }
    setLoading(true);
    const { error } = await supabase.from("partnership_proposals").insert({
      ...form, strategic_goals: selectedGoals,
    });
    setLoading(false);
    if (error) { toast.error("Submission failed. Please try again."); return; }
    onSuccess();
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="Representative Name *">
        <Input value={form.representative_name} onChange={set("representative_name")} placeholder="Jane Smith" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
      </Field>
      <Field label="Email *">
        <Input type="email" value={form.email} onChange={set("email")} placeholder="jane@company.com" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Job Title *">
          <Input value={form.job_title} onChange={set("job_title")} placeholder="VP of Business Development" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
        </Field>
        <Field label="Company Industry *">
          <Select value={form.company_industry} onValueChange={v => setForm(p => ({ ...p, company_industry: v }))}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Select industry" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gaming">Gaming</SelectItem>
              <SelectItem value="ecommerce">E-Commerce</SelectItem>
              <SelectItem value="fintech">Fintech</SelectItem>
              <SelectItem value="media">Media & Entertainment</SelectItem>
              <SelectItem value="technology">Technology</SelectItem>
              <SelectItem value="retail">Retail</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Partnership Proposal *">
        <Textarea value={form.proposal} onChange={set("proposal")} placeholder="Describe the partnership opportunity in detail..." rows={5} className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none" />
      </Field>
      <Field label="Strategic Goals * (select all that apply)">
        <div className="grid grid-cols-2 gap-3">
          {GOALS.map(goal => (
            <label key={goal} className="flex items-center gap-2 cursor-pointer text-sm text-white/70 hover:text-white transition-colors">
              <Checkbox
                checked={selectedGoals.includes(goal)}
                onCheckedChange={() => toggleGoal(goal)}
                className="border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-black"
              />
              {goal}
            </label>
          ))}
        </div>
      </Field>
      <Button type="submit" disabled={loading} className="w-full bg-white text-black hover:bg-white/90 h-12 text-sm font-semibold">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Partnership Proposal"}
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

export default PartnershipForm;
