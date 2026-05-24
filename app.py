import os
import sys
import json
import uuid
import datetime
import time
import threading
import logging
import warnings
import traceback

logging.disable(logging.CRITICAL)
warnings.filterwarnings('ignore')

os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), 'credenciales.json'
)
os.environ['SPANNER_TELEMETRY_DISABLED'] = '1'
os.environ['GOOGLE_CLOUD_DISABLE_METRICS'] = '1'
os.environ['GRPC_ENABLE_FORK_SUPPORT'] = 'false'
os.environ['GRPC_POLL_STRATEGY'] = 'epoll1'

from flask import Flask, request, jsonify, send_from_directory, Response
from werkzeug.exceptions import NotFound
from google.cloud import spanner
from google.cloud.spanner import param_types
from google.api_core import exceptions as gcp_exceptions

app = Flask(__name__)

PROJECT_ID = 'fresh-effort-484916-c7'
INSTANCE_ID = 'instancia-expo'
DATABASE_ID = 'bd-universidad'

client = None
instance = None
database = None
spanner_connected = False
spanner_checked = False


def init_spanner():
    global client, instance, database, spanner_connected, spanner_checked
    try:
        client = spanner.Client(project=PROJECT_ID)
        instance = client.instance(INSTANCE_ID)
        database = instance.database(DATABASE_ID)
        with database.snapshot() as snapshot:
            list(snapshot.execute_sql('SELECT 1'))
        spanner_connected = True
        print('Conectado a Google Cloud Spanner')
    except Exception as e:
        print(f'Error conectando a Spanner: {e}')
        spanner_connected = False
    spanner_checked = True


init_spanner()

sessions = []
activity_log = []
sessions_lock = threading.Lock()


def register_session(ip, sede, client_id=None, nombre=None):
    ip = ip.replace('127.0.0.1', 'local')
    with sessions_lock:
        if client_id:
            for s in sessions:
                if s.get('client_id') == client_id:
                    s['sede'] = sede
                    s['ip'] = ip
                    s['nombre'] = nombre or s.get('nombre', 'Anonimo')
                    s['lastActivity'] = datetime.datetime.now().isoformat()
                    return
        sessions.append({
            'id': str(uuid.uuid4()),
            'client_id': client_id or str(uuid.uuid4()),
            'ip': ip,
            'nombre': nombre or 'Anonimo',
            'sede': sede,
            'connectedAt': datetime.datetime.now().isoformat(),
            'lastActivity': datetime.datetime.now().isoformat()
        })


def log_activity(sede, action):
    with sessions_lock:
        activity_log.insert(0, {
            'sede': sede,
            'action': action,
            'timestamp': datetime.datetime.now().isoformat()
        })
        if len(activity_log) > 50:
            activity_log.pop()


class SpannerEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime.datetime):
            return obj.isoformat()
        if isinstance(obj, datetime.date):
            return obj.isoformat()
        if hasattr(obj, 'seconds'):
            return datetime.datetime.fromtimestamp(obj.seconds).isoformat()
        return str(obj)


def json_resp(data, status=200):
    return Response(json.dumps(data, cls=SpannerEncoder, default=str), status=status, mimetype='application/json')


SEDE_TABLES = {
    'lapaz': 'Estudiantes_LaPaz',
    'santacruz': 'Estudiantes_SantaCruz',
    'cochabamba': 'Estudiantes_Cochabamba'
}


def safe_query(sql, params=None, param_types_dict=None):
    try:
        with database.snapshot() as snapshot:
            if params and param_types_dict:
                results = snapshot.execute_sql(sql, params=params, param_types=param_types_dict)
            else:
                results = snapshot.execute_sql(sql)
            col_names = []
            try:
                col_names = [field.name for field in results.fields]
            except Exception:
                pass
            rows = list(results)
            if not rows:
                return []
            if not col_names:
                try:
                    col_names = [field.name for field in results.fields]
                except Exception:
                    col_names = ['col_' + str(i) for i in range(len(rows[0]))]
            return [dict(zip(col_names, r)) for r in rows]
    except Exception as e:
        print(f'Query error: {e}')
        raise


