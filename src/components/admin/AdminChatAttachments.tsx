import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, FileText, ExternalLink, ImageOff, Trash2 } from "lucide-react";
import AgeversLoader from "@/components/AgeversLoader";
import { logAuditEvent } from "@/lib/auditLog";
import { toast } from "sonner";

interface AttachmentRow {
  id: string;
  request_id: string;
  sender_role: string;
  attachment_path: string;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
  created_at: string;
  user_email: string;
  chat_status: string;
  signed_url: string | null;
}

const ATTACHMENT_BUCKET = "chat-attachments";

// Every file ever sent through the live-chat attachment feature (open or
// closed conversations) — AdminTickets' live-requests panel only lists
// pending/active chats, so a closed chat's attachments were previously only
// reachable by reopening that exact conversation. This page lists them all
// directly, with a signed URL to view/download each one.
const AdminChatAttachments = () => {
  const [rows, setRows] = useState<AttachmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: messages } = (await supabase
        .from("live_chat_messages")
        .select("id, request_id, sender_role, attachment_path, attachment_name, attachment_type, attachment_size, created_at")
        .not("attachment_path", "is", null)
        .order("created_at", { ascending: false })) as any;

      if (!messages || messages.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const requestIds = [...new Set(messages.map((m: any) => m.request_id))];
      const { data: requests } = (await supabase
        .from("live_support_requests" as any)
        .select("id, user_email, status")
        .in("id", requestIds)) as any;
      const requestMap: Record<string, { user_email: string; status: string }> = {};
      (requests || []).forEach((r: any) => {
        requestMap[r.id] = { user_email: r.user_email, status: r.status };
      });

      const withUrls = await Promise.all(
        messages.map(async (m: any) => {
          const { data: signed } = await supabase.storage
            .from(ATTACHMENT_BUCKET)
            .createSignedUrl(m.attachment_path, 3600);
          return {
            ...m,
            user_email: requestMap[m.request_id]?.user_email || "Unknown",
            chat_status: requestMap[m.request_id]?.status || "unknown",
            signed_url: signed?.signedUrl || null,
          } as AttachmentRow;
        })
      );
      setRows(withUrls);
      setLoading(false);
    })();
  }, []);

  const handleDelete = async (row: AttachmentRow) => {
    if (!confirm(`Delete "${row.attachment_name || "this file"}"? This cannot be undone.`)) return;
    setDeletingId(row.id);

    const { error: storageError } = await supabase.storage.from(ATTACHMENT_BUCKET).remove([row.attachment_path]);
    if (storageError) {
      toast.error(storageError.message || "Failed to delete file");
      setDeletingId(null);
      return;
    }

    await supabase
      .from("live_chat_messages")
      .update({ attachment_path: null, attachment_name: null, attachment_type: null, attachment_size: null })
      .eq("id", row.id);

    logAuditEvent({
      action_type: "delete",
      entity_type: "chat_attachment",
      entity_id: row.id,
      entity_title: row.attachment_name || row.attachment_path,
      changes: { attachment_path: row.attachment_path, user_email: row.user_email },
    });

    setRows((prev) => prev.filter((r) => r.id !== row.id));
    toast.success("Attachment deleted");
    setDeletingId(null);
  };

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return r.user_email.toLowerCase().includes(q) || (r.attachment_name || "").toLowerCase().includes(q);
  });

  if (loading) return <AgeversLoader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-xl font-bold text-foreground">
          Chat Attachments <span className="text-muted-foreground font-normal">({rows.length})</span>
        </h1>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by buyer email or filename..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 glass rounded-xl">
          <ImageOff className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No chat attachments found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((r) => {
            const isImage = (r.attachment_type || "").startsWith("image/");
            return (
              <div key={r.id} className="glass rounded-xl p-3 border border-border/50 space-y-2">
                {isImage && r.signed_url ? (
                  <a href={r.signed_url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={r.signed_url}
                      alt={r.attachment_name || "Attachment"}
                      loading="lazy"
                      className="w-full h-36 object-cover rounded-lg border border-border"
                    />
                  </a>
                ) : (
                  <a
                    href={r.signed_url || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center h-36 rounded-lg border border-border bg-secondary/40 text-muted-foreground"
                  >
                    <FileText className="h-8 w-8" />
                  </a>
                )}
                <p className="text-xs font-semibold text-foreground truncate" title={r.attachment_name || ""}>
                  {r.attachment_name || "Unnamed file"}
                </p>
                <p className="text-xs text-muted-foreground truncate" title={r.user_email}>
                  {r.user_email}
                </p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span
                    className={`px-1.5 py-0.5 rounded-full ${
                      r.chat_status === "closed" ? "bg-muted" : "bg-green-500/20 text-green-400"
                    }`}
                  >
                    {r.chat_status}
                  </span>
                  <span className="uppercase">{r.sender_role}</span>
                  <span>{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  {r.signed_url && (
                    <a
                      href={r.signed_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> Open / Download
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={deletingId === r.id}
                    onClick={() => handleDelete(r)}
                    className="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminChatAttachments;
