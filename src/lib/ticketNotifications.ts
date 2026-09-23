import { supabase } from "@/integrations/supabase/client";

interface TicketNotificationParams {
  ticket_id: string;
  action: "seller_response" | "admin_resolved" | "admin_refund" | "admin_closed" | "ticket_created" | "ticket_escalated";
  buyer_email: string;
  game_title: string;
  seller_response?: string;
  admin_note?: string;
}

export const sendTicketNotification = async (params: TicketNotificationParams) => {
  try {
    await supabase.functions.invoke("ticket-notification", {
      body: params,
    });
  } catch (error) {
    console.error("Failed to send ticket notification:", error);
    // Don't block the main flow if notification fails
  }
};
