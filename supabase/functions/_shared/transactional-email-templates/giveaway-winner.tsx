import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Agever's"

interface GiveawayWinnerProps {
  giveawayTitle?: string
  prizeTitle?: string
  platform?: string
  gameCode?: string
  redeemInstructions?: string
}

const GiveawayWinnerEmail = ({
  giveawayTitle = 'Agever\'s Giveaway',
  prizeTitle = 'Your Prize',
  platform = 'Steam',
  gameCode = 'XXXX-XXXX-XXXX',
  redeemInstructions = 'Redeem this code on the official platform store.',
}: GiveawayWinnerProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>🏆 You won the {giveawayTitle} — here is your game code!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={logo}>{SITE_NAME}</Heading>
        </Section>

        <Section style={contentSection}>
          <Heading style={h1}>🏆 Congratulations — You Won!</Heading>
          <Text style={text}>
            You're the winner of <strong>{giveawayTitle}</strong>! 🎉
            Below is your free game code, ready to redeem.
          </Text>

          <Section style={prizeCard}>
            <Text style={orderLabel}>YOUR PRIZE</Text>
            <Text style={orderValue}>{prizeTitle}</Text>
            <Text style={orderDetail}>{platform}</Text>
            <Hr style={divider} />
            <Text style={orderLabel}>GAME CODE</Text>
            <Text style={codeText}>{gameCode}</Text>
          </Section>

          <Section style={instructionsCard}>
            <Text style={instructionsTitle}>How to redeem</Text>
            <Text style={instructionsText}>{redeemInstructions}</Text>
          </Section>

          <Text style={securityNote}>
            🔒 Keep this code private. Do not share it publicly — once used, it cannot be reissued.
          </Text>
        </Section>

        <Hr style={footerDivider} />
        <Text style={footer}>
          Thanks for playing with {SITE_NAME}. Stay tuned — a new giveaway starts every 4 days!
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: GiveawayWinnerEmail,
  subject: (data: Record<string, any>) =>
    `🏆 You won! Your free ${data.prizeTitle || 'game'} code is inside | ${SITE_NAME}`,
  displayName: 'Giveaway winner',
  previewData: {
    giveawayTitle: 'Fighting Giveaway',
    prizeTitle: 'Mortal Kombat 1',
    platform: 'Steam',
    gameCode: 'ABCD-1234-EFGH-5678',
    redeemInstructions: 'Open Steam → Games → Activate a Product on Steam → enter the code above.',
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
const prizeCard = {
  backgroundColor: '#161622', borderRadius: '8px', padding: '20px',
  marginBottom: '20px', border: '1px solid #2d2d3f',
}
const orderLabel = {
  color: '#71717a', fontSize: '11px', fontWeight: '600' as const,
  letterSpacing: '1.5px', textTransform: 'uppercase' as const, margin: '0 0 4px',
}
const orderValue = { color: '#ededed', fontSize: '16px', fontWeight: '600' as const, margin: '0 0 4px' }
const orderDetail = { color: '#a1a1aa', fontSize: '13px', margin: '0 0 4px' }
const codeText = {
  color: '#a855f7', fontSize: '20px', fontWeight: '800' as const,
  margin: '0', fontFamily: "'Courier New', monospace", letterSpacing: '2px',
  wordBreak: 'break-all' as const,
}
const divider = { borderColor: '#2d2d3f', margin: '12px 0' }
const instructionsCard = {
  backgroundColor: '#161622', borderRadius: '8px', padding: '16px',
  marginBottom: '20px', border: '1px solid #2d2d3f',
}
const instructionsTitle = {
  color: '#a855f7', fontSize: '12px', fontWeight: '700' as const,
  letterSpacing: '1.5px', textTransform: 'uppercase' as const, margin: '0 0 8px',
}
const instructionsText = { color: '#a1a1aa', fontSize: '14px', lineHeight: '1.5', margin: '0' }
const securityNote = {
  color: '#71717a', fontSize: '12px', lineHeight: '1.5', textAlign: 'center' as const,
  margin: '0', padding: '16px', backgroundColor: '#161622',
  borderRadius: '8px', border: '1px solid #2d2d3f',
}
const footerDivider = { borderColor: '#2d2d3f', margin: '0' }
const footer = {
  backgroundColor: '#161622', color: '#52525b', fontSize: '11px',
  textAlign: 'center' as const, padding: '20px 32px', lineHeight: '1.5',
  borderRadius: '0 0 12px 12px',
}