def safe_insert(table, columns, values):
    try:
        with database.batch() as batch:
            batch.insert_or_update(table=table, columns=columns, values=[tuple(values)])
        return True
    except Exception as e:
        print(f'Insert error: {e}')
        raise


def safe_delete(sql, params=None, param_types_dict=None):
    def transaction_func(transaction):
        if params and param_types_dict:
            row_count = transaction.execute_update(sql, params=params, param_types=param_types_dict)
        else:
            row_count = transaction.execute_update(sql)
        return row_count
    try:
        result = database.run_in_transaction(transaction_func)
        return result
    except Exception as e:
        print(f'Delete error: {e}')
        raise


def now_ts():
    return datetime.datetime.now(datetime.timezone.utc)


def sede_label(sede_id):
    s = str(sede_id).lower() if sede_id else ''
    if s in ('lp', 'la paz', 'lapaz') or 'lp' in s or 'la paz' in s:
        return 'La Paz'
    if s in ('sc', 'santa cruz', 'santacruz') or 'sc' in s or 'santa cruz' in s:
        return 'Santa Cruz'
    if s in ('cb', 'cochabamba') or 'cb' in s or 'cochabamba' in s:
        return 'Cochabamba'
    return str(sede_id)


# ══════════════════════════════════════
# SERVIR FRONTEND
# ══════════════════════════════════════

PUBLIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public')

@app.route('/')
def index():
    return send_from_directory(PUBLIC_DIR, 'index.html')

@app.route('/style.css')
def serve_css():
    return send_from_directory(PUBLIC_DIR, 'style.css', mimetype='text/css')

@app.route('/app.js')
def serve_js():
    return send_from_directory(PUBLIC_DIR, 'app.js', mimetype='application/javascript')





# ══════════════════════════════════════
# API ROUTES
# ══════════════════════════════════════

@app.route('/api/connection-status')
def connection_status():
    return json_resp({'connected': spanner_connected})


@app.route('/api/options')
def get_options():
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        carreras = set()
        sedes_list = []
        docentes_nombres = []
        try:
            lp = safe_query('SELECT DISTINCT carrera FROM Estudiantes_LaPaz WHERE carrera IS NOT NULL AND carrera != \"\"')
            for r in lp:
                if r.get('carrera') or (isinstance(r, (list, tuple)) and len(r) > 0):
                    carreras.add(r.get('carrera', '') if isinstance(r, dict) else str(r[0]))
        except Exception:
            pass
        try:
            sc = safe_query('SELECT DISTINCT carrera FROM Estudiantes_SantaCruz WHERE carrera IS NOT NULL AND carrera != \"\"')
            for r in sc:
                if r.get('carrera') or (isinstance(r, (list, tuple)) and len(r) > 0):
                    carreras.add(r.get('carrera', '') if isinstance(r, dict) else str(r[0]))
        except Exception:
            pass
        try:
            cb = safe_query('SELECT DISTINCT carrera FROM Estudiantes_Cochabamba WHERE carrera IS NOT NULL AND carrera != \"\"')
            for r in cb:
                if r.get('carrera') or (isinstance(r, (list, tuple)) and len(r) > 0):
                    carreras.add(r.get('carrera', '') if isinstance(r, dict) else str(r[0]))
        except Exception:
            pass
        try:
            mat_carreras = safe_query('SELECT DISTINCT carrera FROM Materias WHERE carrera IS NOT NULL AND carrera != \"\"')
            for r in mat_carreras:
                if r.get('carrera') or (isinstance(r, (list, tuple)) and len(r) > 0):
                    carreras.add(r.get('carrera', '') if isinstance(r, dict) else str(r[0]))
        except Exception:
            pass
        try:
            sedes_rows = safe_query('SELECT * FROM Sedes')
            sedes_list = sedes_rows if sedes_rows else []
        except Exception:
            pass
        try:
            doc_rows = safe_query('SELECT docente_id, nombre, apellido FROM Docentes')
            for d in (doc_rows if doc_rows else []):
                docentes_nombres.append({'id': d.get('docente_id', ''), 'nombre': (d.get('nombre', '') + ' ' + d.get('apellido', '')).strip()})
        except Exception:
            pass
        carreras.discard('')
        carreras.discard(None)
        return json_resp({
            'carreras': sorted(list(carreras)),
            'sedes': sedes_list,
            'docentes': docentes_nombres
        })
    except Exception as e:
        traceback.print_exc()
        return json_resp({'error': str(e)}, 500)


