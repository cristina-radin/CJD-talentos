#!/usr/bin/env python3
"""
Estandariza el CSV exportado del Google Forms de la bolsa de talentos para
poder importarlo en la tabla `members` de Supabase.

Uso:
    python3 estandarizar_csv.py entrada.csv salida.csv

No necesita ninguna librería externa, solo Python 3 (python3 --version
para comprobar que lo tienes instalado).

Qué hace:
  - Lee el CSV real desde disco (nunca hace falta pegar los datos reales
    en ningún sitio para usar este script).
  - Reparte cada columna del formulario en la columna de `members` que le
    corresponde.
  - Para los campos con vocabulario cerrado (estilos, coche, área de
    titulación, nivel de idioma) intenta adivinar el valor exacto a partir
    del texto libre. Cuando no está seguro del todo, se queda con su mejor
    intento y añade el nombre del campo a la columna `revisar` de esa fila,
    para que se pueda repasar a mano luego (por ejemplo en Excel/Sheets,
    filtrando u ordenando por esa columna).
  - Las columnas sensibles (nombre, apellidos, email, teléfono, domicilio)
    se copian tal cual, sin tocarlas ni intentar adivinar nada en ellas.
  - Los campos que este formulario no recoge (NIF, alergias, fecha de
    nacimiento, asociación, foto) se dejan vacíos en el CSV de salida,
    listos para rellenarse a mano o fusionarse con el segundo CSV que
    tengas pendiente.

Formato de columnas especiales en el CSV de salida (para cuando lo
importes en Supabase):
  - estilos: literal de array de Postgres, p.ej. {CREATIVO,ORGANIZADO}
  - idiomas: texto JSON, p.ej. [{"n": "Inglés", "nivel": "Avanzado"}]
"""

import argparse
import csv
import json
import re
import unicodedata


# --- Columnas del formulario (ajusta aquí si el encabezado real difiere) ---

COL_NOMBRE_COMPLETO = 'Nombre y apellidos'
COL_EMAIL = 'Correo electrónico'
COL_DOMICILIO = 'Domicilio'
COL_TELEFONO = 'Número de teléfono'
COL_ESTUDIOS = 'Estudios'
COL_IDIOMAS = 'Nivel de Idiomas'
COL_EXPERIENCIA = 'Experiencia laboral o no'
COL_ESTILOS_PRED = 'Estilos de Pensamiento (Predominante)'
COL_ESTILOS_OTROS = 'Estilos de Pensamiento (Otros)'
COL_HAB_HUMANAS = 'Habilidades y Competencias Humanas'
COL_HAB_CRISTIANAS = 'Habilidades y Competencias Cristianas/Carmelitanas'
COL_AFICIONES = 'Aficiones'
COL_COCHE = 'Carné de conducir'
COL_OBSERVACIONES = (
    'Observaciones. En este párrafo puede usted indicar su disponibilidad '
    'horaria y alguna otra observación que considere oportuna.'
)

# Columnas de salida, en el orden en que se escriben en el CSV limpio.
OUTPUT_COLUMNS = [
    'nombre', 'apellidos', 'email', 'telefono', 'domicilio', 'nif',
    'nacimiento', 'ciudad', 'asociacion', 'area_titulacion', 'titulacion',
    'estilos', 'idiomas', 'coche', 'experiencia', 'hobbies',
    'disponibilidad', 'habilidades_humanas', 'habilidades_cristianas',
    'alergias', 'observaciones', 'foto_url',
    'revisar', 'idiomas_texto_original', 'estudios_texto_original',
]


# --- Utilidades de texto ---

def normalize(text):
    """minúsculas, sin acentos, espacios simples. Solo para comparar, nunca para guardar."""
    if not text:
        return ''
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')
    return re.sub(r'\s+', ' ', text).strip().lower()


def arreglar_mojibake(texto):
    """Corrige acentos rotos tipo 'CastellÃ³n' que vienen de un archivo que
    pasó por Excel/Sheets con la codificación mal detectada en algún paso
    anterior. Si el texto no tiene pinta de estar afectado, se deja igual."""
    if not texto or 'Ã' not in texto:
        return texto
    try:
        return texto.encode('latin-1').decode('utf-8')
    except (UnicodeDecodeError, UnicodeEncodeError):
        return texto


# --- Nombre y apellidos ---

def split_nombre_apellidos(full_name):
    full_name = (full_name or '').strip()
    if not full_name:
        return '', '', False
    palabras = full_name.split()
    # 2-3 palabras: "Nombre Apellido1 [Apellido2]" es lo habitual y fiable.
    # 1 o 4+ palabras: nombres compuestos o casos raros, mejor revisar a mano.
    dudoso = len(palabras) == 1 or len(palabras) >= 4
    nombre = palabras[0]
    apellidos = ' '.join(palabras[1:])
    return nombre, apellidos, dudoso


