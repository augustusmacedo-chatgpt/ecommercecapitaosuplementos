export default {
  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return Response.json({
        error: 'API em migração para o Cloudflare Worker.',
        path: url.pathname,
      }, { status: 503 });
    }

    return new Response(null, { status: 404 });
  },
};
