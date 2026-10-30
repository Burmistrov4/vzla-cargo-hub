import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!
  );

  const { data: rates, error: ratesErr } = await supabase.from('courier_rates').select('*');
  const { data: rules, error: rulesErr } = await supabase.from('courier_rules').select('*');

  if (ratesErr || rulesErr) {
    console.error('Supabase fetch error', { ratesErr, rulesErr });
    return new Response(
      JSON.stringify({ error: 'Failed to fetch rates' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(
    JSON.stringify({ rates, rules }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
