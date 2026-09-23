import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Agever's"

interface AdminNewOrderProps {
  orderId?: string
  gameTitle?: string
  platform?: string
  quantity?: number
  price?: string
  buyerEmail?: string
  source?: string
  status?: string
  buyerCountry?: string
}

const AdminNewOrderEmail = ({
  orderId = '---',
  gameTitle = 'Unknown',
  platform = 'Unknown',
  quantity = 1,
  price = '€0.00',
  buyerEmail = 'unknown',
  source = 'unknown',
  status = 'completed',
  buyerCountry = '—',
}: AdminNewOrderProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New order: {gameTitle} — {price}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={logo}>{SITE_NAME} — Admin</Heading>
        </Section>

        <Section style={contentSection}>
          <Heading style={h1}>🛒 New Order Received</Heading>

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
            <Hr style={divider} />
            <Text style={orderLabel}>BUYER</Text>
            <Text style={orderValue}>{buyerEmail}</Text>
            <Text style={orderDetail}>Country: {buyerCountry}</Text>
            <Hr style={divider} />
            <Text style={orderLabel}>SOURCE</Text>
            <Text style={orderValue}>{source}</Text>
            <Hr style={divider} />
            <Text style={orderLabel}>STATUS</Text>
            <Text style={statusText(status)}>{status.toUpperCase()}</Text>
          </Section>
        </Section>

        <Hr style={footerDivider} />
        <Text style={footer}>
          Automated admin notification from {SITE_NAME}.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AdminNewOrderEmail,
  subject: (data: Record<string, any>) =>
    `New Order: ${data.gameTitle || 'Product'} — ${data.price || '€?'} | ${SITE_NAME}`,
  displayName: 'Admin new order notification',
  previewData: {
    orderId: 'ORD-12345',
    gameTitle: 'Elden Ring',
    platform: 'Steam',
    quantity: 1,
    price: '€39.99',
    buyerEmail: 'buyer@example.com',
    source: 'kinguin',
    status: 'completed',
    buyerCountry: 'NL',
  },
} satisfies TemplateEntry

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
  fontSize: '22px',
  fontWeight: '800' as const,
  fontFamily: "'Orbitron', Arial, sans-serif",
  letterSpacing: '2px',
  margin: '0',
}

const contentSection = {
  backgroundColor: '#1e1e2e',
  padding: '32px',
}

const h1 = {
  color: '#ededed',
  fontSize: '22px',
  fontWeight: '700' as const,
  margin: '0 0 20px',
  fontFamily: "'Orbitron', Arial, sans-serif",
}

const orderCard = {
  backgroundColor: '#161622',
  borderRadius: '8px',
  padding: '20px',
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
  fontSize: '15px',
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
  fontSize: '20px',
  fontWeight: '800' as const,
  margin: '0',
  fontFamily: "'Orbitron', Arial, sans-serif",
}

const statusText = (status: string) => ({
  color: status === 'completed' ? '#4ade80' : status === 'held' ? '#facc15' : '#a1a1aa',
  fontSize: '14px',
  fontWeight: '700' as const,
  margin: '0',
  letterSpacing: '1px',
})

const divider = {
  borderColor: '#2d2d3f',
  margin: '12px 0',
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
