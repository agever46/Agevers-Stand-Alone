import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { Shield } from "lucide-react";

const PrivacyPolicy = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <section className="pt-32 pb-16">
      <div className="container mx-auto px-4 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-6">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="font-display text-3xl md:text-5xl font-black tracking-wider text-foreground">
              PRIVACY POLICY
            </h1>
          </div>
          <p className="text-muted-foreground mb-12 text-sm">Last updated: September 2026</p>

          <div className="space-y-10 text-muted-foreground text-sm leading-relaxed">
            {/* Compliance */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Compliance</h2>
              <p className="mb-3">
                Agevers ("Agevers", "we", "us", "our") is committed to respecting privacy and data protection compliance.
              </p>
              <p className="mb-3">
                This privacy policy together with Appendix A ("Privacy Policy") sets out how and why we collect, store, use, transfer and disclose your personal data (also referred to as personal information in this Privacy Policy) and how you may access your personal information and correct it. This Privacy Policy also explains the use of cookies on our Site.
              </p>
              <p className="mb-3">
                For the avoidance of doubt, "personal data" or "personal information" means information that specifically identifies an individual (such as a name, address, photo, telephone number, mobile number, e-mail address, birthday, office location, professional and personal interests, company name, title, department, and spoken languages) or information about that individual that is directly linked to personally identifiable information.
              </p>
              <p className="mb-3">
                "Site" means <a href="https://agevers.com" className="text-primary hover:underline">https://agevers.com</a> and all subpages and subdomains and any additional website domains as determined by Agevers from time to time. "User", "you" and "your" collectively mean the person, company, or organization that has visited or is using the Site. A user may be a visitor of Agevers or an Account holder. "Account" means the account that users may create through the Site.
              </p>
              <p>
                Our contact email address for any communications regarding your personal data is{" "}
                <a href="mailto:privacy@agevers.com" className="text-primary hover:underline">privacy@agevers.com</a>{" "}
                (please include "personal data" in the email subject).
              </p>
            </section>

            {/* GDPR */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">GDPR</h2>
              <p>
                If you are a resident of the European Union, you are protected by, and enjoy additional rights under, the European Union's General Data Protection Regulation 2016/679, also known as GDPR.
              </p>
              <p className="mt-3">
                Under Article 6 of the GDPR we only process your personal data where we have a valid legal basis to do so. The legal bases we rely on are:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>
                  <strong className="text-foreground">Performance of a contract (Art. 6(1)(b))</strong> — to create your account, process your orders and payments, deliver digital keys or physical goods, and provide customer support.
                </li>
                <li>
                  <strong className="text-foreground">Consent (Art. 6(1)(a))</strong> — for marketing emails, our newsletter, and non-essential cookies such as analytics and advertising. You may withdraw your consent at any time by unsubscribing or by changing your choice via the "Cookie Settings" link in our footer.
                </li>
                <li>
                  <strong className="text-foreground">Legitimate interests (Art. 6(1)(f))</strong> — to prevent fraud, chargebacks and abuse, to secure our systems, and to improve our services, where those interests are not overridden by your rights.
                </li>
                <li>
                  <strong className="text-foreground">Legal obligation (Art. 6(1)(c))</strong> — to keep tax, accounting and anti-fraud records as required by applicable law.
                </li>
              </ul>
              <p className="mt-3">
                You have the right to access, correct, delete, restrict or object to the processing of your personal data, and the right to data portability. To exercise any of these rights, contact us at support@agevers.com or privacy@agevers.com.
              </p>
            </section>

            {/* Data Protection Officer & Supervisory Authority */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Data Protection Contact & Supervisory Authority</h2>
              <p className="mb-3">
                Our designated contact for data protection matters (Data Protection Officer function) can be reached at{" "}
                <a href="mailto:privacy@agevers.com" className="text-primary hover:underline">privacy@agevers.com</a>{" "}
                or by post at: Agever's, Hativat HaNegev 11, Eilat, Israel.
              </p>
              <p>
                If you believe your data protection rights have been violated, you have the right to lodge a complaint with a supervisory authority — in the EU, with the data protection authority of your member state of residence (for example, the list published by the European Data Protection Board), or in Israel with the Privacy Protection Authority (רשות להגנת הפרטיות).
              </p>
            </section>

            {/* International Data Transfers */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">International Data Transfers</h2>
              <p>
                We operate globally and use trusted service providers that may store or process your personal data outside the European Economic Area (EEA), including in the United States. These providers include, among others:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Supabase — database hosting, authentication and file storage (<a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">privacy policy</a>)</li>
                <li>PayPal — payment processing and fraud prevention (<a href="https://www.paypal.com/us/legalhub/privacy-full" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">privacy policy</a>)</li>
                <li>Resend — transactional and marketing email delivery (<a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">privacy policy</a>)</li>
                <li>Twilio — SMS verification messages (<a href="https://www.twilio.com/en-us/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">privacy policy</a>)</li>
                <li>Google Analytics &amp; Google Ads — website usage analytics and ad measurement (<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">privacy policy</a>)</li>
                <li>Reddit Ads — advertising and conversion measurement (<a href="https://www.reddit.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">privacy policy</a>)</li>
                <li>Cloudflare — security, DDoS protection and bot management (<a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">privacy policy</a>)</li>
                <li>IPQualityScore — fraud risk scoring (<a href="https://www.ipqualityscore.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">privacy policy</a>)</li>
              </ul>
              <p className="mt-3">
                Whenever your data is transferred outside the EEA, we rely on appropriate safeguards as required by Chapter V of the GDPR — primarily the European Commission's Standard Contractual Clauses (SCCs) included in our providers' data processing agreements, together with additional technical and organisational measures such as encryption in transit and at rest. You may request more information about these safeguards by contacting support@agevers.com.
              </p>
            </section>

            {/* Automated decision-making */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">
                Automated Decision-Making & Fraud Screening
              </h2>
              <p>
                To protect our customers and prevent payment fraud and chargebacks, every order is screened by an automated risk-assessment system. This system evaluates signals such as IP address and reputation, device fingerprint, geographic location, email and phone attributes, and order value, using our own rules together with the third-party service IPQualityScore. Where the resulting risk score exceeds a defined threshold, an order may be automatically placed on hold, blocked, or cancelled without human involvement at that initial stage.
              </p>
              <p className="mt-3">
                Because this can constitute a decision based solely on automated processing within the meaning of Article 22 of the GDPR, you have the right to:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>obtain human intervention and have the decision reviewed by a member of our team;</li>
                <li>express your point of view and provide additional information or documentation;</li>
                <li>contest the decision and request that it be reconsidered.</li>
              </ul>
              <p className="mt-3">
                You can request a manual review at any time using the appeal form shown when an order or sign-in is blocked, from{" "}
                <a href="/account" className="text-primary hover:underline">
                  My Account
                </a>
                , via our live support chat, or by emailing support@agevers.com. We aim to respond to review requests within 48 hours.
              </p>
            </section>


            {/* Changes */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Changes to Privacy Policy</h2>
              <p className="mb-3">
                We may change our Privacy Policy from time to time, and at our sole discretion. Although we will use our best endeavours to notify you of any amendment, we will not be required to provide you with prior notification of such amendments or changes.
              </p>
              <p>
                Your continued use of our Site, services, requesting our assistance or the provision of further personal information to us after any change in this Privacy Policy will constitute your acceptance of such change.
              </p>
            </section>

            {/* What data */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">What Data Do We Collect?</h2>
              <p className="mb-3">
                Like most website operators, we collect non-personally-identifying information of the sort that web browsers and servers typically make available, such as the browser type, language preference, referring site, and the date and time of each visitor request.
              </p>
              <p className="mb-3">We also collect potentially personal information including:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Your name</li>
                <li>Your contact information including your email address</li>
                <li>Your demographic information including preferences and interests</li>
                <li>Other information relevant to customer surveys and/or offers</li>
                <li>Internet Protocol ("IP") addresses</li>
                <li>Cookies (see the cookies section below)</li>
              </ul>
            </section>

            {/* How we collect */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">How Do We Collect Personal Data?</h2>
              <p className="mb-3">We collect personal information in a number of ways, including:</p>
              <ul className="list-disc list-inside space-y-1 mb-3">
                <li>When you or a third-party contact us independently of our Site, such as by email, phone or in person</li>
                <li>When you visit and interact with our Site and related software</li>
                <li>When you engage in transactions with us</li>
                <li>When you sign up for an Account with Agevers</li>
                <li>Through cookies and other technologies</li>
                <li>When you contact us via our Site or sign up for our newsletter/mailing list</li>
              </ul>
              <p className="mb-3">
                In each case, we collect such personal information only insofar as is necessary or appropriate to fulfil the purpose of your interaction with us. We do not disclose personal information other than as described below in this Privacy Policy.
              </p>
              <p>
                We will not sell, distribute or lend access to your personal information to third parties unless we have your permission or are required by law to do so.
              </p>
            </section>

            {/* Consent */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Consent</h2>
              <p className="mb-3">
                This Privacy Policy applies to the Site you are currently viewing. By clicking on the "Accept" button or accessing or otherwise using the Site, you acknowledge that you have read, understood, and agree with this Privacy Policy and any other agreements that apply to you as an Agevers Account holder or user.
              </p>
              <p>
                If you do not agree with this, you must stop using or accessing the Site immediately. This Privacy Policy should be read in conjunction with our{" "}
                <a href="/terms-of-service" className="text-primary hover:underline">Terms of Service</a>.
              </p>
            </section>

            {/* Purpose */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Purpose</h2>
              <p className="mb-3">We collect your personal information to enable you to receive the benefit of our Site and services and/or products. We may use your personal information for the following purposes:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>To carry out our obligations and to provide you with agreed services and/or products</li>
                <li>To establish, maintain and administer your Account</li>
                <li>To send you service and/or product or promotional communications and marketing material</li>
                <li>To notify you about changes to our services and/or products</li>
                <li>Quality assurance and training</li>
                <li>Improving our products and services, including site customisation</li>
                <li>To verify your identity or location, and make security checks, in relation to a purchase</li>
                <li>To access third-party development platforms or add-on keys</li>
                <li>Market research and analysis</li>
                <li>Internal record-keeping</li>
              </ul>
            </section>

            {/* Disclosure */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Disclosure of Your Personal Information</h2>
              <p className="mb-3">We may disclose your personal information to other entities or individuals for the Purposes including but not limited to:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Our employees, trusted third parties and other people we work with to provide services to you</li>
                <li>Third party service providers such as IT service providers, data storage, web-hosting and server providers, payment processing and insurers</li>
                <li>Any third-party partners or entities with whom we have a commercial relationship</li>
                <li>Any related entity of ours</li>
                <li>Prospective sellers or buyers of our business or assets</li>
                <li>Any applicable or relevant regulator or third party for the purpose of legislative or contractual compliance</li>
                <li>Other entities or individuals, provided you have given your consent</li>
              </ul>
            </section>

            {/* Accessing */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Accessing Your Personal Data</h2>
              <p className="mb-3">To the extent required by law, you may review, edit, correct or delete any personal information you submit to us.</p>
              <p className="mb-3">On request we will, as soon as reasonably possible, provide you with:</p>
              <ul className="list-disc list-inside space-y-1 mb-3">
                <li>Personal data about you that is in our possession or under our control</li>
                <li>Information about the ways in which the personal data has been or may have been used or disclosed by us during the year preceding the date of the request</li>
              </ul>
              <p className="mb-3">We reserve the right not to provide you with your personal data if providing it could reasonably be expected to:</p>
              <ul className="list-disc list-inside space-y-1 mb-3">
                <li>Threaten the safety or physical or mental health of another individual</li>
                <li>Cause immediate or grave harm to your safety, physical or mental health</li>
                <li>Reveal personal data about another individual</li>
                <li>Be contrary to the national interest</li>
              </ul>
              <p>
                If you wish to access the personal information we hold about you, you should contact us at{" "}
                <a href="mailto:privacy@agevers.com" className="text-primary hover:underline">privacy@agevers.com</a>.
              </p>
            </section>

            {/* Correcting */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Correcting and Updating Your Personal Information</h2>
              <p>
                Please contact us at{" "}
                <a href="mailto:privacy@agevers.com" className="text-primary hover:underline">privacy@agevers.com</a>{" "}
                as soon as possible if there are any changes to your personal information or if you believe the personal information we hold about you is not accurate, complete or up-to-date so that we can update your file accordingly.
              </p>
            </section>

            {/* Accuracy */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Accuracy</h2>
              <p>
                We take reasonable steps to ensure that the personal information we hold about you is accurate, complete and up-to-date. However, we primarily rely on you to advise us of any changes to your personal information.
              </p>
            </section>

            {/* Retention */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Retention of Personal Data</h2>
              <p>
                We will use all reasonable endeavours to cease to retain documents containing personal data, or remove the means by which the personal data can be associated with particular individuals, as soon as it is reasonable to assume that the Purpose for which that personal data was collected is no longer being served by retention of the personal data, or retention is no longer necessary for legal or business purposes.
              </p>
            </section>

            {/* Security */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Security</h2>
              <p className="mb-3">
                We take reasonable steps to ensure that your personal information is treated securely and to prevent unauthorised access, collection, use, disclosure, copying, modification, disposal or similar risks.
              </p>
              <p className="mb-3">
                To prevent unauthorised access or disclosure, we have put in place suitable physical, electronic and managerial procedures to safeguard and secure the information we collect online.
              </p>
              <p>
                Please contact us at{" "}
                <a href="mailto:support@agevers.com" className="text-primary hover:underline">support@agevers.com</a>{" "}
                immediately if you become aware of any unauthorised use of your Account by anyone else or any other breach of security.
              </p>
            </section>

            {/* Cookies */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Cookies</h2>
              <p className="mb-3">
                A cookie is a small file which asks permission to be placed on your computer's hard drive. Once you agree, the file is added and the cookie helps analyse web traffic or lets you know when you visit a particular site.
              </p>
              <p className="mb-3">We do or may use the following cookies:</p>
              <ul className="list-disc list-inside space-y-1 mb-3">
                <li><strong className="text-foreground">Strictly necessary cookies</strong> — required for the operation of our Site (e.g., logging into secure areas, shopping cart)</li>
                <li><strong className="text-foreground">Analytical/performance cookies</strong> — allow us to recognise and count visitors and see how they move around our Site</li>
                <li><strong className="text-foreground">Functionality cookies</strong> — used to recognise you when you return to our Site and personalise content</li>
                <li><strong className="text-foreground">Targeting cookies</strong> — record your visit, pages visited, and links followed to make advertising more relevant</li>
              </ul>
              <p>
                You can choose to accept or decline cookies. Many web browsers automatically accept cookies, but you can usually modify your browser setting to decline cookies if you prefer. This may prevent you from taking full advantage of the Site.
              </p>
            </section>

            {/* Cookie table */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">List of Cookies We Collect</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 pr-4 text-foreground font-semibold">Cookie Name</th>
                      <th className="py-2 text-foreground font-semibold">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr><td className="py-2 pr-4 font-mono text-xs">CART</td><td className="py-2">The association with your shopping cart.</td></tr>
                    <tr><td className="py-2 pr-4 font-mono text-xs">CATEGORY_INFO</td><td className="py-2">Category info on the page for faster display.</td></tr>
                    <tr><td className="py-2 pr-4 font-mono text-xs">COMPARE</td><td className="py-2">Items in the Compare Products list.</td></tr>
                    <tr><td className="py-2 pr-4 font-mono text-xs">CURRENCY</td><td className="py-2">Your preferred currency.</td></tr>
                    <tr><td className="py-2 pr-4 font-mono text-xs">CUSTOMER</td><td className="py-2">An encrypted version of your customer ID.</td></tr>
                    <tr><td className="py-2 pr-4 font-mono text-xs">CUSTOMER_AUTH</td><td className="py-2">Indicates if you are currently logged in.</td></tr>
                    <tr><td className="py-2 pr-4 font-mono text-xs">CUSTOMER_INFO</td><td className="py-2">Encrypted version of the customer group you belong to.</td></tr>
                    <tr><td className="py-2 pr-4 font-mono text-xs">FRONTEND</td><td className="py-2">Your session ID on the server.</td></tr>
                    <tr><td className="py-2 pr-4 font-mono text-xs">GUEST-VIEW</td><td className="py-2">Allows guests to edit their orders.</td></tr>
                    <tr><td className="py-2 pr-4 font-mono text-xs">LAST_CATEGORY</td><td className="py-2">The last category you visited.</td></tr>
                    <tr><td className="py-2 pr-4 font-mono text-xs">LAST_PRODUCT</td><td className="py-2">The most recent product you have viewed.</td></tr>
                    <tr><td className="py-2 pr-4 font-mono text-xs">NO_CACHE</td><td className="py-2">Indicates whether cache is allowed.</td></tr>
                    <tr><td className="py-2 pr-4 font-mono text-xs">PERSISTENT_SHOPPING_CART</td><td className="py-2">Link to cart and viewing history info.</td></tr>
                    <tr><td className="py-2 pr-4 font-mono text-xs">STORE</td><td className="py-2">The store view or language you have selected.</td></tr>
                    <tr><td className="py-2 pr-4 font-mono text-xs">VIEWED_PRODUCT_IDS</td><td className="py-2">Products that you have recently viewed.</td></tr>
                    <tr><td className="py-2 pr-4 font-mono text-xs">WISHLIST</td><td className="py-2">Encrypted list of products added to your Wishlist.</td></tr>
                    <tr><td className="py-2 pr-4 font-mono text-xs">WISHLIST_CNT</td><td className="py-2">The number of items in your Wishlist.</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Third-Party Service Providers */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Third-Party Service Providers & Data Processing</h2>
              <p className="mb-3">
                To operate our platform securely and process transactions, we share certain data with the following third-party service providers:
              </p>
              <ul className="list-disc list-inside space-y-3 mb-3">
                <li>
                  <strong className="text-foreground">PayPal (Payment Processing):</strong> When you pay by PayPal or by card through PayPal's checkout, PayPal receives your name, email address, billing address, and payment details. PayPal acts as an independent data controller for payment data and processes it in accordance with their own{" "}
                  <a href="https://www.paypal.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Privacy Policy</a>.
                  {" "}We do not store your full credit card details on our servers — PayPal handles this securely on our behalf.
                </li>
                <li>
                  <strong className="text-foreground">NOWPayments (Cryptocurrency Payments):</strong> If you choose to pay by cryptocurrency, your order details and wallet transaction data are shared with NOWPayments to process the payment and confirm receipt on the relevant blockchain.
                </li>
                <li>
                  <strong className="text-foreground">IPQualityScore (Fraud Prevention):</strong> To protect our platform and users from fraudulent transactions, we use IPQualityScore (IPQS) to assess transaction risk. When you make a purchase, your IP address and email address are sent to IPQS for real-time fraud analysis. IPQS may determine whether your connection uses a VPN, proxy, or Tor network, and whether your email address is from a disposable provider. The resulting risk score is stored in our system and used solely for fraud prevention purposes. For more information, see the{" "}
                  <a href="https://www.ipqualityscore.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">IPQS Privacy Policy</a>.
                </li>
                <li>
                  <strong className="text-foreground">Kinguin (Order Fulfillment):</strong> For certain products, your order (product, quantity, and a delivery reference) is shared with Kinguin, our supplier, so they can fulfill and deliver the digital code to us for your purchase.
                </li>
                <li>
                  <strong className="text-foreground">Twilio (SMS Verification):</strong> If SMS verification is required for your order, your phone number is shared with Twilio to send a one-time verification code.
                </li>
                <li>
                  <strong className="text-foreground">Resend (Transactional Email):</strong> Order confirmations, support replies, and other account-related emails are sent through Resend, which receives your email address and the message content.
                </li>
                <li>
                  <strong className="text-foreground">Cloudflare Turnstile (Bot Protection):</strong> Used on certain forms to distinguish human visitors from automated bots; it may process your IP address and device signals as part of that check.
                </li>
                <li>
                  <strong className="text-foreground">Google Analytics &amp; Google Ads:</strong> We use Google Analytics (GA4) to understand how visitors use our Site, and Google Ads to measure the effectiveness of our advertising. These process your IP address, device, and browsing behavior on our Site, subject to your cookie preferences.
                </li>
                <li>
                  <strong className="text-foreground">Reddit Ads:</strong> We use the Reddit Pixel and Conversions API to measure ad performance for visitors who arrive from Reddit ads. When you complete a purchase, a hashed version of your email, along with your IP address and browser user-agent, may be shared with Reddit for this purpose, subject to your cookie preferences.
                </li>
              </ul>
              <p>
                We only share the minimum data necessary for each service to function. All third-party providers are contractually obligated to protect your data and use it only for the purposes described above.
              </p>
            </section>

            {/* Business transfer */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Business Transfer</h2>
              <p>
                If we, or substantially all of our assets, were acquired, or in the event that we go out of business or enter bankruptcy, user information would be one of the assets that is transferred or acquired by a third party. You acknowledge and agree that if such transfers occur, any acquirer of our business may continue to use your personal information as set forth in this Privacy Policy.
              </p>
            </section>

            {/* Direct marketing */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Use of Personal Information for Direct Marketing</h2>
              <p className="mb-3">
                From time to time, we may use the personal information we collect from you to identify particular services and/or products that we believe may be of interest to you. Direct marketing from us generally takes the form of an electronic marketing email.
              </p>
              <p>
                Every directly addressed marketing contact sent by us will include a means by which you may unsubscribe (or opt out). You may instruct us at any time to remove any previous consent you provided to receive marketing communications by contacting us at{" "}
                <a href="mailto:support@agevers.com" className="text-primary hover:underline">support@agevers.com</a>.
              </p>
            </section>

            {/* Links */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Links to Third Party Websites</h2>
              <p>
                Our Site may contain links to and from third party websites. If you click on such links, you do so at your own risk and subject to whatever privacy policy and/or website terms may govern the use of such websites. We have no control over, and are not responsible for, the content, privacy practices or website terms of such websites.
              </p>
            </section>

            {/* Your choices */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Your Choices</h2>
              <ul className="list-disc list-inside space-y-2">
                <li><strong className="text-foreground">Account Settings:</strong> You may add or update information or change your Account privacy settings at any time.</li>
                <li><strong className="text-foreground">Cookies:</strong> You can instruct your browser to stop accepting cookies or to prompt you before accepting a cookie.</li>
                <li><strong className="text-foreground">Email:</strong> If you do not want to receive email from us, contact us at <a href="mailto:support@agevers.com" className="text-primary hover:underline">support@agevers.com</a> or click the "unsubscribe" link in any email we send you.</li>
                <li><strong className="text-foreground">Account Deactivation:</strong> You may request deactivation of your Account by contacting us at <a href="mailto:support@agevers.com" className="text-primary hover:underline">support@agevers.com</a>.</li>
              </ul>
            </section>

            {/* Your data rights */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Your Data Rights</h2>

              <h3 className="font-display text-base font-semibold text-foreground mb-2 mt-4">Right of Access</h3>
              <p className="mb-3">
                You may access and review any personal information we hold about you. On your specific request we will provide you with personal data about you that is in our possession, the ways in which your personal data has been used or processed, and information on to whom such data has been disclosed.
              </p>

              <h3 className="font-display text-base font-semibold text-foreground mb-2 mt-4">Right to Rectification and Erasure</h3>
              <p className="mb-3">
                Please contact us at{" "}
                <a href="mailto:privacy@agevers.com" className="text-primary hover:underline">privacy@agevers.com</a>{" "}
                if you believe the personal information we hold about you is not accurate, complete or up-to-date, or is no longer necessary for the purpose for which it was collected. Depending on the circumstance, we may change, erase, or block from use any inaccurate, incomplete, or outdated information.
              </p>

              <h3 className="font-display text-base font-semibold text-foreground mb-2 mt-4">Right to Object</h3>
              <p>
                You may object to collection of specific personal data on limited grounds due to your personal situation. Please contact us at{" "}
                <a href="mailto:privacy@agevers.com" className="text-primary hover:underline">privacy@agevers.com</a>{" "}
                if you wish to make such a request.
              </p>
            </section>

            {/* Analytics */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Analytics</h2>
              <p>
                Agevers may work with third parties to provide analytics information regarding your usage of our Site or to help us track the effectiveness of advertising. These third parties may use cookies, web beacons, and other technologies. The use of these technologies by third parties is subject to their own privacy policies. To opt out of collection of your information by these third parties, please visit their respective websites.
              </p>
            </section>

            {/* Privacy complaints */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Privacy Complaints</h2>
              <p>
                If you believe that we have breached your privacy rights in any way, or you would like to discuss any issues about our Privacy Policy, please contact us at{" "}
                <a href="mailto:privacy@agevers.com" className="text-primary hover:underline">privacy@agevers.com</a>. All such enquiries or complaints will be taken seriously and handled as soon as reasonably practicable.
              </p>
            </section>

            {/* Data Controller – Amendment 13 */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Database Controller (Amendment 13)</h2>
              <p className="mb-2">
                In accordance with Israel's Privacy Protection Law, 5741-1981 (Amendment 13), the registered database controller is:
              </p>
              <ul className="list-none space-y-1 mb-3">
                <li><strong className="text-foreground">Controller:</strong> Agevers</li>
                <li><strong className="text-foreground">Contact Email:</strong>{" "}
                  <a href="mailto:privacy@agevers.com" className="text-primary hover:underline">privacy@agevers.com</a>
                </li>
                <li><strong className="text-foreground">Purpose of Database:</strong> Managing user accounts, processing transactions, and providing customer support for digital product sales.</li>
              </ul>
              <p>
                As a data subject, you have the right to access, correct, or request deletion of your personal data held in our database. To submit a data access, correction, or deletion request, please email{" "}
                <a href="mailto:privacy@agevers.com" className="text-primary hover:underline">privacy@agevers.com</a>{" "}
                with the subject line "Data Request" and include your full name and the email address associated with your account.
              </p>
            </section>

            {/* Data Retention */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Data Storage Duration</h2>
              <ul className="list-disc list-inside space-y-1">
                <li><strong className="text-foreground">Account data</strong> (name, email, preferences): Retained for as long as your account is active, plus 30 days after deletion request.</li>
                <li><strong className="text-foreground">Transaction records</strong> (orders, payment references): Retained for 7 years as required by applicable tax and commerce laws.</li>
                <li><strong className="text-foreground">Fraud prevention data</strong> (IP addresses, risk scores, IPQS results): Retained for up to 24 months from the date of the transaction for chargeback protection and fraud analysis.</li>
                <li><strong className="text-foreground">Support tickets</strong>: Retained for 3 years after resolution.</li>
                <li><strong className="text-foreground">Payment data</strong>: Full payment details are processed and stored by our payment processors (PayPal, or NOWPayments for crypto payments); we only retain order references and transaction IDs.</li>
                <li><strong className="text-foreground">Cookies &amp; analytics data</strong>: Session cookies expire on browser close; persistent cookies up to 12 months; analytics data retained for 26 months.</li>
              </ul>
            </section>

            {/* Contact */}
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Contact Us</h2>
              <p>
                For any questions regarding this Privacy Policy, please contact us at{" "}
                <a href="mailto:privacy@agevers.com" className="text-primary hover:underline">privacy@agevers.com</a>.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </section>
    <Footer />
  </div>
);

export default PrivacyPolicy;
