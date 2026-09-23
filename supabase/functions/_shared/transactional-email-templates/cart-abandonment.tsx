import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Agever's"
const SITE_URL = "https://agevers.com"

interface CartItem {
  title: string
  platform: string
  price: string
  image_url?: string
}

interface CartAbandonmentProps {
  userName?: string
  items?: CartItem[]
  total?: string
}

const fallbackItems: CartItem[] = [
  { title: 'Cyberpunk 2077', platform: 'Steam', price: '€24.99' },
]

const CartAbandonmentEmail = ({ userName, items = fallbackItems, total = '€24.99' }: CartAbandonmentProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You left items in your cart at {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={logo}>{SITE_NAME}</Heading>
        <Heading style={h1}>{userName ? `Hey ${userName}, ` : 'Hey there, '}your cart misses you 🛒</Heading>
        <Text style={text}>
          You left some great deals in your cart. Complete your purchase before they're gone — top digital codes sell out fast.
        </Text>
        <Section style={cartBox}>
          {items.map((item, i) => (
            <Section key={i} style={itemRow}>
              {item.image_url && (
                <Img src={item.image_url} width="60" height="60" alt={item.title} style={itemImage} />
              )}
              <Section style={itemDetails}>
                <Text style={itemTitle}>{item.title}</Text>
                <Text style={itemPlatform}>{item.platform}</Text>
              </Section>
              <Text style={itemPrice}>{item.price}</Text>
            </Section>
          ))}
          <Hr style={hr} />
          <Section style={totalRow}>
            <Text style={totalLabel}>Total</Text>
            <Text style={totalValue}>{total}</Text>
          </Section>
        </Section>
        <Section style={{ textAlign: 'center', margin: '30px 0' }}>
          <Button href={`${SITE_URL}/checkout`} style={button}>Complete Purchase</Button>
        </Section>
        <Text style={footer}>Instant delivery · Secure checkout · {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CartAbandonmentEmail,
  subject: "You left items in your cart 🛒",
  displayName: 'Cart abandonment reminder',
  previewData: {
    userName: 'Alex',
    items: [{ title: 'Cyberpunk 2077', platform: 'Steam', price: '€24.99' }],
    total: '€24.99',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '560px', margin: '0 auto' }
const logo = { fontSize: '24px', fontWeight: 'bold', color: '#FF6B00', margin: '0 0 20px', textAlign: 'center' as const }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#000000', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 20px' }
const cartBox = { backgroundColor: '#f8f8f8', borderRadius: '8px', padding: '16px', margin: '20px 0' }
const itemRow = { display: 'flex' as const, alignItems: 'center' as const, padding: '8px 0' }
const itemImage = { borderRadius: '4px', marginRight: '12px' }
const itemDetails = { flex: 1 }
const itemTitle = { fontSize: '14px', fontWeight: 'bold', color: '#000', margin: '0' }
const itemPlatform = { fontSize: '12px', color: '#888', margin: '2px 0 0' }
const itemPrice = { fontSize: '14px', fontWeight: 'bold', color: '#000', margin: '0' }
const hr = { borderColor: '#ddd', margin: '12px 0' }
const totalRow = { display: 'flex' as const, justifyContent: 'space-between' as const }
const totalLabel = { fontSize: '14px', fontWeight: 'bold', margin: 0 }
const totalValue = { fontSize: '16px', fontWeight: 'bold', color: '#FF6B00', margin: 0 }
const button = { backgroundColor: '#FF6B00', color: '#fff', padding: '12px 28px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0', textAlign: 'center' as const }