@app.route('/api/stats')
def get_stats():
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        lp = safe_query('SELECT COUNT(*) as cnt FROM Estudiantes_LaPaz')
        sc = safe_query('SELECT COUNT(*) as cnt FROM Estudiantes_SantaCruz')
        cb = safe_query('SELECT COUNT(*) as cnt FROM Estudiantes_Cochabamba')
        doc = safe_query('SELECT COUNT(*) as cnt FROM Docentes')
        mat = safe_query('SELECT COUNT(*) as cnt FROM Materias')
        ins = safe_query('SELECT COUNT(*) as cnt FROM Inscripciones')
        sedes_rows = safe_query('SELECT * FROM Sedes')

        def cnt(res):
            if res and 'cnt' in res[0]:
                v = res[0]['cnt']
                return int(v) if v is not None else 0
            return 0

        return json_resp({
            'estudiantesLaPaz': cnt(lp), 'estudiantesSantaCruz': cnt(sc), 'estudiantesCochabamba': cnt(cb),
            'totalNacional': cnt(lp) + cnt(sc) + cnt(cb),
            'totalDocentes': cnt(doc), 'totalMaterias': cnt(mat), 'totalInscripciones': cnt(ins),
            'sedes': sedes_rows, 'equiposConectados': len(sessions)
        })
    except Exception as e:
        traceback.print_exc()
        return json_resp({'error': str(e)}, 500)


@app.route('/api/estudiantes/nacional')
def estudiantes_nacional():
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        sql = """SELECT estudiante_id, nombre, apellido, ci, carrera, semestre, email, telefono, estado, fecha_inscripcion, 'La Paz' as sede_origen FROM Estudiantes_LaPaz
        UNION ALL
        SELECT estudiante_id, nombre, apellido, ci, carrera, semestre, email, telefono, estado, fecha_inscripcion, 'Santa Cruz' as sede_origen FROM Estudiantes_SantaCruz
        UNION ALL
        SELECT estudiante_id, nombre, apellido, ci, carrera, semestre, email, telefono, estado, fecha_inscripcion, 'Cochabamba' as sede_origen FROM Estudiantes_Cochabamba"""
        rows = safe_query(sql)
        return json_resp(rows)
    except Exception as e:
        traceback.print_exc()
        return json_resp({'error': str(e)}, 500)


@app.route('/api/estudiantes/<sede>')
def estudiantes_por_sede(sede):
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        table = SEDE_TABLES.get(sede)
        if not table:
            return json_resp({'error': 'Sede invalida'}, 400)
        rows = safe_query(f'SELECT * FROM {table}')
        return json_resp(rows)
    except Exception as e:
        traceback.print_exc()
        return json_resp({'error': str(e)}, 500)


@app.route('/api/estudiantes/<sede>', methods=['POST'])
def crear_estudiante_sede(sede):
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        table = SEDE_TABLES.get(sede)
        if not table:
            return json_resp({'error': 'Sede invalida'}, 400)
        d = request.json or {}
        eid = str(uuid.uuid4())
        safe_insert(table,
            ('estudiante_id', 'nombre', 'apellido', 'ci', 'carrera', 'semestre', 'email', 'telefono', 'estado', 'fecha_inscripcion'),
            (eid, d.get('nombre', ''), d.get('apellido', ''), d.get('ci', ''), d.get('carrera', ''), int(d.get('semestre', 1)), d.get('email', ''), d.get('telefono', ''), d.get('estado', 'ACTIVO'), now_ts()))
        label_map = {'lapaz': 'La Paz', 'santacruz': 'Santa Cruz', 'cochabamba': 'Cochabamba'}
        log_activity(label_map.get(sede, ''), f'Nuevo estudiante: {d.get("nombre", "")} {d.get("apellido", "")}')
        return json_resp({'success': True, 'id': eid})
    except Exception as e:
        traceback.print_exc()
        return json_resp({'error': str(e)}, 500)


