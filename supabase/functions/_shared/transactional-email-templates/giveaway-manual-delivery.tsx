import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Agever's"

interface Props {
  giveawayId?: string
  giveawayTitle?: string
  winnerEmail?: string
  prizeTitle?: string
  platform?: string
  reason?: string
}

const Email = ({
  giveawayId = '—',
  giveawayTitle = 'Unknown giveaway',
  winnerEmail = 'unknown',
  prizeTitle = '—',
  platform = '—',
  reason = 'Automatic Kinguin purchase failed.',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Giveaway needs manual prize delivery — {giveawayTitle}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={logo}>{SITE_NAME} — Admin</Heading>
        </Section>

        <Section style={contentSection}>
          <Heading style={h1}>⚠️ Giveaway needs manual delivery</Heading>
          <Text style={intro}>
            The automatic prize purchase failed. Please deliver the prize manually to the winner.
          </Text>

          <Section style={card}>
            <Text style={label}>GIVEAWAY</Text>
            <Text style={value}>{giveawayTitle}</Text>
            <Text style={detail}>ID: {giveawayId}</Text>
            <Hr style={divider} />
            <Text style={label}>PRIZE</Text>
            <Text style={value}>{prizeTitle}</Text>
            <Text style={detail}>Platform: {platform}</Text>
            <Hr style={divider} />
            <Text style={label}>WINNER</Text>
            <Text style={value}>{winnerEmail}</Text>
            <Hr style={divider} />
            <Text style={label}>REASON</Text>
            <Text style={reasonText}>{reason}</Text>
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
  component: Email,
  subject: (data: Record<string, any>) =>
    `⚠️ Manual prize delivery needed — ${data.giveawayTitle || 'Giveaway'} | ${SITE_NAME}`,
  displayName: 'Giveaway needs manual delivery',
  previewData: {
    giveawayId: 'abc-123',
    giveawayTitle: 'XBOX 100 USD GIVEAWAY',
    winnerEmail: 'winner@example.com',
    prizeTitle: 'Xbox Gift Card 100 USD',
    platform: 'Xbox',
    reason: 'Kinguin purchase failed: insufficient balance.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Rajdhani', Arial, sans-serif" }
const container = { maxWidth: '520px', margin: '0 auto', padding: '0' }
const headerSection = { backgroundColor: '#161622', padding: '24px 32px', textAlign: 'center' as const, borderRadius: '12px 12px 0 0' }
const logo = { color: '#a855f7', fontSize: '22px', fontWeight: '800' as const, fontFamily: "'Orbitron', Arial, sans-serif", letterSpacing: '2px', margin: '0' }
const contentSection = { backgroundColor: '#1e1e2e', padding: '32px' }
const h1 = { color: '#facc15', fontSize: '22px', fontWeight: '700' as const, margin: '0 0 12px', fontFamily: "'Orbitron', Arial, sans-serif" }
const intro = { color: '#d4d4d8', fontSize: '14px', margin: '0 0 20px' }
const card = { backgroundColor: '#161622', borderRadius: '8px', padding: '20px', border: '1px solid #2d2d3f' }
const label = { color: '#71717a', fontSize: '11px', fontWeight: '600' as const, letterSpacing: '1.5px', textTransform: 'uppercase' as const, margin: '0 0 4px' }
const value = { color: '#ededed', fontSize: '15px', fontWeight: '600' as const, margin: '0 0 4px' }
const detail = { color: '#a1a1aa', fontSize: '13px', margin: '0' }
const reasonText = { color: '#fca5a5', fontSize: '14px', fontWeight: '600' as const, margin: '0' }
const divider = { borderColor: '#2d2d3f', margin: '12px 0' }
const footerDivider = { borderColor: '#2d2d3f', margin: '0' }
const footer = { backgroundColor: '#161622', color: '#52525b', fontSize: '11px', textAlign: 'center' as const, padding: '20px 32px', lineHeight: '1.5', borderRadius: '0 0 12px 12px' }