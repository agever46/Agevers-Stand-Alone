import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { RotateCcw } from "lucide-react";

const RefundPolicy = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <section className="pt-32 pb-16">
      <div className="container mx-auto px-4 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-6">
            <RotateCcw className="h-8 w-8 text-primary" />
            <h1 className="font-display text-3xl md:text-5xl font-black tracking-wider text-foreground">
              REFUND POLICY
            </h1>
          </div>
          <p className="text-muted-foreground mb-12 text-sm">Last updated: March 2026</p>

          <div className="space-y-8 text-muted-foreground text-sm leading-relaxed">
            {/* Digital Products – Main Clause */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Refund Policy for Digital Products</h2>
              <p className="mb-3">
                Due to the nature of digital content, <strong className="text-foreground">all sales of digital codes and keys are final and non-refundable.</strong>
              </p>
              <p className="mb-3">
                Once a digital code has been delivered, displayed, or emailed to the customer, it is considered "unsealed" or "used" under the Israeli Consumer Protection Law (Information/Software exemption), EU Directive 2011/83/EU (Article 16(m)), and international digital commerce standards.
              </p>
              <p>
                By completing a purchase, you expressly consent to the immediate delivery of digital content and acknowledge that your right of withdrawal is waived upon delivery.
              </p>
            </section>

            {/* Exceptions */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Exceptions</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>Refunds may only be considered if the code is proven to be <strong className="text-foreground">invalid or defective</strong> at the time of delivery.</li>
                <li>In such cases, the customer must contact our support within <strong className="text-foreground">48 hours</strong> of purchase with a screenshot of the error message.</li>
                <li>We reserve the right to verify the code's status with the provider before issuing a refund or replacement.</li>
              </ul>
            </section>

            {/* How to Request */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">How to Request a Refund</h2>
              <p>To request a refund for a defective key, contact our support team at <a href="mailto:support@agevers.com" className="text-primary hover:underline">support@agevers.com</a> with your order number, a description of the issue, and a screenshot of the error. We will review your request within 48 hours.</p>
            </section>

            {/* Non-Refundable Items */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Non-Refundable Items</h2>
              <p>The following are non-refundable under all circumstances:</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Activated or redeemed game keys and codes</li>
                <li>Subscription services that have been used or activated</li>
                <li>In-game currency, top-ups, and virtual items</li>
                <li>Gift cards and prepaid cards once the code has been revealed</li>
                <li>Software license keys that have been activated</li>
              </ul>
            </section>

            {/* Defective Keys */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Defective Keys</h2>
              <p>If you receive a key that does not work, contact us immediately. We will verify the issue with the provider and provide either a replacement key or a full refund at no additional cost.</p>
            </section>

            {/* Region Restrictions */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Region-Restricted Products</h2>
              <p>
                Some products are region-locked and may only be activated in specific countries. Region information is displayed on each product page. It is the buyer's responsibility to verify regional compatibility before purchasing. <strong className="text-foreground">No refunds will be issued for region-related activation issues</strong> if the region was clearly indicated on the product page.
              </p>
            </section>

            {/* Legal Basis */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Legal Basis</h2>
              <p className="mb-2">This refund policy is established in accordance with:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong className="text-foreground">Israel:</strong> Consumer Protection Law, 5741-1981, Amendment 13 – exemption for digital content delivered immediately.</li>
                <li><strong className="text-foreground">European Union:</strong> Directive 2011/83/EU, Article 16(m) – waiver of withdrawal right for digital content delivered with consumer's prior consent.</li>
                <li><strong className="text-foreground">Australia:</strong> Australian Consumer Law (Schedule 2, Competition and Consumer Act 2010) – consumer guarantees for faulty products remain in effect.</li>
                <li><strong className="text-foreground">United States:</strong> FTC guidelines on digital commerce – full disclosure of terms prior to purchase.</li>
              </ul>
            </section>

            {/* Contact */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Contact Us</h2>
              <p>
                For any questions regarding this refund policy, please contact us at{" "}
                <a href="mailto:support@agevers.com" className="text-primary hover:underline">support@agevers.com</a>.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </section>
    <Footer />
  </div>
);

export default RefundPolicy;
