import os
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'credenciales.json'
os.environ['SPANNER_TELEMETRY_DISABLED'] = '1'
os.environ['GOOGLE_CLOUD_DISABLE_METRICS'] = '1'
from google.cloud import spanner
from google.cloud.spanner import KeySet

client = spanner.Client(project='fresh-effort-484916-c7')
instance = client.instance('instancia-expo')
database = instance.database('bd-universidad')

tables = ['Notas', 'Inscripciones', 'Estudiantes_LaPaz', 'Estudiantes_SantaCruz', 'Estudiantes_Cochabamba',
          'Estudiante_Personal', 'Estudiante_Academico', 'Docentes', 'Materias']

with database.batch() as batch:
    for t in tables:
        batch.delete(t, KeySet(all_=True))
        print(f'Borrado: {t}')

print('Limpieza completa. Sedes preservadas.')