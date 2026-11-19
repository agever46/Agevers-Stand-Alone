
import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

import type { TemplateEntry } from './registry.ts'

interface EmailVerificationProps {
  siteName: string
  siteUrl: string
  recipient: string
  verificationUrl: string
  otpCode?: string
}

const LOGO_URL = 'https://lqkxxlvhcynxjuydkjha.supabase.co/storage/v1/object/public/email-assets/logo.png'

const EmailVerification = ({
  siteName = 'Agevers',
  siteUrl = 'https://agevers.com',
  recipient = 'user@example.com',
  verificationUrl = '#',
  otpCode,
}: EmailVerificationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Verify your email for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt={siteName} width="160" height="auto" style={logo} />
        <Heading style={h1}>Verify Your Email</Heading>
        <Text style={text}>
          Hey there! Please verify your email address (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) to unlock purchases on{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          .
        </Text>
        <Text style={text}>
          Click the button below to verify your email in one click:
        </Text>
        <Button style={button} href={verificationUrl}>
          ✓ Verify My Email
        </Button>
        {otpCode ? (
          <>
            <Text style={{ ...text, textAlign: 'center' as const, margin: '24px 0 8px' }}>
              Or enter this 6-digit code on the verification screen:
            </Text>
            <Text style={otpBox}>{otpCode}</Text>
          </>
        ) : null}
        <Text style={warning}>
          ⚠️ <strong>Important:</strong> You have <strong>3 days</strong> to verify your email address.
          Unverified accounts will be <strong>permanently blocked</strong> after this period.
        </Text>
        <Text style={info}>
          🛡️ <strong>Heads up — new account safety rule:</strong> For your protection, brand-new accounts
          can purchase up to <strong>€20</strong> during their first <strong>24 hours</strong>. The limit
          lifts automatically after that. Need a larger purchase sooner? Just reach out via live chat or
          email and we'll review it manually.
        </Text>
        <Text style={footer}>
          This verification link expires in 24 hours — you can request a new one anytime from your account.
          If you didn't create an account, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailVerification

export const template: TemplateEntry = {
  component: EmailVerification,
  subject: 'Verify your email — Agevers',
  displayName: 'Email Verification',
  previewData: {
    siteName: 'Agevers',
    siteUrl: 'https://agevers.com',
    recipient: 'user@example.com',
    verificationUrl: 'https://agevers.com/verify-email?token=abc123',
  },
}

const main = { backgroundColor: '#161622', fontFamily: "'Rajdhani', Arial, sans-serif" }
const container = { backgroundColor: '#1e1e2e', padding: '32px 28px', borderRadius: '12px', margin: '40px auto', maxWidth: '480px', border: '1px solid #2a2a3e' }
const logo = { margin: '0 auto 24px', display: 'block' as const, backgroundColor: '#1e1e2e', padding: '12px 16px', borderRadius: '8px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#ededed', margin: '0 0 20px', fontFamily: "'Orbitron', Arial, sans-serif", textAlign: 'center' as const }
const text = { fontSize: '15px', color: '#ffffff', lineHeight: '1.6', margin: '0 0 20px' }
const link = { color: '#a78bfa', textDecoration: 'underline' }
const button = { backgroundColor: '#7c3aed', color: '#ffffff', fontSize: '15px', borderRadius: '8px', padding: '14px 28px', textDecoration: 'none', fontWeight: 'bold' as const, display: 'block' as const, textAlign: 'center' as const }
const otpBox = { fontSize: '32px', fontWeight: 'bold' as const, color: '#a78bfa', letterSpacing: '8px', textAlign: 'center' as const, padding: '16px', backgroundColor: '#0f0f1a', borderRadius: '8px', border: '1px solid #2a2a3e', margin: '12px 0 20px', fontFamily: "'Courier New', monospace" }
const warning = { fontSize: '13px', color: '#fbbf24', lineHeight: '1.6', margin: '24px 0 0', padding: '12px 16px', backgroundColor: '#2a2416', borderRadius: '8px', border: '1px solid #5c4a1f', textAlign: 'center' as const }
const info = { fontSize: '13px', color: '#93c5fd', lineHeight: '1.6', margin: '12px 0 0', padding: '12px 16px', backgroundColor: '#172033', borderRadius: '8px', border: '1px solid #1e3a5f', textAlign: 'left' as const }
const footer = { fontSize: '12px', color: '#666666', margin: '20px 0 0', textAlign: 'center' as const }
