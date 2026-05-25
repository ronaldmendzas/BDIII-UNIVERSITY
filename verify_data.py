import os
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'credenciales.json'
os.environ['SPANNER_TELEMETRY_DISABLED'] = '1'
os.environ['GOOGLE_CLOUD_DISABLE_METRICS'] = '1'
from google.cloud import spanner

client = spanner.Client(project='fresh-effort-484916-c7')
instance = client.instance('instancia-expo')
database = instance.database('bd-universidad')

expected = {
    'Sedes': 3,
    'Estudiantes_LaPaz': 5,
    'Estudiantes_SantaCruz': 5,
    'Estudiantes_Cochabamba': 5,
    'Docentes': 6,
    'Materias': 6,
    'Inscripciones': 6,
    'Notas': 6,
    'Estudiante_Personal': 6,
    'Estudiante_Academico': 6,
}

all_ok = True
for t, exp in expected.items():
    with database.snapshot() as snapshot:
        results = snapshot.execute_sql('SELECT COUNT(*) FROM ' + t)
        count = list(results)[0][0]
        status = 'OK' if count == exp else 'FALTA'
        if count != exp:
            all_ok = False
        print(f'{t}: {count}/{exp} {status}')

print()
if all_ok:
    print('TODOS LOS DATOS COMPLETOS!')
else:
    print('FALTAN DATOS - re-inserta los que faltan')