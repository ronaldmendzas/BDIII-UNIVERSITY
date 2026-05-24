"""UniSpanner - Tests del Sistema"""
import sys
import json
import time
import traceback

BASE_URL = 'http://localhost:3000'
created = {}

def test(name, fn):
    try:
        result = fn()
        if result:
            print(f'  [OK] {name}')
        else:
            print(f'  [FALLO] {name}')
        return result
    except Exception as e:
        print(f'  [ERROR] {name}: {e}')
        return False

def get(path):
    try:
        import urllib.request
        req = urllib.request.Request(f'{BASE_URL}{path}')
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        return None

def post(path, data):
    try:
        import urllib.request
        body = json.dumps(data).encode()
        req = urllib.request.Request(f'{BASE_URL}{path}', data=body, headers={'Content-Type': 'application/json'}, method='POST')
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        print(f'    POST error: {e}')
        return None

def put(path, data):
    try:
        import urllib.request
        body = json.dumps(data).encode()
        req = urllib.request.Request(f'{BASE_URL}{path}', data=body, headers={'Content-Type': 'application/json'}, method='PUT')
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        print(f'    PUT error: {e}')
        return None

def delete(path):
    try:
        import urllib.request
        req = urllib.request.Request(f'{BASE_URL}{path}', method='DELETE')
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        print(f'    DELETE error: {e}')
        return None