@app.route('/api/estudiantes/<sede>/<eid>', methods=['PUT'])
def actualizar_estudiante_sede(sede, eid):
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        table = SEDE_TABLES.get(sede)
        if not table:
            return json_resp({'error': 'Sede invalida'}, 400)
        d = request.json or {}
        safe_insert(table,
            ('estudiante_id', 'nombre', 'apellido', 'ci', 'carrera', 'semestre', 'email', 'telefono', 'estado'),
            (eid, d.get('nombre', ''), d.get('apellido', ''), d.get('ci', ''), d.get('carrera', ''), int(d.get('semestre', 1)), d.get('email', ''), d.get('telefono', ''), d.get('estado', 'ACTIVO')))
        return json_resp({'success': True})
    except Exception as e:
        traceback.print_exc()
        return json_resp({'error': str(e)}, 500)


@app.route('/api/estudiantes/<sede>/<eid>', methods=['DELETE'])
def eliminar_estudiante_sede(sede, eid):
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        table = SEDE_TABLES.get(sede)
        if not table:
            return json_resp({'error': 'Sede invalida'}, 400)
        safe_delete(f'DELETE FROM {table} WHERE estudiante_id = @id', {'id': eid}, {'id': param_types.STRING})
        return json_resp({'success': True})
    except Exception as e:
        traceback.print_exc()
        return json_resp({'error': str(e)}, 500)


@app.route('/api/estudiantes/completo/<eid>')
def estudiante_completo(eid):
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        sql = """SELECT p.estudiante_id, p.ci, p.fecha_nacimiento, p.telefono, p.direccion, p.email, p.genero, p.fecha_registro,
        a.nombre, a.apellido, a.carrera, a.semestre_actual, a.sede_id, a.estado, a.gestion_ingreso, a.promedio_general
        FROM Estudiante_Personal p
        INNER JOIN Estudiante_Academico a ON p.estudiante_id = a.estudiante_id
        WHERE p.estudiante_id = @id"""
        rows = safe_query(sql, {'id': eid}, {'id': param_types.STRING})
        return json_resp(rows[0] if rows else None)
    except Exception as e:
        traceback.print_exc()
        return json_resp({'error': str(e)}, 500)


@app.route('/api/estudiantes/completo', methods=['POST'])
def crear_estudiante_completo():
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        d = request.json or {}
        eid = str(uuid.uuid4())
        fn = d.get('fecha_nacimiento', '')
        if fn == '' or fn is None:
            fn = None
        safe_insert('Estudiante_Personal',
            ('estudiante_id', 'ci', 'fecha_nacimiento', 'telefono', 'direccion', 'email', 'genero', 'fecha_registro'),
            (eid, d.get('ci', ''), fn, d.get('telefono', ''), d.get('direccion', ''), d.get('email', ''), d.get('genero', ''), now_ts()))
        safe_insert('Estudiante_Academico',
            ('estudiante_id', 'nombre', 'apellido', 'carrera', 'semestre_actual', 'sede_id', 'estado', 'gestion_ingreso', 'promedio_general'),
            (eid, d.get('nombre', ''), d.get('apellido', ''), d.get('carrera', ''), int(d.get('semestre_actual', 1)), d.get('sede_id', 'LP'), d.get('estado', 'ACTIVO'), d.get('gestion_ingreso', '2024'), float(d.get('promedio_general', 0))))
        log_activity(sede_label(d.get('sede_id', 'LP')), f'Estudiante completo registrado: {d.get("nombre", "")} {d.get("apellido", "")}')
        return json_resp({'success': True, 'id': eid})
    except Exception as e:
        traceback.print_exc()
        return json_resp({'error': str(e)}, 500)


@app.route('/api/estudiantes/personal')
def estudiantes_personal():
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        return json_resp(safe_query('SELECT * FROM Estudiante_Personal'))
    except Exception as e:
        return json_resp({'error': str(e)}, 500)


@app.route('/api/estudiantes/academico')
def estudiantes_academico():
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        return json_resp(safe_query('SELECT * FROM Estudiante_Academico'))
    except Exception as e:
        return json_resp({'error': str(e)}, 500)


