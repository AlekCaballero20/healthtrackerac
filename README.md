# Health Tracker AC · Glow Up

Nueva versión de la app de seguimiento de bienestar para Alek y Cata.

## Qué trae esta versión

- Registro rápido diario tipo check-in.
- Dashboard con métricas, alertas y últimos movimientos.
- Seguimiento por perfil: Alek, Cata o vista compartida.
- Síntomas, mapa corporal, citas, controles, tratamientos y notas.
- Edición de cualquier registro (no solo crear/borrar) reutilizando el diálogo.
- Tratamientos con frecuencia/horarios, registro de tomas (adherencia) y alertas de fin.
- Adjuntar exámenes y fórmulas (imagen/PDF) a citas, controles y tratamientos.
- Gráficas de evolución de energía, dolor y sueño en Seguimiento.
- Historial unificado con búsqueda y filtro por tipo.
- Exportación e importación de backup JSON.
- Modo demo local usando `?demo=1`.
- Firebase Auth + Firestore + Storage usando la configuración del proyecto `health-tracker-ac`.

## Cómo probar localmente

Abre la carpeta con VS Code y usa Live Server, o levanta un servidor simple:

```bash
python -m http.server 5500
```

Luego entra a:

```txt
http://localhost:5500
```

Para probar sin Firebase:

```txt
http://localhost:5500?demo=1
```

## Archivos principales

```txt
index.html
css/styles.css
js/app.js        # controlador: arranque, eventos, acciones, render
js/config.js     # constantes, catálogos y config de Firebase
js/firebase.js   # capa de datos: auth, Firestore, Storage y modo demo
js/utils.js      # helpers puros (fechas, DOM, formato, toasts)
js/state.js      # estado global y datos derivados por perfil
js/domain.js     # lógica de salud: alertas, resúmenes, historial, series
js/records.js    # tipos de registro y formularios "schema-driven"
js/views.js      # render de cada vista
firebase.json
firestore.rules
storage.rules
```

## Firebase

La app usa estos servicios:

- Firebase Authentication con Google.
- Cloud Firestore.
- Firebase Storage (adjuntos de exámenes/fórmulas).
- Firebase Hosting, si quieres desplegarla desde Firebase.

Colecciones usadas:

```txt
profiles
dailyLogs
bodyStatusEntries
symptoms
appointments
checkups
treatments
notes
```

## Correos autorizados

Están en `js/config.js`:

```js
allowedEmails: [
  "alekcaballeromusic@gmail.com",
  "catalina.medina.leal@gmail.com"
]
```

## Despliegue en Firebase Hosting

Instala Firebase CLI si no lo tienes:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

Si ya tienes el proyecto conectado, puedes usar:

```bash
firebase deploy --only hosting
```

## Reglas de seguridad

- `firestore.rules`: restringe lectura y escritura a los correos autorizados.
- `storage.rules`: limita los adjuntos a los mismos correos, máximo 15 MB y solo imágenes o PDF.

Despliega ambas con:

```bash
firebase deploy --only firestore:rules,storage
```

Ajusta los correos si cambia la cuenta de Cata o si quieren agregar más usuarios (en `js/config.js`, `firestore.rules` y `storage.rules`).

## Nota importante

Esta app organiza información personal de salud. No diagnostica, no reemplaza criterio médico y no toma decisiones clínicas. Sirve para registrar patrones, preparar citas y entender mejor lo que va pasando, que ya es bastante frente al caos humano promedio.
