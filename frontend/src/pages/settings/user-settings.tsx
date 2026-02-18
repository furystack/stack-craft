import { createComponent, Shade } from '@furystack/shades'
import { Button, Input, NotyService } from '@furystack/shades-common-components'
import { IdentityApiClient } from '../../services/api-clients/identity-api-client.js'
import { TokensApiClient } from '../../services/api-clients/tokens-api-client.js'
import type { PublicApiToken } from 'common'

export const UserSettings = Shade({
  shadowDomName: 'shade-user-settings',
  render: ({ injector, useState }) => {
    const [tokens, setTokens] = useState<PublicApiToken[]>('tokens', [])
    const [isLoaded, setIsLoaded] = useState('isLoaded', false)
    const [newTokenName, setNewTokenName] = useState('newTokenName', '')
    const [createdToken, setCreatedToken] = useState<string | null>('createdToken', null)

    const tokensApi = injector.getInstance(TokensApiClient)
    const identityApi = injector.getInstance(IdentityApiClient)
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

    const handlePasswordChange = async (ev: SubmitEvent) => {
      ev.preventDefault()
      const form = ev.target as HTMLFormElement
      const data = new FormData(form)
      try {
        await identityApi.call({
          method: 'POST',
          action: '/password-reset',
          body: {
            currentPassword: data.get('currentPassword') as string,
            newPassword: data.get('newPassword') as string,
          },
        })
        notys.emit('onNotyAdded', { title: 'Password changed', body: 'Your password has been updated.', type: 'success' })
        form.reset()
      } catch {
        notys.emit('onNotyAdded', { title: 'Error', body: 'Failed to change password.', type: 'error' })
      }
    }

    const handleCreateToken = async () => {
      if (!newTokenName) return
      try {
        const { result } = await tokensApi.call({
          method: 'POST',
          action: '/tokens',
          body: { name: newTokenName },
        })
        setCreatedToken(result.plainTextToken)
        setTokens([...tokens, result.token])
        setNewTokenName('')
        notys.emit('onNotyAdded', {
          title: 'Token created',
          body: 'Copy the token now - it won\'t be shown again.',
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
      <div style={{ padding: '24px', maxWidth: '700px' }}>
        <h2 style={{ margin: '0 0 24px 0' }}>User Settings</h2>

        <section style={{ marginBottom: '32px' }}>
          <h3 style={{ margin: '0 0 16px 0' }}>Change Password</h3>
          <form
            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            onsubmit={(ev) => void handlePasswordChange(ev)}
          >
            <Input name="currentPassword" labelTitle="Current Password" type="password" variant="outlined" required />
            <Input name="newPassword" labelTitle="New Password" type="password" variant="outlined" required minLength={4} />
            <Button type="submit" variant="contained" style={{ alignSelf: 'flex-start' }}>
              Change Password
            </Button>
          </form>
        </section>

        <section>
          <h3 style={{ margin: '0 0 16px 0' }}>API Tokens</h3>
          <p style={{ opacity: '0.7', marginBottom: '16px', fontSize: '14px' }}>
            API tokens allow external tools (e.g. MCP clients) to authenticate with StackCraft.
          </p>

          {createdToken ? (
            <div
              style={{
                padding: '12px 16px',
                background: '#1a472a',
                border: '1px solid #2ea043',
                borderRadius: '8px',
                marginBottom: '16px',
                fontFamily: 'monospace',
                fontSize: '13px',
                wordBreak: 'break-all',
              }}
            >
              <strong>New token (copy now):</strong>
              <br />
              {createdToken}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <Input
              variant="outlined"
              labelTitle="Token name"
              value={newTokenName}
              oninput={(ev) => setNewTokenName((ev.target as HTMLInputElement).value)}
              style={{ flex: '1' }}
            />
            <Button variant="contained" onclick={() => void handleCreateToken()}>
              Create Token
            </Button>
          </div>

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
                    <td style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '13px', opacity: '0.7' }}>
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
        </section>
      </div>
    )
  },
})
