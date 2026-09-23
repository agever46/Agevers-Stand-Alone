import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Agever's"

interface ContactFormMessageProps {
  name?: string
  email?: string
  message?: string
}

const ContactFormMessageEmail = ({
  name = 'unknown',
  email = 'unknown',
  message = '',
}: ContactFormMessageProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>📩 New contact form message from {name}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>📩 New Contact Form Message</Heading>
        <Text style={text}>
          Someone submitted the Contact Us form on the website.
        </Text>
        <Section style={infoBox}>
          <Text style={label}>Name</Text>
          <Text style={value}>{name}</Text>
          <Text style={label}>Email</Text>
          <Text style={value}>{email}</Text>
          <Text style={label}>Message</Text>
          <Text style={{ ...value, whiteSpace: 'pre-line' as const }}>{message}</Text>
          <Text style={label}>Time</Text>
          <Text style={value}>{new Date().toLocaleString('en-GB', { timeZone: 'Asia/Jerusalem' })}</Text>
        </Section>
        <Text style={footer}>— {SITE_NAME} System</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ContactFormMessageEmail,
  subject: '📩 New Contact Form Message',
  displayName: 'Contact form message (admin)',
  previewData: { name: 'Jane Doe', email: 'jane@example.com', message: 'I have a question about my order.' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '20px 25px', maxWidth: '520px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#111', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 16px' }
const infoBox = { backgroundColor: '#f8f9fa', borderRadius: '8px', padding: '16px', marginBottom: '20px' }
const label = { fontSize: '11px', color: '#999', textTransform: 'uppercase' as const, margin: '0 0 2px', fontWeight: 'bold' as const }
const value = { fontSize: '14px', color: '#111', margin: '0 0 12px' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
