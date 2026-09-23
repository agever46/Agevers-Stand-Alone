import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text, Section, Hr, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Agever's"
const SITE_URL = 'https://agevers.com'
const SUPPORT_EMAIL = 'support@agevers.com'

interface Props {
  customerName?: string
}

const PasswordResetFixedEmail = ({ customerName }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your password reset issue has been fixed</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={logo}>{SITE_NAME}</Heading>
        </Section>

        <Section style={contentSection}>
          <Heading style={h1}>✅ Password Reset Is Now Working</Heading>
          <Text style={text}>
            {customerName ? `Hi ${customerName},` : 'Hi there,'}
          </Text>
          <Text style={text}>
            Thank you for letting us know about the issue you experienced when trying to
            reset your password. We investigated it right away and the problem has now
            been fixed.
          </Text>
          <Text style={text}>
            You can now request a new password reset link and set a new password directly
            from the reset page — the form will appear as expected after clicking the link
            in your email.
          </Text>

          <Section style={btnRow}>
            <Button href={`${SITE_URL}/auth`} style={btnPrimary}>
              Reset Your Password
            </Button>
          </Section>

          <Text style={text}>
            We really appreciate you taking the time to report this — it helped us improve
            the experience for everyone. If you run into any other issues, just reply to
            this email and we'll be happy to help.
          </Text>

          <Text style={footerText}>
            Need help? Contact us at{' '}
            <Link href={`mailto:${SUPPORT_EMAIL}`} style={link}>{SUPPORT_EMAIL}</Link>.
          </Text>
        </Section>

        <Hr style={footerDivider} />
        <Text style={footer}>
          Sent by the {SITE_NAME} team.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PasswordResetFixedEmail,
  subject: "Your password reset issue is fixed — Agever's",
  displayName: 'Password reset fix notice',
  previewData: { customerName: 'Alex' },
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
const text = { color: '#a1a1aa', fontSize: '15px', lineHeight: '1.6', margin: '0 0 16px' }
const btnRow = { textAlign: 'center' as const, margin: '24px 0 12px' }
const btnPrimary = {
  backgroundColor: '#a855f7', color: '#ffffff', padding: '12px 22px',
  borderRadius: '8px', fontSize: '14px', fontWeight: '700' as const,
  textDecoration: 'none', display: 'inline-block', margin: '0 6px 8px',
  letterSpacing: '1px', textTransform: 'uppercase' as const,
}
const footerText = {
  color: '#a1a1aa', fontSize: '13px', lineHeight: '1.5', textAlign: 'center' as const,
  margin: '8px 0 0',
}
const link = { color: '#a855f7', textDecoration: 'underline' }
const footerDivider = { borderColor: '#2d2d3f', margin: '0' }
const footer = {
  backgroundColor: '#161622', color: '#52525b', fontSize: '11px',
  textAlign: 'center' as const, padding: '20px 32px', lineHeight: '1.5',
  borderRadius: '0 0 12px 12px',
}