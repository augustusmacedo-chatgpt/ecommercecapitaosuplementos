export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const cnpj = (url.searchParams.get('cnpj') || '').replace(/\D/g, '');

  if (cnpj.length !== 14) {
    return Response.json({ error: 'CNPJ inválido' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return Response.json({ error: 'Consulta indisponível' }, { status: 502 });
  }
}
