import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Search } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import mascot from "@/assets/agevers-mascot.png";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="text-center max-w-lg">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
            className="mb-8"
          >
            <motion.img
              src={mascot}
              alt="Agever's mascot — page not found"
              className="h-40 sm:h-48 w-auto object-contain mx-auto mb-4 drop-shadow-[0_0_25px_rgba(139,92,246,0.6)]"
              animate={{ y: [0, -10, 0], rotate: [-2, 2, -2] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            />
            <div className="relative inline-block">
              <span className="font-display text-[8rem] sm:text-[10rem] font-black leading-none gradient-text">
                404
              </span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="font-display text-2xl sm:text-3xl font-bold mb-3"
          >
            Page Not Found
          </motion.h1>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-muted-foreground mb-8 text-base"
          >
            The page you're looking for doesn't exist or has been moved.
          </motion.p>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Button
              variant="hero"
              size="lg"
              onClick={() => navigate("/")}
              className="gap-2 w-full sm:w-auto"
            >
              <Home className="h-4 w-4" />
              Back to Home
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate(-1)}
              className="gap-2 w-full sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => navigate("/search")}
              className="gap-2 w-full sm:w-auto"
            >
              <Search className="h-4 w-4" />
              Search
            </Button>
          </motion.div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default NotFound;
