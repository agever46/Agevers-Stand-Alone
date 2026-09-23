import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Agever's"

interface LiveSupportRequestProps {
  userEmail?: string
  userId?: string
}

const LiveSupportRequestEmail = ({
  userEmail = 'unknown',
  userId = '---',
}: LiveSupportRequestProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>🔴 Live support request from {userEmail}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>🔴 Live Support Request</Heading>
        <Text style={text}>
          A customer is requesting live human support on the website.
        </Text>
        <Section style={infoBox}>
          <Text style={label}>Customer Email</Text>
          <Text style={value}>{userEmail}</Text>
          <Text style={label}>User ID</Text>
          <Text style={value}>{userId}</Text>
          <Text style={label}>Time</Text>
          <Text style={value}>{new Date().toLocaleString('en-GB', { timeZone: 'Asia/Jerusalem' })}</Text>
        </Section>
        <Text style={text}>
          Please log into the admin panel to respond to this request.
        </Text>
        <Text style={footer}>— {SITE_NAME} System</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: LiveSupportRequestEmail,
  subject: '🔴 Live Support Request',
  displayName: 'Live support request (admin)',
  previewData: { userEmail: 'customer@example.com', userId: 'abc-123' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '20px 25px', maxWidth: '520px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#dc2626', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 16px' }
const infoBox = { backgroundColor: '#f8f9fa', borderRadius: '8px', padding: '16px', marginBottom: '20px' }
const label = { fontSize: '11px', color: '#999', textTransform: 'uppercase' as const, margin: '0 0 2px', fontWeight: 'bold' as const }
const value = { fontSize: '14px', color: '#111', margin: '0 0 12px' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
