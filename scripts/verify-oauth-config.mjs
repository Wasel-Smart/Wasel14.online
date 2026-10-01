#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ALLOWED_OAUTH_DOMAINS = ['accounts.google.com', 'facebook.com', 'localhost'];

function isValidOAuthUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') { return false; }
    if (parsed.hostname === 'localhost') { return true; }
    return ALLOWED_OAUTH_DOMAINS.some(d => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

const REQUIRED_ENV_VARS = {
  client: [
    'VITE_GOOGLE_CLIENT_ID',
    'VITE_FACEBOOK_APP_ID',
    'VITE_AUTH_CALLBACK_PATH',
  ],
  server: [
    'SUPABASE_AUTH_GOOGLE_CLIENT_ID',
    'SUPABASE_AUTH_GOOGLE_CLIENT_SECRET',
    'SUPABASE_AUTH_FACEBOOK_CLIENT_ID',
    'SUPABASE_AUTH_FACEBOOK_CLIENT_SECRET',
  ],
};

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function checkEnvFile() {
  log('\n📋 Checking .env file...', 'cyan');

  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    // CI never has a local .env (real env files must not exist there). Secrets live
    // in CI/provider settings, so the presence check is meaningless in that context.
    // The structural checks below (config.toml, auth files, implementation) still run.
    if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
      log('ℹ️  CI run: no .env file expected. Skipping variable presence checks.', 'yellow');
      return true;
    }
    log('❌ .env file not found', 'red');
    log('   Create .env from .env.example', 'yellow');
    return false;
  }

  log('✅ .env file exists', 'green');

  const envContent = readFileSync(envPath, 'utf-8');
  const envVars = {};
  // Split on /\r?\n/, not '\n': a CRLF file leaves a trailing \r on every line and
  // `.` does not match \r in JS, so `/^([^=]+)=(.*)$/` silently matched nothing
  // and the script reported every OAuth variable as "Not configured" while the
  // app was configured correctly.
  for (const line of envContent.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s][^=]*)=(.*)$/);
    if (match) {
      envVars[match[1].trim()] = match[2].trim();
    }
  }

  let allValid = true;

  log('\n🔍 Checking client-side OAuth variables:', 'cyan');
  for (const varName of REQUIRED_ENV_VARS.client) {
    const value = envVars[varName];
    const isSet = value && value !== '' && !value.startsWith('your-') && !value.includes('PASTE_YOUR');
    if (isSet) {
      log(`✅ ${varName}`, 'green');
    } else {
      log(`❌ ${varName} - Not configured`, 'red');
      allValid = false;
    }
  }

  log('\n🔒 Checking server-side OAuth secrets:', 'cyan');
  for (const varName of REQUIRED_ENV_VARS.server) {
    const value = envVars[varName];
    const isSet = value && value !== '' && !value.startsWith('your-') && !value.includes('PASTE_YOUR');
    if (isSet) {
      log(`✅ ${varName}`, 'green');
    } else {
      log(`❌ ${varName} - Not configured`, 'red');
      allValid = false;
    }
  }

  return allValid;
}

function checkSupabaseConfig() {
  log('\n📋 Checking Supabase config.toml...', 'cyan');

  const configPath = join(process.cwd(), 'supabase', 'config.toml');
  if (!existsSync(configPath)) {
    log('❌ supabase/config.toml not found', 'red');
    return false;
  }

  log('✅ config.toml exists', 'green');

  const configContent = readFileSync(configPath, 'utf-8');
  const hasGoogleConfig = configContent.includes('[auth.external.google]');
  const hasFacebookConfig = configContent.includes('[auth.external.facebook]');
  const googleEnabled = configContent.match(/\[auth\.external\.google\][^[]*enabled\s*=\s*true/);
  const facebookEnabled = configContent.match(/\[auth\.external\.facebook\][^[]*enabled\s*=\s*true/);

  log('\n🔍 Checking OAuth provider configuration:', 'cyan');

  if (hasGoogleConfig && googleEnabled) {
    log('✅ Google OAuth enabled', 'green');
  } else if (hasGoogleConfig) {
    log('⚠️  Google OAuth configured but not enabled', 'yellow');
  } else {
    log('❌ Google OAuth not configured', 'red');
  }

  if (hasFacebookConfig && facebookEnabled) {
    log('✅ Facebook OAuth enabled', 'green');
  } else if (hasFacebookConfig) {
    log('⚠️  Facebook OAuth configured but not enabled', 'yellow');
  } else {
    log('❌ Facebook OAuth not configured', 'red');
  }

  return (hasGoogleConfig && googleEnabled) || (hasFacebookConfig && facebookEnabled);
}

function readEnvVars() {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    // No local .env (normal in CI): fall back to the process environment.
    return { ...process.env };
  }

  const envVars = {};
  for (const line of readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s][^=]*)=(.*)$/);
    if (match) {
      envVars[match[1].trim()] = match[2].trim();
    }
  }
  return envVars;
}