@app.route('/api/docentes')
def get_docentes():
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        return json_resp(safe_query('SELECT * FROM Docentes'))
    except Exception as e:
        return json_resp({'error': str(e)}, 500)


@app.route('/api/docentes', methods=['POST'])
def crear_docente():
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        d = request.json or {}
        did = str(uuid.uuid4())
        safe_insert('Docentes',
            ('docente_id', 'nombre', 'apellido', 'ci', 'email', 'telefono', 'especialidad', 'sede_id', 'estado', 'fecha_contrato'),
            (did, d.get('nombre', ''), d.get('apellido', ''), d.get('ci', ''), d.get('email', ''), d.get('telefono', ''), d.get('especialidad', ''), d.get('sede_id', 'LP'), d.get('estado', 'ACTIVO'), now_ts()))
        log_activity(sede_label(d.get('sede_id', 'LP')), f'Nuevo docente: {d.get("nombre", "")} {d.get("apellido", "")}')
        return json_resp({'success': True, 'id': did})
    except Exception as e:
        traceback.print_exc()
        return json_resp({'error': str(e)}, 500)


@app.route('/api/docentes/<did>', methods=['PUT'])
def actualizar_docente(did):
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        d = request.json or {}
        safe_insert('Docentes',
            ('docente_id', 'nombre', 'apellido', 'ci', 'email', 'telefono', 'especialidad', 'sede_id', 'estado'),
            (did, d.get('nombre', ''), d.get('apellido', ''), d.get('ci', ''), d.get('email', ''), d.get('telefono', ''), d.get('especialidad', ''), d.get('sede_id', 'LP'), d.get('estado', 'ACTIVO')))
        return json_resp({'success': True})
    except Exception as e:
        traceback.print_exc()
        return json_resp({'error': str(e)}, 500)


@app.route('/api/docentes/<did>', methods=['DELETE'])
def eliminar_docente(did):
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        safe_delete('DELETE FROM Docentes WHERE docente_id = @id', {'id': did}, {'id': param_types.STRING})
        return json_resp({'success': True})
    except Exception as e:
        traceback.print_exc()
        return json_resp({'error': str(e)}, 500)


@app.route('/api/materias')
def get_materias():
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        return json_resp(safe_query('SELECT * FROM Materias'))
    except Exception as e:
        return json_resp({'error': str(e)}, 500)


@app.route('/api/materias', methods=['POST'])
def crear_materia():
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        d = request.json or {}
        mid = str(uuid.uuid4())
        safe_insert('Materias',
            ('materia_id', 'nombre', 'codigo', 'carrera', 'semestre', 'creditos', 'docente', 'sede_id'),
            (mid, d.get('nombre', ''), d.get('codigo', ''), d.get('carrera', ''), int(d.get('semestre', 1)), int(d.get('creditos', 1)), d.get('docente', ''), d.get('sede_id', 'LP')))
        return json_resp({'success': True, 'id': mid})
    except Exception as e:
        traceback.print_exc()
        return json_resp({'error': str(e)}, 500)


@app.route('/api/materias/<mid>', methods=['PUT'])
def actualizar_materia(mid):
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        d = request.json or {}
        safe_insert('Materias',
            ('materia_id', 'nombre', 'codigo', 'carrera', 'semestre', 'creditos', 'docente', 'sede_id'),
            (mid, d.get('nombre', ''), d.get('codigo', ''), d.get('carrera', ''), int(d.get('semestre', 1)), int(d.get('creditos', 1)), d.get('docente', ''), d.get('sede_id', 'LP')))
        return json_resp({'success': True})
    except Exception as e:
        traceback.print_exc()
        return json_resp({'error': str(e)}, 500)


@app.route('/api/materias/<mid>', methods=['DELETE'])
def eliminar_materia(mid):
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        safe_delete('DELETE FROM Materias WHERE materia_id = @id', {'id': mid}, {'id': param_types.STRING})
        return json_resp({'success': True})
    except Exception as e:
        traceback.print_exc()
        return json_resp({'error': str(e)}, 500)


