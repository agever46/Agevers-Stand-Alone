import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Agever's"

interface Props {
  customerName?: string
  productTitle?: string
  orderId?: string
  amount?: string
}

const OrderUnderReviewEmail = ({
  customerName,
  productTitle = 'your order',
  orderId,
  amount,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your order is under security review — no action needed</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={logo}>{SITE_NAME}</Heading>
        </Section>

        <Section style={contentSection}>
          <Heading style={h1}>🔒 Order Under Security Review</Heading>
          <Text style={text}>
            {customerName ? `Hi ${customerName},` : 'Hi there,'}
          </Text>
          <Text style={text}>
            Thanks for your purchase of <strong>{productTitle}</strong>
            {amount ? <> (<strong>{amount}</strong>)</> : null}. Your payment was received successfully and your order is now being reviewed by our security team before delivery.
          </Text>

          <Section style={card}>
            <Text style={cardTitle}>⏱️ What happens next?</Text>
            <Text style={cardText}>
              Most reviews complete within <strong>1 hour</strong>. As soon as your order is approved, we'll email you again and your code will be unlocked in your account.
              If anything looks off, we may contact you for a quick verification.
            </Text>
          </Section>

          <Section style={card}>
            <Text style={cardTitle}>👀 Track your order</Text>
            <Text style={cardText}>
              You can check the status anytime from <strong>My Account → Orders</strong>.
              The order will be marked as <strong>"Under Review"</strong> until it's released.
            </Text>
          </Section>

          {orderId && (
            <Text style={meta}>Order reference: <span style={metaCode}>{orderId}</span></Text>
          )}

          <Text style={footerText}>
            This extra step keeps every Agever's customer safe from fraud and unauthorized purchases. Thanks for your patience!
          </Text>
        </Section>

        <Hr style={footerDivider} />
        <Text style={footer}>
          Questions? Just reply to this email and our team will help.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrderUnderReviewEmail,
  subject: 'Your order is under security review',
  displayName: 'Order under security review',
  previewData: {
    customerName: 'Alex',
    productTitle: 'Razer Gold 55 USD',
    orderId: '55P7718260297361T',
    amount: '€54.39',
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
