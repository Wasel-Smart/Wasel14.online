@description('API Management service name')
param apimName string = 'wasel-apim-${uniqueString(resourceGroup().id)}'

@description('SKU for API Management')
@allowed(['Consumption', 'Developer', 'Basic', 'Standard', 'Premium'])
param skuName string = 'Consumption'

@description('Publisher email for API Management')
param publisherEmail string = 'platform@wasel.jo'

@description('Publisher name for API Management')
param publisherName string = 'Wasel Platform'

@description('Supabase project URL')
param supabaseUrl string = 'https://zexlxabdcsjefptmjhuq.supabase.co'

@description('Allowed origins for CORS')
param allowedOrigins array = [
  'https://wasel14.online'
  'https://www.wasel14.online'
  'https://app.wasel14.online'
]

@description('Environment name')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'prod'

@description('Enable managed identity for API Management')
param enableManagedIdentity bool = true

@description('Custom domain for API Management gateway')
param customDomainName string = 'api.wasel14.online'

@description('Certificate thumbprint for custom domain (Key Vault reference)')
param certificateKeyVaultId string = ''

var apimSku = {
  name: skuName
  capacity: skuName == 'Consumption' ? 0 : 1
}

var backendBaseUrl = '${supabaseUrl}/functions/v1'

resource apimService 'Microsoft.ApiManagement/service@2023-09-01-preview' = {
  name: apimName
  location: resourceGroup().location
  sku: apimSku
  properties: {
    publisherEmail: publisherEmail
    publisherName: publisherName
    enableClientCertificate: false
    minApiVersion: '2023-09-01-preview'
    publicNetworkAccess: 'Enabled'
    disableGateway: false
    disablePortal: true
    disableScm: true
    virtualNetworkType: 'None'
    identity: enableManagedIdentity ? {
      type: 'SystemAssigned'
    } : {}
  }
  tags: {
    Environment: environment
    Project: 'wasel'
    ManagedBy: 'bicep'
  }
}

resource apimLogger 'Microsoft.ApiManagement/service/loggers@2023-09-01-preview' = {
  parent: apimService
  name: 'applicationinsights'
  properties: {
    loggerType: 'applicationInsights'
    credentials: {
      instrumentationKey: ''
    }
    description: 'Application Insights logger for API Management'
    isBuffered: true
  }
}

resource apimNamedValueSupabaseUrl 'Microsoft.ApiManagement/service/namedValues@2023-09-01-preview' = {
  parent: apimService
  name: 'supabase-url'
  properties: {
    displayName: 'Supabase Base URL'
    value: backendBaseUrl
    secret: false
    tags: ['backend', 'supabase']
  }
}

resource apimNamedValueAllowedOrigins 'Microsoft.ApiManagement/service/namedValues@2023-09-01-preview' = {
  parent: apimService
  name: 'allowed-origins'
  properties: {
    displayName: 'Allowed CORS Origins'
    value: json(allowedOrigins)
    secret: false
    tags: ['cors', 'security']
  }
}

resource apimNamedValueSentryDsn 'Microsoft.ApiManagement/service/namedValues@2023-09-01-preview' = {
  parent: apimService
  name: 'sentry-dsn'
  properties: {
    displayName: 'Sentry DSN'
    value: ''
    secret: true
    tags: ['observability', 'sentry']
  }
}

resource apimGlobalPolicy 'Microsoft.ApiManagement/service/policies@2023-09-01-preview' = {
  parent: apimService
  name: 'policy'
  properties: {
    policyContent: ''
    format: 'xml'
  }
}

module globalPolicies 'apim-global-policy.bicep' = {
  name: 'global-policies'
  params: {
    apimName: apimName
    allowedOrigins: allowedOrigins
    backendBaseUrl: backendBaseUrl
    environment: environment
  }
}

module bookingService 'apim-api.bicep' = {
  name: 'booking-service'
  params: {
    apimName: apimName
    apiId: 'booking-service'
    apiName: 'Booking Service'
    apiPath: 'booking'
    serviceName: 'booking-service'
    openApiSpecPath: '../../api-contracts/booking-service.openapi.yaml'
    environment: environment
  }
}

module tripService 'apim-api.bicep' = {
  name: 'trip-service'
  params: {
    apimName: apimName
    apiId: 'trip-service'
    apiName: 'Trip Service'
    apiPath: 'trips'
    serviceName: 'trip-service'
    openApiSpecPath: '../../api-contracts/trip-service.openapi.yaml'
    environment: environment
  }
}

module packageService 'apim-api.bicep' = {
  name: 'package-service'
  params: {
    apimName: apimName
    apiId: 'package-service'
    apiName: 'Package Service'
    apiPath: 'packages'
    serviceName: 'package-service'
    openApiSpecPath: '../../api-contracts/package-service.openapi.yaml'
    environment: environment
  }
}

module walletService 'apim-api.bicep' = {
  name: 'wallet-service'
  params: {
    apimName: apimName
    apiId: 'wallet-service'
    apiName: 'Wallet Service'
    apiPath: 'wallet'
    serviceName: 'wallet-service'
    openApiSpecPath: '../../api-contracts/wallet-service.openapi.yaml'
    environment: environment
  }
}

resource customDomain 'Microsoft.ApiManagement/service/gateways@2023-09-01-preview' existing = {
  name: 'managed'
  scope: apimService
}

output apimGatewayUrl string = apimService.properties.gatewayUrl
output apimPortalUrl string = apimService.properties.portalUrl
output apimManagementApiUrl string = apimService.properties.managementApiUrl
output apimSkuName string = apimSku.name