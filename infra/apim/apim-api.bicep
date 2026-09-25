@description('API Management service name')
param apimName string

@description('API identifier')
param apiId string

@description('API display name')
param apiName string

@description('API URL path suffix')
param apiPath string

@description('Backend service name (Supabase function name)')
param serviceName string

@description('Path to OpenAPI spec file')
param openApiSpecPath string

@description('Environment name')
param environment string

var backendUrl = '${backendBaseUrl}/${serviceName}'

resource api 'Microsoft.ApiManagement/service/apis@2023-09-01-preview' = {
  parent: apimName
  name: apiId
  properties: {
    displayName: apiName
    description: '${apiName} for Wasel platform'
    protocols: ['https']
    path: apiPath
    serviceUrl: backendUrl
    subscriptionKeyParameterNames: {
      header: 'Ocp-Apim-Subscription-Key'
      query: 'subscription-key'
    }
    subscriptionRequired: true
    apiType: 'http'
  }
}

resource apiVersionSet 'Microsoft.ApiManagement/service/apiVersionSets@2023-09-01-preview' = {
  parent: apimName
  name: '${apiId}-versions'
  properties: {
    displayName: '${apiName} Versions'
    versioningScheme: 'Header'
    versionHeaderName: 'X-Api-Version'
    versionQueryName: 'api-version'
  }
}

resource apiRelease 'Microsoft.ApiManagement/service/apis/releases@2023-09-01-preview' = {
  parent: api
  name: 'v1'
  properties: {
    apiId: api.id
    version: 'v1'
    versionSetId: apiVersionSet.id
    isCurrent: true
    notes: 'Initial release of ${apiName}'
  }
}

resource apiPolicy 'Microsoft.ApiManagement/service/apis/policies@2023-09-01-preview' = {
  parent: api
  name: 'policy'
  properties: {
    format: 'xml'
    policyContent: apiPolicyXml
  }
}

var apiPolicyXml = '''
<policies>
  <inbound>
    <base />
    <!-- Backend URL rewrite -->
    <rewrite-uri template="/${serviceName}" copy-unmatched-params="true" />
    
    <!-- Backend timeout -->
    <set-backend-service base-url="${backendBaseUrl}" />
    <forward-request timeout="30" follow-redirects="true" />
    
    <!-- Request size limit -->
    <set-header name="Content-Length" exists-action="override">
      <value>@(context.Request.Body.As<string>(preserveContent: true).Length.ToString())</value>
    </set-header>
    
    <!-- Validate required headers for mutating operations -->
    <choose>
      <when condition="@(context.Request.Method == "POST" || context.Request.Method == "PUT" || context.Request.Method == "PATCH" || context.Request.Method == "DELETE")">
        <choose>
          <when condition="@(context.Request.Headers.GetValueOrDefault("X-CSRF-Token", "") == "")">
            <return-response>
              <set-status code="403" reason="Forbidden" />
              <set-header name="Content-Type" exists-action="override">
                <value>application/json</value>
              </set-header>
              <set-body>@("{ \"error\": \"Missing CSRF token\" }")</set-body>
            </return-response>
          </when>
        </choose>
      </when>
    </choose>
    
    <!-- Extract user ID from JWT for logging -->
    <set-variable name="user-id" value="@(context.Request.Headers.GetValueOrDefault("Authorization", "").StartsWith("Bearer ") ? JwtParser.Parse(context.Request.Headers.GetValueOrDefault("Authorization", "").Substring(7)).Subject : "")" />
    
    <!-- Add user ID to backend request for audit -->
    <choose>
      <when condition="@(context.Variables.ContainsKey("user-id") && context.Variables["user-id"] != "")">
        <set-header name="X-User-ID" exists-action="override">
          <value>@((string)context.Variables["user-id"])</value>
        </set-header>
      </when>
    </choose>
  </inbound>
  <backend>
    <base />
  </backend>
  <outbound>
    <base />
    <!-- Add API version header -->
    <set-header name="X-Api-Version" exists-action="override">
      <value>v1</value>
    </set-header>
    
    <!-- Cache control for GET endpoints -->
    <choose>
      <when condition="@(context.Request.Method == "GET" && context.Response.StatusCode == 200)">
        <cache-store duration="10" caching-type="prefer-external" vary-by-developer="false" vary-by-developer-groups="false" downstream-caching-type="public" must-revalidate="true">
          <vary-by-query-parameter>date</vary-by-query-parameter>
          <vary-by-query-parameter>seats</vary-by-query-parameter>
          <vary-by-query-parameter>from</vary-by-query-parameter>
          <vary-by-query-parameter>to</vary-by-query-parameter>
        </cache-store>
      </when>
    </choose>
  </outbound>
  <on-error>
    <base />
    <set-header name="Content-Type" exists-action="override">
      <value>application/json</value>
    </set-header>
    <choose>
      <when condition="@(context.Response.StatusCode == 401)">
        <set-body>@("{ \"error\": \"Authentication required\" }")</set-body>
      </when>
      <when condition="@(context.Response.StatusCode == 403)">
        <set-body>@("{ \"error\": \"Insufficient permissions\" }")</set-body>
      </when>
      <when condition="@(context.Response.StatusCode == 404)">
        <set-body>@("{ \"error\": \"Resource not found\" }")</set-body>
      </when>
      <when condition="@(context.Response.StatusCode == 429)">
        <set-header name="Retry-After" exists-action="override">
          <value>@(context.Response.Headers.GetValueOrDefault("Retry-After", "60"))</value>
        </set-header>
        <set-body>@("{ \"error\": \"Rate limit exceeded\", \"retryAfter\": " + context.Response.Headers.GetValueOrDefault("Retry-After", "60") + " }")</set-body>
      </when>
      <when condition="@(context.Response.StatusCode >= 500)">
        <set-body>@("{ \"error\": \"Internal server error\", \"requestId\": \"" + context.Request.Headers.GetValueOrDefault("X-Request-ID", Guid.NewGuid().ToString()) + "\" }")</set-body>
      </when>
    </choose>
  </on-error>
</policies>
'''

resource apiDiagnostics 'Microsoft.ApiManagement/service/apis/diagnostics@2023-09-01-preview' = {
  parent: api
  name: 'applicationinsights'
  properties: {
    loggerId: '/loggers/applicationinsights'
    sampling: 100
    alwaysLogErrors: true
    frontend: {
      request: {
        headers: ['Authorization', 'X-Correlation-ID', 'X-Request-ID', 'X-User-ID', 'X-CSRF-Token']
        body: {
          bytes: 1024
        }
      }
      response: {
        headers: ['X-Api-Version', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
        body: {
          bytes: 1024
        }
      }
    }
    backend: {
      request: {
        headers: ['Authorization', 'X-Correlation-ID', 'X-Request-ID', 'X-User-ID']
        body: {
          bytes: 1024
        }
      }
      response: {
        headers: ['X-Api-Version']
        body: {
          bytes: 1024
        }
      }
    }
  }
}

resource apiProduct 'Microsoft.ApiManagement/service/products@2023-09-01-preview' = {
  parent: apimName
  name: '${apiId}-product'
  properties: {
    displayName: '${apiName} Product'
    description: 'Access to ${apiName} API'
    state: 'published'
    subscriptionRequired: true
    approvalRequired: false
    subscriptionsLimit: 10
  }
}

resource apiProductApi 'Microsoft.ApiManagement/service/products/apis@2023-09-01-preview' = {
  parent: apiProduct
  name: apiId
}

output apiUrl string = '${apimName}.azure-api.net/${apiPath}'