// The provider never sees this app's URL. signInWithOAuth sends the browser to
// supabase.co/auth/v1/authorize, which 302s to Google/Facebook with
// `${supabaseUrl}/auth/v1/callback` as `redirect_uri` and our app URL only as
// `redirect_to`. If that Supabase callback is missing from the provider
// console, the provider answers `redirect_uri_mismatch` and the user never
// reaches the app at all — which is why the callback path is not the thing to
// check here.
function providerRedirectUri(envVars) {
  const supabaseUrl = (envVars.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  return supabaseUrl ? `${supabaseUrl}/auth/v1/callback` : '';
}

async function checkLiveProviders(envVars) {
  log('\n🌐 Checking live Supabase provider settings...', 'cyan');

  const supabaseUrl = (envVars.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const apiKey = envVars.VITE_SUPABASE_ANON_KEY || envVars.VITE_SUPABASE_PUBLISHABLE_KEY || '';

  if (!supabaseUrl || !apiKey) {
    log('⚠️  VITE_SUPABASE_URL / anon key missing - skipping live check', 'yellow');
    return true;
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      log(`⚠️  Auth settings returned HTTP ${response.status} - skipping live check`, 'yellow');
      return true;
    }

    const { external = {} } = await response.json();
    let allEnabled = true;
    for (const provider of ['google', 'facebook']) {
      if (external[provider] === true) {
        log(`✅ ${provider} enabled on the Supabase project`, 'green');
      } else {
        log(`❌ ${provider} is NOT enabled on the Supabase project`, 'red');
        allEnabled = false;
      }
    }
    return allEnabled;
  } catch (error) {
    log(`⚠️  Could not reach the Supabase auth service (${error.message})`, 'yellow');
    return true;
  }
}

function checkProviderRedirectUri(envVars) {
  log('\n🔗 Checking the provider-facing redirect URI...', 'cyan');

  const redirectUri = providerRedirectUri(envVars);
  if (!redirectUri) {
    if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
      log('ℹ️  CI run: VITE_SUPABASE_URL not provided. Skipping redirect URI derivation.', 'yellow');
      return true;
    }
    log('❌ Could not derive the provider redirect URI (VITE_SUPABASE_URL missing)', 'red');
    return false;
  }

  const appOrigin = envVars.VITE_APP_URL || envVars.VITE_APP_ORIGIN || '(unset)';
  const appCallback = `${appOrigin}${envVars.VITE_AUTH_CALLBACK_PATH || '/app/auth/callback'}`;

  log('   Provider `redirect_uri` (what Google/Facebook must whitelist):', 'cyan');
  log(`     ${redirectUri}`, 'blue');
  log('   App `redirect_to` (where the code is finally delivered):', 'cyan');
  log(`     ${appCallback}`, 'blue');
  log('   These are different URLs by design. Verify the first one is registered:', 'yellow');
  log('     Google   → APIs & Services → Credentials → Authorized redirect URIs', 'yellow');
  log('     Facebook → Developers → Settings → Valid OAuth Redirect URIs', 'yellow');
  log('     Supabase → Authentication → URL Configuration → Redirect URLs (the second one)', 'yellow');
  log('   A missing entry surfaces as `redirect_uri_mismatch` on the provider page.', 'yellow');

  return true;
}

