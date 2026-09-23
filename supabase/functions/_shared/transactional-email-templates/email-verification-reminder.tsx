
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

interface ReminderProps {
  siteName: string
  siteUrl: string
  recipient: string
  verificationUrl: string
  hoursLeft: number // 48 for 24h reminder, 24 for 48h reminder
}

const LOGO_URL = 'https://ppernxjnicippytjuxpz.supabase.co/storage/v1/object/public/email-assets/logo.png'

const EmailVerificationReminder = ({
  siteName = 'Agevers',
  siteUrl = 'https://agevers.com',
  recipient = 'user@example.com',
  verificationUrl = '#',
  hoursLeft = 48,
}: ReminderProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Reminder: Verify your ${siteName} email — ${hoursLeft}h left`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt={siteName} width="160" height="auto" style={logo} />
        <Heading style={h1}>⏰ Reminder: Verify Your Email</Heading>
        <Text style={text}>
          Hi! We noticed your email (
          <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link>
          ) hasn't been verified yet on{' '}
          <Link href={siteUrl} style={link}><strong>{siteName}</strong></Link>.
        </Text>
        <Text style={text}>
          Verifying your email keeps your account secure and ensures you can make purchases and receive your digital codes without interruption.
        </Text>
        <Button style={button} href={verificationUrl}>
          ✓ Verify My Email Now
        </Button>
        <Text style={warning}>
          ⚠️ <strong>{hoursLeft} hours left.</strong> Unverified accounts are automatically <strong>suspended</strong> 72 hours after signup and cannot make new purchases until verified.
        </Text>
        <Text style={footer}>
          If you didn't create this account, you can safely ignore this email — it will be cleaned up automatically.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailVerificationReminder

export const template: TemplateEntry = {
  component: EmailVerificationReminder,
  subject: 'Reminder: Verify your email to keep your Agevers account active',
  displayName: 'Email Verification Reminder',
  previewData: {
    siteName: 'Agevers',
    siteUrl: 'https://agevers.com',
    recipient: 'user@example.com',
    verificationUrl: 'https://agevers.com/verify-email?token=abc123',
    hoursLeft: 48,
  },
}

const main = { backgroundColor: '#161622', fontFamily: "'Rajdhani', Arial, sans-serif" }
const container = { backgroundColor: '#1e1e2e', padding: '32px 28px', borderRadius: '12px', margin: '40px auto', maxWidth: '480px', border: '1px solid #2a2a3e' }
const logo = { margin: '0 auto 24px', display: 'block' as const, backgroundColor: '#1e1e2e', padding: '12px 16px', borderRadius: '8px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#ededed', margin: '0 0 20px', fontFamily: "'Orbitron', Arial, sans-serif", textAlign: 'center' as const }
const text = { fontSize: '15px', color: '#ffffff', lineHeight: '1.6', margin: '0 0 20px' }
const link = { color: '#a78bfa', textDecoration: 'underline' }
const button = { backgroundColor: '#7c3aed', color: '#ffffff', fontSize: '15px', borderRadius: '8px', padding: '14px 28px', textDecoration: 'none', fontWeight: 'bold' as const, display: 'block' as const, textAlign: 'center' as const }
const warning = { fontSize: '13px', color: '#fbbf24', lineHeight: '1.6', margin: '24px 0 0', padding: '12px 16px', backgroundColor: '#2a2416', borderRadius: '8px', border: '1px solid #5c4a1f', textAlign: 'center' as const }
const footer = { fontSize: '12px', color: '#666666', margin: '20px 0 0', textAlign: 'center' as const }
