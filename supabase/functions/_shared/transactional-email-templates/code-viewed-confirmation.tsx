import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'

interface CodeViewedData {
  game_title?: string
  order_id?: string
  viewed_at?: string
  ip_address?: string
  country?: string
  city?: string
}

const CodeViewedConfirmation = (props: CodeViewedData) => {
  const {
    game_title = 'your order',
    order_id = 'N/A',
    viewed_at,
    ip_address = 'Unknown',
    country = 'Unknown',
    city = 'Unknown',
  } = props

  const viewedDate = viewed_at ? new Date(viewed_at).toUTCString() : 'N/A'
  const shortOrderId = order_id.length > 8 ? order_id.slice(0, 8) + '…' : order_id

  return React.createElement('html', null,
    React.createElement('head', null,
      React.createElement('meta', { charSet: 'utf-8' })
    ),
    React.createElement('body', { style: { margin: 0, padding: 0, background: '#0e0e16', fontFamily: "'Segoe UI',Roboto,sans-serif" } },
      React.createElement('table', { width: '100%', cellPadding: 0, cellSpacing: 0, style: { background: '#0e0e16', padding: '40px 0' } },
        React.createElement('tr', null,
          React.createElement('td', { align: 'center' },
            React.createElement('table', { width: 600, cellPadding: 0, cellSpacing: 0, style: { background: '#161622', borderRadius: 12, overflow: 'hidden' } },
              // Header
              React.createElement('tr', null,
                React.createElement('td', { style: { padding: '32px 40px 24px', textAlign: 'center' } },
                  React.createElement('h1', { style: { color: '#7c3aed', fontSize: 22, margin: '0 0 8px' } }, 'Code Viewed Confirmation'),
                  React.createElement('p', { style: { color: '#a0a0b8', fontSize: 14, margin: 0 } }, 'Automated notification from Agevers')
                )
              ),
              // Body
              React.createElement('tr', null,
                React.createElement('td', { style: { padding: '0 40px 32px' } },
                  React.createElement('div', { style: { background: '#1e1e2e', borderRadius: 8, padding: 24, marginBottom: 20 } },
                    React.createElement('p', { style: { color: '#e0e0e8', fontSize: 15, margin: '0 0 16px' } },
                      'Your game code for ',
                      React.createElement('strong', { style: { color: '#fff' } }, game_title),
                      ' was successfully viewed on our platform.'
                    ),
                    React.createElement('table', { width: '100%', style: { fontSize: 13, color: '#a0a0b8' } },
                      React.createElement('tbody', null,
                        React.createElement('tr', null,
                          React.createElement('td', { style: { padding: '6px 0', borderBottom: '1px solid #2a2a3e' } }, 'Order ID'),
                          React.createElement('td', { style: { padding: '6px 0', borderBottom: '1px solid #2a2a3e', textAlign: 'right', color: '#fff' } }, shortOrderId)
                        ),
                        React.createElement('tr', null,
                          React.createElement('td', { style: { padding: '6px 0', borderBottom: '1px solid #2a2a3e' } }, 'Viewed At'),
                          React.createElement('td', { style: { padding: '6px 0', borderBottom: '1px solid #2a2a3e', textAlign: 'right', color: '#fff' } }, viewedDate)
                        ),
                        React.createElement('tr', null,
                          React.createElement('td', { style: { padding: '6px 0', borderBottom: '1px solid #2a2a3e' } }, 'IP Address'),
                          React.createElement('td', { style: { padding: '6px 0', borderBottom: '1px solid #2a2a3e', textAlign: 'right', color: '#fff' } }, ip_address)
                        ),
                        React.createElement('tr', null,
                          React.createElement('td', { style: { padding: '6px 0' } }, 'Location'),
                          React.createElement('td', { style: { padding: '6px 0', textAlign: 'right', color: '#fff' } }, `${city}, ${country}`)
                        )
                      )
                    )
                  ),
                  React.createElement('p', { style: { color: '#a0a0b8', fontSize: 13, margin: 0 } },
                    'If you did not view this code, please contact our support team immediately at ',
                    React.createElement('a', { href: 'https://agevers.com/help-center', style: { color: '#7c3aed' } }, 'agevers.com/help-center'),
                    '.'
                  )
                )
              ),
              // Footer
              React.createElement('tr', null,
                React.createElement('td', { style: { padding: '24px 40px', background: '#12121c', textAlign: 'center' } },
                  React.createElement('p', { style: { color: '#666', fontSize: 11, margin: 0 } },
                    `© ${new Date().getFullYear()} Agevers. This email serves as proof of delivery.`
                  )
                )
              )
            )
          )
        )
      )
    )
  )
}

export const template: TemplateEntry = {
  component: CodeViewedConfirmation,
  subject: (data) => `Your game code for "${data.game_title || 'your order'}" was viewed`,
  displayName: 'Code Viewed Confirmation',
  previewData: {
    game_title: 'Elden Ring',
    order_id: 'abc12345-def6-7890',
    viewed_at: new Date().toISOString(),
    ip_address: '203.0.113.42',
    country: 'IL',
    city: 'Tel Aviv',
  },
}
