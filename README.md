# EduNeeds IA 🧩
## Programaciones adaptadas con Inteligencia Artificial y currículo oficial

---

## ¿Qué es esto?

Aplicación web para docentes que genera en segundos programaciones, actividades, adaptaciones curriculares y recursos para alumnos con NEE, usando IA y opcionalmente el currículo oficial de cada comunidad autónoma.

---

## ARQUITECTURA

```
Docente selecciona opciones
        ↓
Frontend (React + Vite)
        ↓
Backend (Vercel Edge Function)
        ↓
  ┌─────────────────────┐
  │ ¿Hay decretos       │
  │ en Supabase?        │
  └──────┬──────────────┘
      SÍ │               NO
         ↓               ↓
  Busca fragmentos   Usa conocimiento
  del currículo      general de la IA
  oficial            (LOMLOE + normativa)
         │               │
         └───────┬───────┘
                 ↓
         Claude genera la
         programación adaptada
```

---

## PASO 1 — Infraestructura básica (sin currículo oficial)

### Necesitas:
- Cuenta en **GitHub** (gratis) → https://github.com
- Cuenta en **Vercel** (gratis) → https://vercel.com
- Cuenta en **Anthropic** (pago por uso) → https://console.anthropic.com

### Instrucciones:
1. Sube esta carpeta a un repositorio de GitHub
2. En https://console.anthropic.com → "API Keys" → crea una clave
3. En Vercel → "Add New Project" → selecciona el repositorio
4. Antes de hacer Deploy, añade la variable de entorno:
   - `ANTHROPIC_API_KEY` = tu clave de Anthropic
5. Deploy → en 2 minutos tienes la URL pública

**Coste estimado:** ~0,003€ por generación

---

## PASO 2 — Añadir currículo oficial (opcional pero recomendado)

### Necesitas además:
- Cuenta en **Supabase** (gratis hasta 500MB) → https://supabase.com
- PDFs de los decretos curriculares de cada comunidad

### 2a. Crear la base de datos en Supabase

1. Ve a https://supabase.com → crea un proyecto
2. En el panel, ve a "SQL Editor" → "New Query"
3. Copia y pega el contenido del archivo `scripts/supabase-setup.sql`
4. Ejecuta el SQL
5. Ve a "Project Settings" → "API" y copia:
   - **Project URL** → será tu `SUPABASE_URL`
   - **service_role key** → será tu `SUPABASE_SERVICE_KEY`

### 2b. Descargar los decretos oficiales

Descarga los PDFs de los boletines oficiales de cada comunidad:

| Comunidad | Dónde descargar |
|-----------|----------------|
| Andalucía | https://www.juntadeandalucia.es/boja |
| Madrid | https://www.bocm.es |
| Cataluña | https://dogc.gencat.cat |
| Valencia | https://dogv.gva.es |
| País Vasco | https://www.legegunea.euskadi.eus |
| Galicia | https://www.xunta.gal/dog |
| Castilla y León | https://bocyl.jcyl.es |
| Aragón | https://boe.es (busca "currículo Aragón LOMLOE") |
| Resto | Busca "[comunidad] currículo LOMLOE decreto" en el BOE |

Guarda los PDFs en la carpeta `scripts/decretos/` con nombres descriptivos.

### 2c. Cargar los PDFs en Supabase

```bash
# Instalar dependencias del script
npm install @supabase/supabase-js pdf-parse dotenv

# Crear archivo .env.local con tus credenciales
echo "SUPABASE_URL=https://xxxx.supabase.co" >> .env.local
echo "SUPABASE_SERVICE_KEY=tu-service-key" >> .env.local

# Editar scripts/cargar-curriculo.js para añadir tus PDFs
# (está muy comentado, es fácil)

# Ejecutar la carga
node scripts/cargar-curriculo.js
```

### 2d. Añadir variables en Vercel

En tu proyecto de Vercel → Settings → Environment Variables, añade:
- `SUPABASE_URL` = URL de tu proyecto Supabase
- `SUPABASE_SERVICE_KEY` = service_role key de Supabase

Redespliega el proyecto. A partir de ahora, cuando un docente seleccione una comunidad, la IA buscará automáticamente los fragmentos relevantes del decreto oficial.

---

## ESTRUCTURA DEL PROYECTO

```
eduneeds/
├── api/
│   └── generar.js              ← Backend: búsqueda + llamada a Claude
├── src/
│   ├── App.jsx                 ← Interfaz (selector de CCAA incluido)
│   ├── App.css                 ← Diseño visual
│   └── main.jsx                ← Entrada React
├── scripts/
│   ├── supabase-setup.sql      ← SQL para crear tablas y función de búsqueda
│   ├── cargar-curriculo.js     ← Script para cargar PDFs
│   └── decretos/               ← Carpeta donde pones los PDFs
├── public/
│   └── index.html
├── package.json
├── vite.config.js
└── vercel.json
```

---

## COSTES ESTIMADOS (mensuales)

| Servicio | Uso bajo (100 gen.) | Uso medio (1.000 gen.) | Uso alto (10.000 gen.) |
|----------|--------------------|-----------------------|-----------------------|
| Anthropic (IA) | ~0,30€ | ~3€ | ~30€ |
| Vercel (hosting) | Gratis | Gratis | Gratis |
| Supabase (BD) | Gratis | Gratis | Gratis |
| **Total** | **~0,30€** | **~3€** | **~30€** |

---

## MODELO DE NEGOCIO PARA EDITORIALES

- **Licencia por centro:** acceso ilimitado para todos los docentes del centro
- **SaaS por docente:** suscripción mensual individual
- **White-label:** la editorial pone su marca, tú pones la tecnología
- **API para plataformas existentes:** integración en plataformas educativas ya existentes

El código es fácilmente adaptable a cualquier sistema de autenticación (OAuth, SSO de editorial, etc.)

