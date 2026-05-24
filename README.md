# UniSpanner - Guia de Configuracion y Ejecucion

Los pasos 1 a 4 (crear proyecto, instancia, base de datos, tablas y service account) estan en el documento Word adjunto. Aqui detallamos los pasos restantes.

---

## Paso 5: Poner las credenciales en el proyecto

Cuando creas el Service Account en GCP y descargas la clave JSON, se descarga un archivo con un nombre largo y raro como este:

```
proyecto-examen-123456-abc123def456.json
```

**Ese archivo es tu credencial.** No lo abras, no lo edites, no cambies nada dentro. Solo hay que moverlo y renombrarlo.

### Que hacer:

1. Copia ese archivo JSON que se descargo
2. Ve a la carpeta del proyecto (donde esta `app.py`)
3. **Borra** el archivo `credenciales.json` que ya esta ahi (es el de la dupla expositora, no te sirve)
4. **Renombra** el archivo que descargaste a `credenciales.json`
5. Ponlo en la raiz del proyecto, al lado de `app.py`

La carpeta del proyecto tiene que quedar asi:

```
BDIII-UNIVERSITY/
  credenciales.json    <-- TU archivo JSON renombrado (reemplazo el anterior)
  app.py
  requirements.txt
  test_system.py
  public/
    index.html
    style.css
    app.js
```

### Como se ve el archivo por dentro:

Si abres el `credenciales.json` con el Bloc de notas, se ve algo asi:

```json
{
  "type": "service_account",
  "project_id": "mi-proyecto-examen-123456",
  "private_key_id": "a1b2c3d4e5f6g7h8i9j0",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----\n",
  "client_email": "spanner-user@mi-proyecto-examen-123456.iam.gserviceaccount.com",
  "client_id": "123456789012345678901",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

**NO cambies nada dentro del JSON.** Solo renombralo y ponlo en la carpeta del proyecto.

### Como asegurarte de que esta bien:

Abre una terminal (PowerShell o CMD) en la carpeta del proyecto y escribe:

```
dir credenciales.json
```

Si aparece el archivo, esta bien. Si dice "no se encuentra", no esta en el lugar correcto.

---

## Paso 6: Cambiar los datos de conexion en app.py

Abre el archivo `app.py` con cualquier editor de texto (Bloc de notas, VS Code, Notepad++, etc).

Busca las **lineas 31, 32 y 33** que dicen exactamente esto:

```python
PROJECT_ID = 'fresh-effort-484916-c7'
INSTANCE_ID = 'instancia-expo'
DATABASE_ID = 'bd-universidad'
```

Solo tienes que **cambiar el texto que esta entre las comillas simples** `'...'`.

### Cambiar PROJECT_ID (linea 31)

```python
# ANTES (ejemplo de la dupla expositora):
PROJECT_ID = 'fresh-effort-484916-c7'

# DESPUES (pon tu Project ID de GCP):
PROJECT_ID = 'tu-proyecto-examen-123456'
```

El Project ID lo encuentras en:
- La esquina superior izquierda de Google Cloud Console, donde dice "Seleccionar proyecto"
- O dentro del archivo `credenciales.json` en el campo `"project_id"`

### Cambiar INSTANCE_ID (linea 32)

```python
# ANTES (ejemplo de la dupla expositora):
INSTANCE_ID = 'instancia-expo'

# DESPUES (pon el nombre de tu instancia Spanner):
INSTANCE_ID = 'mi-instancia-spanner'
```

El Instance ID es el nombre que le diste a tu instancia cuando la creaste en Spanner. Lo encuentras en:
- Google Cloud Console > Spanner > ahi aparece el nombre de tu instancia

### Cambiar DATABASE_ID (linea 33)

```python
# ANTES (ejemplo de la dupla expositora):
DATABASE_ID = 'bd-universidad'

