import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Agever's"

interface SearchItem {
  query: string
  count: number
  zeroResults?: number
}

interface AdminSearchSummaryProps {
  date?: string
  totalSearches?: number
  uniqueQueries?: number
  zeroResultSearches?: number
  topQueries?: SearchItem[]
  topZeroResultQueries?: SearchItem[]
}

const AdminSearchSummaryEmail = ({
  date = new Date().toISOString().split('T')[0],
  totalSearches = 0,
  uniqueQueries = 0,
  zeroResultSearches = 0,
  topQueries = [],
  topZeroResultQueries = [],
}: AdminSearchSummaryProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Daily search summary — ${totalSearches} searches on ${date}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={logo}>{SITE_NAME} — Admin</Heading>
        </Section>

        <Section style={contentSection}>
          <Heading style={h1}>🔍 Daily Search Summary</Heading>
          <Text style={subtitle}>{date}</Text>

          <Section style={statsRow}>
            <Section style={statCard}>
              <Text style={statValue}>{totalSearches}</Text>
              <Text style={statLabel}>TOTAL SEARCHES</Text>
            </Section>
            <Section style={statCard}>
              <Text style={statValue}>{uniqueQueries}</Text>
              <Text style={statLabel}>UNIQUE QUERIES</Text>
            </Section>
            <Section style={statCard}>
              <Text style={{ ...statValue, color: '#facc15' }}>{zeroResultSearches}</Text>
              <Text style={statLabel}>ZERO RESULTS</Text>
            </Section>
          </Section>

          <Section style={card}>
            <Text style={sectionTitle}>🔥 Top Search Queries</Text>
            {topQueries.length === 0 ? (
              <Text style={emptyText}>No searches recorded.</Text>
            ) : (
              topQueries.map((q, i) => (
                <Section key={i} style={queryRow}>
                  <Text style={queryRank}>#{i + 1}</Text>
                  <Text style={queryText}>{q.query}</Text>
                  <Text style={queryCount}>{q.count} {q.count === 1 ? 'search' : 'searches'}</Text>
                  {i < topQueries.length - 1 && <Hr style={divider} />}
                </Section>
              ))
            )}
          </Section>

          {topZeroResultQueries.length > 0 && (
            <Section style={card}>
              <Text style={sectionTitle}>⚠️ Top Zero-Result Queries</Text>
              <Text style={hintText}>These searches returned no products — consider adding them to the catalog.</Text>
              {topZeroResultQueries.map((q, i) => (
                <Section key={i} style={queryRow}>
                  <Text style={queryRank}>#{i + 1}</Text>
                  <Text style={queryText}>{q.query}</Text>
                  <Text style={{ ...queryCount, color: '#facc15' }}>{q.count} {q.count === 1 ? 'attempt' : 'attempts'}</Text>
                  {i < topZeroResultQueries.length - 1 && <Hr style={divider} />}
                </Section>
              ))}
            </Section>
          )}
        </Section>

        <Hr style={footerDivider} />
        <Text style={footer}>Automated daily summary from {SITE_NAME}. Admin searches are excluded.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AdminSearchSummaryEmail,
  subject: (data: Record<string, any>) =>
    `Daily Search Summary — ${data.totalSearches || 0} searches | ${SITE_NAME}`,
  displayName: 'Admin daily search summary',
  previewData: {
    date: new Date().toISOString().split('T')[0],
    totalSearches: 142,
    uniqueQueries: 87,
    zeroResultSearches: 12,
    topQueries: [
      { query: 'elden ring', count: 18 },
      { query: 'gta 6', count: 14 },
      { query: 'cyberpunk', count: 9 },
    ],
    topZeroResultQueries: [
      { query: 'mario kart 9', count: 5 },
      { query: 'half life 3', count: 3 },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Rajdhani', Arial, sans-serif" }
const container = { maxWidth: '600px', margin: '0 auto', padding: '0' }
const headerSection = { backgroundColor: '#161622', padding: '24px 32px', textAlign: 'center' as const, borderRadius: '12px 12px 0 0' }
const logo = { color: '#a855f7', fontSize: '22px', fontWeight: '800' as const, fontFamily: "'Orbitron', Arial, sans-serif", letterSpacing: '2px', margin: '0' }
const contentSection = { backgroundColor: '#1e1e2e', padding: '32px' }
const h1 = { color: '#ededed', fontSize: '22px', fontWeight: '700' as const, margin: '0 0 4px', fontFamily: "'Orbitron', Arial, sans-serif" }
const subtitle = { color: '#a1a1aa', fontSize: '14px', margin: '0 0 24px' }
const statsRow = { display: 'block', marginBottom: '20px' }
const statCard = { backgroundColor: '#161622', borderRadius: '8px', padding: '16px', border: '1px solid #2d2d3f', marginBottom: '8px', textAlign: 'center' as const }
const statValue = { color: '#a855f7', fontSize: '28px', fontWeight: '800' as const, margin: '0', fontFamily: "'Orbitron', Arial, sans-serif" }
const statLabel = { color: '#71717a', fontSize: '11px', fontWeight: '600' as const, letterSpacing: '1.5px', margin: '4px 0 0' }
const card = { backgroundColor: '#161622', borderRadius: '8px', padding: '20px', border: '1px solid #2d2d3f', marginBottom: '16px' }
const sectionTitle = { color: '#a855f7', fontSize: '14px', fontWeight: '700' as const, margin: '0 0 12px', letterSpacing: '1px' }
const hintText = { color: '#a1a1aa', fontSize: '12px', margin: '0 0 12px', fontStyle: 'italic' as const }
const emptyText = { color: '#71717a', fontSize: '13px', margin: '0', fontStyle: 'italic' as const }
const queryRow = { margin: '0' }
const queryRank = { color: '#a855f7', fontSize: '12px', fontWeight: '700' as const, margin: '8px 0 0', display: 'inline' as const }
const queryText = { color: '#ededed', fontSize: '14px', fontWeight: '600' as const, margin: '4px 0' }
const queryCount = { color: '#a1a1aa', fontSize: '12px', margin: '0 0 8px' }
const divider = { borderColor: '#2d2d3f', margin: '8px 0' }
const footerDivider = { borderColor: '#2d2d3f', margin: '0' }
const footer = { backgroundColor: '#161622', color: '#52525b', fontSize: '11px', textAlign: 'center' as const, padding: '20px 32px', lineHeight: '1.5', borderRadius: '0 0 12px 12px' }
