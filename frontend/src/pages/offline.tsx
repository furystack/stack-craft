import { createComponent, Shade } from '@furystack/shades'
import { cssVariableTheme } from '@furystack/shades-common-components'
import { StackCraftNestedRouteLink } from '../components/app-routes.js'
import { environmentOptions } from '../environment-options.js'

export const Offline = Shade({
  customElementName: 'shade-offline',
  css: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 100px',
    '& .offline-content': {
      display: 'flex',
      flexDirection: 'column',
      perspective: '400px',
    },
    '& a': {
      color: cssVariableTheme.palette.primary.main,
    },
    '& a:hover': {
      color: cssVariableTheme.palette.primary.light,
    },
  },
  render: () => {
    return (
      <div className="offline-content">
        <h1>WhoOoOops... 😱</h1>
        <h3>The service seems to be offline 😓</h3>
        <p>
          There was a trouble connecting to the backend service at{' '}
          <a href={environmentOptions.serviceUrl} target="_blank">
            {environmentOptions.serviceUrl}
          </a>
          . It seems to be the service is inaccessible at the moment. You can check the following things:
        </p>
        <ul>
          <li>
            The URL above is correct. You can set in in your 'SERVICE_URL' environment variable before building the app.
          </li>
          <li>
            CORS is enabled in the service from <a href={window.location.origin}>{window.location.origin}</a>
          </li>
          <li>You have started the service :)</li>
        </ul>
        <StackCraftNestedRouteLink path="/">Reload page</StackCraftNestedRouteLink>
      </div>
    )
  },
})
