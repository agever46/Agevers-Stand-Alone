import { useEffect, useState } from "react";
import logoImg from "@/assets/logo.png";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const formatRemaining = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const clock = [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
  return d > 0 ? `${d}d ${clock}` : clock;
};

const ComingSoon = ({ onBypass, until }: { onBypass: () => void; until?: string | null }) => {
  const [clicks, setClicks] = useState(0);
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(
    until ? new Date(until).getTime() - Date.now() : null
  );

  useEffect(() => {
    if (!until) { setRemaining(null); return; }
    const tick = () => {
      const diff = new Date(until).getTime() - Date.now();
      setRemaining(diff);
      if (diff <= 0) window.location.reload();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [until]);

  const handleLogoClick = () => {
    const next = clicks + 1;
    setClicks(next);
    if (next >= 20) {
      setShowLogin(true);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error("Login failed: " + error.message);
        setLoading(false);
        return;
      }
      // Check if user is admin. This must go through the has_role() RPC, not a
      // direct table query — user_roles has no SELECT grant for anon/authenticated
      // (by design, so a user can never read or edit roles directly), only for
      // security-definer functions like has_role/is_super_admin. A direct query
      // here always came back 403 and silently signed the admin back out.
      const { data: isAdmin } = await supabase.rpc("has_role" as any, {
        _user_id: data.user.id,
        _role: "admin",
      } as any);

      if (isAdmin) {
        toast.success("Welcome back, Admin!");
        onBypass();
      } else {
        toast.error("Access denied. Admin credentials required.");
        await supabase.auth.signOut();
      }
    } catch {
      toast.error("Login failed.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#111827] to-[#0a0a0a] flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="text-center z-10 max-w-lg w-full"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8 cursor-pointer select-none"
          onClick={handleLogoClick}
        >
          <img src={logoImg} alt="Agever's" className="h-36 mx-auto object-contain drop-shadow-2xl" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-5xl md:text-6xl font-display font-bold text-white mb-4 tracking-tight"
        >
          under maintenance will be back soon
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-lg text-gray-400 mb-8 font-body leading-relaxed"
        >
          We're upgrading to something amazing.<br />
          Stay tuned for the best deals on digital game codes.
        </motion.p>

        {remaining !== null && remaining > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="mb-8"
          >
            <p className="text-sm uppercase tracking-widest text-gray-500 mb-2">Back online in</p>
            <div className="inline-block px-6 py-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <span className="text-4xl md:text-5xl font-display font-bold text-white tabular-nums">
                {formatRemaining(remaining)}
              </span>
            </div>
          </motion.div>
        )}

        <AnimatePresence>
          {showLogin && (
            <motion.form
              initial={{ opacity: 0, y: 20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              onSubmit={handleLogin}
              className="mx-auto max-w-xs flex flex-col gap-3 mb-8"
            >
              <Input
                type="email"
                placeholder="Admin email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
              />
              <Button type="submit" disabled={loading} variant="hero" size="lg">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Admin Login"}
              </Button>
            </motion.form>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="flex items-center justify-center gap-6 text-gray-500 text-sm"
        >
          <a href="https://instagram.com/agevers" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
            Instagram
          </a>
          <span className="w-1 h-1 bg-gray-600 rounded-full" />
          <a href="mailto:support@agevers.com" className="hover:text-white transition-colors">
            Contact Us
          </a>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default ComingSoon;