@app.route('/api/inscripciones')
def get_inscripciones():
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        return json_resp(safe_query('SELECT * FROM Inscripciones'))
    except Exception as e:
        return json_resp({'error': str(e)}, 500)


@app.route('/api/inscripciones', methods=['POST'])
def crear_inscripcion():
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        d = request.json or {}
        iid = str(uuid.uuid4())
        safe_insert('Inscripciones',
            ('inscripcion_id', 'estudiante_id', 'materia_id', 'sede_id', 'gestion', 'semestre', 'fecha_inscripcion', 'estado'),
            (iid, d.get('estudiante_id', ''), d.get('materia_id', ''), d.get('sede_id', 'LP'), d.get('gestion', '2024'), d.get('semestre', '1'), now_ts(), d.get('estado', 'ACTIVO')))
        log_activity(sede_label(d.get('sede_id', 'LP')), 'Nueva inscripcion registrada')
        return json_resp({'success': True, 'id': iid})
    except Exception as e:
        traceback.print_exc()
        return json_resp({'error': str(e)}, 500)


@app.route('/api/inscripciones/<iid>', methods=['PUT'])
def actualizar_inscripcion(iid):
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        d = request.json or {}
        safe_insert('Inscripciones',
            ('inscripcion_id', 'estudiante_id', 'materia_id', 'sede_id', 'gestion', 'semestre', 'estado'),
            (iid, d.get('estudiante_id', ''), d.get('materia_id', ''), d.get('sede_id', 'LP'), d.get('gestion', '2024'), d.get('semestre', '1'), d.get('estado', 'ACTIVO')))
        return json_resp({'success': True})
    except Exception as e:
        traceback.print_exc()
        return json_resp({'error': str(e)}, 500)


@app.route('/api/inscripciones/<iid>', methods=['DELETE'])
def eliminar_inscripcion(iid):
    try:
        safe_delete('DELETE FROM Inscripciones WHERE inscripcion_id = @id', {'id': iid}, {'id': param_types.STRING})
        return json_resp({'success': True})
    except Exception as e:
        traceback.print_exc()
        return json_resp({'error': str(e)}, 500)


@app.route('/api/notas')
def get_notas():
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        return json_resp(safe_query('SELECT * FROM Notas'))
    except Exception as e:
        return json_resp({'error': str(e)}, 500)


@app.route('/api/notas', methods=['POST'])
def crear_nota():
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        d = request.json or {}
        nid = str(uuid.uuid4())
        n1 = float(d.get('nota1', 0))
        n2 = float(d.get('nota2', 0))
        n3 = float(d.get('nota3', 0))
        prom = round((n1 + n2 + n3) / 3, 2)
        safe_insert('Notas',
            ('nota_id', 'estudiante_id', 'materia_id', 'sede_id', 'nota1', 'nota2', 'nota3', 'promedio', 'gestion', 'semestre', 'fecha_registro'),
            (nid, d.get('estudiante_id', ''), d.get('materia_id', ''), d.get('sede_id', 'LP'), n1, n2, n3, prom, d.get('gestion', '2024'), d.get('semestre', '1'), now_ts()))
        log_activity(sede_label(d.get('sede_id', 'LP')), f'Nota registrada - Promedio: {"APROBADO" if prom >= 51 else "REPROBADO"} ({prom})')
        return json_resp({'success': True, 'id': nid, 'promedio': prom})
    except Exception as e:
        traceback.print_exc()
        return json_resp({'error': str(e)}, 500)


@app.route('/api/notas/<nid>', methods=['PUT'])
def actualizar_nota(nid):
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        d = request.json or {}
        n1 = float(d.get('nota1', 0))
        n2 = float(d.get('nota2', 0))
        n3 = float(d.get('nota3', 0))
        prom = round((n1 + n2 + n3) / 3, 2)
        safe_insert('Notas',
            ('nota_id', 'estudiante_id', 'materia_id', 'sede_id', 'nota1', 'nota2', 'nota3', 'promedio', 'gestion', 'semestre'),
            (nid, d.get('estudiante_id', ''), d.get('materia_id', ''), d.get('sede_id', 'LP'), n1, n2, n3, prom, d.get('gestion', '2024'), d.get('semestre', '1')))
        return json_resp({'success': True, 'promedio': prom})
    except Exception as e:
        traceback.print_exc()
        return json_resp({'error': str(e)}, 500)


