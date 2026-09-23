import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Agever's"

interface GiveawayLoserProps {
  giveawayTitle?: string
  prizeTitle?: string
  nextGiveawayTitle?: string
  nextGiveawayUrl?: string
}

const GiveawayLoserEmail = ({
  giveawayTitle = "Agever's Giveaway",
  prizeTitle = 'the prize',
  nextGiveawayTitle,
  nextGiveawayUrl = 'https://agevers.com/giveaway',
}: GiveawayLoserProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Thanks for joining the {giveawayTitle} — better luck next time!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={logo}>{SITE_NAME}</Heading>
        </Section>

        <Section style={contentSection}>
          <Heading style={h1}>🎮 Thanks for playing!</Heading>
          <Text style={text}>
            The <strong>{giveawayTitle}</strong> has ended and the winner of <strong>{prizeTitle}</strong> has been chosen.
            Unfortunately, this time it wasn't you — but we truly appreciate you joining in!
          </Text>

          <Section style={card}>
            <Text style={cardTitle}>🎁 A new giveaway just started!</Text>
            <Text style={cardText}>
              {nextGiveawayTitle
                ? `Don't miss it — `
                : 'A new giveaway is already live — '}
              <strong>{nextGiveawayTitle || 'a fresh prize is up for grabs'}</strong>.
              Enter now for another shot at winning, completely free.
            </Text>
            <Button href={nextGiveawayUrl} style={ctaButton}>
              Enter the new giveaway →
            </Button>
          </Section>

          <Text style={footerText}>
            Good luck next time — your win could be just one giveaway away. 🍀
          </Text>
        </Section>

        <Hr style={footerDivider} />
        <Text style={footer}>
          Thanks for being part of the {SITE_NAME} community.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: GiveawayLoserEmail,
  subject: (data: Record<string, any>) =>
    `Thanks for joining! ${data.nextGiveawayTitle ? `New giveaway live: ${data.nextGiveawayTitle}` : 'A new giveaway just started'}`,
  displayName: 'Giveaway loser',
  previewData: {
    giveawayTitle: 'Fighting Giveaway',
    prizeTitle: 'Mortal Kombat 1',
    nextGiveawayTitle: '100€ Steam Wallet Mega Giveaway!',
    nextGiveawayUrl: 'https://agevers.com/giveaway',
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
  color: '#ededed', fontSize: '24px', fontWeight: '700' as const,
  margin: '0 0 16px', fontFamily: "'Orbitron', Arial, sans-serif",
}
const text = { color: '#a1a1aa', fontSize: '15px', lineHeight: '1.6', margin: '0 0 24px' }
const card = {
  backgroundColor: '#161622', borderRadius: '8px', padding: '20px',
  marginBottom: '20px', border: '1px solid #2d2d3f',
}
const cardTitle = {
  color: '#a855f7', fontSize: '14px', fontWeight: '700' as const,
  letterSpacing: '1px', textTransform: 'uppercase' as const, margin: '0 0 8px',
}
const cardText = { color: '#a1a1aa', fontSize: '14px', lineHeight: '1.5', margin: '0' }
const footerText = {
  color: '#71717a', fontSize: '13px', lineHeight: '1.5', textAlign: 'center' as const,
  margin: '0', fontStyle: 'italic' as const,
}
const footerDivider = { borderColor: '#2d2d3f', margin: '0' }
const footer = {
  backgroundColor: '#161622', color: '#52525b', fontSize: '11px',
  textAlign: 'center' as const, padding: '20px 32px', lineHeight: '1.5',
  borderRadius: '0 0 12px 12px',
}
const ctaButton = {
  backgroundColor: '#a855f7', color: '#ffffff', fontSize: '14px',
  fontWeight: '700' as const, padding: '12px 22px', borderRadius: '8px',
  textDecoration: 'none', display: 'inline-block', marginTop: '14px',
  letterSpacing: '0.5px',
}