# --- Estilos de pensamiento ---

ESTILOS_CANONICOS = {
    'creativo': 'CREATIVO',
    'empatico': 'EMPATICO',
    'logico matematico': 'LOGICO-MATEMATICO',
    'logico-matematico': 'LOGICO-MATEMATICO',
    'organizado': 'ORGANIZADO',
}


def parse_estilos(predominante, otros):
    combinado = f"{predominante or ''}, {otros or ''}"
    piezas = re.split(r'[,;/]| y ', combinado)
    resultado = []
    hay_texto_sin_reconocer = False
    for pieza in piezas:
        pieza = pieza.strip()
        if not pieza:
            continue
        valor = ESTILOS_CANONICOS.get(normalize(pieza))
        if valor:
            if valor not in resultado:
                resultado.append(valor)
        else:
            hay_texto_sin_reconocer = True
    return resultado, hay_texto_sin_reconocer


# --- Coche / carné de conducir ---

def parse_coche(texto):
    t = normalize(texto)
    if not t:
        return None, True

    if re.search(r'\bsin\s+carn', t) or re.search(r'\bno\s+tengo\s+carn', t):
        return 'SIN CARNÉ', False

    con_coche = re.search(r'\bcon\s+coche\b', t)
    sin_coche = re.search(r'\bsin\s+coche\b', t)
    tiene_carne = 'carn' in t or re.search(r'\bsi\b', t)

    if con_coche:
        return 'CON CARNÉ, CON COCHE', False
    if sin_coche and tiene_carne:
        return 'CON CARNÉ, SIN COCHE', False

    # No se pudo distinguir con seguridad: mejor suposición + revisar.
    if tiene_carne:
        return 'CON CARNÉ, SIN COCHE', True
    return None, True


# --- Área de titulación (a partir del texto libre de "Estudios") ---

AREA_KEYWORDS = {
    'Ingeniería y Arquitectura': ['ingenier', 'arquitect', 'informatic'],
    'Ciencias de la Salud': [
        'medicin', 'medic', 'enfermer', 'farmac', 'fisioterap', 'psicolog',
        'odontolog', 'veterinari', 'nutricion',
    ],
    'Ciencias Sociales y Jurídicas': [
        'derecho', 'econom', 'empresa', 'adminis', 'periodis', 'educacion',
        'magisteri', 'trabajo social', 'turismo', 'relaciones laborales',
        'polit', 'pedagog',
    ],
    'Ciencias': ['fisic', 'quimic', 'matemat', 'biolog', 'geolog', 'estadistic'],
    'Artes y Humanidades': [
        'historia', 'arte', 'filolog', 'filosofi', 'literatur', 'traduccion',
        'bellas artes', 'humanidades', 'linguistic',
    ],
}


def parse_area_titulacion(texto_estudios):
    t = normalize(texto_estudios)
    coincidencias = [
        area for area, palabras in AREA_KEYWORDS.items()
        if any(p in t for p in palabras)
    ]
    if len(coincidencias) == 1:
        return coincidencias[0], False
    return None, True


def parse_titulacion(texto_estudios):
    # Texto libre pasado tal cual (solo se limpian espacios repetidos). No
    # se marca para revisar: es texto tal cual, no una adivinanza.
    texto = re.sub(r'\s+', ' ', (texto_estudios or '')).strip()
    return texto or None


# --- Idiomas ---
# Añade aquí más idiomas si os falta alguno en las respuestas reales.
IDIOMAS_CONOCIDOS = [
    'ingles', 'frances', 'aleman', 'italiano', 'portugues', 'valenciano',
    'catalan', 'euskera', 'gallego', 'chino', 'japones', 'arabe', 'ruso',
    'rumano',
]

NIVEL_KEYWORDS = {
    'Básico': ['basico', 'bajo', 'poco', 'iniciacion'],
    'Intermedio': ['intermedio', 'medio', 'promedio'],
    'Avanzado': ['avanzado', 'alto', 'fluido', 'bilingue', 'nativo'],
}


def detectar_nivel(fragmento_normalizado):
    for nivel, palabras in NIVEL_KEYWORDS.items():
        if any(p in fragmento_normalizado for p in palabras):
            return nivel
    return None


def parse_idiomas(texto):
    if not (texto or '').strip():
        return [], False

    piezas = re.split(r'[,;]| y ', texto)
    resultado = []
    hay_dudas = False

    for pieza in piezas:
        pieza = pieza.strip()
        if not pieza:
            continue
        norm = normalize(pieza)
        idioma_encontrado = next((i for i in IDIOMAS_CONOCIDOS if i in norm), None)
        if not idioma_encontrado:
            hay_dudas = True
            continue

        nivel = detectar_nivel(norm)
        if not nivel:
            hay_dudas = True

        resultado.append({'n': idioma_encontrado.capitalize(), 'nivel': nivel})

    return resultado, hay_dudas


