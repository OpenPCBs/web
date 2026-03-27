// Supabase Edge Function
// Required secrets:
// PCBWAY_API_KEY
// PCBWAY_API_BASE_URL defaults to https://api-partner.pcbway.com/api

import { handleCors, json } from '../_shared.ts';

Deno.serve(async (request) => {
  const cors = handleCors(request);
  if (cors) return cors;

  try {
    const apiKey = Deno.env.get('PCBWAY_API_KEY');
    if (!apiKey) return json({ error: 'Missing PCBWAY_API_KEY.' }, 500);

    const baseUrl = Deno.env.get('PCBWAY_API_BASE_URL') || 'https://api-partner.pcbway.com/api';
    const body = await request.json();
    const quote = body.quote || {};

    const upstreamResponse = await fetch(`${baseUrl}/Pcb/PcbQuotation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apiKey,
      },
      body: JSON.stringify({
        Width: quote.boardWidthMm,
        Height: quote.boardHeightMm,
        Layers: quote.layers,
        Quantity: quote.quantity,
        Thickness: quote.thicknessMm,
        IsAssembly: quote.assembly,
        FileUrl: body.archiveUrl || undefined,
        Subject: body.projectTitle,
      }),
    });

    const upstream = await upstreamResponse.json().catch(() => ({}));
    if (!upstreamResponse.ok) {
      return json({ error: upstream.message || upstream.error || 'PCBWay quote request failed.' }, upstreamResponse.status);
    }

    return json({
      provider: 'pcbway',
      currency: upstream.Currency || 'USD',
      total: Number(upstream.TotalPrice || upstream.Price || 0),
      turnaround: upstream.LeadTime || upstream.Turnaround || '',
      breakdown: [
        upstream.PcbPrice ? { label: 'PCB', amount: upstream.PcbPrice } : null,
        upstream.ShippingPrice ? { label: 'Shipping', amount: upstream.ShippingPrice } : null,
      ].filter(Boolean),
      raw: upstream,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'PCBWay quote failed.' }, 500);
  }
});
