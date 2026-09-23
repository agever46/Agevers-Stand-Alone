import { supabase } from "@/integrations/supabase/client";

interface AuditLogEntry {
  action_type: "create" | "update" | "delete";
  entity_type: string; // product, order, pricing, collection, user, discount, etc.
  entity_id?: string;
  entity_title?: string;
  changes?: Record<string, unknown>;
}

export const logAuditEvent = async (entry: AuditLogEntry) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("admin_audit_log" as any).insert({
      action_type: entry.action_type,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id || null,
      entity_title: entry.entity_title || null,
      changes: entry.changes || {},
      performed_by: user.id,
      performer_email: user.email || null,
    });
  } catch (err) {
    console.error("Audit log failed:", err);
  }
};
