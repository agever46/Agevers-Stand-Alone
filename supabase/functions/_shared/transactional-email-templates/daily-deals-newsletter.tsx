import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr, Img,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Agever's"
const SITE_URL = "https://agevers.com"

interface Deal {
  title: string
  image_url?: string
  sale_price: string
  original_price?: string
  discount_pct?: number
  url: string
}

interface Props {
  deals?: Deal[]
}

const DailyDealsEmail = ({ deals = [] }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>The hottest deals on {SITE_NAME} — limited time only 🔥</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={logo}>{SITE_NAME}</Heading>
        <Heading style={h1}>🔥 The Hottest Deals On {SITE_NAME}</Heading>
        <Text style={text}>
          Hand-picked daily deals — limited stock, limited time. Grab them before they're gone.
        </Text>

        {deals.map((d, i) => (
          <Section key={i} style={dealBox}>
            {d.image_url && (
              <Img src={d.image_url} width="520" alt={d.title} style={dealImg} />
            )}
            <Text style={dealTitle}>{d.title}</Text>
            <Section style={priceRow}>
              <Text style={salePrice}>€{d.sale_price}</Text>
              {d.original_price && (
                <Text style={oldPrice}>€{d.original_price}</Text>
              )}
              {d.discount_pct && d.discount_pct > 0 ? (
                <Text style={badge}>-{d.discount_pct}%</Text>
              ) : null}
            </Section>
            <Section style={{ textAlign: 'center', margin: '12px 0 4px' }}>
              <Button href={d.url} style={button}>GRAB IT NOW</Button>
            </Section>
          </Section>
        ))}

        <Hr style={hr} />
        <Section style={{ textAlign: 'center', margin: '20px 0' }}>
          <Button href={`${SITE_URL}/deals`} style={buttonAlt}>See all deals</Button>
        </Section>

        <Text style={footer}>Instant delivery · Secure checkout · {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DailyDealsEmail,
  subject: "🔥 The Hottest Deals On Agever's — limited time",
  displayName: 'Daily Deals Newsletter',
  previewData: {
    deals: [
      { title: 'Subnautica 2 - Xbox', sale_price: '17.99', original_price: '27.55', discount_pct: 35, url: 'https://agevers.com/deals', image_url: 'https://static.kinguin.net/media/images/products/000_202603181040_SubnauticaII111.jpg' },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '560px', margin: '0 auto' }
const logo = { fontSize: '24px', fontWeight: 'bold', color: '#FF6B00', margin: '0 0 20px', textAlign: 'center' as const }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#000000', margin: '0 0 16px', textAlign: 'center' as const }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 20px', textAlign: 'center' as const }
const dealBox = { backgroundColor: '#f8f8f8', borderRadius: '8px', padding: '16px', margin: '16px 0' }
const dealImg = { borderRadius: '6px', width: '100%', height: 'auto', objectFit: 'cover' as const }
const dealTitle = { fontSize: '16px', fontWeight: 'bold', color: '#000', margin: '12px 0 6px', textAlign: 'center' as const }
const priceRow = { textAlign: 'center' as const, margin: '4px 0' }
const salePrice = { display: 'inline-block', fontSize: '20px', fontWeight: 'bold', color: '#FF6B00', margin: '0 6px' }
const oldPrice = { display: 'inline-block', fontSize: '14px', color: '#999', textDecoration: 'line-through', margin: '0 6px' }
const badge = { display: 'inline-block', fontSize: '12px', fontWeight: 'bold', color: '#fff', backgroundColor: '#e11d48', padding: '3px 8px', borderRadius: '4px', margin: '0 6px' }
const hr = { borderColor: '#ddd', margin: '20px 0' }
const button = { backgroundColor: '#FF6B00', color: '#fff', padding: '12px 28px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', textDecoration: 'none' }
const buttonAlt = { backgroundColor: '#000', color: '#fff', padding: '10px 22px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0', textAlign: 'center' as const }