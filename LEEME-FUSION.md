# AulaIA fusionada (AulaIA + Agenda docente)

Versión nueva y aparte. **Tus dos apps actuales no se tocan** y siguen funcionando igual.

## Qué hay dentro
- La **Agenda** va dentro de AulaIA (`public/agenda`), con su mismo código: pipeline, arrastrar sesiones, plano de aula, listados, mensajes, sustitución… Solo se ha quitado su login propio (usa tu cuenta de AulaIA) y su menú lateral (usa el de AulaIA).
- **Mi Agenda: datos y copias** (menú lateral): copia tus datos de la Agenda antigua a AulaIA. Allí no se borra ni cambia nada.
- **Equipo docente IA**: Coordinadora, Arturo, Eva y Carmen (de tu AgenteDocente, sin datos personales). Solo la administradora (tú) los añade o edita.
- **Mi perfil docente**: nombre, centro, comunidad, etapa y áreas de cada cuenta.
- El **constructor** se apoya en el especialista de cada tipo (Arturo, Eva, Carmen). Mismos botones de siempre.

## Puesta en marcha
1. Supabase (proyecto de AulaIA) → SQL Editor → pega `scripts/supabase-fusion-v4.sql` → Run.
2. GitHub → repositorio nuevo `aulaia-fusion` → sube el contenido de esta carpeta (sin `_copia-fuentes-originales.tgz`).
3. Vercel → Add New → Project → importa `aulaia-fusion` → copia las mismas variables de entorno que tiene el proyecto de AulaIA → Deploy.
