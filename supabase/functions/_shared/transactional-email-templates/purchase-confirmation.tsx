import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Agever's"

interface PurchaseConfirmationProps {
  gameTitle?: string
  platform?: string
  quantity?: number
  price?: string
  orderLink?: string
  orderId?: string
}

const PurchaseConfirmationEmail = ({
  gameTitle = 'Your Game',
  platform = 'Steam',
  quantity = 1,
  price = '€0.00',
  orderLink = '#',
  orderId = '---',
}: PurchaseConfirmationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {SITE_NAME} order is confirmed — view your game code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={logo}>{SITE_NAME}</Heading>
        </Section>

        <Section style={contentSection}>
          <Heading style={h1}>🎮 Order Confirmed!</Heading>
          <Text style={text}>
            Thank you for your purchase! Your game code is ready and waiting for you in your account.
          </Text>

          <Section style={orderCard}>
            <Text style={orderLabel}>ORDER ID</Text>
            <Text style={orderValue}>{orderId}</Text>
            <Hr style={divider} />
            <Text style={orderLabel}>PRODUCT</Text>
            <Text style={orderValue}>{gameTitle}</Text>
            <Text style={orderDetail}>{platform} • Qty: {quantity}</Text>
            <Hr style={divider} />
            <Text style={orderLabel}>TOTAL</Text>
            <Text style={priceText}>{price}</Text>
          </Section>

          <Section style={ctaSection}>
            <Button style={button} href={orderLink}>
              View Your Game Code
            </Button>
          </Section>

          <Text style={securityNote}>
            🔒 For your security, game codes are only visible in your personal account area. 
            Do not share this link with anyone.
          </Text>
        </Section>

        <Hr style={footerDivider} />
        <Text style={footer}>
          This is an automated message from {SITE_NAME}. 
          If you did not make this purchase, please contact our support team immediately.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PurchaseConfirmationEmail,
  subject: (data: Record<string, any>) =>
    `Order Confirmed — ${data.gameTitle || 'Your Game'} | ${SITE_NAME}`,
  displayName: 'Purchase confirmation',
  previewData: {
    gameTitle: 'Elden Ring',
    platform: 'Steam',
    quantity: 1,
    price: '€39.99',
    orderLink: 'https://agevers.com/order/DEMO123',
    orderId: 'DEMO-12345',
  },
} satisfies TemplateEntry

// Styles — Gaming Dark theme matching Agever's brand
const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Rajdhani', Arial, sans-serif",
}

const container = {
  maxWidth: '520px',
  margin: '0 auto',
  padding: '0',
}

const headerSection = {
  backgroundColor: '#161622',
  padding: '24px 32px',
  textAlign: 'center' as const,
  borderRadius: '12px 12px 0 0',
}

const logo = {
  color: '#a855f7',
  fontSize: '28px',
  fontWeight: '800' as const,
  fontFamily: "'Orbitron', Arial, sans-serif",
  letterSpacing: '3px',
  margin: '0',
}

const contentSection = {
  backgroundColor: '#1e1e2e',
  padding: '32px',
}

const h1 = {
  color: '#ededed',
  fontSize: '24px',
  fontWeight: '700' as const,
  margin: '0 0 16px',
  fontFamily: "'Orbitron', Arial, sans-serif",
}

const text = {
  color: '#a1a1aa',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 24px',
}

const orderCard = {
  backgroundColor: '#161622',
  borderRadius: '8px',
  padding: '20px',
  marginBottom: '24px',
  border: '1px solid #2d2d3f',
}

const orderLabel = {
  color: '#71717a',
  fontSize: '11px',
  fontWeight: '600' as const,
  letterSpacing: '1.5px',
  textTransform: 'uppercase' as const,
  margin: '0 0 4px',
}

const orderValue = {
  color: '#ededed',
  fontSize: '16px',
  fontWeight: '600' as const,
  margin: '0 0 4px',
}

const orderDetail = {
  color: '#a1a1aa',
  fontSize: '13px',
  margin: '0',
}

const priceText = {
  color: '#a855f7',
  fontSize: '22px',
  fontWeight: '800' as const,
  margin: '0',
  fontFamily: "'Orbitron', Arial, sans-serif",
}

const divider = {
  borderColor: '#2d2d3f',
  margin: '12px 0',
}

const ctaSection = {
  textAlign: 'center' as const,
  marginBottom: '24px',
}

const button = {
  backgroundColor: '#7c3aed',
  color: '#ffffff',
  fontWeight: '700' as const,
  fontSize: '15px',
  padding: '14px 32px',
  borderRadius: '8px',
  textDecoration: 'none',
  display: 'inline-block',
  fontFamily: "'Orbitron', Arial, sans-serif",
  letterSpacing: '1px',
}

const securityNote = {
  color: '#71717a',
  fontSize: '12px',
  lineHeight: '1.5',
  textAlign: 'center' as const,
  margin: '0',
  padding: '16px',
  backgroundColor: '#161622',
  borderRadius: '8px',
  border: '1px solid #2d2d3f',
}

const footerDivider = {
  borderColor: '#2d2d3f',
  margin: '0',
}

const footer = {
  backgroundColor: '#161622',
  color: '#52525b',
  fontSize: '11px',
  textAlign: 'center' as const,
  padding: '20px 32px',
  lineHeight: '1.5',
  borderRadius: '0 0 12px 12px',
}
