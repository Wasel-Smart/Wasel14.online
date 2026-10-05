import { json, authenticateRequest, type AdminClient } from './shared.ts';

async function getUserOrganization ( supabase: AdminClient, userId: string ) {
  const { data: member } = await supabase
    .from( 'organization_members' )
    .select( 'organization_id, role' )
    .eq( 'user_id', userId )
    .single();
  return member;
}

export async function handleCreateOrganization ( request: Request ) {
  const auth = await authenticateRequest( request );
  if ( 'error' in auth ) {return auth.error;}

  const body = await request.json().catch( () => ( {} ) );
  const { name, contactEmail, contactPhone, billingAddress, taxId } = body;

  if ( !name || !contactEmail ) {
    return json( { error: 'name and contactEmail are required' }, 400 );
  }

  const supabase = auth.admin;

  const { data: org, error } = await supabase
    .from( 'organizations' )
    .insert( {
      name,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      billing_address: billingAddress,
      tax_id: taxId,
      owner_id: auth.canonicalUser.id,
    } )
    .select()
    .single();

  if ( error ) {
    return json( { error: error.message }, 400 );
  }

  await supabase
    .from( 'organization_members' )
    .insert( {
      organization_id: org.id,
      user_id: auth.canonicalUser.id,
      role: 'admin',
    } );

  return json( { data: org } );
}

export async function handleGetOrganization ( request: Request, path: string ) {
  const auth = await authenticateRequest( request );
  if ( 'error' in auth ) {return auth.error;}

  const orgId = path.split( '/' ).pop();
  const supabase = auth.admin;

  const { data: org, error } = await supabase
    .from( 'organizations' )
    .select( '*' )
    .eq( 'id', orgId )
    .single();

  if ( error || !org ) {
    return json( { error: 'Organization not found' }, 404 );
  }

  const membership = await getUserOrganization( supabase, auth.canonicalUser.id );
  if ( !membership || membership.organization_id !== orgId ) {
    return json( { error: 'Forbidden' }, 403 );
  }

  return json( { data: org } );
}

export async function handleListOrganizations ( request: Request ) {
  const auth = await authenticateRequest( request );
  if ( 'error' in auth ) {return auth.error;}

  const supabase = auth.admin;

  const { data: memberships } = await supabase
    .from( 'organization_members' )
    .select( 'organization_id, role' )
    .eq( 'user_id', auth.canonicalUser.id );

  if ( !memberships?.length ) {
    return json( { data: [] } );
  }

  const orgIds = memberships.map( m => m.organization_id );
  const { data: orgs, error } = await supabase
    .from( 'organizations' )
    .select( '*' )
    .in( 'id', orgIds );

  if ( error ) {
    return json( { error: error.message }, 400 );
  }

  return json( { data: orgs } );
}

export async function handleAddMember ( request: Request, path: string ) {
  const auth = await authenticateRequest( request );
  if ( 'error' in auth ) {return auth.error;}

  const orgId = path.split( '/' )[ 2 ];
  const body = await request.json().catch( () => ( {} ) );
  const { userId, employeeId, costCenter } = body;

  if ( !userId ) {
    return json( { error: 'userId is required' }, 400 );
  }

  const supabase = auth.admin;

  const membership = await getUserOrganization( supabase, auth.canonicalUser.id );
  if ( !membership || membership.organization_id !== orgId || membership.role !== 'admin' ) {
    return json( { error: 'Forbidden: only organization admins can add members' }, 403 );
  }

  const { data: member, error } = await supabase
    .from( 'organization_members' )
    .insert( {
      organization_id: orgId,
      user_id: userId,
      role: 'member',
      employee_id: employeeId,
      cost_center: costCenter,
    } )
    .select()
    .single();

  if ( error ) {
    return json( { error: error.message }, 400 );
  }

  return json( { data: member } );
}

export async function handleAddCredits ( request: Request, path: string ) {
  const auth = await authenticateRequest( request );
  if ( 'error' in auth ) {return auth.error;}

  const orgId = path.split( '/' )[ 2 ];
  const body = await request.json().catch( () => ( {} ) );
  const { amount, currency, expiresAt } = body;

  if ( !amount || amount <= 0 ) {
    return json( { error: 'amount must be positive' }, 400 );
  }

  const supabase = auth.admin;

  const membership = await getUserOrganization( supabase, auth.canonicalUser.id );
  if ( !membership || membership.organization_id !== orgId || membership.role !== 'admin' ) {
    return json( { error: 'Forbidden: only organization admins can add credits' }, 403 );
  }

  const { data: credit, error } = await supabase
    .from( 'corporate_credits' )
    .insert( {
      organization_id: orgId,
      amount,
      currency: currency || 'JOD',
      remaining: amount,
      expires_at: expiresAt,
    } )
    .select()
    .single();

  if ( error ) {
    return json( { error: error.message }, 400 );
  }

  return json( { data: credit } );
}

export async function handleGenerateInvoice ( request: Request ) {
  const auth = await authenticateRequest( request );
  if ( 'error' in auth ) {return auth.error;}

  const body = await request.json().catch( () => ( {} ) );
  const { organizationId, billingPeriodStart, billingPeriodEnd } = body;

  if ( !organizationId || !billingPeriodStart || !billingPeriodEnd ) {
    return json( { error: 'organizationId, billingPeriodStart, and billingPeriodEnd are required' }, 400 );
  }

  const supabase = auth.admin;

  const membership = await getUserOrganization( supabase, auth.canonicalUser.id );
  if ( !membership || membership.organization_id !== organizationId || membership.role !== 'admin' ) {
    return json( { error: 'Forbidden: only organization admins can generate invoices' }, 403 );
  }

  const { data: credits } = await supabase
    .from( 'corporate_credits' )
    .select( '*' )
    .eq( 'organization_id', organizationId )
    .eq( 'status', 'active' )
    .gte( 'expires_at', billingPeriodStart )
    .lte( 'expires_at', billingPeriodEnd );

  const lineItems = ( credits || [] ).map( c => ( {
    description: `Credit purchase - ${ c.amount } ${ c.currency }`,
    amount: c.amount,
  } ) );

  const totalAmount = lineItems.reduce( ( sum, item ) => sum + item.amount, 0 );

  const { data: invoice, error } = await supabase
    .from( 'invoices' )
    .insert( {
      organization_id: organizationId,
      billing_period_start: billingPeriodStart,
      billing_period_end: billingPeriodEnd,
      total_amount: totalAmount,
      currency: 'JOD',
      status: 'draft',
      line_items: lineItems,
    } )
    .select()
    .single();

  if ( error ) {
    return json( { error: error.message }, 400 );
  }

  return json( { data: invoice } );
}

export async function handleGetInvoices ( request: Request, path: string ) {
  const auth = await authenticateRequest( request );
  if ( 'error' in auth ) {return auth.error;}

  const orgId = path.split( '/' )[ 2 ];
  const supabase = auth.admin;

  const membership = await getUserOrganization( supabase, auth.canonicalUser.id );
  if ( !membership || membership.organization_id !== orgId ) {
    return json( { error: 'Forbidden' }, 403 );
  }

  const { data: invoices, error } = await supabase
    .from( 'invoices' )
    .select( '*' )
    .eq( 'organization_id', orgId )
    .order( 'created_at', { ascending: false } );

  if ( error ) {
    return json( { error: error.message }, 400 );
  }

  return json( { data: invoices } );
}