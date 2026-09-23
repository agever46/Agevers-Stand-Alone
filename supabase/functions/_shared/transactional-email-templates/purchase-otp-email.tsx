import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Agever's"

interface Props {
  code?: string
}

const PurchaseOtpEmail = ({ code = '000000' }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code to reveal your purchase</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={logo}>{SITE_NAME}</Heading>
        </Section>
        <Section style={contentSection}>
          <Heading style={h1}>Your verification code</Heading>
          <Text style={text}>
            Use the code below to verify your identity and reveal your purchased code.
            It expires in 10 minutes.
          </Text>
          <Section style={codeBox}>
            <Text style={codeText}>{code}</Text>
          </Section>
          <Text style={securityNote}>
            🔒 Never share this code with anyone. {SITE_NAME} staff will never ask for it.
            If you didn't request it, you can safely ignore this email.
          </Text>
        </Section>
        <Hr style={footerDivider} />
        <Text style={footer}>© {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PurchaseOtpEmail,
  subject: 'Your verification code',
  displayName: 'Purchase verification code (email fallback)',
  previewData: { code: '123456' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { margin: '0 auto', padding: '20px 0 40px', maxWidth: '560px' }
const headerSection = { padding: '16px 24px', textAlign: 'center' as const }
const logo = { fontSize: '22px', fontWeight: 'bold', color: '#7c3aed', margin: '0' }
const contentSection = { padding: '8px 24px' }
const h1 = { fontSize: '20px', color: '#111827', margin: '12px 0' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '22px' }
const codeBox = {
  backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '10px',
  padding: '18px', textAlign: 'center' as const, margin: '20px 0',
}
const codeText = { fontSize: '34px', letterSpacing: '10px', fontWeight: 'bold', color: '#5b21b6', margin: '0' }
const securityNote = { fontSize: '12px', color: '#6b7280', lineHeight: '18px' }
const footerDivider = { borderColor: '#e5e7eb', margin: '24px 0 12px' }
const footer = { fontSize: '11px', color: '#9ca3af', textAlign: 'center' as const }
