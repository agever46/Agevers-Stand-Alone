import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Agever's"

interface Props {
  customerName?: string
  gameTitle?: string
  reviewLink?: string
  rewardLabel?: string
}

const ReviewRequestEmail = ({
  customerName = 'there',
  gameTitle = 'your recent order',
  reviewLink = 'https://www.trustpilot.com/review/agevers.com',
  rewardLabel = '$2',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Review us on Trustpilot and get a ${rewardLabel} voucher`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={logo}>{SITE_NAME}</Heading>
        </Section>

        <Section style={contentSection}>
          <Heading style={h1}>How did we do?</Heading>
          <Text style={text}>
            Hi {customerName}, thanks for your recent purchase of {gameTitle}.
            We'd love to hear how it went - an honest review on Trustpilot takes less than a minute
            and helps other gamers buy with confidence.
          </Text>

          <Section style={ctaSection}>
            <Button style={button} href={reviewLink}>
              Rate us on Trustpilot
            </Button>
          </Section>

          <Section style={rewardCard}>
            <Text style={rewardLabelStyle}>OUR THANK-YOU GIFT</Text>
            <Text style={codeStyle}>{rewardLabel} VOUCHER</Text>
            <Hr style={divider} />
            <Text style={rewardText}>
              Once your review is posted, we will email you a single-use {rewardLabel} discount code
              for your next order.
            </Text>
          </Section>

          <Text style={note}>
            Your review is completely your own - positive or negative, the voucher is yours either way.
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
  component: ReviewRequestEmail,
  subject: (data: Record<string, any>) =>
    `Rate us on Trustpilot and get a ${data.rewardLabel || '$2'} voucher | ${SITE_NAME}`,
  displayName: 'Trustpilot review request',
  previewData: {
    customerName: 'Aden',
    gameTitle: 'Binance Card (btc) $5',
    reviewLink: 'https://www.trustpilot.com/review/agevers.com',
    rewardLabel: '$2',
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
const ctaSection = { textAlign: 'center' as const, marginBottom: '24px' }
const button = {
  backgroundColor: '#7c3aed', color: '#ffffff', fontWeight: '700' as const,
  fontSize: '15px', padding: '14px 32px', borderRadius: '8px', textDecoration: 'none',
  display: 'inline-block', fontFamily: "'Orbitron', Arial, sans-serif", letterSpacing: '1px',
}
const rewardCard = {
  backgroundColor: '#161622', borderRadius: '8px', padding: '20px',
  marginBottom: '24px', border: '1px solid #2d2d3f', textAlign: 'center' as const,
}
const rewardLabelStyle = {
  color: '#71717a', fontSize: '11px', fontWeight: '600' as const,
  letterSpacing: '1.5px', margin: '0 0 8px',
}
const codeStyle = {
  color: '#a855f7', fontSize: '22px', fontWeight: '800' as const,
  letterSpacing: '2px', margin: '0', fontFamily: "'Orbitron', Arial, sans-serif",
}
const rewardText = { color: '#a1a1aa', fontSize: '13px', lineHeight: '1.5', margin: '0' }
const divider = { borderColor: '#2d2d3f', margin: '12px 0' }
const note = { color: '#71717a', fontSize: '13px', lineHeight: '1.5', margin: '0' }
const footerDivider = { borderColor: '#2d2d3f', margin: '0' }
const footer = {
  color: '#71717a', fontSize: '12px', lineHeight: '1.5',
  padding: '16px 32px 24px', textAlign: 'center' as const,
  backgroundColor: '#161622', borderRadius: '0 0 12px 12px', margin: '0',
}
