import { createComponent, Shade } from '@furystack/shades'
import { Alert, Button, Form, Icon, icons, Input, NotyService, Paper } from '@furystack/shades-common-components'
import type { PublicApiToken } from 'common'

import { TokensApiClient } from '../../services/api-clients/tokens-api-client.js'

type CreateTokenPayload = {
  name: string
}

const isCreateTokenPayload = (data: unknown): data is CreateTokenPayload => {
  const d = data as CreateTokenPayload
  return d.name?.length > 0
}

export const ApiTokensSection = Shade({
  shadowDomName: 'shade-api-tokens-section',
  render: ({ injector, useState }) => {
    const [tokens, setTokens] = useState<PublicApiToken[]>('tokens', [])
    const [isLoaded, setIsLoaded] = useState('isLoaded', false)
    const [createdToken, setCreatedToken] = useState<string | null>('createdToken', null)

    const tokensApi = injector.getInstance(TokensApiClient)
    const notys = injector.getInstance(NotyService)

    if (!isLoaded) {
      tokensApi
        .call({ method: 'GET', action: '/tokens', query: { findOptions: {} } })
        .then(({ result }) => {
          setTokens(result.entries)
          setIsLoaded(true)
        })
        .catch(() => setIsLoaded(true))
    }

    const handleCreateToken = async (payload: CreateTokenPayload) => {
      try {
        const { result } = await tokensApi.call({
          method: 'POST',
          action: '/tokens',
          body: { name: payload.name },
        })
        setCreatedToken(result.plainTextToken)
        setTokens([...tokens, result.token])
        notys.emit('onNotyAdded', {
          title: 'Token created',
          body: "Copy the token now - it won't be shown again.",
          type: 'success',
        })
      } catch {
        notys.emit('onNotyAdded', { title: 'Error', body: 'Failed to create token.', type: 'error' })
      }
    }

    const handleDeleteToken = async (id: string) => {
      await tokensApi.call({ method: 'DELETE', action: '/tokens/:id', url: { id } })
      setTokens(tokens.filter((t) => t.id !== id))
    }

    return (
      <Paper elevation={1}>
        <h3 style={{ margin: '0 0 16px 0' }}>
          <Icon icon={icons.link} size="small" style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          API Tokens
        </h3>
        <p style={{ opacity: '0.7', marginBottom: '16px', fontSize: '14px' }}>
          API tokens allow external tools (e.g. MCP clients) to authenticate with StackCraft.
        </p>

        {createdToken ? (
          <Alert
            severity="success"
            title="New token (copy now)"
            style={{ marginBottom: '16px', fontFamily: 'monospace', fontSize: '13px', wordBreak: 'break-all' }}
          >
            {createdToken}
          </Alert>
        ) : null}

        <Form<CreateTokenPayload>
          validate={isCreateTokenPayload}
          onSubmit={(data) => void handleCreateToken(data)}
          style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}
        >
          <Input variant="outlined" labelTitle="Token name" name="name" style={{ flex: '1' }} required />
          <Button
            variant="contained"
            type="submit"
            style={{ height: '100%', display: 'flex', alignItems: 'center' }}
          >
            Create Token
          </Button>
        </Form>

        {tokens.length === 0 ? (
          <p style={{ opacity: '0.5' }}>No tokens yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  Name
                </th>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  Created
                </th>
                <th style={{ width: '80px', padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }} />
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr>
                  <td style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{token.name}</td>
                  <td
                    style={{
                      padding: '8px',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      fontSize: '13px',
                      opacity: '0.7',
                    }}
                  >
                    {new Date(token.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Button variant="outlined" color="error" onclick={() => void handleDeleteToken(token.id)}>
                      Revoke
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Paper>
    )
  },
})
