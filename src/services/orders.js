import { APP_URL, getFunctionUrl } from '../lib/env';

async function postJson(url, body) {
  if (!url) {
    throw new Error('Server integrations are not configured yet. Add VITE_SUPABASE_FUNCTIONS_URL first.');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Request failed.');
  }

  return data;
}

export async function fetchFabricationQuote(provider, payload) {
  return postJson(getFunctionUrl(`${provider}-quote`), payload);
}

export async function createStripeCheckout(payload) {
  const data = await postJson(getFunctionUrl('stripe-checkout'), {
    successUrl: `${APP_URL}/#/dashboard?checkout=success`,
    cancelUrl: `${APP_URL}/#/project/${payload.projectId}?checkout=cancelled`,
    ...payload,
  });

  if (data.url) {
    window.location.assign(data.url);
  }

  return data;
}
