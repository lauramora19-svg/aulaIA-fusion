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
  eso:["Lengua y Literatura","Matemáticas","Física y Química","Biología y Geología","Geografía e Historia","Inglés","Educación Física","Música","Tecnología","Religión","Valores Cívicos","Tutoría"],
  bach:["Lengua y Literatura","Matemáticas","Historia","Filosofía","Inglés","Física","Química","Biología","Economía","Arte","Religión"],
  fp:["Módulo profesional","Formación en centros de trabajo","Proyecto integrado"],
};
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