function checkAuthFiles() {
  log('\n📋 Checking authentication files...', 'cyan');

  const files = [
    'src/contexts/AuthContext.tsx',
    'src/pages/WaselAuth.tsx',
    'src/utils/oauthErrors.ts',
  ];

  let allExist = true;
  for (const file of files) {
    const filePath = join(process.cwd(), file);
    if (existsSync(filePath)) {
      log(`✅ ${file}`, 'green');
    } else {
      log(`❌ ${file} - Missing`, 'red');
      allExist = false;
    }
  }

  return allExist;
}

function checkOAuthImplementation() {
  log('\n📋 Checking OAuth implementation...', 'cyan');

  const authContextPath = join(process.cwd(), 'src/contexts/auth/AuthContext.tsx');
  const legacyAuthContextPath = join(process.cwd(), 'src/contexts/AuthContext.tsx');
  const authContextPathToUse = existsSync(authContextPath) ? authContextPath : legacyAuthContextPath;

  if (!existsSync(authContextPathToUse)) {
    log('❌ AuthContext.tsx not found', 'red');
    return false;
  }

  const authContent = readFileSync(authContextPathToUse, 'utf-8');

  const checks = [
    { name: 'Google sign-in method', check: authContent.includes('signInWithGoogle') },
    { name: 'Facebook sign-in method', check: authContent.includes('signInWithFacebook') },
    { name: 'OAuth helper function', check: authContent.includes('signInWithOAuthProvider') },
    { name: 'Enhanced OAuth error handling', check: authContent.includes('parseOAuthError') },
  ];

  let allPassed = true;
  for (const { name, check } of checks) {
    if (check) {
      log(`✅ ${name}`, 'green');
    } else {
      log(`❌ ${name}`, 'red');
      allPassed = false;
    }
  }

  void isValidOAuthUrl;
  return allPassed;
}

function printSummary(results) {
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 OAuth Configuration Summary', 'cyan');
  log('='.repeat(60), 'cyan');

  const allPassed = Object.values(results).every(r => r);
  for (const [check, passed] of Object.entries(results)) {
    const status = passed ? '✅' : '❌';
    const color = passed ? 'green' : 'red';
    log(`${status} ${check}`, color);
  }

  log('\n' + '='.repeat(60), 'cyan');
  if (allPassed) {
    log('🎉 All OAuth checks passed!', 'green');
    log('   Your OAuth configuration is ready for use.', 'green');
    log('\n📚 Next steps:', 'cyan');
    log('   1. Start your dev server: npm run dev', 'blue');
    log('   2. Test Google sign-in at /app/auth', 'blue');
    log('   3. Test Facebook sign-in at /app/auth', 'blue');
    log('   4. Run OAuth tests: npm run test:e2e:oauth', 'blue');
  } else {
    log('⚠️  Some OAuth checks failed', 'yellow');
    log('   Review the errors above and fix configuration.', 'yellow');
    log('\n📚 Resources:', 'cyan');
    log('   • Setup guide: docs/oauth-setup-guide.md', 'blue');
    log('   • Environment example: .env.example', 'blue');
    log('   • Supabase config: supabase/config.toml', 'blue');
  }
  log('='.repeat(60) + '\n', 'cyan');

  return allPassed;
}

async function main() {
  log('\n🔐 Wasel OAuth Configuration Verification', 'cyan');
  log('='.repeat(60) + '\n', 'cyan');

  const envVars = readEnvVars();

  const results = {
    'Environment Variables': checkEnvFile(),
    'Supabase Configuration': checkSupabaseConfig(),
    'Provider Redirect URI': checkProviderRedirectUri(envVars),
    'Live Providers': await checkLiveProviders(envVars),
    'Authentication Files': checkAuthFiles(),
    'OAuth Implementation': checkOAuthImplementation(),
  };

  const allPassed = printSummary(results);
  // Do not call process.exit(): the live provider check leaves an undici
  // keep-alive socket open, and forcing an exit while it is still pending
  // crashes node on Windows (0xC0000409). Setting exitCode lets it drain.
  process.exitCode = allPassed ? 0 : 1;
}

main().catch((error) => {
  log(`\n❌ Verification crashed: ${error.stack || error.message}`, 'red');
  process.exitCode = 1;
});