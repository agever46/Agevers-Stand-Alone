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
  verificationMessage?: string
}

const OrderVerificationRequiredEmail = ({
  customerName,
  productTitle = 'your order',
  orderId,
  amount,
  verificationMessage,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Action Required: Verify your purchase of {productTitle}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={logo}>{SITE_NAME}</Heading>
        </Section>

        <Section style={contentSection}>
          <Heading style={h1}>⚠️ Action Required: Identity Verification</Heading>
          <Text style={text}>
            {customerName ? `Hi ${customerName},` : 'Hi there,'}
          </Text>
          <Text style={text}>
            Thank you for your purchase of <strong>{productTitle}</strong>
            {amount ? <> (<strong>{amount}</strong>)</> : null}. 
          </Text>
          
          <Section style={alertCard}>
            <Text style={cardTitle}>Why is my order held?</Text>
            <Text style={cardText}>
              Your order is currently under a routine security review because the email address or phone number used on our site doesn't match your PayPal payment information. 
            </Text>
          </Section>

          <Section style={actionCard}>
            <Text style={actionTitle}>How to release your code:</Text>
            <Text style={actionText}>
              To protect your account and complete the delivery, please follow these steps:
            </Text>
            <Text style={instructions}>
              1. <strong>Confirm Authorization:</strong> Reply to this email and confirm you authorized this purchase.<br />
              2. <strong>Screenshot:</strong> Attach a screenshot of your PayPal transaction confirmation.<br />
              3. <strong>Identity:</strong> If possible, confirm the mismatch reason (e.g., using a family member's PayPal).
            </Text>
          </Section>

          <Section style={card}>
            <Text style={cardTitle}>💬 Live Support Message</Text>
            <Text style={cardText}>
              Our team sent you the following message in the site's live chat:
            </Text>
            <Text style={quote}>
              "{verificationMessage || "Your order is currently under a routine security review because the email address used on our site doesn't match your PayPal payment email. To protect your account and complete the delivery, could you please confirm that you authorized this payment? A screenshot of your PayPal transaction confirmation would help us release the code immediately. Thank you for your patience!"}"
            </Text>
          </Section>

          {orderId && (
            <Text style={meta}>Order reference: <span style={metaCode}>{orderId}</span></Text>
          )}

          <Text style={footerText}>
            This extra step keeps every Agever's customer safe from fraud. We appreciate your cooperation!
          </Text>
        </Section>

        <Hr style={footerDivider} />
        <Text style={footer}>
          Reply directly to this email or use the live chat on our website to complete verification.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrderVerificationRequiredEmail,
  subject: 'Action Required: Verify your purchase',
  displayName: 'Order Verification Required',
  previewData: {
    customerName: 'Alex',
    productTitle: 'Binance Card (euri) €10',
    orderId: '5XB9929535318304U',
    amount: '€13.11',
    verificationMessage: "Hi again! Your order is currently under a routine security review because the email address used on our site doesn't match your PayPal payment email. To protect your account and complete the delivery, could you please confirm that you authorized this payment? A screenshot of your PayPal transaction confirmation would help us release the code immediately."
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
const alertCard = {
  backgroundColor: '#3b0a0a', borderRadius: '8px', padding: '20px',
  marginBottom: '16px', border: '1px solid #7f1d1d',
}
const actionCard = {
  backgroundColor: '#1e293b', borderRadius: '8px', padding: '20px',
  marginBottom: '16px', border: '1px solid #334155',
}
const cardTitle = {
  color: '#a855f7', fontSize: '14px', fontWeight: '700' as const,
  letterSpacing: '1px', textTransform: 'uppercase' as const, margin: '0 0 8px',
}
const actionTitle = {
  color: '#38bdf8', fontSize: '14px', fontWeight: '700' as const,
  letterSpacing: '1px', textTransform: 'uppercase' as const, margin: '0 0 8px',
}
const cardText = { color: '#a1a1aa', fontSize: '14px', lineHeight: '1.5', margin: '0' }
const actionText = { color: '#e2e8f0', fontSize: '14px', lineHeight: '1.5', margin: '0 0 12px' }
const instructions = { color: '#e2e8f0', fontSize: '14px', lineHeight: '1.8', margin: '0' }
const quote = { 
  color: '#d1d5db', fontSize: '14px', lineHeight: '1.6', margin: '8px 0 0', 
  paddingLeft: '12px', borderLeft: '3px solid #a855f7', fontStyle: 'italic' as const 
}
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
