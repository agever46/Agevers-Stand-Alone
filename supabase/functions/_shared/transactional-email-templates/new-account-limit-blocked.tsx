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
  hoursLeft?: number
}

const NewAccountLimitBlockedEmail = ({ customerName, hoursLeft }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>About your recent {SITE_NAME} checkout — new-account €20/24h limit</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={logo}>{SITE_NAME}</Heading>
        </Section>

        <Section style={contentSection}>
          <Heading style={h1}>Checkout Paused — New Account Limit</Heading>
          <Text style={text}>{customerName ? `Hi ${customerName},` : 'Hi there,'}</Text>
          <Text style={text}>
            We noticed your recent checkout on {SITE_NAME} was stopped. For everyone's
            safety, brand-new accounts are limited to <strong>€20 per order during the
            first 24 hours</strong>. This helps us prevent fraud and protect both buyers
            and our store.
          </Text>

          <Section style={card}>
            <Text style={cardTitle}>✅ What you can do now</Text>
            <Text style={cardText}>
              • Lower your order to €20 or less and complete it right away.<br />
              • Or wait until the 24-hour window ends
              {typeof hoursLeft === 'number' && hoursLeft > 0
                ? ` (about ${hoursLeft.toFixed(1)}h left)`
                : ''}
              — we'll email you the moment the limit is lifted.
            </Text>
          </Section>

          <Section style={card}>
            <Text style={cardTitle}>💬 Need it sooner?</Text>
            <Text style={cardText}>
              If you need to place a larger order before the 24 hours are up, reply to
              this email or contact support. We can review your account manually — most
              cases are approved within a few hours.
            </Text>
          </Section>

          <Section style={btnRow}>
            <Button href={`mailto:${SUPPORT_EMAIL}?subject=Manual%20review%20-%20new%20account%20limit`} style={btnPrimary}>
              Email Support
            </Button>
            <Button href={`${SITE_URL}/help-center?chat=open`} style={btnSecondary}>
              Open Live Chat
            </Button>
          </Section>

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
  component: NewAccountLimitBlockedEmail,
  subject: "About your recent Agever's checkout — new account 24h limit",
  displayName: 'New account €20/24h limit hit',
  previewData: { customerName: 'Alex', hoursLeft: 18.5 },
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