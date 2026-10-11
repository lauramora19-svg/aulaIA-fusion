/* ==========================================================================
   AulaAI - Clases Engine (Mis Clases, Plano de Aula / Asientos & Conducta)
   ========================================================================== */

class ClasesEngine {
  constructor() {
    this.draggedSeatId = null;
  }

  // Alumnado que pertenece a una clase, por coincidencia del campo "Grupo"
  studentsForClass(cls) {
    if (!cls) return [];
    return (window.store.state.students || []).filter(s => s.group === cls.groupLabel);
  }

  // Se asegura de que exista un registro de asientos para la clase, y lo
  // sincroniza con el alumnado real: añade pupitres para alumnos nuevos sin
  // asiento, y no borra asignaciones ya hechas.
  ensureSeating(classId, roster) {
    const seatingByClass = window.store.state.seatingByClass;
    if (!seatingByClass[classId]) {
      seatingByClass[classId] = { layout: 'individual', seats: [] };
    }
    const record = seatingByClass[classId];

    const assignedIds = new Set(record.seats.map(s => s.studentId).filter(Boolean));
    // Quita asientos de alumnos que ya no existen en el roster
    record.seats = record.seats.filter(s => !s.studentId || roster.some(r => r.id === s.studentId));
    // Añade un asiento vacío por cada alumno del roster que todavía no tiene pupitre
    roster.forEach(student => {
      if (!assignedIds.has(student.id)) {
        record.seats.push({ id: `seat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, studentId: student.id });
      }
    });
    return record;
  }

  renderClasesView() {
    const container = document.getElementById('clases-view-container');
    if (!container) return;

    const classes = window.store.state.classes || [];
    const selectedClassId = window.store.state.selectedClassId || (classes[0] ? classes[0].id : null);
    if (window.store.state.selectedClassId !== selectedClassId) {
      window.store.state.selectedClassId = selectedClassId;
      window.store.saveState();
    }
    const activeClass = classes.find(c => c.id === selectedClassId) || null;
    const roster = this.studentsForClass(activeClass);
    const seatingRecord = activeClass ? this.ensureSeating(activeClass.id, roster) : null;

    container.innerHTML = `
      <!-- TOP: TARJETAS DE MIS CLASES / GRUPOS -->
      <div style="margin-bottom: 1.5rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.85rem;">
          <h3 style="font-family: var(--font-display); font-size: 1.25rem; color: var(--text-primary);">
            <i class="fa-solid fa-chalkboard" style="color: var(--accent-primary);"></i> Mis Clases y Grupos
          </h3>
          <button class="btn btn-secondary" onclick="window.clasesEngine.openEditClassModal('')">
            <i class="fa-solid fa-plus"></i> Añadir Clase
          </button>
        </div>

        ${classes.length === 0 ? `
          <div style="border: 1px dashed var(--border-color); border-radius: var(--radius-lg); padding: 2rem; text-align: center; color: var(--text-muted);">
            Todavía no has creado ninguna clase o grupo. Pulsa "Añadir Clase" para crear el primero.
          </div>
        ` : `
          <div class="classes-cards-grid">
            ${classes.map(cls => `
              <div class="class-group-card ${cls.id === selectedClassId ? 'active-group' : ''}" onclick="window.clasesEngine.selectGroup('${cls.id}')">
                <div style="display: flex; align-items: flex-start; justify-content: space-between;">
                  <div style="font-family: var(--font-display); font-weight: 700; font-size: 1.15rem; color: var(--text-primary);">
                    ${cls.groupLabel}
                  </div>
                  <div style="display: flex; gap: 6px;">
                    <button onclick="event.stopPropagation(); window.clasesEngine.openEditClassModal('${cls.id}')" style="border:none;background:none;color:var(--text-muted);cursor:pointer;" title="Editar clase">
                      <i class="fa-solid fa-pen" style="font-size: 0.75rem;"></i>
                    </button>
                    <button onclick="event.stopPropagation(); window.clasesEngine.deleteClass('${cls.id}')" style="border:none;background:none;color:var(--text-muted);cursor:pointer;" title="Eliminar clase">
                      <i class="fa-solid fa-xmark" style="font-size: 0.85rem;"></i>
                    </button>
                  </div>
                </div>
                <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-top: 2px;">
                  ${cls.subject}
                </div>
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 6px;">
                  <i class="fa-solid fa-users"></i> ${this.studentsForClass(cls).length} alumnos
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      ${!activeClass ? '' : `
      <!-- MAIN DUAL SECTION: PLANO DE AULA (ASIENTOS) & TABLA DE ALUMNADO CON CONDUCTA -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;" class="clases-main-grid">

        <!-- PLANO DE AULA INTERACTIVO (MAPA DE ASIENTOS) -->
        <div style="background: var(--bg-secondary); border-radius: var(--radius-lg); border: 1px solid var(--border-color); padding: 1.5rem; box-shadow: var(--shadow-sm);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
            <h4 style="font-family: var(--font-display); font-size: 1.15rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
              <i class="fa-solid fa-vector-square" style="color: var(--accent-primary);"></i> Plano de Aula ${activeClass.groupLabel}
            </h4>
            <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">Clic: asignar · Arrastra: cambiar de sitio</span>
          </div>

          <!-- SELECTOR DE AGRUPAMIENTO -->
          <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1rem;">
            ${Object.entries(window.SEATING_LAYOUTS).map(([key, def]) => `
              <button onclick="window.clasesEngine.setLayout('${activeClass.id}', '${key}')"
                style="font-size: 0.75rem; font-weight: 600; padding: 5px 10px; border-radius: var(--radius-full); cursor: pointer;
                       border: 1px solid ${seatingRecord.layout === key ? 'var(--accent-primary)' : 'var(--border-color)'};
                       background: ${seatingRecord.layout === key ? 'var(--accent-light)' : 'transparent'};
                       color: ${seatingRecord.layout === key ? 'var(--accent-primary)' : 'var(--text-secondary)'};">
                ${def.label}
              </button>
            `).join('')}
          </div>

          <!-- BLACKBOARD / PIZARRA HEADER -->
          <div class="blackboard-header">
            <i class="fa-solid fa-chalkboard-user"></i> PIZARRA DEL AULA
          </div>

          <!-- DESKS GRID (LAYOUT DE ASIENTOS DE ALUMNOS) -->
          ${seatingRecord.seats.length === 0 ? `
            <div style="border: 1px dashed var(--border-color); border-radius: var(--radius-md); padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
              Este grupo todavía no tiene alumnado asignado. Añade alumnos desde "Alumnado &amp; NEAE" con el Grupo "${activeClass.groupLabel}" y aparecerán aquí para colocarlos.
            </div>
          ` : this.renderSeatingGroups(seatingRecord)}
        </div>

        <!-- LISTA DE ALUMNADO Y CONDUCTA -->
        <div style="background: var(--bg-secondary); border-radius: var(--radius-lg); border: 1px solid var(--border-color); padding: 1.5rem; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
              <h4 style="font-family: var(--font-display); font-size: 1.15rem; color: var(--text-primary);">
                Lista ${activeClass.groupLabel}
              </h4>
            </div>

            ${roster.length === 0 ? `
              <div style="border: 1px dashed var(--border-color); border-radius: var(--radius-md); padding: 1.25rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
                Sin alumnado en este grupo todavía.
              </div>
            ` : `
            <table style="width: 100%; font-size: 0.85rem; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted); text-align: left;">
                  <th style="padding: 6px 0;">Nº</th>
                  <th style="padding: 6px 0;">Nombre</th>
                  <th style="padding: 6px 0;">NEAE</th>
                  <th style="padding: 6px 0;">Cumpleaños</th>
                  <th style="padding: 6px 0;">Conducta</th>
                </tr>
              </thead>
              <tbody>
                ${roster.map((s, idx) => `
                  <tr style="border-bottom: 1px dashed var(--border-color); cursor: pointer;" onclick="window.clasesEngine.openStudentDetailModal('${s.id}')">
                    <td style="padding: 8px 0; font-weight: 700; color: var(--text-muted);">${idx + 1}</td>
                    <td style="padding: 8px 0; font-weight: 600; color: var(--text-primary);">${s.name}</td>
                    <td style="padding: 8px 0;">${s.neae ? `<span class="neae-badge" style="font-size: 0.68rem;">NEAE</span>` : '—'}</td>
                    <td style="padding: 8px 0; color: var(--text-secondary);">${s.birthday ? window.alumnoEngine.formatBirthday(s.birthday) : '—'}</td>
                    <td style="padding: 8px 0;">
                      <span class="behavior-pill behavior-${(s.behavior || 'Sin registrar').toLowerCase().replace(' ', '-')}">
                        ${s.behavior || 'Sin registrar'}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            `}
          </div>

          <!-- WIDGETS INFERIORES: CUMPLEAÑOS Y NOTAS DE CONDUCTA -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">

            <!-- CUMPLEAÑOS -->
            <div style="background: var(--bg-tertiary); padding: 0.85rem; border-radius: var(--radius-md);">
              <div style="font-weight: 700; font-size: 0.82rem; color: var(--text-primary); margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.3rem;">
                <i class="fa-solid fa-cake-candles" style="color: var(--accent-primary);"></i> Próximos Cumpleaños
              </div>
              <div style="font-size: 0.78rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 2px;">
                ${(() => {
                  const thisMonth = window.alumnoEngine.getBirthdaysThisMonth(roster);
                  if (thisMonth.length === 0) return '<span style="color: var(--text-muted);">Sin cumpleaños este mes.</span>';
                  return thisMonth.map(s => `<div>🎂 <strong>${s.name.split(' ')[0]}:</strong> ${window.alumnoEngine.formatBirthday(s.birthday)}</div>`).join('');
                })()}
              </div>
            </div>

            <!-- ESCALA DE CONDUCTA -->
            <div style="background: var(--bg-tertiary); padding: 0.85rem; border-radius: var(--radius-md);">
              <div style="font-weight: 700; font-size: 0.82rem; color: var(--text-primary); margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.3rem;">
                <i class="fa-solid fa-face-smile" style="color: #10b981;"></i> Escala de Conducta
              </div>
              <div style="display: flex; flex-wrap: wrap; gap: 4px; font-size: 0.7rem;">
                <span class="behavior-pill behavior-excelente">Excelente</span>
                <span class="behavior-pill behavior-bueno">Bueno</span>
                <span class="behavior-pill behavior-correcta">Correcta</span>
                <span class="behavior-pill behavior-a-mejorar">A mejorar</span>
              </div>
            </div>

          </div>
        </div>

      </div>
      `}
    `;

    this.setupSeatDragAndDrop();
  }

  // Agrupa visualmente los pupitres en bloques según el agrupamiento elegido
  renderSeatingGroups(seatingRecord) {
    const layoutDef = window.SEATING_LAYOUTS[seatingRecord.layout] || window.SEATING_LAYOUTS.individual;
    const groupSize = layoutDef.size;
    const students = window.store.state.students || [];
    const seats = seatingRecord.seats;

    let html = '<div style="display: flex; flex-wrap: wrap; gap: 1rem;">';
    for (let i = 0; i < seats.length; i += groupSize) {
      const groupSeats = seats.slice(i, i + groupSize);
      html += `<div style="display: grid; grid-template-columns: repeat(${Math.min(groupSize, 3)}, 1fr); gap: 8px; padding: 8px; border: 1px dashed var(--border-color); border-radius: var(--radius-md);">`;
      groupSeats.forEach(seat => {
        const student = students.find(s => s.id === seat.studentId);
        html += `
          <div class="seat-desk-card ${student && student.neae ? 'seat-neae' : ''}" draggable="true" data-seat-id="${seat.id}"
               onclick="window.clasesEngine.openSeatModal('${seat.id}')">
            ${student ? `
              <div class="seat-avatar">${student.name[0]}</div>
              <div class="seat-name">${student.name.split(' ')[0]}</div>
              ${student.neae ? '<span class="seat-neae-tag">NEAE</span>' : ''}
            ` : `
              <div class="seat-avatar" style="background: var(--bg-tertiary); color: var(--text-muted);"><i class="fa-solid fa-plus"></i></div>
              <div class="seat-name" style="color: var(--text-muted);">Vacío</div>
            `}
          </div>
        `;
      });
      html += `</div>`;
    }
    html += '</div>';
    return html;
  }

  // ---- Drag & Drop de pupitres (intercambia dos alumnos de sitio) ----
  setupSeatDragAndDrop() {
    const grid = document.getElementById('clases-view-container');
    if (!grid) return;

    grid.querySelectorAll('.seat-desk-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        this.draggedSeatId = card.dataset.seatId;
        card.classList.add('is-dragging');
        e.dataTransfer.setData('text/plain', this.draggedSeatId);
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging');
      });
      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        card.classList.add('drag-over');
      });
      card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        const targetSeatId = card.dataset.seatId;
        if (this.draggedSeatId && targetSeatId && targetSeatId !== this.draggedSeatId) {
          this.swapSeats(this.draggedSeatId, targetSeatId);
        }
      });
    });
  }

  swapSeats(seatIdA, seatIdB) {
    const classId = window.store.state.selectedClassId;
    const record = window.store.state.seatingByClass[classId];
    if (!record) return;
    const seatA = record.seats.find(s => s.id === seatIdA);
    const seatB = record.seats.find(s => s.id === seatIdB);
    if (!seatA || !seatB) return;
    const tmp = seatA.studentId;
    seatA.studentId = seatB.studentId;
    seatB.studentId = tmp;
    window.store.saveState();
    this.renderClasesView();
    window.app.showToast('Alumnos cambiados de sitio.', 'success');
  }

  setLayout(classId, layoutKey) {
    const record = window.store.state.seatingByClass[classId];
    if (!record) return;
    record.layout = layoutKey;
    window.store.saveState();
    this.renderClasesView();
  }

  // ---- Modal de asignar pupitre ----
  openSeatModal(seatId) {
    const classId = window.store.state.selectedClassId;
    const record = window.store.state.seatingByClass[classId];
    const seat = record && record.seats.find(s => s.id === seatId);
    if (!seat) return;

    const activeClass = (window.store.state.classes || []).find(c => c.id === classId);
    const roster = this.studentsForClass(activeClass);

    document.getElementById('edit-seat-id').value = seatId;
    const select = document.getElementById('edit-seat-student');
    select.innerHTML = `<option value="">— Vacío —</option>` + roster.map(s =>
      `<option value="${s.id}" ${s.id === seat.studentId ? 'selected' : ''}>${s.name}</option>`
    ).join('');

    document.getElementById('modal-seat-view-profile-btn').style.display = seat.studentId ? 'inline-flex' : 'none';

    window.app.openModal('modal-seat');
  }

  saveSeatFromModal() {
    const seatId = document.getElementById('edit-seat-id').value;
    const studentId = document.getElementById('edit-seat-student').value;
    const classId = window.store.state.selectedClassId;
    const record = window.store.state.seatingByClass[classId];
    const seat = record && record.seats.find(s => s.id === seatId);
    if (!seat) return;

    // Si ese alumno ya estaba en otro pupitre, lo dejamos libre (un alumno no puede estar en dos sitios)
    if (studentId) {
      record.seats.forEach(s => { if (s.id !== seatId && s.studentId === studentId) s.studentId = null; });
    }
    seat.studentId = studentId || null;

    window.store.saveState();
    window.app.closeModal('modal-seat');
    this.renderClasesView();
  }

  viewSeatProfile() {
    const seatId = document.getElementById('edit-seat-id').value;
    const classId = window.store.state.selectedClassId;
    const record = window.store.state.seatingByClass[classId];
    const seat = record && record.seats.find(s => s.id === seatId);
    if (!seat || !seat.studentId) return;
    window.app.closeModal('modal-seat');
    this.openStudentDetailModal(seat.studentId);
  }

  // ---- CRUD de clases ----
  selectGroup(classId) {
    window.store.state.selectedClassId = classId;
    window.store.saveState();
    this.renderClasesView();
  }

  openEditClassModal(classId) {
    const cls = classId ? (window.store.state.classes || []).find(c => c.id === classId) : null;
    document.getElementById('modal-class-title-display').innerText = cls ? 'Editar Clase / Grupo' : 'Nueva Clase / Grupo';
    document.getElementById('edit-class-id').value = cls ? cls.id : '';
    document.getElementById('edit-class-name').value = cls ? cls.groupLabel : '';
    document.getElementById('edit-class-subject').value = cls ? cls.subject : '';
    window.app.openModal('modal-class');
  }

  saveClassFromModal() {
    const id = document.getElementById('edit-class-id').value;
    const groupLabel = document.getElementById('edit-class-name').value.trim();
    const subject = document.getElementById('edit-class-subject').value.trim();

    if (!groupLabel) {
      window.app.showToast('Escribe el nombre del grupo (ej. 2ºA).', 'warning');
      return;
    }

    if (id) {
      const cls = window.store.state.classes.find(c => c.id === id);
      if (cls) {
        cls.groupLabel = groupLabel;
        cls.subject = subject;
      }
    } else {
      const newClass = { id: `CLASS-${Date.now()}`, groupLabel, subject };
      window.store.state.classes.push(newClass);
      window.store.state.selectedClassId = newClass.id;
    }

    window.store.saveState();
    window.app.closeModal('modal-class');
    this.renderClasesView();
    window.app.showToast('Clase guardada.', 'success');
  }

  deleteClass(classId) {
    window.store.state.classes = window.store.state.classes.filter(c => c.id !== classId);
    delete window.store.state.seatingByClass[classId];
    if (window.store.state.selectedClassId === classId) {
      window.store.state.selectedClassId = window.store.state.classes[0] ? window.store.state.classes[0].id : null;
    }
    window.store.saveState();
    this.renderClasesView();
    window.app.showToast('Clase eliminada.', 'info');
  }

  openStudentDetailModal(studentId) {
    const student = window.store.state.students.find(s => s.id === studentId);
    if (!student) return;

    document.getElementById('full-student-name').innerText = student.name;
    document.getElementById('full-student-group').innerText = student.group ? `Grupo ${student.group}` : 'Sin grupo';
    document.getElementById('full-student-avatar-letter').innerText = student.name[0];
    document.getElementById('full-student-birthday').innerText = student.birthday ? window.alumnoEngine.formatBirthday(student.birthday) : '—';
    document.getElementById('full-student-parent').innerText = student.parentName || '—';
    const phonesEl = document.getElementById('full-student-phones');
    if (phonesEl) {
      const phones = Array.isArray(student.phones) ? student.phones.filter(p => p.number) : [];
      phonesEl.innerText = phones.length
        ? phones.map(p => p.label ? `${p.label}: ${p.number}` : p.number).join(' · ')
        : '—';
    }
    document.getElementById('full-student-email').innerText = student.parentEmail || '—';
    document.getElementById('full-student-notes').innerText = student.notes || 'Sin observaciones.';

    window.app.openModal('modal-student-full');
  }
}

window.clasesEngine = new ClasesEngine();
