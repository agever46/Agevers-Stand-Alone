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
  reason?: string
}

const AccountBlockedEmail = ({ customerName, reason }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Important: action needed on your {SITE_NAME} account</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={logo}>{SITE_NAME}</Heading>
        </Section>

        <Section style={contentSection}>
          <Heading style={h1}>Purchases Temporarily Restricted</Heading>
          <Text style={text}>
            {customerName ? `Hi ${customerName},` : 'Hi there,'}
          </Text>
          <Text style={text}>
            We're reaching out to let you know that purchases on your {SITE_NAME} account
            have been <strong>temporarily restricted</strong> by our automated security system.
          </Text>

          <Section style={card}>
            <Text style={cardTitle}>✅ What you can still do</Text>
            <Text style={cardText}>
              You can still <strong>sign in, browse the catalog, manage your wishlist,
              and use your account</strong> as normal. The only thing affected is the
              ability to complete a purchase at checkout.
            </Text>
          </Section>

          <Section style={card}>
            <Text style={cardTitle}>🚫 What's blocked</Text>
            <Text style={cardText}>
              Any attempt to complete a checkout will be stopped automatically until
              this restriction is lifted by our team.
            </Text>
          </Section>

          {reason && (
            <Section style={card}>
              <Text style={cardTitle}>ℹ️ Reason flagged</Text>
              <Text style={cardText}>{reason}</Text>
            </Section>
          )}

          <Section style={card}>
            <Text style={cardTitle}>💬 Think this is a mistake?</Text>
            <Text style={cardText}>
              We're happy to review your account manually. Please get in touch — most
              cases are resolved within 24 hours.
            </Text>
          </Section>

          <Section style={btnRow}>
            <Button href={`mailto:${SUPPORT_EMAIL}?subject=Account%20review%20request`} style={btnPrimary}>
              Email Support
            </Button>
            <Button href={`${SITE_URL}/help-center?chat=open`} style={btnSecondary}>
              Open Live Chat
            </Button>
          </Section>

          <Text style={hoursText}>
            💡 Live chat is available during business hours (Mon–Fri, 09:00–18:00 CET).
            Outside those hours, email support is the fastest option — we monitor
            it 7 days a week.
          </Text>

          <Text style={footerText}>
            Or write to us directly at{' '}
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
  component: AccountBlockedEmail,
  subject: "Important: action needed on your Agever's account",
  displayName: 'Account purchases blocked',
  previewData: {
    customerName: 'Alex',
    reason: 'Multiple security signals detected during checkout.',
  },
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
const btnSecondary = {
  backgroundColor: 'transparent', color: '#a855f7', padding: '11px 21px',
  borderRadius: '8px', fontSize: '14px', fontWeight: '700' as const,
  textDecoration: 'none', display: 'inline-block', margin: '0 6px 8px',
  border: '1px solid #a855f7', letterSpacing: '1px', textTransform: 'uppercase' as const,
}
const hoursText = {
  color: '#71717a', fontSize: '12px', lineHeight: '1.5', textAlign: 'center' as const,
  margin: '8px 0 16px', fontStyle: 'italic' as const,
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
