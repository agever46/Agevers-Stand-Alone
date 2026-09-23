import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Agever's"
const SITE_URL = 'https://agevers.com'

interface LiveChatInviteProps {
  ticketMessage?: string
}

const LiveChatInviteEmail = ({ ticketMessage }: LiveChatInviteProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>An Agever's support agent is ready to chat with you now</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>💬 A support agent wants to chat with you</Heading>
        <Text style={text}>
          Hi! Regarding your recent support ticket, an {SITE_NAME} agent is now
          online and ready to help you in a live chat.
        </Text>
        {ticketMessage && (
          <Section style={infoBox}>
            <Text style={label}>Your Message</Text>
            <Text style={value}>{ticketMessage}</Text>
          </Section>
        )}
        <Text style={text}>
          To join the chat, open our website and click the chat icon at the
          bottom-right of the page.
        </Text>
        <Section style={{ textAlign: 'center', margin: '24px 0' }}>
          <Button href={SITE_URL} style={button}>Open Live Chat</Button>
        </Section>
        <Text style={footer}>— The {SITE_NAME} Support Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: LiveChatInviteEmail,
  subject: "💬 An Agever's agent is ready to chat with you",
  displayName: 'Live chat invite (buyer)',
  previewData: { ticketMessage: 'I have an issue with my order.' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '20px 25px', maxWidth: '520px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#111', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 16px' }
const infoBox = { backgroundColor: '#f8f9fa', borderRadius: '8px', padding: '16px', marginBottom: '20px' }
const label = { fontSize: '11px', color: '#999', textTransform: 'uppercase' as const, margin: '0 0 6px', fontWeight: 'bold' as const }
const value = { fontSize: '14px', color: '#111', margin: '0', whiteSpace: 'pre-line' as const }
const button = { backgroundColor: '#7c3aed', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: 'bold' as const }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }