// EmailVerificationGuard — no banner, just passthrough.
// Email verification is handled in AccountSettings and Checkout.
const EmailVerificationGuard = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export default EmailVerificationGuard;
