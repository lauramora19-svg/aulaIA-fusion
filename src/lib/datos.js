// Datos compartidos entre el generador y el módulo CRM
export const COMUNIDADES = [
  "Andalucía","Aragón","Asturias","Baleares","Canarias","Cantabria",
  "Castilla-La Mancha","Castilla y León","Cataluña","Com. Valenciana",
  "Extremadura","Galicia","La Rioja","Madrid","Murcia","Navarra",
  "País Vasco","Ceuta","Melilla",
];
export const ETAPAS = [
  { id:"infantil", label:"Infantil",      emoji:"🌱", rango:"3-6 años" },
  { id:"primaria", label:"Primaria",      emoji:"📚", rango:"6-12 años" },
  { id:"eso",      label:"ESO",           emoji:"🎒", rango:"12-16 años" },
  { id:"bach",     label:"Bachillerato",  emoji:"🎓", rango:"16-18 años" },
  { id:"fp",       label:"FP",            emoji:"🔧", rango:"Formación Profesional" },
];
export const CURSOS = {
  infantil:["1º Infantil","2º Infantil","3º Infantil"],
  primaria:["1º Primaria","2º Primaria","3º Primaria","4º Primaria","5º Primaria","6º Primaria"],
  eso:["1º ESO","2º ESO","3º ESO","4º ESO"],
  bach:["1º Bachillerato","2º Bachillerato"],
  fp:["Grado Básico","Grado Medio","Grado Superior"],
};
export const AREAS = {
  infantil:["Comunicación y representación","Conocimiento del entorno","Identidad y autonomía personal","Religión"],
  primaria:["Lengua y Literatura","Matemáticas","Ciencias Naturales","Ciencias Sociales","Inglés","Educación Física","Música","Plástica","Religión","Tutoría / Habilidades sociales","Autonomía personal"],
  eso:[],  // se rellena abajo con todas las de ASIGNATURAS_CURSO (orden alfabético)
  bach:[],
  fp:["Módulo profesional","Formación en centros de trabajo","Proyecto integrado"],
};
// Asignaturas de cada curso de ESO y Bachillerato (Comunidad de Madrid:
// Decreto 65/2022 ESO, Decreto 64/2022 Bachillerato y Orden 1736/2023 de optativas).
// Al elegir el curso solo aparecen las de ese curso, en orden alfabético.
const ordenar = (l) => [...new Set(l)].sort((a, b) => a.localeCompare(b, "es"));
const ESO_TODOS = ["Educación Física","Francés","Geografía e Historia","Inglés","Lengua Castellana y Literatura","Religión","Tutoría","Deporte","Ámbito Científico-Tecnológico"];
const BACH_TODOS = ["Francés","Inglés","Religión","Tutoría","Anatomía y Fisiología Humanas"];
export const ASIGNATURAS_CURSO = {
  "1º ESO": ordenar([...ESO_TODOS,"Matemáticas","Biología y Geología","Educación Plástica, Visual y Audiovisual","Música","Ciencias de la Computación","Ámbito Sociolingüístico"]),
  "2º ESO": ordenar([...ESO_TODOS,"Matemáticas","Educación en Valores Cívicos y Éticos","Educación Plástica, Visual y Audiovisual","Física y Química","Tecnología y Digitalización","Ciencias de la Computación","Ámbito Sociolingüístico"]),
  "3º ESO": ordenar([...ESO_TODOS,"Matemáticas","Biología y Geología","Física y Química","Música","Tecnología y Digitalización","Cultura Clásica","Proyecto","Ámbito Lingüístico y Social"]),
  "4º ESO": ordenar([...ESO_TODOS,"Matemáticas A","Matemáticas B","Biología y Geología","Física y Química","Digitalización","Tecnología","Economía y Emprendimiento","Formación y Orientación Personal y Profesional","Latín","Música","Filosofía","Cultura Clásica","Proyecto","Ámbito Lingüístico y Social"]),
  "1º Bachillerato": ordenar([...BACH_TODOS,"Educación Física","Filosofía","Lengua Castellana y Literatura I","Matemáticas I","Matemáticas Aplicadas a las Ciencias Sociales I","Física y Química","Biología, Geología y Ciencias Ambientales","Dibujo Técnico I","Tecnología e Ingeniería I","Economía","Historia del Mundo Contemporáneo","Latín I","Ciencias de la Computación"]),
  "2º Bachillerato": ordenar([...BACH_TODOS,"Historia de España","Historia de la Filosofía","Lengua Castellana y Literatura II","Matemáticas II","Matemáticas Aplicadas a las Ciencias Sociales II","Física","Química","Biología","Geología y Ciencias Ambientales","Dibujo Técnico II","Tecnología e Ingeniería II","Geografía","Empresa y Diseño de Modelos de Negocio","Latín II"]),
};
AREAS.eso = ordenar(CURSOS.eso.flatMap(c => ASIGNATURAS_CURSO[c]));
AREAS.bach = ordenar(CURSOS.bach.flatMap(c => ASIGNATURAS_CURSO[c]));
// Lista para un curso concreto; si no hay curso, todas las de la etapa
export const asignaturasDe = (etapa, curso) => ASIGNATURAS_CURSO[curso] || AREAS[etapa] || [];

export const NECESIDADES = [
  { id:"tea",         label:"TEA",               emoji:"🧩", desc:"Trastorno del Espectro Autista" },
  { id:"tdah",        label:"TDAH",              emoji:"⚡", desc:"Déficit de Atención e Hiperactividad" },
  { id:"tda",         label:"TDA",               emoji:"🎯", desc:"Déficit de Atención sin hiperactividad" },
  { id:"dislexia",    label:"Dislexia",           emoji:"📖", desc:"Dificultades en lectoescritura" },
  { id:"discalculia", label:"Discalculia",        emoji:"🔢", desc:"Dificultades en el cálculo y numeración" },
  { id:"tdl",         label:"TDL",               emoji:"💬", desc:"Trastorno del Desarrollo del Lenguaje" },
  { id:"di",          label:"Disc. Intelectual",  emoji:"🌱", desc:"Discapacidad intelectual" },
  { id:"dm",          label:"Disc. Motora",       emoji:"♿", desc:"Discapacidad motora o física" },
  { id:"down",        label:"Síndrome de Down",   emoji:"🌟", desc:"Trisomía 21" },
  { id:"altas",       label:"Altas Capacidades",  emoji:"🚀", desc:"Superdotación y talento" },
  { id:"tgd",         label:"TGD",               emoji:"🔄", desc:"Trastorno generalizado del desarrollo" },
  { id:"visual",      label:"Disc. Visual",       emoji:"👁", desc:"Baja visión o ceguera" },
  { id:"auditiva",    label:"Disc. Auditiva",     emoji:"👂", desc:"Hipoacusia o sordera" },
];
