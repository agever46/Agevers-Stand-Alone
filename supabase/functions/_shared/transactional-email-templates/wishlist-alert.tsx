import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Agever's"
const SITE_URL = "https://agevers.com"

interface WishlistItem {
  title: string
  platform: string
  oldPrice?: string
  newPrice?: string
  dropPct?: number
  alertType: 'price_drop' | 'restock'
  productUrl: string
}

interface WishlistAlertProps {
  userName?: string
  items?: WishlistItem[]
}

const fallbackItems: WishlistItem[] = [
  {
    title: 'Cyberpunk 2077',
    platform: 'Steam',
    oldPrice: '€39.99',
    newPrice: '€24.99',
    dropPct: 38,
    alertType: 'price_drop',
    productUrl: SITE_URL,
  },
]

const WishlistAlertEmail = ({ userName, items = fallbackItems }: WishlistAlertProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Good news from your wishlist on {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={logo}>{SITE_NAME}</Heading>
        </Section>

        <Section style={contentSection}>
          <Heading style={h1}>❤️ Wishlist update{userName ? `, ${userName}` : ''}!</Heading>
          <Text style={text}>
            Some games on your wishlist just got more interesting. Grab them before they're gone:
          </Text>

          {items.map((item, idx) => (
            <Section key={idx} style={itemCard}>
              <Text style={itemTitle}>{item.title}</Text>
              <Text style={itemMeta}>{item.platform}</Text>
              {item.alertType === 'price_drop' ? (
                <>
                  <Text style={badgeGreen}>📉 Price dropped {item.dropPct}%</Text>
                  <Text style={priceRow}>
                    <span style={priceNew}>{item.newPrice}</span>{' '}
                    <span style={priceOld}>{item.oldPrice}</span>
                  </Text>
                </>
              ) : (
                <Text style={badgeBlue}>📦 Back in stock</Text>
              )}
              <Button href={item.productUrl} style={cta}>View deal</Button>
              <Hr style={divider} />
            </Section>
          ))}

          <Text style={footer}>
            You're receiving this because you added these items to your wishlist on {SITE_NAME}.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WishlistAlertEmail,
  subject: (data: Record<string, any>) => {
    const items = (data?.items as WishlistItem[]) || []
    if (items.length === 0) return `Updates from your ${SITE_NAME} wishlist`
    const first = items[0]
    if (items.length === 1) {
      return first.alertType === 'price_drop'
        ? `📉 ${first.title} dropped ${first.dropPct}% — grab it before it's gone`
        : `📦 ${first.title} is back in stock on ${SITE_NAME}`
    }
    return `${items.length} updates from your ${SITE_NAME} wishlist`
  },
  displayName: 'Wishlist alert (price drop / restock)',
  previewData: {
    userName: 'Alex',
    items: fallbackItems,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '0', maxWidth: '600px', margin: '0 auto' }
const headerSection = { backgroundColor: '#0f172a', padding: '24px', textAlign: 'center' as const }
const logo = { color: '#ffffff', fontSize: '24px', margin: '0', letterSpacing: '2px' }
const contentSection = { padding: '28px 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 20px' }
const itemCard = { padding: '12px 0' }
const itemTitle = { fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 4px' }
const itemMeta = { fontSize: '12px', color: '#888', margin: '0 0 8px' }
const badgeGreen = { fontSize: '12px', fontWeight: 'bold', color: '#10b981', margin: '0 0 8px' }
const badgeBlue = { fontSize: '12px', fontWeight: 'bold', color: '#3b82f6', margin: '0 0 8px' }
const priceRow = { margin: '0 0 12px', fontSize: '14px' }
const priceNew = { color: '#0f172a', fontWeight: 'bold', fontSize: '18px' }
const priceOld = { color: '#999', textDecoration: 'line-through', marginLeft: '8px' }
const cta = { backgroundColor: '#0f172a', color: '#ffffff', padding: '10px 20px', borderRadius: '6px', textDecoration: 'none', fontSize: '13px', fontWeight: 'bold', display: 'inline-block' }
const divider = { borderColor: '#eee', margin: '16px 0 0' }
const footer = { fontSize: '11px', color: '#999', margin: '24px 0 0', textAlign: 'center' as const }