import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Agever's"

interface Props {
  customerName?: string
  productTitle?: string
  orderId?: string
  orderUrl?: string
}

const SmsRegionFixedEmail = ({ customerName, productTitle = 'your order', orderId, orderUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Good news — SMS delivery to your region has been restored</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={logo}>{SITE_NAME}</Heading>
        </Section>

        <Section style={contentSection}>
          <Heading style={h1}>✅ SMS Delivery Restored</Heading>
          <Text style={text}>{customerName ? `Hi ${customerName},` : 'Hi there,'}</Text>
          <Text style={text}>
            Great news — the SMS delivery issue affecting your region (Vietnam / +84)
            has been <strong>fully resolved</strong>. Our SMS provider has confirmed that
            verification codes are now being delivered normally.
          </Text>
          <Text style={text}>
            You can now return to your order for <strong>{productTitle}</strong>,
            complete the quick SMS verification, and unlock your code immediately.
          </Text>

          {orderUrl && (
            <Section style={{ textAlign: 'center', margin: '24px 0' }}>
              <Button href={orderUrl} style={button}>Complete verification</Button>
            </Section>
          )}

          <Section style={card}>
            <Text style={cardTitle}>💡 Tip</Text>
            <Text style={cardText}>
              If the first code doesn't arrive within a minute, tap "Resend code".
              Make sure your phone has signal and can receive international SMS.
            </Text>
          </Section>

          {orderId && (
            <Text style={meta}>Order reference: <span style={metaCode}>{orderId}</span></Text>
          )}

          <Text style={footerText}>
            Thank you for your patience — we truly appreciate it.
          </Text>
        </Section>

        <Hr style={footerDivider} />
        <Text style={footer}>Need help? Just reply to this email and our team will assist you.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SmsRegionFixedEmail,
  subject: 'Good news — SMS delivery has been restored, complete your order',
  displayName: 'SMS region issue resolved',
  previewData: {
    customerName: 'Alex',
    productTitle: 'Razer Gold 1 USD',
    orderId: '4BJ33461BL6422803',
    orderUrl: 'https://agevers.com/order/4BJ33461BL6422803',
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
  color: '#ededed', fontSize: '22px', fontWeight: '700' as const,
  margin: '0 0 16px', fontFamily: "'Orbitron', Arial, sans-serif",
}
const text = { color: '#a1a1aa', fontSize: '15px', lineHeight: '1.6', margin: '0 0 16px' }
const button = {
  backgroundColor: '#a855f7', color: '#ffffff', padding: '12px 28px',
  borderRadius: '8px', fontSize: '15px', fontWeight: '700' as const,
  textDecoration: 'none', letterSpacing: '1px', textTransform: 'uppercase' as const,
}
const card = {
  backgroundColor: '#161622', borderRadius: '8px', padding: '20px',
  marginBottom: '16px', border: '1px solid #2d2d3f',
}
const cardTitle = {
  color: '#a855f7', fontSize: '14px', fontWeight: '700' as const,
  letterSpacing: '1px', textTransform: 'uppercase' as const, margin: '0 0 8px',
}
const cardText = { color: '#a1a1aa', fontSize: '14px', lineHeight: '1.5', margin: '0' }
const meta = { color: '#71717a', fontSize: '12px', margin: '8px 0 16px', textAlign: 'center' as const }
const metaCode = { color: '#ededed', fontFamily: 'monospace' }
const footerText = {
  color: '#71717a', fontSize: '13px', lineHeight: '1.5', textAlign: 'center' as const,
  margin: '16px 0 0', fontStyle: 'italic' as const,
}
const footerDivider = { borderColor: '#2d2d3f', margin: '0' }
const footer = {
  backgroundColor: '#161622', color: '#52525b', fontSize: '11px',
  textAlign: 'center' as const, padding: '20px 32px', lineHeight: '1.5',
  borderRadius: '0 0 12px 12px',
}