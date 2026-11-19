
import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

const LOGO_URL = 'https://lqkxxlvhcynxjuydkjha.supabase.co/storage/v1/object/public/email-assets/logo.png'

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your password for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt={siteName} width="160" height="auto" style={logo} />
        <Heading style={h1}>Reset your password</Heading>
        <Text style={text}>
          We received a request to reset your password for {siteName}. Click
          the button below to choose a new password.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Reset Password
        </Button>
        <Text style={footer}>
          If you didn't request a password reset, you can safely ignore this
          email. Your password will not be changed.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#161622', fontFamily: "'Rajdhani', Arial, sans-serif" }
const container = { backgroundColor: '#1e1e2e', padding: '32px 28px', borderRadius: '12px', margin: '40px auto', maxWidth: '480px', border: '1px solid #2a2a3e' }
const logo = { margin: '0 auto 24px', display: 'block' as const, backgroundColor: '#1e1e2e', padding: '12px 16px', borderRadius: '8px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#ededed', margin: '0 0 20px', fontFamily: "'Orbitron', Arial, sans-serif", textAlign: 'center' as const }
const text = { fontSize: '15px', color: '#ffffff', lineHeight: '1.6', margin: '0 0 20px' }
const button = { backgroundColor: '#7c3aed', color: '#ffffff', fontSize: '15px', borderRadius: '8px', padding: '14px 28px', textDecoration: 'none', fontWeight: 'bold' as const, display: 'block' as const, textAlign: 'center' as const }
const footer = { fontSize: '12px', color: '#666666', margin: '28px 0 0', textAlign: 'center' as const }