@app.route('/api/notas/<nid>', methods=['DELETE'])
def eliminar_nota(nid):
    try:
        safe_delete('DELETE FROM Notas WHERE nota_id = @id', {'id': nid}, {'id': param_types.STRING})
        return json_resp({'success': True})
    except Exception as e:
        traceback.print_exc()
        return json_resp({'error': str(e)}, 500)


@app.route('/api/sedes')
def get_sedes():
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        return json_resp(safe_query('SELECT * FROM Sedes'))
    except Exception as e:
        return json_resp({'error': str(e)}, 500)


@app.route('/api/sedes', methods=['POST'])
def crear_sede():
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        d = request.json or {}
        sid = str(uuid.uuid4())
        safe_insert('Sedes',
            ('sede_id', 'nombre', 'ciudad', 'director', 'direccion', 'telefono', 'email', 'capacidad_maxima', 'fecha_creacion'),
            (sid, d.get('nombre', ''), d.get('ciudad', ''), d.get('director', ''), d.get('direccion', ''), d.get('telefono', ''), d.get('email', ''), int(d.get('capacidad_maxima', 0)), now_ts()))
        return json_resp({'success': True, 'id': sid})
    except Exception as e:
        traceback.print_exc()
        return json_resp({'error': str(e)}, 500)


@app.route('/api/sedes/<sid>', methods=['PUT'])
def actualizar_sede(sid):
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        d = request.json or {}
        safe_insert('Sedes',
            ('sede_id', 'nombre', 'ciudad', 'director', 'direccion', 'telefono', 'email', 'capacidad_maxima'),
            (sid, d.get('nombre', ''), d.get('ciudad', ''), d.get('director', ''), d.get('direccion', ''), d.get('telefono', ''), d.get('email', ''), int(d.get('capacidad_maxima', 0))))
        return json_resp({'success': True})
    except Exception as e:
        traceback.print_exc()
        return json_resp({'error': str(e)}, 500)


@app.route('/api/sedes/<sid>', methods=['DELETE'])
def eliminar_sede(sid):
    try:
        safe_delete('DELETE FROM Sedes WHERE sede_id = @id', {'id': sid}, {'id': param_types.STRING})
        return json_resp({'success': True})
    except Exception as e:
        traceback.print_exc()
        return json_resp({'error': str(e)}, 500)


@app.route('/api/fragmentacion/horizontal')
def fragmentacion_horizontal():
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        lp = safe_query('SELECT * FROM Estudiantes_LaPaz')
        sc = safe_query('SELECT * FROM Estudiantes_SantaCruz')
        cb = safe_query('SELECT * FROM Estudiantes_Cochabamba')
        sql_text = """-- Fragmentacion Horizontal: UNION ALL de 3 tablas por sede
SELECT *, 'La Paz' as sede_origen FROM Estudiantes_LaPaz
UNION ALL
SELECT *, 'Santa Cruz' as sede_origen FROM Estudiantes_SantaCruz
UNION ALL
SELECT *, 'Cochabamba' as sede_origen FROM Estudiantes_Cochabamba;"""
        return json_resp({'lapaz': lp, 'santacruz': sc, 'cochabamba': cb, 'sql': sql_text})
    except Exception as e:
        traceback.print_exc()
        return json_resp({'error': str(e)}, 500)


@app.route('/api/fragmentacion/vertical')
def fragmentacion_vertical():
    try:
        if not spanner_connected:
            return json_resp({'error': 'Spanner no conectado'}, 503)
        personal = safe_query('SELECT * FROM Estudiante_Personal')
        academico = safe_query('SELECT * FROM Estudiante_Academico')
        sql_text = """-- Fragmentacion Vertical: JOIN de Personal + Academico
SELECT p.estudiante_id, p.ci, p.fecha_nacimiento, p.telefono,
       p.direccion, p.email, p.genero, p.fecha_registro,
       a.nombre, a.apellido, a.carrera, a.semestre_actual,
       a.sede_id, a.estado, a.gestion_ingreso, a.promedio_general
FROM Estudiante_Personal p
INNER JOIN Estudiante_Academico a
  ON p.estudiante_id = a.estudiante_id;"""
        return json_resp({'personal': personal, 'academico': academico, 'sql': sql_text})
    except Exception as e:
        traceback.print_exc()
        return json_resp({'error': str(e)}, 500)


