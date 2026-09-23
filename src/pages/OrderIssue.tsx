import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ShieldCheck, LogIn } from "lucide-react";

/**
 * Guest checkout has been removed from the site, so this page no longer
 * accepts anonymous ticket submissions. Every purchase now belongs to an
 * authenticated account — buyers open support tickets from their account.
 */
const OrderIssue = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-2xl">
        <h1 className="text-3xl font-bold mb-2">Order issue</h1>
        <p className="text-muted-foreground mb-8">
          To open a support ticket, please sign in to the account you used at checkout.
          You'll find all your orders and a ticket form inside your account dashboard.
        </p>

        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <span className="font-semibold">Account required</span>
          </div>
          <p className="text-sm text-muted-foreground">
            For your security, order details and support tickets are only accessible
            from the account that placed the order.
          </p>
          <div className="flex gap-3 pt-2">
            <Button asChild className="flex-1">
              <Link to="/auth"><LogIn className="h-4 w-4 mr-2" /> Sign in</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link to="/help">Help center</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default OrderIssue;