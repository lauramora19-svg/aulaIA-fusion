/* ==========================================================================
   AulaAI - Date Engine (Generación automática de 52 Semanas y Fechas)
   ========================================================================== */

class DateEngine {
  constructor() {
    this.startDate = new Date(window.store.state.startDate);
  }

  // Set new course start date (First Monday of academic year)
  setCourseStartDate(dateStr) {
    window.store.state.startDate = dateStr;
    window.store.saveState();
    this.startDate = new Date(dateStr);
  }

  // Get start and end Date objects for a given week index (0-51)
  getWeekRange(weekIndex) {
    const monday = new Date(this.startDate);
    monday.setDate(monday.getDate() + (weekIndex * 7));

    const friday = new Date(monday);
    friday.setDate(friday.getDate() + 4);

    return { monday, friday };
  }

  // Formatted date string for week display (e.g. "7 Sep - 11 Sep 2026")
  getWeekFormattedString(weekIndex) {
    const { monday, friday } = this.getWeekRange(weekIndex);
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    
    const mDay = monday.getDate();
    const mMonth = months[monday.getMonth()];
    const fDay = friday.getDate();
    const fMonth = months[friday.getMonth()];
    const year = friday.getFullYear();

    if (mMonth === fMonth) {
      return `${mDay} - ${fDay} ${mMonth} ${year}`;
    }
    return `${mDay} ${mMonth} - ${fDay} ${fMonth} ${year}`;
  }

  // Determine Trimester tag based on week index
  getTrimester(weekIndex) {
    if (weekIndex <= 14) return '1º Trimestre';
    if (weekIndex <= 28) return '2º Trimestre';
    return '3º Trimestre';
  }

  // Get specific date for each day of the current selected week
  getDayDates(weekIndex) {
    const { monday } = this.getWeekRange(weekIndex);
    const dayDates = {};

    window.DAYS.forEach((day, index) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + index);
      dayDates[day.id] = `${d.getDate()}/${d.getMonth() + 1}`;
    });

    return dayDates;
  }

  // Día de la semana de HOY (LUN..VIE), o null si es fin de semana
  getTodayDayId() {
    const jsDay = new Date().getDay(); // 0 domingo .. 6 sábado
    const map = { 1: 'LUN', 2: 'MAR', 3: 'MIE', 4: 'JUE', 5: 'VIE' };
    return map[jsDay] || null;
  }

  // A qué semana del curso (0-51) corresponde la fecha de HOY,
  // independientemente de la semana que se esté visualizando en el planner
  getRealCurrentWeekIndex() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(this.startDate);
    start.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today - start) / (1000 * 60 * 60 * 24));
    const idx = Math.floor(diffDays / 7);
    return Math.max(0, Math.min(51, idx));
  }
  // A qué semana del curso corresponde una fecha CUALQUIERA (no solo hoy)
  getWeekIndexForDate(dateStr) {
    const target = new Date(dateStr + "T00:00:00");
    target.setHours(0, 0, 0, 0);
    const start = new Date(this.startDate);
    start.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target - start) / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7);
  }

  // Día de la semana (LUN..VIE) de una fecha cualquiera, o null si es fin de semana
  getDayIdForDate(dateStr) {
    const jsDay = new Date(dateStr + "T00:00:00").getDay();
    const map = { 1: "LUN", 2: "MAR", 3: "MIE", 4: "JUE", 5: "VIE" };
    return map[jsDay] || null;
  }
}

window.dateEngine = new DateEngine();
