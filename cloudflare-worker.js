
export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname.endsWith('/health')) {
      return json({ ok: true, name: 'ruta-escolar-worker', version: '2.0.0' }, 200, cors);
    }

    if (request.method !== 'POST') {
      return json({ ok: false, error: 'Método no permitido' }, 405, cors);
    }

    const apiKey = request.headers.get('x-api-key');
    if (env.PUBLIC_API_KEY && apiKey !== env.PUBLIC_API_KEY) {
      return json({ ok: false, error: 'No autorizado' }, 401, cors);
    }

    try {
      const body = await request.json();
      const to = String(body?.to || '').replace(/\D/g, '');
      const payload = body?.payload;

      if (!to || !payload?.type) {
        return json({ ok: false, error: 'Faltan datos obligatorios' }, 400, cors);
      }

      const metaPayload = {
        messaging_product: 'whatsapp',
        to,
        ...buildMetaPayload(payload)
      };

      const response = await fetch(`https://graph.facebook.com/v23.0/${env.PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metaPayload)
      });

      const data = await response.json();
      if (!response.ok) {
        return json({ ok: false, error: data }, response.status, cors);
      }

      return json({ ok: true, data }, 200, cors);
    } catch (error) {
      return json({ ok: false, error: error.message || 'Error interno' }, 500, cors);
    }
  }
};

function buildMetaPayload(payload) {
  if (payload.type === 'template') {
    return {
      type: 'template',
      template: payload.template
    };
  }

  if (payload.type === 'interactive') {
    return {
      type: 'interactive',
      interactive: payload.interactive
    };
  }

  return {
    type: 'text',
    text: payload.text
  };
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extra
    }
  });
}