@app.route('/api/monitor')
def get_monitor():
    sede_counts = {'La Paz': 0, 'Santa Cruz': 0, 'Cochabamba': 0}
    with sessions_lock:
        for s in sessions:
            sede = s.get('sede', '')
            if sede in sede_counts:
                sede_counts[sede] += 1
            elif sede.lower() in ('lapaz', 'lp'):
                sede_counts['La Paz'] += 1
            elif sede.lower() in ('santacruz', 'sc'):
                sede_counts['Santa Cruz'] += 1
            elif sede.lower() in ('cochabamba', 'cb'):
                sede_counts['Cochabamba'] += 1
        return json_resp({
            'equiposConectados': len(sessions),
            'sedes': sede_counts,
            'sesiones': [{'nombre': s.get('nombre', 'Anonimo'), 'ip': s['ip'], 'sede': s['sede'], 'conectadoHace': s.get('connectedAt', ''), 'ultimaActividad': s.get('lastActivity', '')} for s in sessions],
            'actividad': activity_log[:20]
        })


@app.route('/api/monitor/register', methods=['POST'])
def register_monitor():
    ip = request.remote_addr or 'unknown'
    data = request.json or {}
    client_id = data.get('client_id', '')
    nombre = data.get('nombre', 'Anonimo')
    register_session(ip, data.get('sede', 'La Paz'), client_id, nombre)
    return json_resp({'success': True, 'client_id': client_id or sessions[-1]['client_id'] if sessions else str(uuid.uuid4())})


@app.route('/api/monitor/clear', methods=['POST'])
def clear_monitor():
    with sessions_lock:
        sessions.clear()
        activity_log.clear()
    return json_resp({'success': True})


@app.route('/api/monitor/activity', methods=['POST'])
def log_monitor_activity():
    data = request.json or {}
    log_activity(data.get('sede', ''), data.get('action', ''))
    return json_resp({'success': True})


@app.route('/events')
def sse_events():
    def generate():
        for i in range(1):
            try:
                data = json.dumps({'type': 'monitor', 'equiposConectados': len(sessions), 'actividad': activity_log[:10]}, cls=SpannerEncoder, default=str)
                yield f"data: {data}\n\n"
            except Exception:
                pass
            time.sleep(0.1)
    return Response(generate(), mimetype='text/event-stream',
                    headers={'Cache-Control': 'no-cache', 'Connection': 'close',
                             'Access-Control-Allow-Origin': '*'})


@app.errorhandler(NotFound)
def handle_notfound(e):
    return json_resp({'error': 'Not found', 'connected': spanner_connected}, 404)


@app.errorhandler(Exception)
def handle_exception(e):
    try:
        traceback.print_exc()
    except Exception:
        pass
    try:
        return json_resp({'error': str(e)}, 500)
    except Exception:
        return Response(json.dumps({'error': 'Internal server error'}), status=500, mimetype='application/json')


if __name__ == '__main__':
    werkzeug_log = logging.getLogger('werkzeug')
    werkzeug_log.setLevel(logging.ERROR)
    print('\n===================================================')
    print('  UniSpanner - Sistema Nacional de Registro Universitario')
    print('  Servidor corriendo en http://localhost:3000')
    if spanner_connected:
        print('  Spanner: CONECTADO')
    else:
        print('  Spanner: NO CONECTADO')
    print('===================================================\n')
    from waitress import serve
    try:
        print('  Iniciando con waitress (servidor estable)...')
        serve(app, host='0.0.0.0', port=3000, threads=4, channel_timeout=60, cleanup_interval=30)
    except ImportError:
        print('  Waitress no disponible, usando Flask...')
        app.run(host='0.0.0.0', port=3000, debug=False, threaded=True, use_reloader=False)