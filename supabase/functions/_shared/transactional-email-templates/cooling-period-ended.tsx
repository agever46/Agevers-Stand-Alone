import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text, Section, Hr, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Agever's"
const SITE_URL = 'https://agevers.com'
const SUPPORT_EMAIL = 'support@agevers.com'

interface Props {
  customerName?: string
}

const CoolingPeriodEndedEmail = ({ customerName }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You're all set — the new-account 24h limit on your {SITE_NAME} account has ended</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={logo}>{SITE_NAME}</Heading>
        </Section>

        <Section style={contentSection}>
          <Heading style={h1}>🎉 You're Ready to Shop</Heading>
          <Text style={text}>
            {customerName ? `Hi ${customerName},` : 'Hi there,'}
          </Text>
          <Text style={text}>
            Good news — the 24-hour new-account cooling period on your {SITE_NAME} account
            has ended. The €20 per-order limit is no longer active, and you can now
            complete purchases of any size.
          </Text>

          <Section style={card}>
            <Text style={cardTitle}>✅ What this means</Text>
            <Text style={cardText}>
              Your account is fully active. Browse the catalog, add items to your cart,
              and check out normally — no further restrictions apply.
            </Text>
          </Section>

          <Section style={btnRow}>
            <Button href={SITE_URL} style={btnPrimary}>
              Start Shopping
            </Button>
          </Section>

          <Text style={footerText}>
            Need help? Write to us at{' '}
            <Link href={`mailto:${SUPPORT_EMAIL}`} style={link}>{SUPPORT_EMAIL}</Link>.
          </Text>
        </Section>

        <Hr style={footerDivider} />
        <Text style={footer}>
          This is an automated security notice from {SITE_NAME}.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CoolingPeriodEndedEmail,
  subject: "You're all set — your Agever's account is fully active",
  displayName: 'Cooling period ended (24h new-account limit lifted)',
  previewData: { customerName: 'Alex' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Rajdhani', Arial, sans-serif" }
const container = { maxWidth: '520px', margin: '0 auto', padding: '0' }
const headerSection = {
  backgroundColor: '#161622', padding: '24px 32px', textAlign: 'center' as const,
  borderRadius: '12px 12px 0 0',
}
const logo = {
  color: '#a855f7', fontSize: '28px', fontWeight: '800' as const,
  fontFamily: "'Orbitron', Arial, sans-serif", letterSpacing: '3px', margin: '0',
}
const contentSection = { backgroundColor: '#1e1e2e', padding: '32px' }
const h1 = {
  color: '#ededed', fontSize: '24px', fontWeight: '700' as const,
  margin: '0 0 16px', fontFamily: "'Orbitron', Arial, sans-serif",
}
const text = { color: '#a1a1aa', fontSize: '15px', lineHeight: '1.6', margin: '0 0 16px' }
const card = {
  backgroundColor: '#161622', borderRadius: '8px', padding: '20px',
  marginBottom: '16px', border: '1px solid #2d2d3f',
}
const cardTitle = {
  color: '#a855f7', fontSize: '14px', fontWeight: '700' as const,
  letterSpacing: '1px', textTransform: 'uppercase' as const, margin: '0 0 8px',
}
const cardText = { color: '#a1a1aa', fontSize: '14px', lineHeight: '1.5', margin: '0' }
const btnRow = { textAlign: 'center' as const, margin: '24px 0 12px' }
const btnPrimary = {
  backgroundColor: '#a855f7', color: '#ffffff', padding: '12px 22px',
  borderRadius: '8px', fontSize: '14px', fontWeight: '700' as const,
  textDecoration: 'none', display: 'inline-block', margin: '0 6px 8px',
  letterSpacing: '1px', textTransform: 'uppercase' as const,
}
const footerText = {
  color: '#a1a1aa', fontSize: '13px', lineHeight: '1.5', textAlign: 'center' as const,
  margin: '8px 0 0',
}
const link = { color: '#a855f7', textDecoration: 'underline' }
const footerDivider = { borderColor: '#2d2d3f', margin: '0' }
const footer = {
  backgroundColor: '#161622', color: '#52525b', fontSize: '11px',
  textAlign: 'center' as const, padding: '20px 32px', lineHeight: '1.5',
  borderRadius: '0 0 12px 12px',
}