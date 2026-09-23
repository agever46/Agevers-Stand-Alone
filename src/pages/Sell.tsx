import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import SellerBenefits from "@/components/seller/SellerBenefits";
import StepIndicator from "@/components/seller/StepIndicator";
import FileUploadField from "@/components/seller/FileUploadField";
import MultiFileUploadField from "@/components/seller/MultiFileUploadField";

const STEP_LABELS = ["Personal Info", "Identity", "Documents"];

const inputClass =
  "w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary";

const Sell = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Step 1: Personal info
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [productTypes, setProductTypes] = useState("");
  const [experience, setExperience] = useState("");
  const [whySell, setWhySell] = useState("");

  // Step 2: Identity verification
  const [idDocumentUrl, setIdDocumentUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);

  // Step 3: Business & supplier docs
  const [isRegisteredBusiness, setIsRegisteredBusiness] = useState(false);
  const [businessDocUrl, setBusinessDocUrl] = useState<string | null>(null);
  const [supplierReceipts, setSupplierReceipts] = useState<string[]>([]);

  const validateStep1 = () => {
    if (!fullName.trim() || !email.trim() || !country.trim() || !productTypes.trim()) {
      toast.error("Please fill in all required fields");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!idDocumentUrl) {
      toast.error("Please upload an ID document");
      return false;
    }
    if (!selfieUrl) {
      toast.error("Please upload a selfie");
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (isRegisteredBusiness && !businessDocUrl) {
      toast.error("Please upload your business registration document");
      return false;
    }
    if (supplierReceipts.length === 0) {
      toast.error("Please upload at least one supplier receipt");
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please sign in to apply");
      navigate("/auth");
      return;
    }
    if (!validateStep3()) return;

    setSubmitting(true);
    const { error } = await supabase.from("seller_applications").insert({
      user_id: user.id,
      full_name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      country: country.trim(),
      business_name: businessName.trim() || null,
      product_types: productTypes.trim(),
      experience: experience.trim() || null,
      why_sell: whySell.trim() || null,
      id_document_url: idDocumentUrl,
      selfie_url: selfieUrl,
      business_document_url: businessDocUrl,
      supplier_receipts_urls: supplierReceipts,
    } as any);
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
    } else {
      setSubmitted(true);
      toast.success("Application submitted successfully!");
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center pt-28">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-4 px-4"
          >
            <CheckCircle className="h-16 w-16 text-primary mx-auto" />
            <h1 className="font-display text-2xl font-bold text-foreground">
              Application Submitted!
            </h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              Thank you for applying. Our team will review your application and
              get back to you soon.
            </p>
            <Button variant="hero" onClick={() => navigate("/")}>
              Back to Home
            </Button>
          </motion.div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-36 pb-16">
        {/* Announcement Banner */}
        <div className="w-full mb-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-xl mx-4 md:mx-auto max-w-4xl border border-primary/30"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 animate-pulse" />
            <div className="relative px-6 py-5 text-center backdrop-blur-sm bg-card/80">
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">🎮 Since 2018</p>
              <h3 className="font-display text-lg md:text-xl font-black text-foreground mb-1">
                Agever's Has Opened Its Doors to New Sellers!
              </h3>
              <p className="text-sm text-muted-foreground max-w-xl mx-auto">
                We've been selling game codes since 2018 — and now we're welcoming new sellers to our marketplace. Don't miss this opportunity to sell with us!
              </p>
            </div>
          </motion.div>
        </div>

        <div className="container mx-auto px-4">
          {!showForm ? (
            <SellerBenefits
              onApply={() => {
                if (!user) {
                  toast.error("Please sign in first");
                  navigate("/auth");
                  return;
                }
                setShowForm(true);
              }}
            />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-lg mx-auto"
            >
              <h2 className="font-display text-2xl font-bold text-foreground mb-2 text-center">
                Seller Application
              </h2>
              <p className="text-muted-foreground text-sm text-center mb-6">
                Complete all steps to submit your application.
              </p>

              <StepIndicator
                currentStep={step}
                totalSteps={3}
                labels={STEP_LABELS}
              />

              <form onSubmit={handleSubmit} className="space-y-4">
                <AnimatePresence mode="wait">
                  {step === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <div>
                        <label className="text-xs font-display font-semibold text-foreground mb-1 block">
                          Full Name <span className="text-destructive">*</span>
                        </label>
                        <input className={inputClass} placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                      </div>
                      <div>
                        <label className="text-xs font-display font-semibold text-foreground mb-1 block">
                          Email <span className="text-destructive">*</span>
                        </label>
                        <input type="email" className={inputClass} placeholder="john@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                      </div>
                      <div>
                        <label className="text-xs font-display font-semibold text-foreground mb-1 block">Phone</label>
                        <input className={inputClass} placeholder="+1 234 567 890" value={phone} onChange={(e) => setPhone(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-display font-semibold text-foreground mb-1 block">
                          Country <span className="text-destructive">*</span>
                        </label>
                        <input className={inputClass} placeholder="United States" value={country} onChange={(e) => setCountry(e.target.value)} required />
                      </div>
                      <div>
                        <label className="text-xs font-display font-semibold text-foreground mb-1 block">Business Name</label>
                        <input className={inputClass} placeholder="Your business or store name (optional)" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-display font-semibold text-foreground mb-1 block">
                          What products will you sell? <span className="text-destructive">*</span>
                        </label>
                        <input className={inputClass} placeholder="e.g. Steam keys, PlayStation codes" value={productTypes} onChange={(e) => setProductTypes(e.target.value)} required />
                      </div>
                      <div>
                        <label className="text-xs font-display font-semibold text-foreground mb-1 block">Selling Experience</label>
                        <textarea className={`${inputClass} h-20 resize-none py-2`} placeholder="Tell us about your previous selling experience (optional)" value={experience} onChange={(e) => setExperience(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-display font-semibold text-foreground mb-1 block">Why do you want to sell with us?</label>
                        <textarea className={`${inputClass} h-20 resize-none py-2`} placeholder="Tell us why you'd like to join (optional)" value={whySell} onChange={(e) => setWhySell(e.target.value)} />
                      </div>

                      <Button type="button" variant="hero" className="w-full mt-4" onClick={handleNext}>
                        Next
                      </Button>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <div className="glass rounded-lg p-4 text-center mb-2">
                        <p className="text-xs text-muted-foreground">
                          Upload a government-issued ID and a selfie for identity verification.
                        </p>
                      </div>

                      <FileUploadField
                        label="ID Document"
                        required
                        userId={user!.id}
                        folder="id-document"
                        value={idDocumentUrl}
                        onChange={setIdDocumentUrl}
                        hint="Driver's license, passport, or national ID card"
                        accept="image/*,.pdf"
                      />

                      <FileUploadField
                        label="Selfie"
                        required
                        userId={user!.id}
                        folder="selfie"
                        value={selfieUrl}
                        onChange={setSelfieUrl}
                        hint="A clear photo of your face for identity matching"
                        accept="image/*"
                      />

                      <div className="flex gap-3 mt-4">
                        <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>
                          <ArrowLeft className="h-4 w-4 mr-1" /> Back
                        </Button>
                        <Button type="button" variant="hero" className="flex-1" onClick={handleNext}>
                          Next
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <div className="glass rounded-lg p-4 text-center mb-2">
                        <p className="text-xs text-muted-foreground">
                          Upload business documents and supplier receipts to verify your source of game codes.
                        </p>
                      </div>

                      <div>
                        <label className="text-xs font-display font-semibold text-foreground mb-1 block">
                          Are you a registered business?
                        </label>
                        <div className="flex gap-3 mt-1">
                          <button
                            type="button"
                            onClick={() => setIsRegisteredBusiness(true)}
                            className={`flex-1 h-10 rounded-md border text-sm font-display transition-colors ${
                              isRegisteredBusiness
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-secondary text-muted-foreground"
                            }`}
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsRegisteredBusiness(false);
                              setBusinessDocUrl(null);
                            }}
                            className={`flex-1 h-10 rounded-md border text-sm font-display transition-colors ${
                              !isRegisteredBusiness
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-secondary text-muted-foreground"
                            }`}
                          >
                            No, Individual
                          </button>
                        </div>
                      </div>

                      {isRegisteredBusiness && (
                        <FileUploadField
                          label="Business Registration Document"
                          required
                          userId={user!.id}
                          folder="business-doc"
                          value={businessDocUrl}
                          onChange={setBusinessDocUrl}
                          hint="Certificate of incorporation or business license"
                          accept="image/*,.pdf"
                        />
                      )}

                      <MultiFileUploadField
                        label="Supplier Receipts / Invoices"
                        required
                        userId={user!.id}
                        folder="supplier-receipts"
                        values={supplierReceipts}
                        onChange={setSupplierReceipts}
                        hint="Upload receipts from your code suppliers to prove legitimate sourcing (up to 5)"
                        accept="image/*,.pdf"
                        max={5}
                      />

                      <div className="flex gap-3 mt-4">
                        <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(2)}>
                          <ArrowLeft className="h-4 w-4 mr-1" /> Back
                        </Button>
                        <Button type="submit" variant="hero" className="flex-1" disabled={submitting}>
                          {submitting ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Submitting...
                            </>
                          ) : (
                            "Apply Now"
                          )}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setStep(1);
                  }}
                  className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
                >
                  ← Back to benefits
                </button>
              </form>
            </motion.div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Sell;
