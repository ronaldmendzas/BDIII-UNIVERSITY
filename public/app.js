const App = {
    state: {
        currentScreen: 'dashboard',
        sede: localStorage.getItem('unispanner_sede') || null,
        sedeKey: null,
        stats: {},
        estudiantes: [],
        estudianteTab: 'lapaz',
        nacionalMode: false,
        docentes: [],
        materias: [],
        inscripciones: [],
        notas: [],
        sedes: [],
        charts: {},
        _estMap: {},
        _matMap: {},
        _loading: false,
        _abortController: null,
        options: { carreras: [], sedes: [], docentes: [] },
    },

    sedeKeys: { 'La Paz': 'lapaz', 'Santa Cruz': 'santacruz', 'Cochabamba': 'cochabamba' },
    sedeIds: { 'La Paz': 'LP', 'Santa Cruz': 'SC', 'Cochabamba': 'CB' },
    sedeColors: { 'La Paz': '#3b82f6', 'Santa Cruz': '#22c55e', 'Cochabamba': '#f97316' },
    sedeDimColors: { 'La Paz': '#eff6ff', 'Santa Cruz': '#f0fdf4', 'Cochabamba': '#fff7ed' },

    init() {
        this.checkConnection();
        this._connInterval = setInterval(function() { App.checkConnection(); }, 15000);
        if (this.state.sede) {
            this.enterApp();
        } else {
            this.createParticles();
        }
    },

    createParticles() {
        const container = document.getElementById('particles');
        if (!container) return;
        const colors = ['#3b82f6', '#22c55e', '#f97316'];
        for (let i = 0; i < 25; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.left = Math.random() * 100 + '%';
            p.style.bottom = '-10px';
            p.style.width = p.style.height = Math.random() * 4 + 2 + 'px';
            p.style.background = colors[Math.floor(Math.random() * colors.length)];
            p.style.animationDuration = Math.random() * 10 + 10 + 's';
            p.style.animationDelay = Math.random() * 10 + 's';
            container.appendChild(p);
        }
    },

    async checkConnection() {
        var connected = false;
        try {
            var controller = new AbortController();
            var timeoutId = setTimeout(function() { controller.abort(); }, 8000);
            var r = await fetch('/api/connection-status', { signal: controller.signal });
            clearTimeout(timeoutId);
            if (r.ok) {
                var d = await r.json();
                connected = !!d.connected;
            }
        } catch (e) {
            connected = false;
        }
        var dots = document.querySelectorAll('.connection-dot');
        var ring = document.getElementById('conn-ring');
        var connText = document.getElementById('connection-text');
        var splashText = document.getElementById('splash-connection-text');
        if (connected) {
            dots.forEach(function(dot) { dot.classList.add('connected'); });
            if (ring) { ring.classList.remove('disconnected'); ring.classList.add('connected'); }
            if (connText) connText.textContent = 'Conectado';
            if (splashText) splashText.textContent = 'Conectado a Google Cloud Spanner';
        } else {
            dots.forEach(function(dot) { dot.classList.remove('connected'); });
            if (ring) { ring.classList.remove('connected'); ring.classList.add('disconnected'); }
            if (connText) connText.textContent = 'Desconectado';
            if (splashText) splashText.textContent = 'Sin conexion a Spanner';
        }
    },

    selectSede(sede) {
        this.state.sede = sede;
        this.state.sedeKey = this.sedeKeys[sede];
        localStorage.setItem('unispanner_sede', sede);
        this.enterApp();
    },

enterApp() {
        this.state.sedeKey = this.sedeKeys[this.state.sede];
        var splash = document.getElementById('screen-splash');
        if (splash) { splash.classList.remove('active'); splash.style.display = 'none'; }
        var shell = document.getElementById('app-shell');
        if (shell) shell.classList.remove('hidden');
        this.updateSedeBadge();
        this.loadOptions();
        this.navigate('dashboard');
        this.registerMonitor();
    },

    changeSede() {
        const shell = document.getElementById('app-shell');
        const splash = document.getElementById('screen-splash');
        if (shell) shell.classList.add('hidden');
        if (splash) { splash.style.display = ''; splash.classList.add('active'); }
        this.state.sede = null;
        localStorage.removeItem('unispanner_sede');
    },

    updateSedeBadge() {
        const badge = document.getElementById('sede-badge');
        if (badge) {
            badge.textContent = this.state.sede;
            badge.style.background = this.sedeDimColors[this.state.sede];
            badge.style.color = this.sedeColors[this.state.sede];
            badge.style.borderColor = this.sedeColors[this.state.sede];
        }
    },

    navigate(screen) {
        this.state.currentScreen = screen;
        document.querySelectorAll('#app-shell > section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.nav-btn[data-screen]').forEach(b => b.classList.remove('active'));
        const el = document.getElementById('screen-' + screen);
        if (el) el.classList.add('active');
        const navBtn = document.querySelector('.nav-btn[data-screen="' + screen + '"]');
        if (navBtn) navBtn.classList.add('active');
        this.loadScreen(screen);
    },

    async loadOptions() {
        try {
            var data = await this.api('/api/options');
            if (data) {
                this.state.options.carreras = data.carreras || [];
                this.state.options.sedes = data.sedes || [];
                this.state.options.docentes = data.docentes || [];
            }
        } catch (e) { }
    },

    sedeSelectHtml(id, selected) {
        var sedes = this.state.options.sedes;
        var html = '<select id="' + id + '" class="input input-full">';
        if (sedes && sedes.length > 0) {
            sedes.forEach(function(s) {
                var sid = s.sede_id || '';
                var sn = (s.nombre || s.ciudad || sid);
                html += '<option value="' + sid + '"' + (sid === selected ? ' selected' : '') + '>' + sn + '</option>';
            });
        } else {
            html += '<option value="LP">La Paz</option><option value="SC">Santa Cruz</option><option value="CB">Cochabamba</option>';
        }
        html += '</select>';
        return html;
    },

    carreraSelectHtml(id, selected) {
        var carreras = this.state.options.carreras;
        var html = '<select id="' + id + '" class="input input-full" onchange="App.toggleCarreraNew(\'' + id + '\')"><option value="">Seleccionar carrera...</option>';
        if (carreras) {
            carreras.forEach(function(c) {
                html += '<option value="' + c + '"' + (c === selected ? ' selected' : '') + '>' + c + '</option>';
            });
        }
        html += '<option value="__new__">+ Otra carrera...</option></select>';
        html += '<input type="text" id="' + id + '_new" class="input input-full" style="display:none;margin-top:4px;" placeholder="Nombre de la nueva carrera (Enter para confirmar)" onkeydown="App.carreraNewKeydown(event,\'' + id + '\')" onblur="App.syncCarreraNew(\'' + id + '\')">';
        return html;
    },

    docenteSelectHtml(id, selected) {
        var docentes = this.state.options.docentes;
        var html = '<select id="' + id + '" class="input input-full"><option value="">Seleccionar docente...</option>';
        if (docentes) {
            docentes.forEach(function(d) {
                var n = d.nombre || '';
                html += '<option value="' + n + '"' + (n === selected ? ' selected' : '') + '>' + n + '</option>';
            });
        }
        html += '</select>';
        return html;
    },

    toggleCarreraNew(id) {
        var sel = document.getElementById(id);
        var inp = document.getElementById(id + '_new');
        if (sel && inp) {
            inp.style.display = sel.value === '__new__' ? 'block' : 'none';
            if (sel.value === '__new__') inp.focus();
        }
    },

    carreraNewKeydown(e, id) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.syncCarreraNew(id);
        }
    },

    syncCarreraNew(id) {
        var sel = document.getElementById(id);
        var inp = document.getElementById(id + '_new');
        if (sel && inp && sel.value === '__new__' && inp.value.trim()) {
            var opt = document.createElement('option');
            opt.value = inp.value.trim();
            opt.textContent = inp.value.trim();
            opt.selected = true;
            sel.insertBefore(opt, sel.options[sel.options.length - 1]);
            sel.value = inp.value.trim();
            inp.value = '';
            inp.style.display = 'none';
        }
    },

    getCarreraValue(id) {
        var sel = document.getElementById(id);
        if (sel && sel.value === '__new__') {
            var inp = document.getElementById(id + '_new');
            return inp ? inp.value.trim() : '';
        }
        return sel ? sel.value : '';
    },

    showLoading() {
        if (this.state._loading) return;
        this.state._loading = true;
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'flex';
    },

    hideLoading() {
        this.state._loading = false;
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'none';
    },

    async loadScreen(screen) {
        this.showLoading();
        try {
            switch (screen) {
                case 'dashboard': await this.loadDashboard(); break;
                case 'estudiantes': await this.loadEstudiantes(); break;
                case 'docentes': await this.loadDocentes(); break;
                case 'materias': await this.loadMaterias(); break;
                case 'inscripciones': await this.loadInscripciones(); break;
                case 'notas': await this.loadNotas(); break;
                case 'fragmentacion': await this.loadFragmentacion(); break;
                case 'monitor': await this.loadMonitor(); break;
                case 'sedes': await this.loadSedes(); break;
            }
        } catch (e) {
            console.warn('Error cargando pantalla:', e.message);
        } finally {
            this.hideLoading();
        }
    },

    toast(msg, type) {
        type = type || 'info';
        const container = document.getElementById('toast-container');
        if (!container) return;
        const t = document.createElement('div');
        t.className = 'toast toast-' + type;
        t.textContent = msg;
        container.appendChild(t);
        setTimeout(function() { if (t.parentNode) t.remove(); }, 3000);
    },

    async api(url, options) {
        try {
            var r = await fetch(url, options || {});
            if (!r.ok) {
                var errData;
                try { errData = await r.json(); } catch(e) { errData = { error: 'Error del servidor' }; }
                throw new Error(errData.error || 'Error ' + r.status);
            }
            return await r.json();
        } catch (e) {
            if (e.name === 'TypeError' && e.message.includes('fetch')) {
                this.toast('No se pudo conectar al servidor', 'error');
            } else {
                this.toast(e.message, 'error');
            }
            throw e;
        }
    },

    // ═══════════════ DASHBOARD ═══════════════
    async loadDashboard() {
        var stats = await this.api('/api/stats');
        if (!stats) return;
        this.state.stats = stats;
        var sk = this.state.sedeKey;
        var miSede = 0;
        if (sk === 'lapaz') miSede = stats.estudiantesLaPaz;
        else if (sk === 'santacruz') miSede = stats.estudiantesSantaCruz;
        else if (sk === 'cochabamba') miSede = stats.estudiantesCochabamba;

        document.getElementById('stat-mi-sede').textContent = miSede;
        document.getElementById('stat-mi-sede-label').textContent = 'Estudiantes en ' + this.state.sede;
        document.getElementById('stat-nacional').textContent = stats.totalNacional;
        document.getElementById('stat-docentes').textContent = stats.totalDocentes;
        document.getElementById('stat-materias').textContent = stats.totalMaterias;
        document.getElementById('stat-inscripciones').textContent = stats.totalInscripciones;
        document.getElementById('stat-equipos').textContent = stats.equiposConectados;

        this.renderBarChart(stats);
        await this.renderLastStudents();
        await this.loadCarrerasChart();
    },

    renderBarChart(stats) {
        var ctx = document.getElementById('chart-sedes');
        if (!ctx) return;
        if (this.state.charts.sedes) this.state.charts.sedes.destroy();
        this.state.charts.sedes = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['La Paz', 'Santa Cruz', 'Cochabamba'],
                datasets: [{ label: 'Estudiantes', data: [stats.estudiantesLaPaz, stats.estudiantesSantaCruz, stats.estudiantesCochabamba], backgroundColor: ['#3b82f6', '#22c55e', '#f97316'], borderWidth: 0, borderRadius: 4 }]
            },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#e2e8f0' }, ticks: { color: '#64748b' } }, x: { grid: { display: false }, ticks: { color: '#64748b' } } } }
        });
    },

    async loadCarrerasChart() {
        try {
            var data = await this.api('/api/estudiantes/nacional');
            if (!data || !Array.isArray(data)) return;
            var carreras = {};
            data.forEach(function(e) { var c = e.carrera || 'Sin carrera'; carreras[c] = (carreras[c] || 0) + 1; });
            var labels = Object.keys(carreras);
            var values = Object.values(carreras);
            var colors = ['#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f59e0b'];
            var ctx = document.getElementById('chart-carreras');
            if (!ctx) return;
            if (this.state.charts.carreras) this.state.charts.carreras.destroy();
            this.state.charts.carreras = new Chart(ctx, {
                type: 'doughnut',
                data: { labels: labels, datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }] },
                options: { responsive: true, plugins: { legend: { position: 'right', labels: { color: '#64748b', font: { size: 11 } } } } }
            });
        } catch (e) { }
    },

    async renderLastStudents() {
        try {
            var data = await this.api('/api/estudiantes/nacional');
            if (!data || !Array.isArray(data)) return;
            var last5 = data.slice(-5).reverse();
            var tbody = document.querySelector('#dashboard-last-students tbody');
            if (!tbody) return;
            if (last5.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">Sin estudiantes registrados</td></tr>';
                return;
            }
            var self = this;
            tbody.innerHTML = last5.map(function(e) {
                return '<tr><td title="' + e.estudiante_id + '">' + e.estudiante_id.substring(0, 8) + '...</td><td>' + (e.nombre || '') + '</td><td>' + (e.apellido || '') + '</td><td>' + (e.carrera || '') + '</td><td>' + self.sedeBadge(e.sede_origen) + '</td><td>' + self.statusBadge(e.estado) + '</td></tr>';
            }).join('');
        } catch (e) { }
    },

    // ═══════════════ ESTUDIANTES ═══════════════
    async loadEstudiantes() {
        await this.switchEstudianteTab(this.state.estudianteTab);
    },

    switchEstudianteTab(sede) {
        this.state.estudianteTab = sede;
        this.state.nacionalMode = false;
        document.querySelectorAll('.tab-btn[data-sede]').forEach(function(b) { b.classList.remove('active'); });
        var btn = document.querySelector('.tab-btn[data-sede="' + sede + '"]');
        if (btn) btn.classList.add('active');
        this.loadEstudiantesSede(sede);
    },

    async loadEstudiantesSede(sede) {
        try {
            var data = await this.api('/api/estudiantes/' + sede);
            if (!data) return;
            this.state.estudiantes = Array.isArray(data) ? data : [];
            this.renderEstudiantesTable(this.state.estudiantes);
            this.updateCarreraFilter(this.state.estudiantes);
        } catch (e) { }
    },

    async loadEstudiantesNacional() {
        this.state.nacionalMode = true;
        try {
            var data = await this.api('/api/estudiantes/nacional');
            if (!data) return;
            this.state.estudiantes = Array.isArray(data) ? data : [];
            this.renderEstudiantesTable(this.state.estudiantes, true);
        } catch (e) { }
    },

    renderEstudiantesTable(data, nacional) {
        var tbody = document.querySelector('#estudiantes-table tbody');
        if (!tbody) return;
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">Sin estudiantes</td></tr>';
            return;
        }
        var self = this;
        tbody.innerHTML = data.map(function(e) {
            return '<tr><td title="' + e.estudiante_id + '">' + e.estudiante_id.substring(0, 8) + '...</td>' +
                '<td>' + (e.nombre || '') + '</td><td>' + (e.apellido || '') + '</td><td>' + (e.ci || '') + '</td>' +
                '<td>' + (e.carrera || '') + '</td><td>' + (e.semestre || e.semestre_actual || '') + '</td>' +
                '<td>' + (e.email || '') + '</td><td>' + self.statusBadge(e.estado) + '</td>' +
                '<td><button class="btn btn-sm btn-secondary" onclick="App.editEstudiante(\'' + e.estudiante_id + '\')">Editar</button> ' +
                '<button class="btn btn-sm btn-danger" onclick="App.deleteEstudiante(\'' + e.estudiante_id + '\')">Eliminar</button>' +
                (nacional ? '' : ' <button class="btn btn-sm btn-secondary" onclick="App.viewEstudianteCompleto(\'' + e.estudiante_id + '\')">Ver Completo</button>') +
                '</td></tr>';
        }).join('');
    },

    updateCarreraFilter(data) {
        var sel = document.getElementById('est-filter-carrera');
        if (!sel) return;
        var carreras = [];
        if (data && Array.isArray(data)) {
            data.forEach(function(e) { if (e.carrera && carreras.indexOf(e.carrera) === -1) carreras.push(e.carrera); });
        }
        sel.innerHTML = '<option value="">Todas las carreras</option>' + carreras.map(function(c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
    },

    filterEstudiantes() {
        var search = (document.getElementById('est-search')?.value || '').toLowerCase();
        var carrera = document.getElementById('est-filter-carrera')?.value || '';
        var semestre = document.getElementById('est-filter-semestre')?.value || '';
        var self = this;
        var filtered = this.state.estudiantes.filter(function(e) {
            var matchSearch = !search || (e.nombre || '').toLowerCase().indexOf(search) !== -1 || (e.ci || '').indexOf(search) !== -1;
            var matchCarrera = !carrera || e.carrera === carrera;
            var matchSemestre = !semestre || String(e.semestre || e.semestre_actual || '') === semestre;
            return matchSearch && matchCarrera && matchSemestre;
        });
        this.renderEstudiantesTable(filtered, this.state.nacionalMode);
    },

    showEstudianteForm(estudiante) {
        var isEdit = !!estudiante;
        var sede = this.state.estudianteTab;
        var title = isEdit ? 'Editar Estudiante' : 'Nuevo Estudiante';
        var body = '<div class="form-grid">' +
            '<div class="form-group"><label>Nombre</label><input type="text" id="f-est-nombre" class="input input-full" value="' + (estudiante ? estudiante.nombre || '' : '') + '"></div>' +
            '<div class="form-group"><label>Apellido</label><input type="text" id="f-est-apellido" class="input input-full" value="' + (estudiante ? estudiante.apellido || '' : '') + '"></div>' +
            '<div class="form-group"><label>CI</label><input type="text" id="f-est-ci" class="input input-full" value="' + (estudiante ? estudiante.ci || '' : '') + '"></div>' +
            '<div class="form-group"><label>Carrera</label>' + this.carreraSelectHtml('f-est-carrera', estudiante ? estudiante.carrera || '' : '') + '</div>' +
            '<div class="form-group"><label>Semestre</label><input type="number" id="f-est-semestre" class="input input-full" value="' + (estudiante ? estudiante.semestre || 1 : 1) + '" min="1" max="10"></div>' +
            '<div class="form-group"><label>Email</label><input type="email" id="f-est-email" class="input input-full" value="' + (estudiante ? estudiante.email || '' : '') + '"></div>' +
            '<div class="form-group"><label>Telefono</label><input type="text" id="f-est-telefono" class="input input-full" value="' + (estudiante ? estudiante.telefono || '' : '') + '"></div>' +
            '<div class="form-group"><label>Estado</label><select id="f-est-estado" class="input input-full"><option value="ACTIVO"' + ((!estudiante || estudiante.estado === 'ACTIVO') ? ' selected' : '') + '>ACTIVO</option><option value="INACTIVO"' + (estudiante && estudiante.estado === 'INACTIVO' ? ' selected' : '') + '>INACTIVO</option></select></div>' +
            '</div><div class="modal-actions"><button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>' +
            '<button class="btn btn-primary" onclick="App.saveEstudiante(\'' + sede + '\', ' + (isEdit ? "'" + estudiante.estudiante_id + "'" : 'null') + ')">' + (isEdit ? 'Actualizar' : 'Crear') + '</button></div>';
        this.openModal(title, body);
    },

    async saveEstudiante(sede, id) {
        var data = {
            nombre: document.getElementById('f-est-nombre').value,
            apellido: document.getElementById('f-est-apellido').value,
            ci: document.getElementById('f-est-ci').value,
            carrera: this.getCarreraValue('f-est-carrera') || document.getElementById('f-est-carrera').value,
            semestre: parseInt(document.getElementById('f-est-semestre').value) || 1,
            email: document.getElementById('f-est-email').value,
            telefono: document.getElementById('f-est-telefono').value,
            estado: document.getElementById('f-est-estado').value
        };
        try {
            if (id) {
                await this.api('/api/estudiantes/' + sede + '/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                this.toast('Estudiante actualizado', 'success');
            } else {
                await this.api('/api/estudiantes/' + sede, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                this.toast('Estudiante creado', 'success');
            }
            this.closeModal();
            this.loadEstudiantesSede(sede);
        } catch (e) { }
    },

    editEstudiante(id) {
        var e = this.state.estudiantes.find(function(x) { return x.estudiante_id === id; });
        if (e) this.showEstudianteForm(e);
    },

    async deleteEstudiante(id) {
        if (!confirm('Seguro que deseas eliminar este estudiante?')) return;
        var sede = this.state.estudianteTab;
        try {
            await this.api('/api/estudiantes/' + sede + '/' + id, { method: 'DELETE' });
            this.toast('Estudiante eliminado', 'success');
            this.loadEstudiantesSede(sede);
        } catch (e) { }
    },

    async viewEstudianteCompleto(id) {
        try {
            var data = await this.api('/api/estudiantes/completo/' + id);
            if (!data) { this.toast('No se encontraron datos completos', 'info'); return; }
            var panels = document.getElementById('vertical-details');
            if (panels) panels.classList.remove('hidden');
            var pd = document.getElementById('personal-details');
            var ad = document.getElementById('academico-details');
            if (pd) pd.innerHTML = '<div class="detail-item"><div class="detail-label">CI</div><div class="detail-value">' + (data.ci || '') + '</div></div>' +
                '<div class="detail-item"><div class="detail-label">Fecha Nacimiento</div><div class="detail-value">' + (data.fecha_nacimiento || '') + '</div></div>' +
                '<div class="detail-item"><div class="detail-label">Telefono</div><div class="detail-value">' + (data.telefono || '') + '</div></div>' +
                '<div class="detail-item"><div class="detail-label">Direccion</div><div class="detail-value">' + (data.direccion || '') + '</div></div>' +
                '<div class="detail-item"><div class="detail-label">Email</div><div class="detail-value">' + (data.email || '') + '</div></div>' +
                '<div class="detail-item"><div class="detail-label">Genero</div><div class="detail-value">' + (data.genero || '') + '</div></div>';
            if (ad) ad.innerHTML = '<div class="detail-item"><div class="detail-label">Nombre</div><div class="detail-value">' + (data.nombre || '') + '</div></div>' +
                '<div class="detail-item"><div class="detail-label">Apellido</div><div class="detail-value">' + (data.apellido || '') + '</div></div>' +
                '<div class="detail-item"><div class="detail-label">Carrera</div><div class="detail-value">' + (data.carrera || '') + '</div></div>' +
                '<div class="detail-item"><div class="detail-label">Semestre</div><div class="detail-value">' + (data.semestre_actual || '') + '</div></div>' +
                '<div class="detail-item"><div class="detail-label">Sede</div><div class="detail-value">' + this.sedeBadge(data.sede_id, true) + '</div></div>' +
                '<div class="detail-item"><div class="detail-label">Estado</div><div class="detail-value">' + this.statusBadge(data.estado) + '</div></div>' +
                '<div class="detail-item"><div class="detail-label">Promedio</div><div class="detail-value">' + (data.promedio_general || 0) + '</div></div>';
        } catch (e) { }
    },

    showEstudianteCompletoForm() {
        var title = 'Registrar Datos Completos (Fragmentacion Vertical)';
        var body = '<p class="text-muted mb-16">Este formulario inserta en Estudiante_Personal Y Estudiante_Academico simultaneamente.</p>' +
            '<div class="form-grid">' +
            '<div class="form-group"><label>Nombre</label><input type="text" id="f-vc-nombre" class="input input-full"></div>' +
            '<div class="form-group"><label>Apellido</label><input type="text" id="f-vc-apellido" class="input input-full"></div>' +
            '<div class="form-group"><label>CI</label><input type="text" id="f-vc-ci" class="input input-full"></div>' +
            '<div class="form-group"><label>Carrera</label>' + this.carreraSelectHtml('f-vc-carrera', '') + '</div>' +
            '<div class="form-group"><label>Semestre Actual</label><input type="number" id="f-vc-semestre" class="input input-full" value="1"></div>' +
            '<div class="form-group"><label>Sede</label>' + this.sedeSelectHtml('f-vc-sede', 'LP') + '</div>' +
            '<div class="form-group"><label>Email</label><input type="email" id="f-vc-email" class="input input-full"></div>' +
            '<div class="form-group"><label>Telefono</label><input type="text" id="f-vc-telefono" class="input input-full"></div>' +
            '<div class="form-group"><label>Direccion</label><input type="text" id="f-vc-direccion" class="input input-full"></div>' +
            '<div class="form-group"><label>Genero</label><select id="f-vc-genero" class="input input-full"><option value="M">Masculino</option><option value="F">Femenino</option><option value="O">Otro</option></select></div>' +
            '<div class="form-group"><label>Estado</label><select id="f-vc-estado" class="input input-full"><option value="ACTIVO">ACTIVO</option><option value="INACTIVO">INACTIVO</option></select></div>' +
            '<div class="form-group"><label>Promedio General</label><input type="number" id="f-vc-promedio" class="input input-full" value="0" step="0.01"></div>' +
            '</div><div class="modal-actions"><button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button class="btn btn-primary" onclick="App.saveEstudianteCompleto()">Registrar en Ambas Tablas</button></div>';
        this.openModal(title, body);
    },

    async saveEstudianteCompleto() {
        var data = {
            nombre: document.getElementById('f-vc-nombre').value, apellido: document.getElementById('f-vc-apellido').value,
            ci: document.getElementById('f-vc-ci').value, carrera: this.getCarreraValue('f-vc-carrera') || document.getElementById('f-vc-carrera').value,
            semestre_actual: parseInt(document.getElementById('f-vc-semestre').value) || 1, sede_id: document.getElementById('f-vc-sede').value,
            email: document.getElementById('f-vc-email').value, telefono: document.getElementById('f-vc-telefono').value,
            direccion: document.getElementById('f-vc-direccion').value, genero: document.getElementById('f-vc-genero').value,
            estado: document.getElementById('f-vc-estado').value, promedio_general: parseFloat(document.getElementById('f-vc-promedio').value) || 0,
            gestion_ingreso: new Date().getFullYear().toString()
        };
        try {
            await this.api('/api/estudiantes/completo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            this.toast('Estudiante registrado en ambas tablas', 'success');
            this.closeModal();
        } catch (e) { }
    },

    // ═══════════════ DOCENTES ═══════════════
    async loadDocentes() {
        try {
            var data = await this.api('/api/docentes');
            if (!data) return;
            this.state.docentes = Array.isArray(data) ? data : [];
            var filterSede = document.getElementById('doc-filter-sede')?.value || '';
            var filtered = filterSede ? this.state.docentes.filter(function(d) { return App.sedeMatch(d.sede_id, filterSede); }) : this.state.docentes;
            this.renderDocentesTable(filtered);
        } catch (e) { }
    },

    renderDocentesTable(data) {
        var tbody = document.querySelector('#docentes-table tbody');
        if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">Sin docentes</td></tr>'; return; }
        var self = this;
        tbody.innerHTML = data.map(function(d) {
            return '<tr><td title="' + d.docente_id + '">' + d.docente_id.substring(0, 8) + '...</td><td>' + (d.nombre || '') + '</td><td>' + (d.apellido || '') + '</td><td>' + (d.ci || '') + '</td><td>' + (d.email || '') + '</td><td>' + (d.especialidad || '') + '</td><td>' + self.sedeBadge(d.sede_id, true) + '</td><td>' + self.statusBadge(d.estado) + '</td><td><button class="btn btn-sm btn-secondary" onclick="App.editDocente(\'' + d.docente_id + '\')">Editar</button> <button class="btn btn-sm btn-danger" onclick="App.deleteDocente(\'' + d.docente_id + '\')">Eliminar</button></td></tr>';
        }).join('');
    },

    showDocenteForm(docente) {
        var isEdit = !!docente;
        var body = '<div class="form-grid">' +
            '<div class="form-group"><label>Nombre</label><input type="text" id="f-doc-nombre" class="input input-full" value="' + (docente ? docente.nombre || '' : '') + '"></div>' +
            '<div class="form-group"><label>Apellido</label><input type="text" id="f-doc-apellido" class="input input-full" value="' + (docente ? docente.apellido || '' : '') + '"></div>' +
            '<div class="form-group"><label>CI</label><input type="text" id="f-doc-ci" class="input input-full" value="' + (docente ? docente.ci || '' : '') + '"></div>' +
            '<div class="form-group"><label>Email</label><input type="email" id="f-doc-email" class="input input-full" value="' + (docente ? docente.email || '' : '') + '"></div>' +
            '<div class="form-group"><label>Telefono</label><input type="text" id="f-doc-telefono" class="input input-full" value="' + (docente ? docente.telefono || '' : '') + '"></div>' +
            '<div class="form-group"><label>Especialidad</label><input type="text" id="f-doc-especialidad" class="input input-full" value="' + (docente ? docente.especialidad || '' : '') + '"></div>' +
            '<div class="form-group"><label>Sede</label>' + this.sedeSelectHtml('f-doc-sede', docente ? docente.sede_id || 'LP' : 'LP') + '</div>' +
            '<div class="form-group"><label>Estado</label><select id="f-doc-estado" class="input input-full"><option value="ACTIVO"' + ((!docente || docente.estado === 'ACTIVO') ? ' selected' : '') + '>ACTIVO</option><option value="INACTIVO"' + (docente && docente.estado === 'INACTIVO' ? ' selected' : '') + '>INACTIVO</option></select></div>' +
            '</div><div class="modal-actions"><button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button class="btn btn-primary" onclick="App.saveDocente(' + (isEdit ? "'" + docente.docente_id + "'" : 'null') + ')">' + (isEdit ? 'Actualizar' : 'Crear') + '</button></div>';
        this.openModal(isEdit ? 'Editar Docente' : 'Nuevo Docente', body);
    },

    async saveDocente(id) {
        var d = { nombre: document.getElementById('f-doc-nombre').value, apellido: document.getElementById('f-doc-apellido').value, ci: document.getElementById('f-doc-ci').value, email: document.getElementById('f-doc-email').value, telefono: document.getElementById('f-doc-telefono').value, especialidad: document.getElementById('f-doc-especialidad').value, sede_id: document.getElementById('f-doc-sede').value, estado: document.getElementById('f-doc-estado').value };
        try {
            if (id) { await this.api('/api/docentes/' + id, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(d) }); this.toast('Docente actualizado', 'success'); }
            else { await this.api('/api/docentes', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(d) }); this.toast('Docente creado', 'success'); }
            this.closeModal(); this.loadDocentes();
        } catch (e) { }
    },

    editDocente(id) { var d = this.state.docentes.find(function(x) { return x.docente_id === id; }); if (d) this.showDocenteForm(d); },

    async deleteDocente(id) {
        if (!confirm('Seguro que deseas eliminar este docente?')) return;
        try { await this.api('/api/docentes/' + id, { method: 'DELETE' }); this.toast('Docente eliminado', 'success'); this.loadDocentes(); } catch (e) { }
    },

    // ═══════════════ MATERIAS ═══════════════
    async loadMaterias() {
        try {
            var data = await this.api('/api/materias');
            if (!data) return;
            this.state.materias = Array.isArray(data) ? data : [];
            var filterSede = document.getElementById('mat-filter-sede')?.value || '';
            var filterCarrera = document.getElementById('mat-filter-carrera')?.value || '';
            var filtered = this.state.materias;
            if (filterSede) filtered = filtered.filter(function(m) { return App.sedeMatch(m.sede_id, filterSede); });
            if (filterCarrera) filtered = filtered.filter(function(m) { return m.carrera === filterCarrera; });
            this.renderMateriasTable(filtered);
            this.updateMateriaCarreraFilter(this.state.materias);
        } catch (e) { }
    },

    renderMateriasTable(data) {
        var tbody = document.querySelector('#materias-table tbody');
        if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">Sin materias</td></tr>'; return; }
        var self = this;
        tbody.innerHTML = data.map(function(m) {
            return '<tr><td title="' + m.materia_id + '">' + m.materia_id.substring(0, 8) + '...</td><td>' + (m.nombre || '') + '</td><td>' + (m.codigo || '') + '</td><td>' + (m.carrera || '') + '</td><td>' + (m.semestre || '') + '</td><td>' + (m.creditos || '') + '</td><td>' + (m.docente || '') + '</td><td>' + self.sedeBadge(m.sede_id, true) + '</td><td><button class="btn btn-sm btn-danger" onclick="App.deleteMateria(\'' + m.materia_id + '\')">Eliminar</button></td></tr>';
        }).join('');
    },

    updateMateriaCarreraFilter(data) {
        var sel = document.getElementById('mat-filter-carrera');
        if (!sel) return;
        var carreras = [];
        data.forEach(function(m) { if (m.carrera && carreras.indexOf(m.carrera) === -1) carreras.push(m.carrera); });
        sel.innerHTML = '<option value="">Todas las carreras</option>' + carreras.map(function(c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
    },

    showMateriaForm() {
        var body = '<div class="form-grid">' +
            '<div class="form-group"><label>Nombre</label><input type="text" id="f-mat-nombre" class="input input-full"></div>' +
            '<div class="form-group"><label>Codigo</label><input type="text" id="f-mat-codigo" class="input input-full"></div>' +
            '<div class="form-group"><label>Carrera</label>' + this.carreraSelectHtml('f-mat-carrera', '') + '</div>' +
            '<div class="form-group"><label>Semestre</label><input type="number" id="f-mat-semestre" class="input input-full" value="1"></div>' +
            '<div class="form-group"><label>Creditos</label><input type="number" id="f-mat-creditos" class="input input-full" value="1"></div>' +
            '<div class="form-group"><label>Docente</label>' + this.docenteSelectHtml('f-mat-docente', '') + '</div>' +
            '<div class="form-group"><label>Sede</label>' + this.sedeSelectHtml('f-mat-sede', 'LP') + '</div>' +
            '</div><div class="modal-actions"><button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button class="btn btn-primary" onclick="App.saveMateria()">Crear</button></div>';
        this.openModal('Nueva Materia', body);
    },

    async saveMateria() {
        var d = { nombre: document.getElementById('f-mat-nombre').value, codigo: document.getElementById('f-mat-codigo').value, carrera: document.getElementById('f-mat-carrera').value, semestre: parseInt(document.getElementById('f-mat-semestre').value) || 1, creditos: parseInt(document.getElementById('f-mat-creditos').value) || 1, docente: document.getElementById('f-mat-docente').value, sede_id: document.getElementById('f-mat-sede').value };
        try { await this.api('/api/materias', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(d) }); this.toast('Materia creada', 'success'); this.closeModal(); this.loadMaterias(); } catch (e) { }
    },

    async deleteMateria(id) { if (!confirm('Eliminar materia?')) return; try { await this.api('/api/materias/' + id, { method: 'DELETE' }); this.toast('Materia eliminada', 'success'); this.loadMaterias(); } catch (e) { } },

    // ═══════════════ INSCRIPCIONES ═══════════════
    async loadInscripciones() {
        try {
            var results = await Promise.allSettled([this.api('/api/inscripciones'), this.api('/api/estudiantes/nacional'), this.api('/api/materias')]);
            this.state.inscripciones = Array.isArray(results[0].value) ? results[0].value : [];
            var est = (results[1].status === 'fulfilled' && Array.isArray(results[1].value)) ? results[1].value : [];
            var mat = (results[2].status === 'fulfilled' && Array.isArray(results[2].value)) ? results[2].value : [];
            this.state._estMap = {}; est.forEach(function(e) { this.state._estMap[e.estudiante_id] = e.nombre + ' ' + e.apellido; }.bind(this));
            this.state._matMap = {}; mat.forEach(function(m) { this.state._matMap[m.materia_id] = m.nombre; }.bind(this));
            this.renderInscripcionesTable(this.state.inscripciones);
        } catch (e) { }
    },

    renderInscripcionesTable(data) {
        var tbody = document.querySelector('#inscripciones-table tbody');
        if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">Sin inscripciones</td></tr>'; return; }
        var self = this;
        tbody.innerHTML = data.map(function(i) {
            return '<tr><td title="' + i.inscripcion_id + '">' + i.inscripcion_id.substring(0, 8) + '...</td><td>' + (self.state._estMap[i.estudiante_id] || i.estudiante_id.substring(0, 8)) + '</td><td>' + (self.state._matMap[i.materia_id] || i.materia_id.substring(0, 8)) + '</td><td>' + self.sedeBadge(i.sede_id, true) + '</td><td>' + (i.gestion || '') + '</td><td>' + (i.semestre || '') + '</td><td>' + self.statusBadge(i.estado) + '</td><td><button class="btn btn-sm btn-danger" onclick="App.deleteInscripcion(\'' + i.inscripcion_id + '\')">Eliminar</button></td></tr>';
        }).join('');
    },

    async showInscripcionForm() {
        var est = [], mat = [];
        try { est = await this.api('/api/estudiantes/nacional'); } catch(e) {}
        try { mat = await this.api('/api/materias'); } catch(e) {}
        if (!Array.isArray(est)) est = [];
        if (!Array.isArray(mat)) mat = [];
        var body = '<div class="form-grid">' +
            '<div class="form-group form-full"><label>Estudiante</label><select id="f-ins-estudiante" class="input input-full">' + est.map(function(e) { return '<option value="' + e.estudiante_id + '">' + e.nombre + ' ' + e.apellido + ' (' + (e.sede_origen || '') + ')</option>'; }).join('') + '</select></div>' +
            '<div class="form-group form-full"><label>Materia</label><select id="f-ins-materia" class="input input-full">' + mat.map(function(m) { return '<option value="' + m.materia_id + '">' + (m.nombre || '') + ' (' + (m.codigo || '') + ')</option>'; }).join('') + '</select></div>' +
            '<div class="form-group"><label>Sede</label><select id="f-ins-sede" class="input input-full"><option value="LP">La Paz</option><option value="SC">Santa Cruz</option><option value="CB">Cochabamba</option></select></div>' +
            '<div class="form-group"><label>Gestion</label><input type="text" id="f-ins-gestion" class="input input-full" value="2024"></div>' +
            '<div class="form-group"><label>Semestre</label><select id="f-ins-semestre" class="input input-full"><option value="1">1</option><option value="2">2</option></select></div>' +
            '<div class="form-group"><label>Estado</label><select id="f-ins-estado" class="input input-full"><option value="ACTIVO">ACTIVO</option><option value="INACTIVO">INACTIVO</option><option value="RETIRADO">RETIRADO</option></select></div>' +
            '</div><div class="modal-actions"><button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button class="btn btn-primary" onclick="App.saveInscripcion()">Inscribir</button></div>';
        this.openModal('Nueva Inscripcion', body);
    },

    async saveInscripcion() {
        var d = { estudiante_id: document.getElementById('f-ins-estudiante').value, materia_id: document.getElementById('f-ins-materia').value, sede_id: document.getElementById('f-ins-sede').value, gestion: document.getElementById('f-ins-gestion').value, semestre: document.getElementById('f-ins-semestre').value, estado: document.getElementById('f-ins-estado').value };
        try { await this.api('/api/inscripciones', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(d) }); this.toast('Inscripcion creada', 'success'); this.closeModal(); this.loadInscripciones(); } catch (e) { }
    },

    async deleteInscripcion(id) { if (!confirm('Eliminar inscripcion?')) return; try { await this.api('/api/inscripciones/' + id, { method: 'DELETE' }); this.toast('Inscripcion eliminada', 'success'); this.loadInscripciones(); } catch (e) { } },

    // ═══════════════ NOTAS ═══════════════
    async loadNotas() {
        try {
            var results = await Promise.allSettled([this.api('/api/notas'), this.api('/api/estudiantes/nacional'), this.api('/api/materias')]);
            this.state.notas = Array.isArray(results[0].value) ? results[0].value : [];
            var est = (results[1].status === 'fulfilled' && Array.isArray(results[1].value)) ? results[1].value : [];
            var mat = (results[2].status === 'fulfilled' && Array.isArray(results[2].value)) ? results[2].value : [];
            this.state._estMap = {}; est.forEach(function(e) { this.state._estMap[e.estudiante_id] = e.nombre + ' ' + e.apellido; }.bind(this));
            this.state._matMap = {}; mat.forEach(function(m) { this.state._matMap[m.materia_id] = m.nombre; }.bind(this));
            this.renderNotasTable(this.state.notas);
        } catch (e) { }
    },

    renderNotasTable(data) {
        var tbody = document.querySelector('#notas-table tbody');
        if (!data || data.length === 0) { tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">Sin notas</td></tr>'; return; }
        var self = this;
        tbody.innerHTML = data.map(function(n) {
            var prom = parseFloat(n.promedio || 0);
            var estado = prom >= 51 ? 'APROBADO' : 'REPROBADO';
            var cls = prom >= 51 ? 'nota-aprobado' : 'nota-reprobado';
            return '<tr><td>' + (self.state._estMap[n.estudiante_id] || n.estudiante_id.substring(0, 8)) + '</td><td>' + (self.state._matMap[n.materia_id] || n.materia_id.substring(0, 8)) + '</td><td>' + self.sedeBadge(n.sede_id, true) + '</td><td>' + (n.nota1 ?? '') + '</td><td>' + (n.nota2 ?? '') + '</td><td>' + (n.nota3 ?? '') + '</td><td class="' + cls + '">' + prom.toFixed(2) + '</td><td class="' + cls + '">' + estado + '</td><td><button class="btn btn-sm btn-danger" onclick="App.deleteNota(\'' + n.nota_id + '\')">Eliminar</button></td></tr>';
        }).join('');
    },

    async showNotaForm() {
        var est = [], mat = [];
        try { est = await this.api('/api/estudiantes/nacional'); } catch(e) {}
        try { mat = await this.api('/api/materias'); } catch(e) {}
        if (!Array.isArray(est)) est = [];
        if (!Array.isArray(mat)) mat = [];
        var body = '<div class="form-grid">' +
            '<div class="form-group form-full"><label>Estudiante</label><select id="f-nota-estudiante" class="input input-full">' + est.map(function(e) { return '<option value="' + e.estudiante_id + '">' + (e.nombre || '') + ' ' + (e.apellido || '') + '</option>'; }).join('') + '</select></div>' +
            '<div class="form-group form-full"><label>Materia</label><select id="f-nota-materia" class="input input-full">' + mat.map(function(m) { return '<option value="' + m.materia_id + '">' + (m.nombre || '') + '</option>'; }).join('') + '</select></div>' +
            '<div class="form-group"><label>Sede</label><select id="f-nota-sede" class="input input-full"><option value="LP">La Paz</option><option value="SC">Santa Cruz</option><option value="CB">Cochabamba</option></select></div>' +
            '<div class="form-group"><label>Gestion</label><input type="text" id="f-nota-gestion" class="input input-full" value="2024"></div>' +
            '<div class="form-group"><label>Semestre</label><select id="f-nota-semestre" class="input input-full"><option value="1">1</option><option value="2">2</option></select></div><div class="form-group"></div>' +
            '<div class="form-group"><label>Nota 1</label><input type="number" id="f-nota1" class="input input-full" min="0" max="100"></div>' +
            '<div class="form-group"><label>Nota 2</label><input type="number" id="f-nota2" class="input input-full" min="0" max="100"></div>' +
            '<div class="form-group"><label>Nota 3</label><input type="number" id="f-nota3" class="input input-full" min="0" max="100"></div>' +
            '<div class="form-group"><label>Promedio</label><div id="f-nota-promedio" class="input input-full" style="display:flex;align-items:center;">-</div></div>' +
            '</div><div class="modal-actions"><button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button class="btn btn-primary" onclick="App.saveNota()">Registrar Nota</button></div>';
        this.openModal('Registrar Nota', body);
        ['f-nota1', 'f-nota2', 'f-nota3'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('input', function() {
                var n1 = parseFloat(document.getElementById('f-nota1').value) || 0;
                var n2 = parseFloat(document.getElementById('f-nota2').value) || 0;
                var n3 = parseFloat(document.getElementById('f-nota3').value) || 0;
                var prom = ((n1 + n2 + n3) / 3).toFixed(2);
                var el2 = document.getElementById('f-nota-promedio');
                if (el2) { el2.textContent = prom + (parseFloat(prom) >= 51 ? ' (APROBADO)' : ' (REPROBADO)'); el2.style.color = parseFloat(prom) >= 51 ? '#166534' : '#991b1b'; }
            });
        });
    },

    async saveNota() {
        var d = { estudiante_id: document.getElementById('f-nota-estudiante').value, materia_id: document.getElementById('f-nota-materia').value, sede_id: document.getElementById('f-nota-sede').value, gestion: document.getElementById('f-nota-gestion').value, semestre: document.getElementById('f-nota-semestre').value, nota1: parseFloat(document.getElementById('f-nota1').value) || 0, nota2: parseFloat(document.getElementById('f-nota2').value) || 0, nota3: parseFloat(document.getElementById('f-nota3').value) || 0 };
        try { await this.api('/api/notas', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(d) }); this.toast('Nota registrada', 'success'); this.closeModal(); this.loadNotas(); } catch (e) { }
    },

    async deleteNota(id) { if (!confirm('Eliminar nota?')) return; try { await this.api('/api/notas/' + id, { method: 'DELETE' }); this.toast('Nota eliminada', 'success'); this.loadNotas(); } catch (e) { } },

    // ═══════════════ FRAGMENTACION ═══════════════
    async loadFragmentacion() { await this.loadFragmentacionHorizontal(); },

    async loadFragmentacionHorizontal() {
        try {
            var stats = await this.api('/api/stats');
            if (stats) {
                document.getElementById('frag-lp-count').textContent = stats.estudiantesLaPaz;
                document.getElementById('frag-sc-count').textContent = stats.estudiantesSantaCruz;
                document.getElementById('frag-cb-count').textContent = stats.estudiantesCochabamba;
            }
        } catch (e) {}
        try {
            var data = await this.api('/api/fragmentacion/horizontal');
            if (!data) return;
            document.getElementById('frag-h-sql').classList.remove('hidden');
            document.getElementById('frag-h-sql-text').textContent = data.sql;
            document.getElementById('frag-h-tables').classList.remove('hidden');
            var formatTable = function(rows, tableId) {
                var tbody = document.querySelector('#' + tableId + ' tbody');
                if (!rows || rows.length === 0) { tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">Sin datos</td></tr>'; return; }
                tbody.innerHTML = rows.slice(0, 10).map(function(r) { return '<tr><td>' + (r.nombre || '') + '</td><td>' + (r.apellido || '') + '</td><td>' + (r.carrera || '') + '</td><td>' + (r.semestre || '') + '</td></tr>'; }).join('');
            };
            formatTable(data.lapaz, 'frag-lp-table');
            formatTable(data.santacruz, 'frag-sc-table');
            formatTable(data.cochabamba, 'frag-cb-table');
        } catch (e) { }
    },

    async executeVerticalJoin() {
        try {
            var data = await this.api('/api/fragmentacion/vertical');
            if (!data) return;
            document.getElementById('frag-v-sql').classList.remove('hidden');
            document.getElementById('frag-v-sql-text').textContent = data.sql;
            document.getElementById('frag-v-result').classList.remove('hidden');
            var tbody = document.querySelector('#frag-v-table tbody');
            if (!data.personal || data.personal.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">Sin datos - Registre estudiantes completos primero</td></tr>';
                return;
            }
            var acadMap = {};
            (data.academico || []).forEach(function(a) { acadMap[a.estudiante_id] = a; });
            tbody.innerHTML = data.personal.slice(0, 15).map(function(p) {
                var a = acadMap[p.estudiante_id] || {};
                return '<tr><td title="' + p.estudiante_id + '">' + p.estudiante_id.substring(0, 8) + '...</td><td>' + (p.ci || '') + '</td><td>' + (p.genero || '') + '</td><td>' + (a.nombre || '') + '</td><td>' + (a.apellido || '') + '</td><td>' + (a.carrera || '') + '</td><td>' + (a.semestre_actual || '') + '</td><td>' + App.sedeBadge(a.sede_id, true) + '</td><td>' + (a.promedio_general || 0) + '</td></tr>';
            }).join('');
        } catch (e) { }
    },

    async loadFragmentacionVertical() {
        try {
            var data = await this.api('/api/fragmentacion/vertical');
            if (!data) return;
            document.getElementById('frag-v-sql').classList.remove('hidden');
            document.getElementById('frag-v-sql-text').textContent = data.sql;
            document.getElementById('frag-v-result').classList.remove('hidden');
            var tbody = document.querySelector('#frag-v-table tbody');
            if (!data.personal || data.personal.length === 0) { tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">Sin datos</td></tr>'; return; }
            var acadMap = {};
            (data.academico || []).forEach(function(a) { acadMap[a.estudiante_id] = a; });
            tbody.innerHTML = data.personal.slice(0, 15).map(function(p) {
                var a = acadMap[p.estudiante_id] || {};
                return '<tr><td title="' + p.estudiante_id + '">' + p.estudiante_id.substring(0, 8) + '...</td><td>' + (p.ci || '') + '</td><td>' + (p.genero || '') + '</td><td>' + (a.nombre || '') + '</td><td>' + (a.apellido || '') + '</td><td>' + (a.carrera || '') + '</td><td>' + (a.semestre_actual || '') + '</td><td>' + App.sedeBadge(a.sede_id, true) + '</td><td>' + (a.promedio_general || 0) + '</td></tr>';
            }).join('');
        } catch (e) { }
    },

    // ═══════════════ MONITOR ═══════════════
    async loadMonitor() {
        try {
            var data = await this.api('/api/monitor');
            if (!data) return;
            document.getElementById('monitor-equipos').textContent = data.equiposConectados;
            document.getElementById('map-lp-count').textContent = (data.sedes && data.sedes['La Paz'] || 0) + ' equipos';
            document.getElementById('map-sc-count').textContent = (data.sedes && data.sedes['Santa Cruz'] || 0) + ' equipos';
            document.getElementById('map-cb-count').textContent = (data.sedes && data.sedes['Cochabamba'] || 0) + ' equipos';
            var sessionsTbody = document.querySelector('#monitor-sessions tbody');
            if (data.sesiones && data.sesiones.length > 0) {
                var self = this;
                sessionsTbody.innerHTML = data.sesiones.map(function(s) { return '<tr><td>' + s.ip + '</td><td>' + self.sedeBadge(s.sede) + '</td><td>' + (s.conectadoHace || '') + '</td></tr>'; }).join('');
            } else {
                sessionsTbody.innerHTML = '<tr><td colspan="3" class="empty-cell">Sin sesiones</td></tr>';
            }
            var feed = document.getElementById('monitor-activity');
            if (data.actividad && data.actividad.length > 0) {
                feed.innerHTML = data.actividad.map(function(a) {
                    var cls = a.sede === 'La Paz' ? 'act-lp' : a.sede === 'Santa Cruz' ? 'act-sc' : 'act-cb';
                    return '<div class="activity-item ' + cls + '">[' + a.sede + '] ' + a.action + '</div>';
                }).join('');
            } else {
                feed.innerHTML = '<p class="text-muted">Sin actividad reciente</p>';
            }
        } catch (e) { }
    },

    async registerMonitor() {
        try { await fetch('/api/monitor/register', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ sede: this.state.sede || 'La Paz' }) }); } catch (e) { }
    },

    // ═══════════════ SEDES ═══════════════
    async loadSedes() {
        try {
            var results = await Promise.allSettled([this.api('/api/sedes'), this.api('/api/stats')]);
            var sedes = (results[0].status === 'fulfilled' && Array.isArray(results[0].value)) ? results[0].value : [];
            var stats = (results[1].status === 'fulfilled') ? results[1].value : {};
            this.state.sedes = sedes;
            var estCounts = { 'LP': stats.estudiantesLaPaz || 0, 'SC': stats.estudiantesSantaCruz || 0, 'CB': stats.estudiantesCochabamba || 0 };
            this.renderSedesTable(sedes, estCounts);
        } catch (e) { }
    },

    renderSedesTable(sedes, estCounts) {
        var tbody = document.querySelector('#sedes-table tbody');
        if (!sedes || sedes.length === 0) { tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">Sin sedes</td></tr>'; return; }
        tbody.innerHTML = sedes.map(function(s) {
            var key = s.sede_id || (s.nombre || '').substring(0, 2).toUpperCase();
            var count = estCounts[key] || 0;
            var cap = parseInt(s.capacidad_maxima) || 0;
            var pct = cap > 0 ? Math.min((count / cap) * 100, 100) : 0;
            var color = pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#22c55e';
            return '<tr><td title="' + s.sede_id + '">' + (s.sede_id || '').substring(0, 8) + '...</td><td>' + (s.nombre || '') + '</td><td>' + (s.ciudad || '') + '</td><td>' + (s.director || '') + '</td><td>' + (s.email || '') + '</td><td>' + cap + '</td><td>' + count + '</td><td><div class="progress-bar-bg"><div class="progress-bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div><div class="progress-label">' + pct.toFixed(0) + '%</div></td><td><button class="btn btn-sm btn-secondary" onclick="App.editSede(\'' + s.sede_id + '\')">Editar</button> <button class="btn btn-sm btn-danger" onclick="App.deleteSede(\'' + s.sede_id + '\')">Eliminar</button></td></tr>';
        }).join('');
    },

    showSedeForm(sede) {
        var isEdit = !!sede;
        var body = '<div class="form-grid">' +
            '<div class="form-group"><label>Nombre</label><input type="text" id="f-sede-nombre" class="input input-full" value="' + (sede ? sede.nombre || '' : '') + '"></div>' +
            '<div class="form-group"><label>Ciudad</label><input type="text" id="f-sede-ciudad" class="input input-full" value="' + (sede ? sede.ciudad || '' : '') + '"></div>' +
            '<div class="form-group"><label>Director</label><input type="text" id="f-sede-director" class="input input-full" value="' + (sede ? sede.director || '' : '') + '"></div>' +
            '<div class="form-group"><label>Direccion</label><input type="text" id="f-sede-direccion" class="input input-full" value="' + (sede ? sede.direccion || '' : '') + '"></div>' +
            '<div class="form-group"><label>Telefono</label><input type="text" id="f-sede-telefono" class="input input-full" value="' + (sede ? sede.telefono || '' : '') + '"></div>' +
            '<div class="form-group"><label>Email</label><input type="email" id="f-sede-email" class="input input-full" value="' + (sede ? sede.email || '' : '') + '"></div>' +
            '<div class="form-group form-full"><label>Capacidad Maxima</label><input type="number" id="f-sede-capacidad" class="input input-full" value="' + (sede ? sede.capacidad_maxima || 0 : 0) + '"></div>' +
            '</div><div class="modal-actions"><button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button class="btn btn-primary" onclick="App.saveSede(' + (isEdit ? "'" + sede.sede_id + "'" : 'null') + ')">' + (isEdit ? 'Actualizar' : 'Crear') + '</button></div>';
        this.openModal(isEdit ? 'Editar Sede' : 'Nueva Sede', body);
    },

    async saveSede(id) {
        var d = { nombre: document.getElementById('f-sede-nombre').value, ciudad: document.getElementById('f-sede-ciudad').value, director: document.getElementById('f-sede-director').value, direccion: document.getElementById('f-sede-direccion').value, telefono: document.getElementById('f-sede-telefono').value, email: document.getElementById('f-sede-email').value, capacidad_maxima: parseInt(document.getElementById('f-sede-capacidad').value) || 0 };
        try {
            if (id) { await this.api('/api/sedes/' + id, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(d) }); this.toast('Sede actualizada', 'success'); }
            else { await this.api('/api/sedes', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(d) }); this.toast('Sede creada', 'success'); }
            this.closeModal(); this.loadSedes();
        } catch (e) { }
    },

    editSede(id) { var s = this.state.sedes.find(function(x) { return x.sede_id === id; }); if (s) this.showSedeForm(s); },

    async deleteSede(id) { if (!confirm('Seguro que deseas eliminar esta sede?')) return; try { await this.api('/api/sedes/' + id, { method: 'DELETE' }); this.toast('Sede eliminada', 'success'); this.loadSedes(); } catch (e) {} },

    // ═══════════════ MODAL ═══════════════
    openModal(title, bodyContent) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = bodyContent;
        var overlay = document.getElementById('modal-overlay');
        if (overlay) overlay.classList.remove('hidden');
    },

    closeModal() {
        var overlay = document.getElementById('modal-overlay');
        if (overlay) overlay.classList.add('hidden');
    },

    closeModalOutside(e) { if (e.target.id === 'modal-overlay') this.closeModal(); },

    // ═══════════════ HELPERS ═══════════════
    sedeMatch(sedeId, filter) {
        if (!filter) return true;
        var s = String(sedeId || '').toLowerCase();
        var f = String(filter).toLowerCase();
        if (s === f) return true;
        if (f === 'lp' && (s.indexOf('lp') !== -1)) return true;
        if (f === 'sc' && (s.indexOf('sc') !== -1)) return true;
        if (f === 'cb' && (s.indexOf('cb') !== -1)) return true;
        return false;
    },

    sedeBadge(sede, short) {
        if (!sede) return '<span class="badge">-</span>';
        var s = String(sede);
        if (s === 'LP' || s === 'La Paz' || s === 'lapaz' || s.indexOf('lp') !== -1 || s.indexOf('La Paz') !== -1) return '<span class="badge badge-lp">' + (short ? 'LP' : 'La Paz') + '</span>';
        if (s === 'SC' || s === 'Santa Cruz' || s === 'santacruz' || s.indexOf('sc') !== -1 || s.indexOf('Santa Cruz') !== -1) return '<span class="badge badge-sc">' + (short ? 'SC' : 'Santa Cruz') + '</span>';
        if (s === 'CB' || s === 'Cochabamba' || s === 'cochabamba' || s.indexOf('cb') !== -1 || s.indexOf('Cochabamba') !== -1) return '<span class="badge badge-cb">' + (short ? 'CB' : 'Cochabamba') + '</span>';
        return '<span class="badge">' + sede + '</span>';
    },

    statusBadge(status) {
        if (!status) return '<span class="badge">-</span>';
        var s = String(status).toUpperCase();
        if (s === 'ACTIVO') return '<span class="badge badge-active">ACTIVO</span>';
        if (s === 'INACTIVO') return '<span class="badge badge-inactive">INACTIVO</span>';
        if (s === 'RETIRADO') return '<span class="badge badge-pending">RETIRADO</span>';
        return '<span class="badge">' + status + '</span>';
    }
};

document.addEventListener('DOMContentLoaded', function() { App.init(); });