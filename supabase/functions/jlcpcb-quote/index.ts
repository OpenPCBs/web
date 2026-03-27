// Supabase Edge Function
// Required secrets:
// JLCPCB_API_TOKEN
// Optional:
// JLCPCB_API_BASE_URL (defaults to https://api.jlcpcb.com)

import { handleCors, json } from '../_shared.ts';

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    const token = Deno.env.get('JLCPCB_API_TOKEN');
    if (!token) return json({ error: 'Missing JLCPCB_API_TOKEN.' }, 500);

    const baseUrl = Deno.env.get('JLCPCB_API_BASE_URL') || 'https://api.jlcpcb.com';
    const body = await request.json();
    const quote = body.quote || {};

    // This payload is a template and may need adjustment to match your approved JLCPCB account scope.
    const upstreamResponse = await fetch(`${baseUrl}/api/pcb/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        width: quote.boardWidthMm,
        height: quote.boardHeightMm,
        layers: quote.layers,
        quantity: quote.quantity,
        thickness: quote.thicknessMm,
        assembly: quote.assembly,
        fileUrl: body.archiveUrl || undefined,
        projectTitle: body.projectTitle,
      }),
    });

    const upstream = await upstreamResponse.json().catch(() => ({}));
    if (!upstreamResponse.ok) {
      return json({ error: upstream.message || upstream.error || 'JLCPCB quote request failed.' }, upstreamResponse.status);
    }

    return json({
      provider: 'jlcpcb',
      currency: upstream.currency || 'USD',
      total: Number(upstream.total || upstream.price || 0),
      turnaround: upstream.turnaround || upstream.leadTime || '',
      breakdown: upstream.breakdown || upstream.items || [],
      raw: upstream,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'JLCPCB quote failed.' }, 500);
  }
});
