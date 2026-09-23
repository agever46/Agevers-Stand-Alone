import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Agever's"

interface AdminNewSignupProps {
  userId?: string
  email?: string
  username?: string
  displayName?: string
  signupMethod?: string
  ipAddress?: string
  country?: string
  city?: string
  userAgent?: string
  fraudScore?: number | null
  fraudRiskLevel?: string
  fraudNotes?: string
  signedUpAt?: string
}

const riskColor = (level?: string) => {
  switch ((level || '').toLowerCase()) {
    case 'high': return '#ef4444'
    case 'medium': return '#facc15'
    case 'low': return '#4ade80'
    default: return '#a1a1aa'
  }
}

const AdminNewSignupEmail = ({
  userId = '---',
  email = 'unknown',
  username = '—',
  displayName = '—',
  signupMethod = 'email',
  ipAddress = '—',
  country = '—',
  city = '—',
  userAgent = '—',
  fraudScore = null,
  fraudRiskLevel = 'unknown',
  fraudNotes = '',
  signedUpAt = new Date().toISOString(),
}: AdminNewSignupProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New signup: {email}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={logo}>{SITE_NAME} — Admin</Heading>
        </Section>

        <Section style={contentSection}>
          <Heading style={h1}>👤 New Account Registered</Heading>

          <Section style={card}>
            <Text style={label}>EMAIL</Text>
            <Text style={value}>{email}</Text>
            <Hr style={divider} />
            <Text style={label}>USERNAME / DISPLAY NAME</Text>
            <Text style={value}>{username}</Text>
            <Text style={detail}>{displayName}</Text>
            <Hr style={divider} />
            <Text style={label}>USER ID</Text>
            <Text style={mono}>{userId}</Text>
            <Hr style={divider} />
            <Text style={label}>SIGNUP METHOD</Text>
            <Text style={value}>{signupMethod.toUpperCase()}</Text>
            <Hr style={divider} />
            <Text style={label}>SIGNED UP AT</Text>
            <Text style={value}>{new Date(signedUpAt).toUTCString()}</Text>
          </Section>

          <Section style={card}>
            <Text style={sectionTitle}>📍 Location & Device</Text>
            <Text style={label}>IP ADDRESS</Text>
            <Text style={mono}>{ipAddress}</Text>
            <Hr style={divider} />
            <Text style={label}>LOCATION</Text>
            <Text style={value}>{city}, {country}</Text>
            <Hr style={divider} />
            <Text style={label}>USER AGENT</Text>
            <Text style={detailSmall}>{userAgent}</Text>
          </Section>

          <Section style={card}>
            <Text style={sectionTitle}>🛡️ Fraud Score</Text>
            <Text style={label}>RISK LEVEL</Text>
            <Text style={{ ...value, color: riskColor(fraudRiskLevel), fontWeight: 800 }}>
              {fraudRiskLevel.toUpperCase()}
            </Text>
            <Hr style={divider} />
            <Text style={label}>SCORE</Text>
            <Text style={value}>{fraudScore !== null ? `${fraudScore}/100` : 'Not calculated'}</Text>
            {fraudNotes && (
              <>
                <Hr style={divider} />
                <Text style={label}>NOTES</Text>
                <Text style={detailSmall}>{fraudNotes}</Text>
              </>
            )}
          </Section>
        </Section>

        <Hr style={footerDivider} />
        <Text style={footer}>Automated admin notification from {SITE_NAME}.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AdminNewSignupEmail,
  subject: (data: Record<string, any>) =>
    `New Signup: ${data.email || 'unknown'} (${(data.fraudRiskLevel || 'unknown').toUpperCase()}) | ${SITE_NAME}`,
  displayName: 'Admin new signup notification',
  previewData: {
    userId: '00000000-0000-0000-0000-000000000000',
    email: 'newuser@example.com',
    username: 'ShadowWolf_1234',
    displayName: 'New User',
    signupMethod: 'email',
    ipAddress: '203.0.113.42',
    country: 'US',
    city: 'New York',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    fraudScore: 25,
    fraudRiskLevel: 'low',
    fraudNotes: 'No suspicious flags detected',
    signedUpAt: new Date().toISOString(),
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Rajdhani', Arial, sans-serif" }
const container = { maxWidth: '560px', margin: '0 auto', padding: '0' }
const headerSection = { backgroundColor: '#161622', padding: '24px 32px', textAlign: 'center' as const, borderRadius: '12px 12px 0 0' }
const logo = { color: '#a855f7', fontSize: '22px', fontWeight: '800' as const, fontFamily: "'Orbitron', Arial, sans-serif", letterSpacing: '2px', margin: '0' }
const contentSection = { backgroundColor: '#1e1e2e', padding: '32px' }
const h1 = { color: '#ededed', fontSize: '22px', fontWeight: '700' as const, margin: '0 0 20px', fontFamily: "'Orbitron', Arial, sans-serif" }
const card = { backgroundColor: '#161622', borderRadius: '8px', padding: '20px', border: '1px solid #2d2d3f', marginBottom: '16px' }
const sectionTitle = { color: '#a855f7', fontSize: '14px', fontWeight: '700' as const, margin: '0 0 12px', letterSpacing: '1px' }
const label = { color: '#71717a', fontSize: '11px', fontWeight: '600' as const, letterSpacing: '1.5px', textTransform: 'uppercase' as const, margin: '0 0 4px' }
const value = { color: '#ededed', fontSize: '15px', fontWeight: '600' as const, margin: '0 0 4px' }
const mono = { color: '#ededed', fontSize: '13px', fontFamily: 'monospace', margin: '0 0 4px', wordBreak: 'break-all' as const }
const detail = { color: '#a1a1aa', fontSize: '13px', margin: '0' }
const detailSmall = { color: '#a1a1aa', fontSize: '12px', margin: '0', wordBreak: 'break-all' as const }
const divider = { borderColor: '#2d2d3f', margin: '12px 0' }
const footerDivider = { borderColor: '#2d2d3f', margin: '0' }
const footer = { backgroundColor: '#161622', color: '#52525b', fontSize: '11px', textAlign: 'center' as const, padding: '20px 32px', lineHeight: '1.5', borderRadius: '0 0 12px 12px' }
