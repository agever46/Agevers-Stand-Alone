// Live support notifier for admins
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { gameSounds } from "@/lib/gameSounds";
import { toast } from "sonner";


const AdminLiveSupportNotifier = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const initialLoadDone = useRef(false);


  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.rpc("check_my_role", { _role: "admin" }).then(({ data }) => {
      setIsAdmin(!!data);
    });
  }, [user]);

  useEffect(() => {
    if (!user || !isAdmin) return;

    // Skip sound on initial subscription — only react to NEW inserts
    initialLoadDone.current = false;
    const timer = setTimeout(() => {
      initialLoadDone.current = true;
    }, 2000);

    const channel = supabase
      .channel("admin-global-live-support-notify")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_support_requests",
        },
        (payload) => {
          if (!initialLoadDone.current) return;
          const req = payload.new as any;
          if (req.status === "pending") {
            gameSounds.notification();
            toast.info("🔴 New live support request!", { duration: 8000 });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "live_support_requests",
        },
        (payload) => {
          if (!initialLoadDone.current) return;
          const req = payload.new as any;
          const old = payload.old as any;
          // Reopened request (was closed, now pending again)
          if (old.status === "closed" && req.status === "pending") {
            gameSounds.notification();
            toast.info("🔴 Support request reopened!", { duration: 8000 });
          }
        }
      )
      .subscribe();

    // Notify admin when a customer replies inside an existing live chat
    const msgChannel = supabase
      .channel("admin-global-live-chat-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_chat_messages" },
        (payload) => {
          if (!initialLoadDone.current) return;
          const msg = payload.new as any;
          if (msg.sender_role !== "user") return;
          // Skip when the admin is already on the chat screen
          if (window.location.pathname.startsWith("/admin/tickets")) return;
          gameSounds.notification();
          const preview = String(msg.content || "").slice(0, 80);
          toast.info(`💬 Customer replied: ${preview}`, {
            duration: 10000,
            action: {
              label: "Open chat",
              onClick: () => navigate("/admin/tickets"),
            },
          });
        }
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
      supabase.removeChannel(msgChannel);
    };
  }, [user, isAdmin, navigate]);


  return null;
};

export default AdminLiveSupportNotifier;
