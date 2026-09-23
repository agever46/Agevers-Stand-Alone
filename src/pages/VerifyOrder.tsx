import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, ShieldCheck, CheckCircle2, AlertTriangle, FileText } from "lucide-react";
import { toast } from "sonner";

interface Info {
  game_title: string;
  price: number;
  buyer_email: string | null;
  buyer_name: string | null;
  already_uploaded: number;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const VerifyOrder = () => {
  const { token = "" } = useParams();
  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Verify Your Order — Agever's";
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/id-verification-info?token=${encodeURIComponent(token)}`,
          { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Invalid link");
        setInfo(data);
      } catch (e: any) {
        setError(e.message || "Invalid or expired link");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      if (file.size > 15 * 1024 * 1024) {
        toast.error(`${file.name} is over 15MB`);
        continue;
      }
      const fd = new FormData();
      fd.append("token", token);
      fd.append("file", file);
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/id-verification-upload`, {
          method: "POST",
          headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        setUploaded((prev) => [...prev, file.name]);
        toast.success(`${file.name} uploaded`);
      } catch (e: any) {
        toast.error(`${file.name}: ${e.message}`);
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="glass rounded-2xl p-8 max-w-md text-center">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
          <h1 className="font-display text-xl font-bold text-foreground mb-2">Link not valid</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground mt-4">
            If you need help, email support@agevers.com.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-lg mx-auto glass rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">Verify your order</h1>
        </div>
        <div className="rounded-lg bg-secondary/50 border border-border p-3 mb-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-display">Order</p>
          <p className="text-sm text-foreground font-semibold">{info?.game_title}</p>
          <p className="text-xs text-muted-foreground mt-1">
            €{Number(info?.price || 0).toFixed(2)} • {info?.buyer_email}
          </p>
        </div>

        <p className="text-sm text-foreground mb-2">
          Please upload the documents requested by our team (government photo ID, PayPal
          transaction screenshot, etc.).
        </p>
        <p className="text-xs text-muted-foreground mb-5">
          Your files are stored privately and used only to verify this purchase. Maximum 15MB per
          file. Images (JPG/PNG/WEBP/HEIC) or PDF.
        </p>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          className="w-full h-12 gap-2 font-display tracking-wider"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Uploading…" : "Choose files to upload"}
        </Button>

        {uploaded.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-display">
              Uploaded ({uploaded.length + (info?.already_uploaded || 0)})
            </p>
            {uploaded.map((n) => (
              <div key={n} className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className="text-xs text-foreground truncate">{n}</span>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-2">
              You can close this page — we'll review the documents and release your code as soon as
              possible.
            </p>
          </div>
        )}

        {uploaded.length === 0 && (info?.already_uploaded || 0) > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-2">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs text-muted-foreground">
              {info?.already_uploaded} file(s) already uploaded for this order.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyOrder;
