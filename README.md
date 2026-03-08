# Ruta Escolar Montenegro - versión móvil

Proyecto web estático listo para GitHub Pages y pensado para abrir en celular.

## Incluye
- Panel móvil simplificado.
- 4 rutas: Bachillerato, Primaria, Transición y Especial.
- 51 barrios de Montenegro cargados en JSON.
- GPS del navegador.
- Cálculo de cercanía por metros.
- Mensajes personalizados con IA local.
- Soporte para WhatsApp normal, backend automático y payload interactivo / plantilla.
- Worker para Cloudflare.

## Publicar en GitHub Pages
1. Sube todos los archivos de esta carpeta a tu repositorio.
2. En GitHub ve a Settings > Pages.
3. Elige Deploy from a branch.
4. Selecciona la rama `main` y la carpeta `/root`.
5. Mantén el archivo `.nojekyll`.

## Modo de envío
### Demo
No envía nada. Solo registra el evento.

### Abrir WhatsApp
Abre WhatsApp con el texto listo.

### Backend
Envía directo a WhatsApp Cloud API usando `backend/cloudflare-worker.js`.

## Desplegar el Worker
1. Crea un Worker en Cloudflare.
2. Copia el código de `backend/cloudflare-worker.js`.
3. Configura estos secretos:
   - `WHATSAPP_TOKEN`
   - `PHONE_NUMBER_ID`
   - `PUBLIC_API_KEY`
4. Publica el Worker.
5. En la web pega la URL final en Config > URL backend.
6. En Clave pública usa el mismo valor de `PUBLIC_API_KEY`.

## Endpoints del Worker
- `GET /health` → prueba de salud
- `POST /send` → envío de mensajes

## Nota importante
Para iniciar conversaciones fuera de la ventana de atención de 24 horas normalmente debes usar plantillas aprobadas en WhatsApp Business / Cloud API.
