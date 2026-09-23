import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Agever's"

interface Props {
  gameTitle?: string
  platform?: string
  orderId?: string
  orderLink?: string
}

const OrderApprovedEmail = ({
  gameTitle = 'Your Order',
  platform = '',
  orderId = '---',
  orderLink = '#',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your order has been approved — your code is ready to view</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={logo}>{SITE_NAME}</Heading>
        </Section>

        <Section style={contentSection}>
          <Heading style={h1}>✅ Order Approved</Heading>
          <Text style={text}>
            Good news — our security review is complete and your order has been approved.
            Your code is ready to view in your account.
          </Text>

          <Section style={orderCard}>
            <Text style={orderLabel}>ORDER ID</Text>
            <Text style={orderValue}>{orderId}</Text>
            <Hr style={divider} />
            <Text style={orderLabel}>PRODUCT</Text>
            <Text style={orderValue}>{gameTitle}</Text>
            {platform ? <Text style={orderDetail}>{platform}</Text> : null}
          </Section>

          <Section style={ctaSection}>
            <Button style={button} href={orderLink}>
              Reveal My Code
            </Button>
          </Section>

          <Text style={securityNote}>
            🔒 Sign in to your {SITE_NAME} account to reveal the code. For your protection,
            codes are only shown in your personal account area — never share this link.
          </Text>
        </Section>

        <Hr style={footerDivider} />
        <Text style={footer}>
          This is an automated message from {SITE_NAME}. Need help? Contact our support team.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OrderApprovedEmail,
  subject: (data: Record<string, any>) =>
    `Your code is ready — ${data.gameTitle || 'Your Order'} | ${SITE_NAME}`,
  displayName: 'Order approved — code ready',
  previewData: {
    gameTitle: 'Elden Ring',
    platform: 'Steam',
    orderId: 'DEMO-12345',
    orderLink: 'https://agevers.com/order/DEMO123',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Rajdhani', Arial, sans-serif" }
const container = { maxWidth: '520px', margin: '0 auto', padding: '0' }
const headerSection = {
  backgroundColor: '#161622', padding: '24px 32px',
  textAlign: 'center' as const, borderRadius: '12px 12px 0 0',
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
const text = { color: '#a1a1aa', fontSize: '15px', lineHeight: '1.6', margin: '0 0 24px' }
const orderCard = {
  backgroundColor: '#161622', borderRadius: '8px', padding: '20px',
  marginBottom: '24px', border: '1px solid #2d2d3f',
}
const orderLabel = {
  color: '#71717a', fontSize: '11px', fontWeight: '600' as const,
  letterSpacing: '1.5px', textTransform: 'uppercase' as const, margin: '0 0 4px',
}
const orderValue = { color: '#ededed', fontSize: '16px', fontWeight: '600' as const, margin: '0 0 4px' }
const orderDetail = { color: '#a1a1aa', fontSize: '13px', margin: '0' }
const divider = { borderColor: '#2d2d3f', margin: '12px 0' }
const ctaSection = { textAlign: 'center' as const, marginBottom: '24px' }
const button = {
  backgroundColor: '#7c3aed', color: '#ffffff', fontWeight: '700' as const,
  fontSize: '15px', padding: '14px 32px', borderRadius: '8px', textDecoration: 'none',
  display: 'inline-block', fontFamily: "'Orbitron', Arial, sans-serif", letterSpacing: '1px',
}
const securityNote = { color: '#71717a', fontSize: '13px', lineHeight: '1.5', margin: '0' }
const footerDivider = { borderColor: '#2d2d3f', margin: '0' }
const footer = {
  color: '#71717a', fontSize: '12px', lineHeight: '1.5',
  padding: '16px 32px 24px', textAlign: 'center' as const,
  backgroundColor: '#161622', borderRadius: '0 0 12px 12px', margin: '0',
}
