import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Megaphone, Send, Eye, Loader2, Users, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { MARKETING_TEMPLATES, getTemplate, type MarketingTemplate } from "./marketingTemplates";
import { Plus, X, Code2 } from "lucide-react";

type Mode = "all_subscribers" | "all_users" | "manual";

interface Campaign {
  id: string;
  subject: string;
  html_content: string;
  status: string;
  total_recipients: number;
  total_sent: number;
  total_failed: number;
  created_at: string;
  sent_at: string | null;
}

const AdminMarketingEmails = () => {
  const [tab, setTab] = useState("compose");
  const [templateKey, setTemplateKey] = useState<string>(MARKETING_TEMPLATES[0].key);
  const [values, setValues] = useState<Record<string, any>>({ ...MARKETING_TEMPLATES[0].defaults });
  const [advancedMode, setAdvancedMode] = useState(false);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [mode, setMode] = useState<Mode>("all_subscribers");
  const [manualEmails, setManualEmails] = useState("");
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [unsubCount, setUnsubCount] = useState(0);

  const fetchCampaigns = async () => {
    const { data } = await (supabase
      .from("marketing_campaigns" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50) as any);
    setCampaigns((data as Campaign[]) ?? []);
  };

  const fetchUnsubCount = async () => {
    const { count } = await (supabase
      .from("marketing_unsubscribes" as any)
      .select("*", { count: "exact", head: true }) as any);
    setUnsubCount(count ?? 0);
  };

  const refreshRecipientCount = async () => {
    if (mode === "manual") {
      const list = manualEmails.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
      setRecipientCount(list.length);
      return;
    }
    if (mode === "all_subscribers") {
      const { count } = await (supabase
        .from("newsletter_subscribers" as any)
        .select("*", { count: "exact", head: true }) as any);
      setRecipientCount(count ?? 0);
    } else if (mode === "all_users") {
      const { count } = await (supabase
        .from("profiles" as any)
        .select("*", { count: "exact", head: true })
        .not("email", "is", null) as any);
      setRecipientCount(count ?? 0);
    }
  };

  useEffect(() => { fetchCampaigns(); fetchUnsubCount(); }, []);
  useEffect(() => { refreshRecipientCount(); }, [mode, manualEmails]);

  const currentTemplate: MarketingTemplate | undefined = getTemplate(templateKey);

  // Rebuild subject + html whenever the form values or template change (form mode only).
  useEffect(() => {
    if (advancedMode || !currentTemplate) return;
    const built = currentTemplate.build(values);
    setSubject(built.subject);
    setHtml(built.html);
  }, [values, templateKey, advancedMode, currentTemplate]);

  const pickTemplate = (key: string) => {
    const t = getTemplate(key);
    if (!t) return;
    setTemplateKey(key);
    setValues({ ...t.defaults });
    setAdvancedMode(false);
  };

  const setField = (key: string, val: any) =>
    setValues((prev) => ({ ...prev, [key]: val }));

  const setRepeatableItem = (groupKey: string, idx: number, field: string, val: any) =>
    setValues((prev) => {
      const list = Array.isArray(prev[groupKey]) ? [...prev[groupKey]] : [];
      list[idx] = { ...(list[idx] || {}), [field]: val };
      return { ...prev, [groupKey]: list };
    });

  const addRepeatableItem = (groupKey: string) =>
    setValues((prev) => {
      const list = Array.isArray(prev[groupKey]) ? [...prev[groupKey]] : [];
      list.push({});
      return { ...prev, [groupKey]: list };
    });

  const removeRepeatableItem = (groupKey: string, idx: number) =>
    setValues((prev) => {
      const list = Array.isArray(prev[groupKey]) ? [...prev[groupKey]] : [];
      list.splice(idx, 1);
      return { ...prev, [groupKey]: list };
    });

  const handleSend = async () => {
    if (!subject.trim() || !html.trim()) {
      toast.error("Subject and content are required");
      return;
    }
    setSending(true);
    setConfirmOpen(false);
    try {
      const filter: any = { mode };
      if (mode === "manual") {
        filter.emails = manualEmails.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
      }
      const { data: campaign, error: cErr } = await (supabase
        .from("marketing_campaigns" as any)
        .insert({
          subject, html_content: html, recipient_filter: filter, status: "draft",
        })
        .select()
        .single() as any);
      if (cErr) throw cErr;

      const { data, error } = await supabase.functions.invoke("send-marketing-campaign", {
        body: { campaignId: campaign.id },
      });
      if (error) throw error;
      toast.success(`Campaign sent! ${data.sent} delivered, ${data.failed} failed.`);
      setSubject(""); setHtml(""); setManualEmails("");
      fetchCampaigns();
      setTab("history");
    } catch (e: any) {
      toast.error(`Failed: ${e?.message || e}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-center gap-3">
        <Megaphone className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">Marketing Emails</h1>
      </div>

      <Card className="p-4 bg-amber-500/10 border-amber-500/40">
        <div className="flex gap-2 text-sm text-amber-200">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            Marketing emails are sent via <strong>Resend</strong> from <code>marketing@updates.agevers.com</code>,
            kept separate from transactional emails to protect deliverability. {unsubCount} users have unsubscribed.
          </div>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="compose">Compose</TabsTrigger>
          <TabsTrigger value="history">History ({campaigns.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-4 mt-4">
          <Card className="p-6 space-y-4">
            <div>
              <Label>Choose a template</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {MARKETING_TEMPLATES.map(t => (
                  <Button
                    key={t.key}
                    size="sm"
                    variant={t.key === templateKey && !advancedMode ? "default" : "outline"}
                    onClick={() => pickTemplate(t.key)}
                  >
                    {t.name}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={advancedMode ? "default" : "outline"}
                  onClick={() => setAdvancedMode(true)}
                >
                  <Code2 className="h-3.5 w-3.5 mr-1" /> Advanced (HTML)
                </Button>
              </div>
              {currentTemplate && !advancedMode && (
                <p className="text-xs text-muted-foreground mt-2">{currentTemplate.description}</p>
              )}
              {templateKey === "referral_boost" && !advancedMode && (
                <p className="text-xs text-muted-foreground mt-2">
                  The <code className="bg-muted px-1 rounded">{`{{referral_link}}`}</code> placeholder is replaced per-recipient with their personal invite link.
                </p>
              )}
            </div>

            {advancedMode || !currentTemplate ? (
              <>
                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)}
                    placeholder="🎮 Your weekly deals are here" />
                </div>
                <div>
                  <Label htmlFor="html">HTML content</Label>
                  <Textarea id="html" value={html} onChange={(e) => setHtml(e.target.value)}
                    placeholder="<h1>Hello!</h1><p>Your message...</p>"
                    rows={14} className="font-mono text-xs" />
                </div>
              </>
            ) : (
              <div className="space-y-4">
                {currentTemplate.fields.map((f) => (
                  <div key={f.key}>
                    <Label htmlFor={`f-${f.key}`}>{f.label}</Label>
                    {f.type === "textarea" ? (
                      <Textarea
                        id={`f-${f.key}`}
                        value={values[f.key] ?? ""}
                        onChange={(e) => setField(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        rows={3}
                      />
                    ) : (
                      <Input
                        id={`f-${f.key}`}
                        type={f.type === "number" ? "number" : "text"}
                        value={values[f.key] ?? ""}
                        onChange={(e) => setField(f.key, e.target.value)}
                        placeholder={f.placeholder}
                      />
                    )}
                    {f.help && <p className="text-xs text-muted-foreground mt-1">{f.help}</p>}
                    {f.type === "image" && values[f.key] && (
                      <img
                        src={values[f.key]}
                        alt=""
                        className="mt-2 h-16 w-28 object-cover rounded border border-border"
                        onError={(e) => ((e.currentTarget.style.display = "none"))}
                      />
                    )}
                  </div>
                ))}

                {currentTemplate.repeatable && (() => {
                  const rep = currentTemplate.repeatable!;
                  const items: any[] = Array.isArray(values[rep.key]) ? values[rep.key] : [];
                  return (
                    <div className="space-y-3 border-t border-border pt-4">
                      <div className="flex items-center justify-between">
                        <Label>{rep.label} ({items.length})</Label>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addRepeatableItem(rep.key)}
                          disabled={items.length >= rep.max}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Add {rep.itemLabel}
                        </Button>
                      </div>
                      {items.map((item, idx) => (
                        <Card key={idx} className="p-4 space-y-3 bg-muted/30">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">{rep.itemLabel} {idx + 1}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeRepeatableItem(rep.key, idx)}
                              disabled={items.length <= rep.min}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {rep.fields.map((rf) => (
                              <div key={rf.key}>
                                <Label className="text-xs">{rf.label}</Label>
                                <Input
                                  value={item?.[rf.key] ?? ""}
                                  onChange={(e) => setRepeatableItem(rep.key, idx, rf.key, e.target.value)}
                                  placeholder={rf.placeholder}
                                />
                                {rf.type === "image" && item?.[rf.key] && (
                                  <img
                                    src={item[rf.key]}
                                    alt=""
                                    className="mt-2 h-16 w-28 object-cover rounded border border-border"
                                    onError={(e) => ((e.currentTarget.style.display = "none"))}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </Card>
                      ))}
                    </div>
                  );
                })()}

                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground mb-1">Generated subject</div>
                  <div className="text-sm font-medium">{subject || <span className="text-muted-foreground">(empty)</span>}</div>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Recipients</h2>
            </div>

            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all_subscribers">All newsletter subscribers</SelectItem>
                <SelectItem value="all_users">All registered users</SelectItem>
                <SelectItem value="manual">Manual email list</SelectItem>
              </SelectContent>
            </Select>

            {mode === "manual" && (
              <Textarea value={manualEmails} onChange={(e) => setManualEmails(e.target.value)}
                placeholder="user1@example.com, user2@example.com" rows={5} />
            )}

            <div className="flex items-center justify-between bg-muted/40 p-3 rounded-md">
              <span className="text-sm">Estimated recipients (after removing unsubscribers):</span>
              <Badge variant="secondary" className="text-base">
                {recipientCount === null ? "..." : recipientCount}
              </Badge>
            </div>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setPreviewOpen(true)} disabled={!html}>
              <Eye className="h-4 w-4 mr-2" /> Preview
            </Button>
            <Button onClick={() => setConfirmOpen(true)}
              disabled={!subject || !html || sending || !recipientCount}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send Campaign
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-3">
          {campaigns.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">No campaigns yet.</Card>
          )}
          {campaigns.map(c => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{c.subject}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(c.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={c.status === "sent" ? "default" : c.status === "failed" ? "destructive" : "secondary"}>
                    {c.status}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-4 mt-3 text-sm">
                <span>📤 Sent: <strong>{c.total_sent}</strong></span>
                <span>❌ Failed: <strong>{c.total_failed}</strong></span>
                <span>👥 Total: <strong>{c.total_recipients}</strong></span>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader><DialogTitle>{subject}</DialogTitle></DialogHeader>
          <div className="bg-white text-black rounded p-4" dangerouslySetInnerHTML={{ __html: html }} />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send to {recipientCount} recipients?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will immediately send "<strong>{subject}</strong>" via Resend. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMarketingEmails;