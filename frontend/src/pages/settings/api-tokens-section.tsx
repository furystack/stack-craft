import type { FindOptions } from '@furystack/core'
import { useCollectionSync } from '@furystack/entity-sync-client'
import { createComponent, Shade } from '@furystack/shades'
import type { ColumnFilterConfig } from '@furystack/shades-common-components'
import {
  Alert,
  Button,
  CollectionService,
  DataGrid,
  Form,
  Icon,
  icons,
  Input,
  Loader,
  NotyService,
  Paper,
} from '@furystack/shades-common-components'
import { PublicApiToken } from 'common'

import { TokensApiClient } from '../../services/api-clients/tokens-api-client.js'
import { SessionService } from '../../services/session.js'

type CreateTokenPayload = {
  name: string
}

export const isCreateTokenPayload = (data: unknown): data is CreateTokenPayload => {
  const d = data as CreateTokenPayload
  return d.name?.length > 0
}

type TokenColumn = 'name' | 'createdAt' | 'actions'

const tokenColumnFilters: { [K in TokenColumn]?: ColumnFilterConfig } = {
  name: { type: 'string' },
  createdAt: { type: 'date' },
}

export const ApiTokensSection = Shade({
  customElementName: 'shade-api-tokens-section',
  render: (options) => {
    const { injector, useState, useObservable, useDisposable } = options

    const sessionService = injector.getInstance(SessionService)
    const [currentUser] = useObservable('currentUser', sessionService.currentUser)
    const [createdToken, setCreatedToken] = useState<string | null>('createdToken', null)

    const tokensApi = injector.getInstance(TokensApiClient)
    const notys = injector.getInstance(NotyService)

    const collectionService = useDisposable(
      'collectionService',
      () => new CollectionService<PublicApiToken>({ searchField: 'name' }),
    )

    const [findOptions, setFindOptions] = useState<FindOptions<PublicApiToken, Array<keyof PublicApiToken>>>(
      'findOptionsObservable',
      { top: 25 },
    )

    const tokensState = useCollectionSync(options, PublicApiToken, {
      filter: currentUser ? { username: { $eq: currentUser.username }, ...findOptions.filter } : findOptions.filter,
      top: findOptions.top,
      skip: findOptions.skip,
      order: findOptions.order,
    })

    const [revokingTokenId, setRevokingTokenId] = useState<string | null>('revokingTokenId', null)

    const handleCreateToken = async (payload: CreateTokenPayload) => {
      try {
        const { result } = await tokensApi.call({
          method: 'POST',
          action: '/tokens',
          body: { name: payload.name },
        })
        setCreatedToken(result.plainTextToken)
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
      setRevokingTokenId(id)
      try {
        await tokensApi.call({ method: 'DELETE', action: '/tokens/:id', url: { id } })
      } catch {
        notys.emit('onNotyAdded', { title: 'Error', body: 'Failed to revoke token.', type: 'error' })
      } finally {
        setRevokingTokenId(null)
      }
    }

    const isLoading = tokensState.status === 'connecting'
    const entries = tokensState.status === 'synced' || tokensState.status === 'cached' ? tokensState.data.entries : []
    const count = tokensState.status === 'synced' || tokensState.status === 'cached' ? tokensState.data.count : 0

    collectionService.data.setValue({ entries, count })

    return (
      <Paper elevation={1}>
        <h3 style={{ margin: '0 0 16px 0' }}>
          <Icon icon={icons.link} size="small" style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          API Tokens
        </h3>
        <p style={{ opacity: '0.7', marginBottom: '16px', fontSize: '14px' }}>
          API tokens allow external tools (e.g. MCP clients) to authenticate with StackCraft.
        </p>

        {tokensState.status === 'error' ? (
          <Alert severity="error" title="Error loading tokens" style={{ marginBottom: '16px' }}>
            {tokensState.error}
          </Alert>
        ) : null}

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
          onSubmit={handleCreateToken}
          disableOnSubmit
          style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}
        >
          <Input variant="outlined" labelTitle="Token name" name="name" style={{ flex: '1' }} required />
          <Button
            variant="contained"
            type="submit"
            startIcon={<Icon icon={icons.plus} size="small" />}
            style={{ height: '100%', display: 'flex', alignItems: 'center' }}
          >
            Create Token
          </Button>
        </Form>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
            <Loader />
          </div>
        ) : entries.length === 0 ? (
          <p style={{ opacity: '0.5' }}>No tokens yet.</p>
        ) : (
          <DataGrid<PublicApiToken, TokenColumn>
            columns={['name', 'createdAt', 'actions']}
            findOptions={findOptions}
            onFindOptionsChange={setFindOptions}
            styles={undefined}
            collectionService={collectionService}
            columnFilters={tokenColumnFilters}
            headerComponents={{
              actions: () => <span />,
            }}
            rowComponents={{
              createdAt: (entry) => (
                <span style={{ fontSize: '13px', opacity: '0.7' }}>
                  {new Date(entry.createdAt).toLocaleDateString()}
                </span>
              ),
              actions: (entry) => (
                <Button
                  variant="outlined"
                  size="small"
                  color="error"
                  loading={revokingTokenId === entry.id}
                  onclick={() => void handleDeleteToken(entry.id)}
                  startIcon={<Icon icon={icons.trash} size="small" />}
                >
                  Revoke
                </Button>
              ),
            }}
          />
        )}
      </Paper>
    )
  },
})
