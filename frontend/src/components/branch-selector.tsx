import { createComponent, Shade } from '@furystack/shades'
import { Chip, NotyService, Select, type SelectOption } from '@furystack/shades-common-components'

import { ServicesApiClient } from '../services/api-clients/services-api-client.js'

type BranchSelectorProps = {
  serviceId: string
  currentBranch?: string
  isCloned: boolean
}

const buildOptionGroups = (
  branches: { local: string[]; remote: string[] } | null,
): Array<{ label: string; options: SelectOption[] }> => {
  if (!branches) {
    return [
      { label: 'Local', options: [] },
      { label: 'Remote', options: [] },
    ]
  }

  const localOptions: SelectOption[] = branches.local.map((b) => ({
    value: b,
    label: b,
  }))

  const remoteOptions: SelectOption[] = branches.remote
    .filter((b) => !b.endsWith('/HEAD'))
    .map((b) => ({
      value: b,
      label: b,
    }))

  return [
    { label: 'Local', options: localOptions },
    { label: 'Remote', options: remoteOptions },
  ]
}

export const BranchSelector = Shade<BranchSelectorProps>({
  customElementName: 'shade-branch-selector',
  render: ({ props, injector, useState, useDisposable }) => {
    const { serviceId, currentBranch, isCloned } = props

    const [branches, setBranches] = useState<{ local: string[]; remote: string[] } | null>('branches', null)
    const [isLoading, setIsLoading] = useState('isLoading', false)
    const [isCheckingOut, setIsCheckingOut] = useState('isCheckingOut', false)
    const [selectShown, setSelectShown] = useState('selectShown', true)

    const api = injector.getInstance(ServicesApiClient)
    const noty = injector.getInstance(NotyService)

    const loadBranches = async () => {
      setIsLoading(true)
      try {
        const result = await api.call({
          method: 'GET',
          action: '/services/:id/branches',
          url: { id: serviceId },
        })
        setBranches({ local: result.result.local, remote: result.result.remote })
      } catch {
        noty.emit('onNotyAdded', {
          title: 'Error',
          body: 'Failed to load branches',
          type: 'error',
        })
      } finally {
        setIsLoading(false)
      }
    }

    useDisposable(
      `load-branches-${serviceId}`,
      () => {
        if (isCloned) {
          void loadBranches()
        }
        return { [Symbol.dispose]: () => {} }
      },
      [isCloned],
    )

    if (!isCloned) {
      return (
        <Chip variant="outlined" size="small" color="secondary">
          Not cloned
        </Chip>
      )
    }

    const handleCheckout = async (branch: string) => {
      if (branch === currentBranch) return
      setIsCheckingOut(true)
      try {
        await api.call({
          method: 'POST',
          action: '/services/:id/checkout',
          url: { id: serviceId },
          body: { branch },
        })
        noty.emit('onNotyAdded', {
          title: 'Branch changed',
          body: `Switched to ${branch}`,
          type: 'success',
        })
        void loadBranches()
      } catch (error) {
        noty.emit('onNotyAdded', {
          title: 'Checkout failed',
          body: error instanceof Error ? error.message : 'Failed to checkout branch',
          type: 'error',
        })
        setSelectShown(false)
        queueMicrotask(() => setSelectShown(true))
      } finally {
        setIsCheckingOut(false)
      }
    }

    const optionGroups = buildOptionGroups(branches)

    return (
      <div style={{ display: 'inline-block', minWidth: '200px', maxWidth: 'min(320px, 100vw - 32px)' }}>
        {selectShown ? (
          <Select
            variant="outlined"
            placeholder={isLoading ? 'Loading branches...' : 'Select branch...'}
            value={currentBranch ?? ''}
            optionGroups={optionGroups}
            showSearch
            disabled={isLoading || isCheckingOut}
            onValueChange={(value: string) => {
              void handleCheckout(value)
            }}
          />
        ) : null}
      </div>
    )
  },
})
