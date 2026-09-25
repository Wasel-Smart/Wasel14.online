@description('API Management service name')
param apimName string

@description('Allowed origins for CORS')
param allowedOrigins array

@description('Backend base URL')
param backendBaseUrl string

@description('Environment name')
param environment string

var corsOrigins = join(',', allowedOrigins)

resource globalPolicy 'Microsoft.ApiManagement/service/policies@2023-09-01-preview' = {
  parent: apimName
  name: 'policy'
  properties: {
    format: 'xml'
    policyContent: ''
  }
}

var globalPolicyXml = '''
<policies>
  <inbound>
    <base />
    <!-- Add correlation ID for tracing -->
    <set-header name="X-Correlation-ID" exists-action="override">
      <value>@(context.Request.Headers.GetValueOrDefault("X-Correlation-ID", "") ?? Guid.NewGuid().ToString())</value>
    </set-header>
    <set-header name="X-Request-ID" exists-action="override">
      <value>@(context.Request.Headers.GetValueOrDefault("X-Request-ID", "") ?? Guid.NewGuid().ToString())</value>
    </set-header>
    
    <!-- Rate limiting by subscription key (APIM subscription) -->
    <rate-limit-by-key calls="1000" renewal-period="60" counter-key="@(context.Subscription?.Key ?? context.Request.IpAddress)" increment-condition="@(context.Response.StatusCode < 400)" />
    
    <!-- IP-based rate limiting for anonymous/unauthenticated requests -->
    <choose>
      <when condition="@(context.Request.Headers.GetValueOrDefault("Authorization", "") == "")">
        <rate-limit-by-key calls="30" renewal-period="60" counter-key="@(context.Request.IpAddress)" />
      </when>
    </choose>
    
    <!-- CORS handling -->
    <cors>
      <allowed-origins>
        <origin>${corsOrigins}</origin>
      </allowed-origins>
      <allowed-methods>
        <method>GET</method>
        <method>POST</method>
        <method>PUT</method>
        <method>PATCH</method>
        <method>DELETE</method>
        <method>OPTIONS</method>
      </allowed-methods>
      <allowed-headers>
        <header>Authorization</header>
        <header>Content-Type</header>
        <header>X-CSRF-Token</header>
        <header>X-Correlation-ID</header>
        <header>X-Request-ID</header>
        <header>X-Client-Info</header>
        <header>Apikey</header>
      </allowed-headers>
      <expose-headers>
        <header>X-Correlation-ID</header>
        <header>X-Request-ID</header>
        <header>X-Api-Version</header>
        <header>X-RateLimit-Remaining</header>
        <header>X-RateLimit-Reset</header>
        <header>Retry-After</header>
      </expose-headers>
      <max-age>300</max-age>
      <allow-credentials>true</allow-credentials>
    </cors>
    
    <!-- Security headers -->
    <set-header name="X-Content-Type-Options" exists-action="override">
      <value>nosniff</value>
    </set-header>
    <set-header name="X-Frame-Options" exists-action="override">
      <value>DENY</value>
    </set-header>
    <set-header name="Referrer-Policy" exists-action="override">
      <value>strict-origin-when-cross-origin</value>
    </set-header>
    <set-header name="Permissions-Policy" exists-action="override">
      <value>camera=(), microphone=(), geolocation=(self), payment=(self)</value>
    </set-header>
    
    <!-- Remove server header -->
    <set-header name="Server" exists-action="delete" />
    
    <!-- Forward client IP to backend -->
    <set-header name="X-Forwarded-For" exists-action="override">
      <value>@(context.Request.IpAddress)</value>
    </set-header>
    <set-header name="X-Forwarded-Proto" exists-action="override">
      <value>https</value>
    </set-header>
    
    <!-- Validate JWT structure early (before backend) -->
    <choose>
      <when condition="@(context.Request.Headers.GetValueOrDefault("Authorization", "").StartsWith("Bearer "))">
        <validate-jwt header-name="Authorization" failed-validation-httpcode="401" failed-validation-error-message="Invalid token" require-expiration-time="true" require-scheme="Bearer" require-signed-tokens="true">
          <openid-config url="@(context.Variables.GetValueOrDefault("supabase-url", "")?.ToString().TrimEnd('/') + "/auth/v1/.well-known/openid-configuration") />
          <required-claims>
            <claim name="aud" match="all">
              <value>authenticated</value>
            </claim>
          </required-claims>
        </validate-jwt>
      </when>
      <otherwise>
        <choose>
          <when condition="@(context.Operation.Id != "health-check" && context.Api.Id != "health")">
            <return-response>
              <set-status code="401" reason="Unauthorized" />
              <set-header name="Content-Type" exists-action="override">
                <value>application/json</value>
              </set-header>
              <set-body>@("{ \"error\": \"Missing bearer token\" }")</set-body>
            </return-response>
          </when>
        </choose>
      </otherwise>
    </choose>
  </inbound>
  <backend>
    <base />
  </backend>
  <outbound>
    <base />
    <!-- Add security headers to response -->
    <set-header name="X-Content-Type-Options" exists-action="override">
      <value>nosniff</value>
    </set-header>
    <set-header name="X-Frame-Options" exists-action="override">
      <value>DENY</value>
    </set-header>
    <set-header name="Referrer-Policy" exists-action="override">
      <value>strict-origin-when-cross-origin</value>
    </set-header>
    <set-header name="Permissions-Policy" exists-action="override">
      <value>camera=(), microphone=(), geolocation=(self), payment=(self)</value>
    </set-header>
    <set-header name="Cross-Origin-Opener-Policy" exists-action="override">
      <value>same-origin-allow-popups</value>
    </set-header>
    <set-header name="Cross-Origin-Resource-Policy" exists-action="override">
      <value>same-site</value>
    </set-header>
    
    <!-- Propagate correlation IDs -->
    <set-header name="X-Correlation-ID" exists-action="override">
      <value>@(context.Variables.GetValueOrDefault("x-correlation-id", "")?.ToString() ?? context.Request.Headers.GetValueOrDefault("X-Correlation-ID", "") ?? Guid.NewGuid().ToString())</value>
    </set-header>
    <set-header name="X-Request-ID" exists-action="override">
      <value>@(context.Variables.GetValueOrDefault("x-request-id", "")?.ToString() ?? context.Request.Headers.GetValueOrDefault("X-Request-ID", "") ?? Guid.NewGuid().ToString())</value>
    </set-header>
  </outbound>
  <on-error>
    <base />
    <set-header name="Content-Type" exists-action="override">
      <value>application/json</value>
    </set-header>
    <choose>
      <when condition="@(context.Response.StatusCode == 429)">
        <set-header name="Retry-After" exists-action="override">
          <value>@(context.Response.Headers.GetValueOrDefault("Retry-After", "60"))</value>
        </set-header>
        <return-response>
          <set-status code="429" reason="Too Many Requests" />
          <set-body>@("{ \"error\": \"Rate limit exceeded\", \"retryAfter\": " + context.Response.Headers.GetValueOrDefault("Retry-After", "60") + " }")</set-body>
        </return-response>
      </when>
      <when condition="@(context.Response.StatusCode >= 500)">
        <set-body>@("{ \"error\": \"Internal server error\", \"requestId\": \"" + context.Request.Headers.GetValueOrDefault("X-Request-ID", Guid.NewGuid().ToString()) + "\" }")</set-body>
      </when>
    </choose>
  </on-error>
</policies>
'''

resource globalPolicy 'Microsoft.ApiManagement/service/policies@2023-09-01-preview' = {
  parent: apimName
  name: 'policy'
  properties: {
    format: 'xml'
    policyContent: globalPolicyXml
  }
}