# DESPUES (pon el nombre de tu base de datos Spanner):
DATABASE_ID = 'mi-base-de-datos'
```

El Database ID es el nombre que le diste a tu base de datos dentro de la instancia. Lo encuentras en:
- Google Cloud Console > Spanner > tu instancia > ahi aparece el nombre de tu base de datos

### Ejemplo completo:

Si tu Project ID es `examen-bd-2026`, tu instancia se llama `instancia-bd` y tu base de datos se llama `universidad-db`, las 3 lineas quedarian asi:

```python
PROJECT_ID = 'examen-bd-2026'
INSTANCE_ID = 'instancia-bd'
DATABASE_ID = 'universidad-db'
```

**Solo cambias lo que esta entre comillas.** No borres las comillas, no cambies nada mas.

### Verificacion rapida:

Despues de cambiar, las 3 lineas deben verse asi:

```python
PROJECT_ID = 'algo-aqui'        # linea 31
INSTANCE_ID = 'algo-aqui'       # linea 32
DATABASE_ID = 'algo-aqui'       # linea 33
```

Si alguna dice `'fresh-effort-484916-c7'`, `'instancia-expo'` o `'bd-universidad'`, te falta cambiarlo.

---

## Paso 8: Instalar, ejecutar y verificar el proyecto

### 8.1 Verificar que Python esta instalado

Abre una terminal (PowerShell o CMD) y escribe:

```
py --version
```

Debe aparecer algo como `Python 3.12.x` o similar. Si dice "no se reconoce", instala Python desde https://www.python.org/downloads/ (marca la opcion "Add Python to PATH" durante la instalacion).

### 8.2 Instalar las dependencias

Abre una terminal en la carpeta del proyecto (donde esta `app.py`) y ejecuta:

```
pip install -r requirements.txt
```

Esto instala Flask, Google Cloud Spanner y Waitress. Espera a que termine. Debes ver algo como:

```
Successfully installed Flask-3.x.x google-cloud-spanner-3.x.x waitress-2.x.x ...
```

Si sale un error, prueba con:

```
py -m pip install -r requirements.txt
```

### 8.3 Verificar las credenciales

Antes de correr el proyecto, verifica que las credenciales estan bien. En la terminal, desde la carpeta del proyecto, ejecuta:

```
py -c "import os; os.environ['GOOGLE_APPLICATION_CREDENTIALS']='credenciales.json'; from google.cloud import spanner; c=spanner.Client(project='TU_PROJECT_ID'); i=c.instance('TU_INSTANCE_ID'); d=i.database('TU_DATABASE_ID'); s=d.snapshot(); list(s.execute_sql('SELECT 1')); print('CONEXION EXITOSA')"
```

**Cambia `TU_PROJECT_ID`, `TU_INSTANCE_ID` y `TU_DATABASE_ID`** por los valores que pusiste en `app.py`.

Si todo esta bien, veras:

```
CONEXION EXITOSA
```

Si sale un error, revisa:
- Que `credenciales.json` este en la carpeta correcta (al lado de `app.py`)
- Que los 3 valores en `app.py` coincidan con tu proyecto GCP
- Que el Service Account tenga el rol **Cloud Spanner User**

### 8.4 Ejecutar el proyecto

En la terminal, desde la carpeta del proyecto:

```
py app.py
```

Debes ver algo como:

```
Conectado a Google Cloud Spanner
Servidor corriendo en http://localhost:3000
```

**Si dice "Error conectando a Spanner"**, revisa las credenciales y los valores de `app.py`.

### 8.5 Abrir el sistema en el navegador

Abre tu navegador y ve a:

```
http://localhost:3000
```

Debes ver la pantalla principal de UniSpanner con un indicador verde que dice "Conectado".

Si dice "Desconectado" en rojo, la conexion a Spanner fallo. Vuelve al paso 8.3.

### 8.6 Correr los tests automaticos

En **otra terminal** (sin cerrar la que corre el servidor), ejecuta:

```
py test_system.py
```

Debes ver algo como:

```
============================================================
  UniSpanner - Tests del Sistema
  Verificando http://localhost:3000
============================================================

1. FRONTEND
  [OK] Pagina principal (index.html)
  [OK] Archivo CSS (style.css)
  [OK] Archivo JS (app.js)

2. CONEXION SPANNER
    -> Spanner CONECTADO
  [OK] Estado de conexion Spanner

...

============================================================
  RESULTADO: 36/36 tests pasados
  TODOS LOS TESTS PASARON!
============================================================
```

Si todos los tests pasan, el sistema esta funcionando correctamente.

### 8.7 Detener el servidor

Para detener el servidor, ve a la terminal donde esta corriendo y presiona `Ctrl + C`.

---

## Paso 9: Conectar otros compañeros en la red local

El sistema tiene un Monitor en Vivo que muestra qué sedes están conectadas. Para que otros compañeros puedan ver y usar el sistema desde sus computadoras:

### 9.1 Obtener tu IP local

Abre una terminal (PowerShell o CMD) en la computadora donde corre el servidor y escribe:

```
ipconfig
```

Busca la linea que dice **IPv4 Address**. Vas a ver algo como:

```
IPv4 Address. . . . . . . . . . . : 192.168.100.8
```

Ese número es **tu IP local**. Anótalo.

### 9.2 Dar acceso a otros

Diles a tus compañeros que abran su navegador y escriban:

```
http://TU_IP_LOCAL:3000
```

Por ejemplo, si tu IP es `192.168.100.8`, tus compañeros abren:

```
http://192.168.100.8:3000
```

**Importante:** Todos deben estar conectados a la **misma red WiFi**.

### 9.3 Seleccionar la sede correcta

Cada persona debe seleccionar su sede en la pantalla de inicio:

- El que esta en **La Paz** selecciona "La Paz"
- El que esta en **Santa Cruz** selecciona "Santa Cruz"
- El que esta en **Cochabamba** selecciona "Cochabamba"

El Monitor en Vivo va a mostrar cuántos equipos hay conectados por sede y va a actualizar en tiempo real.

### 9.4 Si no funciona la conexion

Si los compañeros no pueden acceder a `http://TU_IP:3000`:

1. **Verifica que esten en la misma red WiFi** - todos deben estar en el mismo WiFi
2. **Verifica el firewall** - en Windows, busca "Firewall de Windows" y agrega una regla que permita el puerto 3000, o temporalmente desactiva el firewall
3. **Prueba con ping** - los compañeros abren CMD y escriben `ping 192.168.100.8` (tu IP). Si responde, la red funciona
4. **Verifica que el servidor este corriendo** - en tu terminal debe decir "Servidor corriendo en http://0.0.0.0:3000"

---

## Resumen rapido de lo que hay que cambiar

| Que cambiar          | Donde                               | Que pones                                           |
|----------------------|-------------------------------------|-----------------------------------------------------|
| Archivo JSON         | `credenciales.json` en la raiz      | Tu clave JSON descargada de GCP (renombrarla)      |
| Project ID           | `app.py` linea 31                   | Tu ID de proyecto de GCP                            |
| Instance ID          | `app.py` linea 32                   | Tu nombre de instancia Spanner                      |
| Database ID          | `app.py` linea 33                   | Tu nombre de base de datos Spanner                  |

**Solo esas 4 cosas.** Nada mas se cambia.