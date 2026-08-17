// Supabase Edge Function — daily BCV / paralelo / USDT exchange rates.
// Deploy with: supabase functions deploy tasas-cambio
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DolarApiRate {
  promedio: number;
}

interface BinanceP2pResponse {
  data: { adv: { price: string } }[];
}

async function fetchOficialYParalelo(): Promise<{ bcv: number; paralelo: number }> {
  const [oficialRes, paraleloRes] = await Promise.all([
    fetch('https://ve.dolarapi.com/v1/dolares/oficial'),
    fetch('https://ve.dolarapi.com/v1/dolares/paralelo'),
  ]);

  const oficial: DolarApiRate = await oficialRes.json();
  const paralelo: DolarApiRate = await paraleloRes.json();

  return { bcv: oficial.promedio, paralelo: paralelo.promedio };
}

async function fetchUsdt(): Promise<number> {
  // Public Binance P2P ad search — no API key required. tradeType "SELL"
  // returns the ads a USDT seller would be matched against, which is the
  // rate Venezuelan "USDT" monitors typically quote.
  const response = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      asset: 'USDT',
      fiat: 'VES',
      tradeType: 'SELL',
      page: 1,
      rows: 5,
      payTypes: [],
    }),
  });

  const json: BinanceP2pResponse = await response.json();
  const prices = json.data.map((item) => Number(item.adv.price));

  return prices.reduce((sum, price) => sum + price, 0) / prices.length;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const today = new Date().toISOString().slice(0, 10);

    const { data: cached } = await supabase
      .from('tasas_cambio')
      .select('*')
      .eq('fecha', today)
      .maybeSingle();

    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [{ bcv, paralelo }, usdt] = await Promise.all([fetchOficialYParalelo(), fetchUsdt()]);

    const { data: saved, error } = await supabase
      .from('tasas_cambio')
      .upsert({ fecha: today, bcv, paralelo, usdt }, { onConflict: 'fecha' })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify(saved), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
