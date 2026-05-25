import os
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'credenciales.json'
os.environ['SPANNER_TELEMETRY_DISABLED'] = '1'
os.environ['GOOGLE_CLOUD_DISABLE_METRICS'] = '1'
from google.cloud import spanner

client = spanner.Client(project='fresh-effort-484916-c7')
instance = client.instance('instancia-expo')
database = instance.database('bd-universidad')

tables = ['Estudiantes_LaPaz', 'Estudiantes_SantaCruz', 'Estudiantes_Cochabamba',
          'Estudiante_Personal', 'Estudiante_Academico',
          'Docentes', 'Materias', 'Inscripciones', 'Notas', 'Sedes']

for t in tables:
    with database.snapshot() as snapshot:
        results = snapshot.execute_sql('SELECT COUNT(*) FROM ' + t)
        count = list(results)[0][0]
        if count > 0:
            print(f'{t}: {count} filas')
            with database.snapshot() as snap2:
                rows = snap2.execute_sql('SELECT * FROM ' + t)
                for r in list(rows)[:3]:
                    vals = []
                    for v in r:
                        if v is not None:
                            vals.append(str(v)[:30])
                        else:
                            vals.append('NULL')
                    print(f'  {vals}')
        else:
            print(f'{t}: vacia')