# --- Fila completa ---

def procesar_fila(fila):
    revisar = []

    nombre, apellidos, dudoso_nombre = split_nombre_apellidos(fila.get(COL_NOMBRE_COMPLETO))
    if dudoso_nombre:
        revisar.append('nombre_apellidos')

    estilos, dudas_estilos = parse_estilos(fila.get(COL_ESTILOS_PRED), fila.get(COL_ESTILOS_OTROS))
    if dudas_estilos:
        revisar.append('estilos')

    coche, dudas_coche = parse_coche(fila.get(COL_COCHE))
    if dudas_coche:
        revisar.append('coche')

    area, dudas_area = parse_area_titulacion(fila.get(COL_ESTUDIOS))
    if dudas_area:
        revisar.append('area_titulacion')

    titulacion = parse_titulacion(fila.get(COL_ESTUDIOS))

    idiomas, dudas_idiomas = parse_idiomas(fila.get(COL_IDIOMAS))
    if dudas_idiomas:
        revisar.append('idiomas')

    return {
        'nombre': nombre,
        'apellidos': apellidos,
        'email': (fila.get(COL_EMAIL) or '').strip(),
        'telefono': (fila.get(COL_TELEFONO) or '').strip() or None,
        'domicilio': (fila.get(COL_DOMICILIO) or '').strip() or None,
        'nif': None,
        'nacimiento': None,
        'ciudad': None,
        'asociacion': None,
        'area_titulacion': area,
        'titulacion': titulacion,
        'estilos': '{' + ','.join(estilos) + '}' if estilos else None,
        'idiomas': json.dumps(idiomas, ensure_ascii=False) if idiomas else None,
        'coche': coche,
        'experiencia': (fila.get(COL_EXPERIENCIA) or '').strip() or None,
        'hobbies': (fila.get(COL_AFICIONES) or '').strip() or None,
        'disponibilidad': (fila.get(COL_OBSERVACIONES) or '').strip() or None,
        'habilidades_humanas': (fila.get(COL_HAB_HUMANAS) or '').strip() or None,
        'habilidades_cristianas': (fila.get(COL_HAB_CRISTIANAS) or '').strip() or None,
        'alergias': None,
        'observaciones': None,
        'foto_url': None,
        'revisar': ';'.join(revisar),
        'idiomas_texto_original': fila.get(COL_IDIOMAS) or '',
        'estudios_texto_original': fila.get(COL_ESTUDIOS) or '',
    }


def leer_filas_csv(ruta):
    """Lee un CSV probando varias codificaciones (los CSV exportados desde
    Excel en Windows a veces no son UTF-8) y arregla acentos rotos si los
    hubiera."""
    ultimo_error = None
    for encoding in ('utf-8-sig', 'cp1252', 'latin-1'):
        try:
            with open(ruta, newline='', encoding=encoding) as f_in:
                contenido = f_in.read()
            break
        except UnicodeDecodeError as e:
            ultimo_error = e
            contenido = None
    if contenido is None:
        raise ultimo_error

    try:
        dialecto = csv.Sniffer().sniff(contenido[:4096], delimiters=',;\t')
    except csv.Error:
        dialecto = csv.excel

    lector = csv.DictReader(contenido.splitlines(), dialect=dialecto)
    filas = []
    for fila in lector:
        filas.append({k: arreglar_mojibake(v) for k, v in fila.items()})
    return filas


def main():
    parser = argparse.ArgumentParser(description='Estandariza el CSV del formulario para importar en Supabase.')
    parser.add_argument('entrada', help='Ruta al CSV exportado de Google Forms/Sheets')
    parser.add_argument('salida', help='Ruta donde escribir el CSV limpio')
    args = parser.parse_args()

    filas_entrada = leer_filas_csv(args.entrada)
    filas_salida = [procesar_fila(fila) for fila in filas_entrada]

    with open(args.salida, 'w', newline='', encoding='utf-8') as f_out:
        escritor = csv.DictWriter(f_out, fieldnames=OUTPUT_COLUMNS)
        escritor.writeheader()
        escritor.writerows(filas_salida)

    total = len(filas_salida)
    con_dudas = sum(1 for f in filas_salida if f['revisar'])
    print(f"Listo: {total} filas procesadas, {con_dudas} con algo que revisar (columna 'revisar').")
    print(f"Guardado en: {args.salida}")


if __name__ == '__main__':
    main()