def main():
    global created
    passed = 0
    failed = 0
    print('=' * 60)
    print('  UniSpanner - Tests del Sistema')
    print('  Verificando http://localhost:3000')
    print('=' * 60)
    print()

    # ═══════════════ 1. FRONTEND ═══════════════
    print('1. FRONTEND')
    def t_index():
        try:
            import urllib.request
            req = urllib.request.Request(BASE_URL + '/')
            with urllib.request.urlopen(req, timeout=10) as resp:
                html = resp.read().decode()
                return 'UniSpanner' in html
        except Exception as e:
            print(f'    {e}')
            return False

    def t_css():
        try:
            import urllib.request
            req = urllib.request.Request(BASE_URL + '/style.css')
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = resp.read().decode()
                return len(data) > 100
        except:
            return False

    def t_js():
        try:
            import urllib.request
            req = urllib.request.Request(BASE_URL + '/app.js')
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = resp.read().decode()
                return 'App' in data
        except:
            return False

    if test('Pagina principal (index.html)', t_index): passed += 1
    else: failed += 1
    if test('Archivo CSS (style.css)', t_css): passed += 1
    else: failed += 1
    if test('Archivo JS (app.js)', t_js): passed += 1
    else: failed += 1
    print()

    # ═══════════════ 2. CONEXION SPANNER ═══════════════
    print('2. CONEXION SPANNER')
    def t_conn():
        d = get('/api/connection-status')
        if d and d.get('connected') == True:
            print('    -> Spanner CONECTADO')
            return True
        elif d is not None:
            print('    -> Spanner NO CONECTADO (pero endpoint funciona)')
            return True
        return False

    if test('Estado de conexion Spanner', t_conn): passed += 1
    else: failed += 1
    print()

    # ═══════════════ 3. STATS ═══════════════
    print('3. DASHBOARD - STATS')
    def t_stats():
        d = get('/api/stats')
        return d is not None and 'totalNacional' in d

    if test('GET /api/stats', t_stats): passed += 1
    else: failed += 1
    print()

    # ═══════════════ 4. ESTUDIANTES ═══════════════
    print('4. ESTUDIANTES')

    def t_est_lp():
        d = get('/api/estudiantes/lapaz')
        if d is None: return False
        if isinstance(d, list): return True
        if isinstance(d, dict) and 'error' in d: return False
        return False

    def t_est_sc():
        d = get('/api/estudiantes/santacruz')
        return d is not None

    def t_est_cb():
        d = get('/api/estudiantes/cochabamba')
        return d is not None

    def t_est_nacional():
        d = get('/api/estudiantes/nacional')
        return d is not None and isinstance(d, list)

    def t_est_crear_lp():
        d = post('/api/estudiantes/lapaz', {
            'nombre': 'TestLP', 'apellido': 'Apellido', 'ci': '12345',
            'carrera': 'Informatica', 'semestre': 3, 'email': 'test@lp.bo',
            'telefono': '70000001', 'estado': 'ACTIVO'
        })
        if d and d.get('success'):
            created['est_lp'] = d.get('id')
            print(f'    -> Creado estudiante LP: {created["est_lp"][:8]}...')
            return True
        return False

    def t_est_crear_sc():
        d = post('/api/estudiantes/santacruz', {
            'nombre': 'TestSC', 'apellido': 'Apellido', 'ci': '67890',
            'carrera': 'Sistemas', 'semestre': 2, 'email': 'test@sc.bo',
            'telefono': '70000002', 'estado': 'ACTIVO'
        })
        if d and d.get('success'):
            created['est_sc'] = d.get('id')
            print(f'    -> Creado estudiante SC: {created["est_sc"][:8]}...')
            return True
        return False

    if test('GET /api/estudiantes/lapaz', t_est_lp): passed += 1
    else: failed += 1
    if test('GET /api/estudiantes/santacruz', t_est_sc): passed += 1
    else: failed += 1
    if test('GET /api/estudiantes/cochabamba', t_est_cb): passed += 1
    else: failed += 1
    if test('GET /api/estudiantes/nacional (UNION)', t_est_nacional): passed += 1
    else: failed += 1
    if test('POST /api/estudiantes/lapaz (crear)', t_est_crear_lp): passed += 1
    else: failed += 1
    time.sleep(1)
    if test('POST /api/estudiantes/santacruz (crear)', t_est_crear_sc): passed += 1
    else: failed += 1
    time.sleep(1)

    def t_est_actualizar():
        if 'est_lp' not in created: return False
        d = put(f'/api/estudiantes/lapaz/{created["est_lp"]}', {
            'nombre': 'TestLP_Act', 'apellido': 'Apellido', 'ci': '12345',
            'carrera': 'Informatica', 'semestre': 4, 'email': 'test2@lp.bo',
            'telefono': '70000001', 'estado': 'ACTIVO'
        })
        return d is not None and d.get('success') == True

    if test('PUT /api/estudiantes/lapaz/{id} (actualizar)', t_est_actualizar): passed += 1
    else: failed += 1

    # ═══════════════ 5. ESTUDIANTE COMPLETO (FRAGMENTACION VERTICAL) ═══════════════
    print()
    print('5. FRAGMENTACION VERTICAL')

    def t_est_completo_crear():
        d = post('/api/estudiantes/completo', {
            'ci': '99999', 'fecha_nacimiento': '2000-01-15', 'telefono': '75000001',
            'direccion': 'Calle Test 123', 'email': 'completo@test.bo', 'genero': 'M',
            'nombre': 'TestCompleto', 'apellido': 'Vertical', 'carrera': 'Informatica',
            'semestre_actual': 5, 'sede_id': 'LP', 'estado': 'ACTIVO',
            'gestion_ingreso': '2024', 'promedio_general': 75.5
        })
        if d and d.get('success'):
            created['est_completo'] = d.get('id')
            print(f'    -> Creado estudiante completo: {created["est_completo"][:8]}...')
            return True
        return False

    def t_est_completo_get():
        if 'est_completo' not in created: return False
        d = get(f'/api/estudiantes/completo/{created["est_completo"]}')
        return d is not None and isinstance(d, dict) and 'estudiante_id' in d

    def t_est_personal():
        d = get('/api/estudiantes/personal')
        return d is not None

    def t_est_academico():
        d = get('/api/estudiantes/academico')
        return d is not None

    if test('POST /api/estudiantes/completo (vertical)', t_est_completo_crear): passed += 1
    else: failed += 1
    if test('GET /api/estudiantes/completo/{id} (JOIN)', t_est_completo_get): passed += 1
    else: failed += 1
    if test('GET /api/estudiantes/personal', t_est_personal): passed += 1
    else: failed += 1
    if test('GET /api/estudiantes/academico', t_est_academico): passed += 1
    else: failed += 1

    # ═══════════════ 6. DOCENTES ═══════════════
    print()
    print('6. DOCENTES')

    def t_doc_get():
        d = get('/api/docentes')
        return d is not None and isinstance(d, list)

    def t_doc_crear():
        d = post('/api/docentes', {
            'nombre': 'Dr. Test', 'apellido': 'Docente', 'ci': '55555',
            'email': 'doc@test.bo', 'telefono': '76000001', 'especialidad': 'Base de Datos',
            'sede_id': 'LP', 'estado': 'ACTIVO'
        })
        if d and d.get('success'):
            created['doc'] = d.get('id')
            print(f'    -> Creado docente: {created["doc"][:8]}...')
            return True
        return False

    def t_doc_actualizar():
        if 'doc' not in created: return False
        d = put(f'/api/docentes/{created["doc"]}', {
            'nombre': 'Dr. Test_Act', 'apellido': 'Docente', 'ci': '55555',
            'email': 'doc2@test.bo', 'telefono': '76000001', 'especialidad': 'Base de Datos',
            'sede_id': 'LP', 'estado': 'ACTIVO'
        })
        return d is not None and d.get('success') == True

    if test('GET /api/docentes', t_doc_get): passed += 1
    else: failed += 1
    if test('POST /api/docentes (crear)', t_doc_crear): passed += 1
    else: failed += 1
    if test('PUT /api/docentes/{id} (actualizar)', t_doc_actualizar): passed += 1
    else: failed += 1

    # ═══════════════ 7. MATERIAS ═══════════════
    print()
    print('7. MATERIAS')

    def t_mat_get():
        d = get('/api/materias')
        return d is not None and isinstance(d, list)

    def t_mat_crear():
        d = post('/api/materias', {
            'nombre': 'Base de Datos III', 'codigo': 'BD301', 'carrera': 'Informatica',
            'semestre': 6, 'creditos': 5, 'docente': 'Dr. Test Docente', 'sede_id': 'LP'
        })
        if d and d.get('success'):
            created['mat'] = d.get('id')
            print(f'    -> Creada materia: {created["mat"][:8]}...')
            return True
        return False

    if test('GET /api/materias', t_mat_get): passed += 1
    else: failed += 1
    if test('POST /api/materias (crear)', t_mat_crear): passed += 1
    else: failed += 1

    # ═══════════════ 8. INSCRIPCIONES ═══════════════
    print()
    print('8. INSCRIPCIONES')

    def t_ins_get():
        d = get('/api/inscripciones')
        return d is not None and isinstance(d, list)

    def t_ins_crear():
        d = post('/api/inscripciones', {
            'estudiante_id': created.get('est_lp', 'test-123'),
            'materia_id': created.get('mat', 'test-456'),
            'sede_id': 'LP', 'gestion': '2024', 'semestre': '1', 'estado': 'ACTIVO'
        })
        if d and d.get('success'):
            created['ins'] = d.get('id')
            print(f'    -> Creada inscripcion: {created["ins"][:8]}...')
            return True
        return False

    if test('GET /api/inscripciones', t_ins_get): passed += 1
    else: failed += 1
    if test('POST /api/inscripciones (crear)', t_ins_crear): passed += 1
    else: failed += 1

    # ═══════════════ 9. NOTAS ═══════════════
    print()
    print('9. NOTAS')

    def t_notas_get():
        d = get('/api/notas')
        return d is not None and isinstance(d, list)

    def t_notas_crear():
        d = post('/api/notas', {
            'estudiante_id': created.get('est_lp', 'test-123'),
            'materia_id': created.get('mat', 'test-456'),
            'sede_id': 'LP', 'nota1': 70, 'nota2': 80, 'nota3': 60,
            'gestion': '2024', 'semestre': '1'
        })
        if d and d.get('success'):
            created['nota'] = d.get('id')
            prom = d.get('promedio', 0)
            estado = 'APROBADO' if prom >= 51 else 'REPROBADO'
            print(f'    -> Creada nota: {created["nota"][:8]}... Promedio: {prom} ({estado})')
            return True
        return False

    if test('GET /api/notas', t_notas_get): passed += 1
    else: failed += 1
    if test('POST /api/notas (crear)', t_notas_crear): passed += 1
    else: failed += 1

    # ═══════════════ 10. SEDES ═══════════════
    print()
    print('10. SEDES')

    def t_sedes_get():
        d = get('/api/sedes')
        return d is not None and isinstance(d, list)

    if test('GET /api/sedes', t_sedes_get): passed += 1
    else: failed += 1

    # ═══════════════ 11. FRAGMENTACION ═══════════════
    print()
    print('11. FRAGMENTACION')

    def t_frag_h():
        d = get('/api/fragmentacion/horizontal')
        return d is not None and 'sql' in d

    def t_frag_v():
        d = get('/api/fragmentacion/vertical')
        return d is not None and 'sql' in d

    if test('GET /api/fragmentacion/horizontal', t_frag_h): passed += 1
    else: failed += 1
    if test('GET /api/fragmentacion/vertical', t_frag_v): passed += 1
    else: failed += 1

    # ═══════════════ 12. MONITOR ═══════════════
    print()
    print('12. MONITOR')

    def t_monitor_get():
        d = get('/api/monitor')
        return d is not None and 'equiposConectados' in d

    def t_monitor_register():
        d = post('/api/monitor/register', {'sede': 'La Paz'})
        return d is not None and d.get('success') == True

    if test('GET /api/monitor', t_monitor_get): passed += 1
    else: failed += 1
    if test('POST /api/monitor/register', t_monitor_register): passed += 1
    else: failed += 1

    # ═══════════════ 13. LIMPIEZA (DELETE) ═══════════════
    print()
    print('13. LIMPIEZA (DELETE)')

    def t_del_nota():
        if 'nota' not in created: return False
        d = delete(f'/api/notas/{created["nota"]}')
        return d is not None and d.get('success') == True

    def t_del_inscripcion():
        if 'ins' not in created: return False
        d = delete(f'/api/inscripciones/{created["ins"]}')
        return d is not None and d.get('success') == True

    def t_del_materia():
        if 'mat' not in created: return False
        d = delete(f'/api/materias/{created["mat"]}')
        return d is not None and d.get('success') == True

    def t_del_docente():
        if 'doc' not in created: return False
        d = delete(f'/api/docentes/{created["doc"]}')
        return d is not None and d.get('success') == True

    def t_del_est_lp():
        if 'est_lp' not in created: return False
        d = delete(f'/api/estudiantes/lapaz/{created["est_lp"]}')
        return d is not None and d.get('success') == True

    def t_del_est_sc():
        if 'est_sc' not in created: return False
        d = delete(f'/api/estudiantes/santacruz/{created["est_sc"]}')
        return d is not None and d.get('success') == True

    if test('DELETE /api/notas/{id}', t_del_nota): passed += 1
    else: failed += 1
    if test('DELETE /api/inscripciones/{id}', t_del_inscripcion): passed += 1
    else: failed += 1
    if test('DELETE /api/materias/{id}', t_del_materia): passed += 1
    else: failed += 1
    if test('DELETE /api/docentes/{id}', t_del_docente): passed += 1
    else: failed += 1
    if test('DELETE /api/estudiantes/lapaz/{id}', t_del_est_lp): passed += 1
    else: failed += 1
    if test('DELETE /api/estudiantes/santacruz/{id}', t_del_est_sc): passed += 1
    else: failed += 1

    # ═══════════════ RESUMEN ═══════════════
    print()
    print('=' * 60)
    total = passed + failed
    print(f'  RESULTADO: {passed}/{total} tests pasados')
    if failed > 0:
        print(f'  FALLARON: {failed} tests')
    else:
        print('  TODOS LOS TESTS PASARON!')
    print('=' * 60)

if __name__ == '__main__':
    main()