import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, Handshake, CheckCircle } from "lucide-react";
import WholesaleForm from "@/components/portal/WholesaleForm";
import AffiliateForm from "@/components/portal/AffiliateForm";
import PartnershipForm from "@/components/portal/PartnershipForm";

const BusinessPortal = () => {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "wholesale";
  const [submitted, setSubmitted] = useState<string | null>(null);

  if (submitted) {
    return (
      <div className="min-h-screen bg-black text-white">
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
          <div className="max-w-md text-center space-y-6">
            <div className="mx-auto w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Application Submitted</h1>
            <p className="text-white/60 text-lg">
              Thank you for your interest! Our team will review your {submitted} submission and get back to you within 2-3 business days.
            </p>
            <button
              onClick={() => setSubmitted(null)}
              className="mt-4 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg transition-colors text-sm font-medium"
            >
              Submit Another Application
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-16 sm:py-24">
        <div className="text-center mb-12 space-y-3">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Business Portal</h1>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Partner with us through wholesale, affiliate, or strategic business programs.
          </p>
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="w-full bg-white/5 border border-white/10 rounded-xl p-1 h-auto flex-wrap">
            <TabsTrigger value="wholesale" className="flex-1 min-w-[140px] data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 gap-2 py-3">
              <Building2 className="w-4 h-4" />
              Wholesale
            </TabsTrigger>
            <TabsTrigger value="affiliate" className="flex-1 min-w-[140px] data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 gap-2 py-3">
              <Users className="w-4 h-4" />
              Affiliate
            </TabsTrigger>
            <TabsTrigger value="partnership" className="flex-1 min-w-[140px] data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50 gap-2 py-3">
              <Handshake className="w-4 h-4" />
              Partnership
            </TabsTrigger>
          </TabsList>

          <div className="mt-8">
            <TabsContent value="wholesale">
              <FormContainer title="Wholesale Inquiry" description="Apply for bulk purchasing and wholesale pricing.">
                <WholesaleForm onSuccess={() => setSubmitted("wholesale inquiry")} />
              </FormContainer>
            </TabsContent>
            <TabsContent value="affiliate">
              <FormContainer title="Affiliate Program" description="Join our affiliate network and earn commissions.">
                <AffiliateForm onSuccess={() => setSubmitted("affiliate application")} />
              </FormContainer>
            </TabsContent>
            <TabsContent value="partnership">
              <FormContainer title="Business Partnership" description="Propose a strategic partnership with our team.">
                <PartnershipForm onSuccess={() => setSubmitted("partnership proposal")} />
              </FormContainer>
            </TabsContent>
          </div>
        </Tabs>
      </div>
      <Footer />
    </div>
  );
};

const FormContainer = ({ title, description, children }: { title: string; description: string; children: React.ReactNode }) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8 space-y-6">
    <div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-white/40 text-sm mt-1">{description}</p>
    </div>
    {children}
  </div>
);

export default BusinessPortal;
