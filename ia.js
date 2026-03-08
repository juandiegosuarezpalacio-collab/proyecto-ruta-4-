
window.RutaIA = (() => {
  const plantillas = {
    formal: {
      cerca: 'Buen día, {acudiente}. Le informamos que la {servicio} de {estudiante} ya se encuentra cerca del sector {barrio}. Tiempo estimado: {minutos} minutos. {detalle}',
      retraso: 'Buen día, {acudiente}. La {servicio} presenta un retraso aproximado de {minutos} minutos para recoger a {estudiante}. {detalle}',
      subio: 'Buen día, {acudiente}. Confirmamos que {estudiante} ya abordó la {servicio} sin novedad. {detalle}',
      noSalio: 'Buen día, {acudiente}. Pasamos por el punto de recogida de {estudiante}, pero no fue posible abordarlo. {detalle}',
      llegada: 'Buen día, {acudiente}. Confirmamos que {estudiante} llegó correctamente a {colegio}. {detalle}',
      personalizado: 'Buen día, {acudiente}. {detalle}'
    },
    cercano: {
      cerca: 'Hola {acudiente} 👋, la {servicio} de {estudiante} ya va cerca por {barrio}. Llegamos en unos {minutos} minutos. {detalle}',
      retraso: 'Hola {acudiente}, vamos con un retraso aproximado de {minutos} minutos para recoger a {estudiante}. {detalle}',
      subio: 'Hola {acudiente} ✅, {estudiante} ya subió a la {servicio}. {detalle}',
      noSalio: 'Hola {acudiente}, pasamos por el punto de {estudiante} y hoy no alcanzó a salir. {detalle}',
      llegada: 'Hola {acudiente} 🏫, {estudiante} ya llegó al colegio sin novedad. {detalle}',
      personalizado: 'Hola {acudiente}, {detalle}'
    },
    breve: {
      cerca: '{acudiente}, la ruta de {estudiante} ya está cerca por {barrio}. {minutos} min. {detalle}',
      retraso: '{acudiente}, retraso de {minutos} min para {estudiante}. {detalle}',
      subio: '{acudiente}, {estudiante} ya subió. {detalle}',
      noSalio: '{acudiente}, {estudiante} no salió al punto. {detalle}',
      llegada: '{acudiente}, {estudiante} llegó al colegio. {detalle}',
      personalizado: '{acudiente}, {detalle}'
    }
  };

  function text(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function capitalizar(mensaje) {
    const limpio = text(mensaje);
    if (!limpio) return '';
    const conMayuscula = limpio.charAt(0).toUpperCase() + limpio.slice(1);
    return /[.!?]$/.test(conMayuscula) ? conMayuscula : conMayuscula + '.';
  }

  function reemplazar(template, data) {
    return template.replace(/\{(\w+)\}/g, (_, key) => data[key] ?? '');
  }

  function detectarMinutos(extra, fallback = 4) {
    const found = String(extra || '').match(/(\d{1,3})/);
    return found ? Number(found[1]) : fallback;
  }

  function limpiarDetalle(detalle, tipo) {
    const base = text(detalle);
    if (!base) {
      if (tipo === 'cerca') return 'Por favor alistarlo y tener el celular atento.';
      if (tipo === 'retraso') return 'Gracias por la comprensión.';
      if (tipo === 'noSalio') return 'Si necesita apoyo, por favor responder este mensaje.';
      return '';
    }
    return base;
  }

  function buildMessage({ estudiante, tipo = 'cerca', tono = 'cercano', extra = '', config = {}, minutos = null }) {
    const grupo = plantillas[tono] || plantillas.cercano;
    const template = grupo[tipo] || grupo.personalizado;
    const finalMin = minutos ?? detectarMinutos(extra, 4);
    const payload = {
      acudiente: estudiante?.acudiente || 'familia',
      estudiante: estudiante?.nombre || 'el estudiante',
      barrio: estudiante?.barrio || 'su sector',
      servicio: config?.serviceName || 'ruta escolar',
      colegio: config?.schoolName || 'el colegio',
      minutos: finalMin,
      detalle: limpiarDetalle(extra || estudiante?.nota, tipo)
    };
    return capitalizar(reemplazar(template, payload).replace(/\s+/g, ' '));
  }

  function buildInteractive({ message, buttons = [] }) {
    const valid = buttons.filter(Boolean).slice(0, 3).map((title, index) => ({
      type: 'reply',
      reply: {
        id: `btn_${index + 1}`,
        title: String(title).slice(0, 20)
      }
    }));

    return {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: capitalizar(message) },
        action: { buttons: valid }
      }
    };
  }

  function buildTemplatePayload({ templateName, languageCode = 'es_CO', bodyParams = [] }) {
    return {
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: bodyParams.length ? [{
          type: 'body',
          parameters: bodyParams.map((value) => ({ type: 'text', text: String(value) }))
        }] : []
      }
    };
  }

  function assistantReply(question, ctx) {
    const q = String(question || '').toLowerCase();
    const current = ctx.current;

    if (q.includes('siguiente') || q.includes('quien')) {
      return current
        ? `Sigue ${current.nombre} en ${current.barrio}. El acudiente es ${current.acudiente} y el teléfono es ${current.telefono}.`
        : 'No hay estudiante activo. Inicia la ruta o cambia el filtro.';
    }

    if (q.includes('retraso')) {
      return buildMessage({ estudiante: current, tipo: 'retraso', tono: ctx.tone, extra: 'Vamos avanzando lo más rápido posible.', config: ctx.config, minutos: 8 });
    }

    if (q.includes('amable') || q.includes('mejor')) {
      return buildMessage({ estudiante: current, tipo: 'cerca', tono: 'cercano', extra: 'Gracias por estar atentos y tenerlo listo en el punto.', config: ctx.config, minutos: 3 });
    }

    return 'Puedo mejorar mensajes, hacerlos más cortos, más formales o más cercanos, y también preparar textos para ruta cerca, retraso, subió, no salió o llegada.';
  }

  return { buildMessage, buildInteractive, buildTemplatePayload, assistantReply };
})();
