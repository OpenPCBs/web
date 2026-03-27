// Supabase Edge Function
// Required secrets:
// STRIPE_SECRET_KEY
// Optional:
// STRIPE_PRICE_CURRENCY (defaults to usd)

import Stripe from 'https://esm.sh/stripe@18.1.1?target=deno';
import { handleCors, json } from '../_shared.ts';

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!secretKey) return json({ error: 'Missing STRIPE_SECRET_KEY.' }, 500);

    const stripe = new Stripe(secretKey, { apiVersion: '2025-02-24.acacia' });
    const body = await request.json();
    const currency = (body.quote?.currency || Deno.env.get('STRIPE_PRICE_CURRENCY') || 'usd').toLowerCase();
    const unitAmount = Math.round(Number(body.quote?.total || 0) * 100);

    if (!unitAmount) return json({ error: 'Quote total is required before checkout.' }, 400);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: body.successUrl,
      cancel_url: body.cancelUrl,
      customer_email: body.customerEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: unitAmount,
            product_data: {
              name: `${body.projectTitle || 'OpenPCB project'} fabrication order`,
              description: `${String(body.provider || '').toUpperCase()} quote created from OpenPCB`,
            },
          },
        },
      ],
      metadata: {
        provider: body.provider || '',
        projectId: body.projectId || '',
      },
    });

    return json({ id: session.id, url: session.url });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Checkout creation failed.' }, 500);
  }
});
