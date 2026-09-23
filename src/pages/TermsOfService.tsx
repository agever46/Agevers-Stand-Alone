import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { FileText } from "lucide-react";

const TermsOfService = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <section className="pt-32 pb-16">
      <div className="container mx-auto px-4 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-6">
            <FileText className="h-8 w-8 text-primary" />
            <h1 className="font-display text-3xl md:text-5xl font-black tracking-wider text-foreground">
              TERMS &amp; CONDITIONS
            </h1>
          </div>
          <p className="text-muted-foreground mb-12 text-sm">Last updated: March 2026</p>

          <div className="space-y-10 text-muted-foreground text-sm leading-relaxed">
            {/* Intro */}
            <section>
              <p className="mb-3">
                These Terms and Conditions regulate the relationship between you (the "User") and Agever's ("Platform Operator", "we", "us") with respect to your use of the Platform and any purchase of Products you make via the Platform. If you have any enquiries, please email:{" "}
                <a href="mailto:support@agevers.com" className="text-primary hover:underline">support@agevers.com</a>.
              </p>
              <p>
                By creating an account, accessing or otherwise using the Platform, you acknowledge that you have read, understood, and agreed to be bound by these Terms and Conditions. If you do not agree, you must stop using the Platform immediately.
              </p>
            </section>

            {/* 1. Definitions */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">1. Definitions</h2>
              <ul className="list-disc list-inside space-y-2">
                <li><strong className="text-foreground">"Account"</strong> means the account that Users create through the Platform to use the Services.</li>
                <li><strong className="text-foreground">"Buyer"</strong> means a person that purchases a Product through the Platform.</li>
                <li><strong className="text-foreground">"CD Key"</strong> means a serial number or code used to register and activate a specific Product, provided to you upon successful payment.</li>
                <li><strong className="text-foreground">"Confirmation Order"</strong> means any written or electronic confirmation sent to Buyers in relation to Products, which may include the CD Key, Product Price, payment terms, and Product details.</li>
                <li><strong className="text-foreground">"Content"</strong> means any content submitted, generated, featured, or displayed through the Platform, including text, graphics, photos, reviews, and other materials.</li>
                <li><strong className="text-foreground">"Platform"</strong> means the Agever's website at agevers.com, all subpages, subdomains, and any related mobile applications.</li>
                <li><strong className="text-foreground">"Product"</strong> means any digital game keys, software licenses, gift cards, top-ups, in-game items, subscription codes, or other digital products made available through the Platform.</li>
                <li><strong className="text-foreground">"Product Price"</strong> means the total amount chargeable to Buyers for the purchase of a Product.</li>
                <li><strong className="text-foreground">"Seller"</strong> means an approved third-party seller who lists and sells Products through the Platform.</li>
                <li><strong className="text-foreground">"Service"</strong> means the online services offered by Agever's in connection with the Platform, including providing access to Products, payment services, and customer support.</li>
                <li><strong className="text-foreground">"User"</strong>, <strong className="text-foreground">"you"</strong> and <strong className="text-foreground">"your"</strong> collectively mean the person, company, or organization that is using the Platform and/or the Service.</li>
              </ul>
            </section>

            {/* 2. About the Platform */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">2. About the Platform</h2>
              <div className="space-y-3">
                <p>2.1 The Platform provides access to a variety of digital Products and permits Buyers to purchase legitimate CD Keys for computer games, console games, software, gift cards, and other digital products.</p>
                <p>2.2 Buyers understand and acknowledge that any transaction resulting from their use of the Services is between the Buyer and the relevant Seller. Agever's acts as a marketplace facilitating the sale.</p>
                <p>2.3 Promotions, sales, and giveaways may be offered via the Platform from time to time. Any such promotions may be modified or discontinued at our sole discretion without prior notice.</p>
                <p>2.4 The Platform may not be available in all countries, and we may modify, suspend, or discontinue the Platform, in whole or in part, at any time without notice.</p>
              </div>
            </section>

            {/* 3. Changes to Terms */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">3. Changes to the Terms and Conditions</h2>
              <div className="space-y-3">
                <p>3.1 We may amend these Terms and Conditions from time to time at our sole discretion. We will use reasonable efforts to notify you of material changes, but we are not required to provide prior notice.</p>
                <p>3.2 Your continued use of the Platform after any amendment constitutes your acceptance of the updated terms.</p>
                <p>3.3 You agree to review these Terms and Conditions periodically. If you do not agree to the updated terms, you must stop using the Platform immediately.</p>
              </div>
            </section>

            {/* 4. Eligibility & Account */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">4. Eligibility, Account Registration &amp; Security</h2>
              <div className="space-y-3">
                <p>4.1 To use our Services, you must create an Account using your name and email address. Each Account must have a unique username and password.</p>
                <p>4.2 You must be at least 18 years old, or have the consent of a parent or legal guardian, to create an Account and purchase Products.</p>
                <p>4.3 You are responsible for maintaining the security of your Account and for all activities that occur under it. You must provide accurate and complete information and keep your Account updated.</p>
                <p>4.4 You may not share your password with third parties. You agree to notify us immediately of any unauthorized use of your Account.</p>
                <p>4.5 Your Account is strictly personal and non-transferable. You may not sell, charge others for, or otherwise transfer your Account.</p>
                <p>4.6 We reserve the right to suspend or terminate your Account at any time if any information provided proves to be inaccurate, false, or misleading, or if your conduct violates these Terms.</p>
                <p>4.7 We reserve the right to request additional verification (such as a valid ID) to confirm your identity and to decline or refund any order we believe to be fraudulent.</p>
              </div>
            </section>

            {/* 5. User Conduct */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">5. User Conduct and Restrictions</h2>
              <div className="space-y-3">
                <p>5.1 All Products on the Platform are distributed electronically. There are no physical items to be delivered. You will receive a legitimate electronic CD Key for the Product you purchase.</p>
                <p>5.2 Once you pay the Product Price and pass security checks, the CD Key will be made available on your Account. Neither the Seller nor Agever's shall be responsible for any loss resulting from lost or stolen CD Keys.</p>
                <p>5.3 When you purchase a Product, you are purchasing a <strong className="text-foreground">licence to use</strong> that Product — you do not take ownership of the Product itself. You are granted a limited, non-exclusive, non-transferable, revocable, personal licence to use such Products.</p>
                <p>5.4 Some Products may have specific restrictions, including: (i) country of residence only; (ii) the purchasing Account only; (iii) limited time periods; (iv) certain compatible systems or devices only.</p>
                <p>5.5 You may not, in whole or in part, copy, reproduce, distribute, reverse engineer, modify, disassemble, decompile, or create derivative works from any Products without our prior written consent.</p>
                <p>5.6 You are entitled to use Products for personal use only. You may not sell, rent, lease, license, or commercially exploit Products or any part thereof.</p>
                <p>5.7 Users agree not to transmit any Content that: (i) is unlawful; (ii) harasses or threatens any individual or group; (iii) is spam or unauthorized advertising; (iv) contains viruses, malware, or harmful code; (v) infringes on intellectual property rights; (vi) impersonates any person or entity; or (vii) violates anyone's privacy.</p>
              </div>
            </section>

            {/* 6. Products */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">6. Products</h2>
              <div className="space-y-3">
                <p>6.1 Upon payment, you may download and access a copy of the Product for personal use. It is <strong className="text-foreground">your responsibility</strong> to ensure your device meets the minimum system requirements before purchase.</p>
                <p>6.2 You are responsible for any internet or connection charges incurred when downloading or accessing Products.</p>
                <p>6.3 Some Products may require you to create an account with the applicable third-party platform (e.g., Steam, PlayStation Network, Xbox Live, Epic Games Store, Nintendo eShop). Information you provide to third parties is subject to their terms and privacy policies.</p>
                <p>6.4 Once you purchase a Product and it is made available, you are responsible for retrieving the CD Key and confirming your ability to access the Product. You bear all risk of loss thereafter.</p>
                <p>6.5 If you are unable to access a Product, please contact our support team at{" "}
                  <a href="mailto:support@agevers.com" className="text-primary hover:underline">support@agevers.com</a>.
                </p>
              </div>
            </section>

            {/* 7. Payments */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">7. Payments</h2>
              <div className="space-y-3">
                <p>7.1 Agever's is the <strong className="text-foreground">Merchant of Record</strong> for all transactions on the Platform and is responsible for its own sales tax/VAT obligations and for issuing invoices and receipts. Payments are processed on our behalf by <strong className="text-foreground">PayPal</strong>, or by <strong className="text-foreground">NOWPayments</strong> for cryptocurrency payments, acting as our payment processors.</p>
                <p>7.2 By making a purchase via PayPal, you also agree to PayPal's{" "}
                  <a href="https://www.paypal.com/legalhub" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">User Agreement</a> and{" "}
                  <a href="https://www.paypal.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Privacy Policy</a>. If you pay by cryptocurrency, NOWPayments' terms apply to that payment in addition to these Terms.
                </p>
                <p>7.3 Buyers undertake to pay the Product Price as specified in the Confirmation Order. Buyers are responsible for providing a valid means of payment.</p>
                <p>7.4 After a Buyer successfully makes a payment, the Seller shall send confirmation of the amount received and deliver the CD Key.</p>
                <p>7.5 We reserve the right to delay or decline purchases of any Product for any reason. Limits may apply to the amount and number of Products you can buy.</p>
                <p>7.6 The Buyer acknowledges they are of appropriate age for both the Products and their content, and have authorization of the payment method holder to make the purchase.</p>
                <p>7.7 Prices are displayed in EUR by default and may be shown in your local currency where supported. Any currency conversion is handled by your payment provider or card issuer; conversion fees, if any, are the responsibility of the Buyer.</p>
              </div>
            </section>

            {/* 8. Refunds */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">8. Refund Policy</h2>
              <div className="space-y-3">
                <p>8.1 Due to the nature of digital content, <strong className="text-foreground">all sales of digital codes and keys are final and non-refundable</strong> once delivered.</p>
                <p>8.2 Refunds may only be considered if the code is proven to be <strong className="text-foreground">invalid or defective</strong> at the time of delivery. The customer must contact support within <strong className="text-foreground">48 hours</strong> of purchase with a screenshot of the error.</p>
                <p>8.3 We reserve the right to verify the code's status with the provider before issuing a refund or replacement.</p>
                <p>8.4 The following are <strong className="text-foreground">non-refundable</strong> under all circumstances: activated or redeemed keys; used subscription services; in-game currency and virtual items; revealed gift cards; activated software licenses.</p>
                <p>8.5 <strong className="text-foreground">No refunds will be issued for region-related activation issues</strong> if the region was clearly indicated on the product page.</p>
                <p>8.6 This refund policy is established in accordance with the Israeli Consumer Protection Law (5741-1981, Amendment 13), EU Directive 2011/83/EU (Article 16(m)), Australian Consumer Law, and FTC guidelines on digital commerce.</p>
                <p>8.7 For full details, please see our{" "}
                  <a href="/refund-policy" className="text-primary hover:underline">Refund Policy</a> page.
                </p>
              </div>
            </section>

            {/* 8A. Giveaways */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">8A. Giveaways &amp; Promotional Entries</h2>
              <div className="space-y-3">
                <p>8A.1 Agever's runs free giveaways open to registered users. Participation is free and does not require a purchase.</p>
                <p>8A.2 <strong className="text-foreground">Automatic entry on purchase:</strong> when a giveaway is active, any order that reaches a successful status (completed / paid / delivered) will automatically enroll the buyer in the current active giveaway and grant a bonus entry. This applies even if you have not previously joined that giveaway manually.</p>
                <p>8A.3 If you do not wish to be entered, you may contact <a href="mailto:support@agevers.com" className="text-primary hover:underline">support@agevers.com</a> before or immediately after your purchase to have your entry removed. Automatic entry does not change the price, terms, or refund rights of your order in any way.</p>
                <p>8A.4 Winners are selected at the end of each giveaway period and notified by email. We reserve the right to disqualify any entry suspected of fraud, abuse, multi-accounting, or violation of these Terms.</p>
              </div>
            </section>

            {/* 9. Sellers on the Platform */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">9. Sellers on the Platform</h2>
              <div className="space-y-3">
                <p>9.1 Agever's operates as a marketplace where approved Sellers can list and sell their Products. All Sellers must apply and be approved before listing any Products.</p>
                <p>9.2 Sellers are responsible for ensuring that all CD Keys they sell are legitimate, functional, and have been legally obtained.</p>
                <p>9.3 Agever's reserves the right to remove any Seller or Product from the Platform at any time if we believe the Seller is acting in bad faith, selling fraudulent keys, or violating these Terms.</p>
                <p>9.4 Buyers understand that while Agever's facilitates the transaction, the sale is between the Buyer and the Seller. Agever's provides buyer protection and dispute resolution services.</p>
              </div>
            </section>

            {/* 10. User Content & Reviews */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">10. User Content &amp; Reviews</h2>
              <div className="space-y-3">
                <p>10.1 We are not responsible for any display or misuse of your User Content. You are solely responsible for any content you submit, post, or upload.</p>
                <p>10.2 Buyers may submit reviews of Sellers and Products. These reviews do not constitute a guarantee or warranty. We may remove reviews at our sole discretion.</p>
                <p>10.3 By posting any Content via the Platform, you grant Agever's a worldwide, royalty-free, non-exclusive license to use, reproduce, display, modify, and distribute the Content in connection with our business and marketing purposes.</p>
                <p>10.4 Users represent and warrant that they have the right to post all User Content they submit.</p>
              </div>
            </section>

            {/* 11. Intellectual Property */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">11. Intellectual Property</h2>
              <div className="space-y-3">
                <p>11.1 Agever's retains ownership of all intellectual property rights related to the Platform and Service, including copyrights, patents, trademarks, and other proprietary rights.</p>
                <p>11.2 The Agever's name, logo, and all trademarks appearing on the Platform may not be copied, reproduced, used, or distributed without our prior written permission.</p>
                <p>11.3 If you believe any material on the Platform infringes your copyright or intellectual property rights, please notify us at{" "}
                  <a href="mailto:support@agevers.com" className="text-primary hover:underline">support@agevers.com</a>.
                </p>
              </div>
            </section>

            {/* 12. Third-Party Content & Links */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">12. Third-Party Content &amp; Links</h2>
              <div className="space-y-3">
                <p>12.1 The Platform may provide links to third-party platforms. We have no control over third-party content and are not responsible for it.</p>
                <p>12.2 If you decide to access third-party content through our Platform, you do so at your own risk and our Terms and Conditions no longer govern.</p>
              </div>
            </section>

            {/* 13. Disclaimer of Warranties */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">13. Disclaimer of Warranties &amp; Limitation of Liability</h2>
              <div className="space-y-3">
                <p>13.1 All Products and Services are provided on an <strong className="text-foreground">"as is"</strong> and <strong className="text-foreground">"as available"</strong> basis. We make no warranties regarding the accuracy, reliability, or availability of the Service or Products.</p>
                <p>13.2 Agever's is a marketplace and is <strong className="text-foreground">not responsible</strong> for any issues, downtime, or policy changes of third-party platforms (e.g., Steam, PlayStation Network, Xbox Live, Nintendo eShop, Epic Games Store).</p>
                <p>13.3 It is the customer's sole responsibility to ensure system requirements are met and the Product is compatible with their geographical region before purchase.</p>
                <p>13.4 To the maximum extent permitted by applicable law, in no event shall Agever's or its operators be liable for any indirect, incidental, consequential, special, punitive, or exemplary damages, including loss of profits, business reputation, or data.</p>
                <p>13.5 Our total liability for any claim arising from a purchase shall not exceed the actual amount paid by the customer for the specific Product in question.</p>
              </div>
            </section>

            {/* 14. Indemnification */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">14. Indemnification</h2>
              <div className="space-y-3">
                <p>14.1 You agree to indemnify and hold harmless Agever's from any claims, demands, losses, damages, or expenses arising from: (i) your use of the Platform; (ii) your violation of these Terms; (iii) your User Content; or (iv) any dispute between you and another User or third party.</p>
                <p>14.2 If you have a dispute with another User, you release Agever's from any and all claims arising out of such dispute.</p>
              </div>
            </section>

            {/* 15. Email Communications */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">15. Email Communications</h2>
              <div className="space-y-3">
                <p>15.1 We may send you emails about Services, updates, and promotions. You may unsubscribe from promotional emails at any time.</p>
                <p>15.2 You consent to receive communications from us electronically and agree that electronic communications satisfy any legal requirement for written communications.</p>
              </div>
            </section>

            {/* 16. Termination */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">16. Termination</h2>
              <div className="space-y-3">
                <p>16.1 You may terminate this Agreement by discontinuing use of the Platform. To delete your Account data, contact us at{" "}
                  <a href="mailto:support@agevers.com" className="text-primary hover:underline">support@agevers.com</a>.
                </p>
                <p>16.2 Your rights under these Terms will automatically terminate without notice and without refund if you fail to comply with these Terms.</p>
                <p>16.3 All provisions that should survive termination will survive, including ownership, warranty disclaimers, indemnity, and limitations of liability.</p>
              </div>
            </section>

            {/* 17. Governing Law */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">17. Governing Law &amp; Jurisdiction</h2>
              <div className="space-y-3">
                <p>17.1 This Agreement shall be governed by and interpreted in accordance with the laws of the State of Israel.</p>
                <p>17.2 Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the competent courts in Israel.</p>
                <p>17.3 To the maximum extent permitted by applicable law, you agree to bring any disputes only on an individual basis and not on a class, representative, or collective basis.</p>
              </div>
            </section>

            {/* 18. Miscellaneous */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">18. Miscellaneous</h2>
              <div className="space-y-3">
                <p>18.1 <strong className="text-foreground">Severability:</strong> If any part of this Agreement is held invalid or unenforceable, the remaining portions will remain in full force and effect.</p>
                <p>18.2 <strong className="text-foreground">Assignment:</strong> We may assign our rights or obligations under these Terms at any time. You may not assign your rights without our prior written consent.</p>
                <p>18.3 <strong className="text-foreground">Entire Agreement:</strong> These Terms, together with our Privacy Policy and Refund Policy, constitute the entire agreement between you and Agever's regarding the use of the Platform.</p>
              </div>
            </section>

            {/* Contact */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">19. Contact Us</h2>
              <p>
                For any questions regarding these Terms and Conditions, please contact us at{" "}
                <a href="mailto:support@agevers.com" className="text-primary hover:underline">support@agevers.com</a>.
              </p>
            </section>

            {/* Acknowledgment */}
            <section className="border-t border-border pt-8">
              <p className="text-foreground font-semibold">
                By using the Platform, you acknowledge that you have read, understood, and accepted to be bound by these Terms and Conditions.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </section>
    <Footer />
  </div>
);

export default TermsOfService;
