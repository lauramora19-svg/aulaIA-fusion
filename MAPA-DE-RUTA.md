# 🗺️ AulaIA — Mapa de Ruta

---

## LO QUE HACES TÚ

### 🔧 Infraestructura (una sola vez)
- [ ] Crear cuenta en **GitHub** → https://github.com
- [ ] Crear repositorio `aulaIA` en GitHub (privado)
- [ ] Subir los archivos del ZIP a ese repositorio
- [ ] Crear cuenta en **Vercel** → https://vercel.com
- [ ] Conectar Vercel con el repositorio de GitHub
- [ ] Crear cuenta en **Anthropic** → https://console.anthropic.com
- [ ] Obtener API key de Anthropic y añadirla en Vercel
- [ ] Crear cuenta en **Supabase** → https://supabase.com
- [ ] Ejecutar el archivo `scripts/supabase-setup.sql` en Supabase
- [ ] Añadir las variables de Supabase en Vercel
- [ ] (Opcional) Conectar tu dominio de Hostinger a Vercel

### 📄 Decretos curriculares (cuando quieras activar currículo oficial)
- [ ] Descargar PDFs de los decretos de cada comunidad autónoma
- [ ] Guardarlos en la carpeta `scripts/decretos/`
- [ ] Configurar `scripts/cargar-curriculo.js` con los PDFs
- [ ] Ejecutar el script de carga

### 🚀 Lanzamiento
- [ ] Probar la app con docentes reales (fase beta)
- [ ] Recoger feedback y compartirlo
- [ ] Presentar a editoriales

---

## LO QUE HACE CLAUDE (yo)

### ✅ Ya hecho
- [x] Diseño y código del frontend completo (4 pasos, botones, sin formularios)
- [x] Tres modos: Solo NEE / Ordinario / Mixto-Inclusivo
- [x] Campo de contexto opcional del docente
- [x] Menú ampliado: Situaciones de aprendizaje, DUA, ACI, PTI, Rúbricas, Familias...
- [x] Selector de comunidad autónoma (19 comunidades)
- [x] Backend seguro con llamada a la API de Claude (streaming)
- [x] Prompts diferenciados por modo con lógica pedagógica
- [x] Sistema de usuarios anónimos (solo email, cumple RGPD)
- [x] Biblioteca personal por docente
- [x] Sistema de compartir con enlace
- [x] Integración con Supabase (base de datos + auth)
- [x] Script de carga de decretos curriculares en PDF
- [x] SQL completo para crear todas las tablas
- [x] Guía de decretos por comunidad autónoma
- [x] README con instrucciones paso a paso

### 🔄 Próximas mejoras (Fase 2)
- [ ] Exportar a Word (.docx) directamente desde la app
- [ ] Exportar a PDF
- [ ] Historial con búsqueda avanzada
- [ ] Colaboración entre docentes del mismo centro
- [ ] Banco de actividades reutilizables
- [ ] Panel de administración para editoriales

---

## ARQUITECTURA DEL PRODUCTO

```
Docente (navegador)
      ↓
  AulaIA (Vercel)
      ↓
  ┌───────────────────────────┐
  │ ¿Hay decretos en          │
  │ Supabase para esa CCAA?   │
  └──────┬────────────────────┘
      SÍ │              NO
         ↓              ↓
   Busca fragmentos  Usa conocimiento
   del decreto       general LOMLOE
   oficial           + normativa CCAA
         │              │
         └──────┬────────┘
                ↓
         Claude genera el
         documento adaptado
                ↓
         Se guarda en la
         biblioteca del docente
```

---

## COSTES ESTIMADOS

| Servicio | Coste |
|----------|-------|
| Vercel (hosting) | Gratis |
| Supabase (base de datos) | Gratis hasta 500MB |
| Anthropic (IA) | ~0,003€ por generación |
| Dominio propio | ~10-15€/año |

**Ejemplo:** 1.000 generaciones al mes = ~3€ en IA

---

## MODELO DE NEGOCIO PARA EDITORIALES

| Modelo | Descripción |
|--------|-------------|
| Licencia por centro | Acceso ilimitado para todos los docentes del centro |
| SaaS por docente | Suscripción mensual individual |
| White-label | La editorial pone su marca, tú pones la tecnología |
| API para plataformas | Integración en plataformas educativas existentes |

---

*Última actualización: Mayo 2026*
