import os
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'credenciales.json'
os.environ['SPANNER_TELEMETRY_DISABLED'] = '1'
os.environ['GOOGLE_CLOUD_DISABLE_METRICS'] = '1'
from google.cloud import spanner
from google.cloud.spanner import KeySet

client = spanner.Client(project='fresh-effort-484916-c7')
instance = client.instance('instancia-expo')
database = instance.database('bd-universidad')

def find_keys(tbl, col, sql):
    with database.snapshot() as snap:
        results = snap.execute_sql(sql, params={"p1": "i", "p2": "in"}, param_types={"p1": spanner.param_types.STRING, "p2": spanner.param_types.STRING})
        return [r[0] for r in list(results)]

tables_est = ['Estudiantes_LaPaz', 'Estudiantes_SantaCruz', 'Estudiantes_Cochabamba']
all_keys = {}

for tbl in tables_est:
    keys = find_keys(tbl, 'estudiante_id', "SELECT estudiante_id FROM " + tbl + " WHERE carrera IN (@p1, @p2)")
    if keys:
        all_keys[tbl] = keys
        print(tbl + ': ' + str(keys))
    else:
        print(tbl + ' - limpio')

mat_keys = find_keys('Materias', 'materia_id', "SELECT materia_id FROM Materias WHERE carrera IN (@p1, @p2)")
if mat_keys:
    all_keys['Materias'] = mat_keys
    print('Materias: ' + str(mat_keys))
else:
    print('Materias - limpio')

ea_keys = find_keys('Estudiante_Academico', 'estudiante_id', "SELECT estudiante_id FROM Estudiante_Academico WHERE carrera IN (@p1, @p2)")
if ea_keys:
    all_keys['Estudiante_Academico'] = ea_keys
    print('Estudiante_Academico: ' + str(ea_keys))
else:
    print('Estudiante_Academico - limpio')

if ea_keys:
    ep_keys = find_keys('Estudiante_Personal', 'estudiante_id', "SELECT estudiante_id FROM Estudiante_Personal WHERE estudiante_id IN (SELECT estudiante_id FROM Estudiante_Academico WHERE carrera IN (@p1, @p2))")
    if ep_keys:
        all_keys['Estudiante_Personal'] = ep_keys
        print('Estudiante_Personal: ' + str(ep_keys))

print('---Eliminando...')

with database.batch() as batch:
    for tbl, keys in all_keys.items():
        batch.delete(tbl, KeySet(keys=keys))
        print('Borrado de ' + tbl)

print('Listo! Carreras i e in eliminadas.')