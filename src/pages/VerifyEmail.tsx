import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AgeversLoader from "@/components/AgeversLoader";
import { CheckCircle, XCircle } from "lucide-react";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    const verify = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("verify-email-token", {
          body: { token },
        });

        if (error || !data?.success) {
          setStatus("error");
        } else {
          setStatus("success");
          setTimeout(() => navigate("/"), 3000);
        }
      } catch {
        setStatus("error");
      }
    };

    verify();
  }, [token, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {status === "loading" && (
          <>
            <AgeversLoader />
            <p className="text-muted-foreground font-display">Verifying your email...</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h1 className="text-2xl font-display font-bold text-foreground">Email Verified!</h1>
            <p className="text-muted-foreground">Your email has been verified successfully. You can now make purchases.</p>
            <p className="text-sm text-muted-foreground">Redirecting to home page...</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="h-16 w-16 text-destructive mx-auto" />
            <h1 className="text-2xl font-display font-bold text-foreground">Verification Failed</h1>
            <p className="text-muted-foreground">This verification link is invalid or has expired. Please request a new one.</p>
            <button
              onClick={() => navigate("/")}
              className="mt-4 h-11 px-8 rounded-md gradient-primary font-display text-sm font-semibold tracking-wider text-primary-foreground hover:opacity-90 transition-opacity"
            >
              GO TO HOME
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
