import { createComponent, Shade } from '@furystack/shades'
import { Button, cssVariableTheme, Icon, icons, NotyService } from '@furystack/shades-common-components'

import { stackCraftNavigate, StackCraftNestedRouteLink } from '../../../components/app-routes.js'
import { ServicesApiClient } from '../../../services/api-clients/services-api-client.js'

type SetupStepProps = {
  stackName: string
  serviceId: string
  serviceName: string
}

export const SetupStep = Shade<SetupStepProps>({
  customElementName: 'shade-create-service-setup-step',
  render: ({ props, injector, useState }) => {
    const [setupStatus, setSetupStatus] = useState<'idle' | 'running' | 'done' | 'failed'>('setupStatus', 'idle')

    const servicesApi = injector.get(ServicesApiClient)
    const noty = injector.get(NotyService)

    const handleSetupNow = async () => {
      setSetupStatus('running')
      try {
        await servicesApi.call({
          method: 'POST',
          action: '/services/:id/setup',
          url: { id: props.serviceId },
        })
        setSetupStatus('done')
        noty.emit('onNotyAdded', {
          title: 'Setup complete',
          body: `"${props.serviceName}" has been set up successfully.`,
          type: 'success',
        })
      } catch (error) {
        setSetupStatus('failed')
        noty.emit('onNotyAdded', {
          title: 'Setup failed',
          body: error instanceof Error ? error.message : 'Setup error',
          type: 'error',
        })
      }
    }

    return (
      <div>
        <h2 style={{ margin: '0 0 4px 0' }}>Set Up Service</h2>
        <p style={{ margin: '0 0 20px 0', opacity: '0.7', fontSize: '14px' }}>
          Step 2 of 2: Clone the repository, install packages, and build "{props.serviceName}".
        </p>

        {setupStatus === 'idle' ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ margin: '0 0 16px 0' }}>
              This will clone the repository, install packages, and build the service.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Button
                variant="contained"
                onclick={() => void handleSetupNow()}
                startIcon={<Icon icon={icons.settings} size="small" />}
              >
                Set Up Now
              </Button>
              <Button
                variant="outlined"
                onclick={() =>
                  stackCraftNavigate(injector, { path: '/stacks/:stackName', params: { stackName: props.stackName } })
                }
                endIcon={<Icon icon={icons.chevronRight} size="small" />}
              >
                Skip
              </Button>
            </div>
          </div>
        ) : null}

        {setupStatus === 'running' ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ margin: '0 0 8px 0' }}>Setting up service...</p>
            <p style={{ margin: '0', fontSize: '13px', opacity: '0.6' }}>
              This may take a few minutes. You can view progress in the service logs.
            </p>
          </div>
        ) : null}

        {setupStatus === 'done' ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ margin: '0 0 16px 0', color: cssVariableTheme.palette.success.main }}>
              Service set up successfully!
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Button
                variant="contained"
                color="success"
                onclick={() =>
                  stackCraftNavigate(injector, { path: '/stacks/:stackName', params: { stackName: props.stackName } })
                }
                startIcon={<Icon icon={icons.home} size="small" />}
              >
                Go to Dashboard
              </Button>
              <StackCraftNestedRouteLink
                path="/stacks/:stackName/services/:serviceId"
                params={{ stackName: props.stackName, serviceId: props.serviceId }}
              >
                <Button variant="outlined" startIcon={<Icon icon={icons.eye} size="small" />}>
                  View Service
                </Button>
              </StackCraftNestedRouteLink>
            </div>
          </div>
        ) : null}

        {setupStatus === 'failed' ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ margin: '0 0 16px 0', color: cssVariableTheme.palette.error.main }}>Setup failed.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Button
                variant="outlined"
                onclick={() => setSetupStatus('idle')}
                startIcon={<Icon icon={icons.refresh} size="small" />}
              >
                Retry
              </Button>
              <StackCraftNestedRouteLink
                path="/stacks/:stackName/services/:serviceId"
                params={{ stackName: props.stackName, serviceId: props.serviceId }}
                hash="logs"
              >
                <Button variant="outlined" startIcon={<Icon icon={icons.fileText} size="small" />}>
                  View Logs
                </Button>
              </StackCraftNestedRouteLink>
              <Button
                variant="outlined"
                onclick={() =>
                  stackCraftNavigate(injector, { path: '/stacks/:stackName', params: { stackName: props.stackName } })
                }
                startIcon={<Icon icon={icons.home} size="small" />}
              >
                Go to Dashboard
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    )
  },
})
