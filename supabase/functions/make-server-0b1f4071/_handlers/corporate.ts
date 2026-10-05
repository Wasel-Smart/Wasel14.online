import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { json, enforceRequestSecurity, extractBearerToken, authenticateRequest } from './shared.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function getUserFromRequest(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return null;
  }
  return user;
}

async function getUserOrganization(supabase: any, userId: string) {
  const { data: member } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userId)
    .single();
  return member;
}

export async function handleCreateOrganization(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const body = await request.json();
  const { name, contactEmail, contactPhone, billingAddress, taxId } = body;

  if (!name || !contactEmail) {
    return json({ error: 'name and contactEmail are required' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: org, error } = await supabase
    .from('organizations')
    .insert({
      name,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      billing_address: billingAddress,
      tax_id: taxId,
      owner_id: user.id,
    })
    .select()
    .single();

  if (error) {
    return json({ error: error.message }, 400);
  }

  await supabase
    .from('organization_members')
    .insert({
      organization_id: org.id,
      user_id: user.id,
      role: 'admin',
    });

  return json({ data: org });
}

export async function handleGetOrganization(request: Request, path: string) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const orgId = path.split('/').pop();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: org, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .single();

  if (error || !org) {
    return json({ error: 'Organization not found' }, 404);
  }

  const membership = await getUserOrganization(supabase, user.id);
  if (!membership || membership.organization_id !== orgId) {
    return json({ error: 'Forbidden' }, 403);
  }

  return json({ data: org });
}

export async function handleListOrganizations(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: memberships } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id);

  if (!memberships?.length) {
    return json({ data: [] });
  }

  const orgIds = memberships.map(m => m.organization_id);
  const { data: orgs, error } = await supabase
    .from('organizations')
    .select('*')
    .in('id', orgIds);

  if (error) {
    return json({ error: error.message }, 400);
  }

  return json({ data: orgs });
}

export async function handleAddMember(request: Request, path: string) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const orgId = path.split('/')[2];
  const body = await request.json();
  const { userId, employeeId, costCenter } = body;

  if (!userId) {
    return json({ error: 'userId is required' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const membership = await getUserOrganization(supabase, user.id);
  if (!membership || membership.organization_id !== orgId || membership.role !== 'admin') {
    return json({ error: 'Forbidden: only organization admins can add members' }, 403);
  }

  const { data: member, error } = await supabase
    .from('organization_members')
    .insert({
      organization_id: orgId,
      user_id: userId,
      role: 'member',
      employee_id: employeeId,
      cost_center: costCenter,
    })
    .select()
    .single();

  if (error) {
    return json({ error: error.message }, 400);
  }

  return json({ data: member });
}

export async function handleAddCredits(request: Request, path: string) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const orgId = path.split('/')[2];
  const body = await request.json();
  const { amount, currency, expiresAt } = body;

  if (!amount || amount <= 0) {
    return json({ error: 'amount must be positive' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const membership = await getUserOrganization(supabase, user.id);
  if (!membership || membership.organization_id !== orgId || membership.role !== 'admin') {
    return json({ error: 'Forbidden: only organization admins can add credits' }, 403);
  }

  const { data: credit, error } = await supabase
    .from('corporate_credits')
    .insert({
      organization_id: orgId,
      amount,
      currency: currency || 'JOD',
      remaining: amount,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    return json({ error: error.message }, 400);
  }

  return json({ data: credit });
}

export async function handleGenerateInvoice(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const body = await request.json();
  const { organizationId, billingPeriodStart, billingPeriodEnd } = body;

  if (!organizationId || !billingPeriodStart || !billingPeriodEnd) {
    return json({ error: 'organizationId, billingPeriodStart, and billingPeriodEnd are required' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const membership = await getUserOrganization(supabase, user.id);
  if (!membership || membership.organization_id !== organizationId || membership.role !== 'admin') {
    return json({ error: 'Forbidden: only organization admins can generate invoices' }, 403);
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('name, billing_address, tax_id')
    .eq('id', organizationId)
    .single();

  const { data: credits } = await supabase
    .from('corporate_credits')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .gte('expires_at', billingPeriodStart)
    .lte('expires_at', billingPeriodEnd);

  const lineItems = (credits || []).map(c => ({
    description: `Credit purchase - ${c.amount} ${c.currency}`,
    amount: c.amount,
  }));

  const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      organization_id: organizationId,
      billing_period_start: billingPeriodStart,
      billing_period_end: billingPeriodEnd,
      total_amount: totalAmount,
      currency: 'JOD',
      status: 'draft',
      line_items: lineItems,
    })
    .select()
    .single();

  if (error) {
    return json({ error: error.message }, 400);
  }

  return json({ data: invoice });
}

export async function handleGetInvoices(request: Request, path: string) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const orgId = path.split('/')[2];
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const membership = await getUserOrganization(supabase, user.id);
  if (!membership || membership.organization_id !== orgId) {
    return json({ error: 'Forbidden' }, 403);
  }

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  if (error) {
    return json({ error: error.message }, 400);
  }

  return json({ data: invoices });
}