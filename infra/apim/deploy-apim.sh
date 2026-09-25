#!/bin/bash
# Deploy Wasel API Management Infrastructure
# Usage: ./deploy-apim.sh [resource-group] [location] [environment]

set -euo pipefail

RESOURCE_GROUP="${1:-wasel-rg}"
LOCATION="${2:-East US 2}"
ENVIRONMENT="${3:-prod}"
DEPLOYMENT_NAME="wasel-apim-$(date +%Y%m%d-%H%M%S)"

echo "🚀 Deploying Wasel API Management"
echo "   Resource Group: $RESOURCE_GROUP"
echo "   Location: $LOCATION"
echo "   Environment: $ENVIRONMENT"
echo "   Deployment: $DEPLOYMENT_NAME"

# Check Azure CLI
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI not found. Install: https://docs.microsoft.com/cli/azure/install-azure-cli"
    exit 1
fi

# Check Bicep
if ! az bicep version &> /dev/null; then
    echo "📦 Installing Bicep..."
    az bicep install
fi

# Create resource group if not exists
echo "📁 Ensuring resource group exists..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --tags Environment="$ENVIRONMENT" Project=wasel ManagedBy=bicep

# Validate Bicep
echo "🔍 Validating Bicep template..."
az deployment group validate \
    --resource-group "$RESOURCE_GROUP" \
    --template-file infra/apim/main.bicep \
    --parameters environment="$ENVIRONMENT" \
    --parameters publisherEmail="platform@wasel.jo" \
    --parameters publisherName="Wasel Platform" \
    --parameters supabaseUrl="https://zexlxabdcsjefptmjhuq.supabase.co" \
    --parameters allowedOrigins='["https://wasel14.online","https://www.wasel14.online","https://app.wasel14.online"]'

if [ $? -ne 0 ]; then
    echo "❌ Validation failed"
    exit 1
fi

# Deploy
echo "🚀 Deploying..."
az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$DEPLOYMENT_NAME" \
    --template-file infra/apim/main.bicep \
    --parameters environment="$ENVIRONMENT" \
    --parameters publisherEmail="platform@wasel.jo" \
    --parameters publisherName="Wasel Platform" \
    --parameters supabaseUrl="https://zexlxabdcsjefptmjhuq.supabase.co" \
    --parameters allowedOrigins='["https://wasel14.online","https://www.wasel14.online","https://app.wasel14.online"]' \
    --parameters skuName="Consumption" \
    --parameters enableManagedIdentity=true

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed"
    exit 1
fi

# Get outputs
echo "📋 Deployment outputs:"
az deployment group show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$DEPLOYMENT_NAME" \
    --query "properties.outputs" -o json

echo "✅ Deployment complete!"
echo ""
echo "🔗 Next steps:"
echo "1. Configure custom domain: api.wasel14.online"
echo "2. Import OpenAPI specs to APIM (auto-imported via Bicep)"
echo "3. Create API subscriptions for clients"
echo "4. Update frontend to use APIM gateway URL"
echo "5. Configure Sentry DSN in APIM named values"
echo "6. Set up APIM Application Insights integration"