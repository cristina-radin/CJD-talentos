#!/usr/bin/env python3
"""
Convierte el CSV final (salida de fusionar_csv.py, o de estandarizar_csv.py
si no hay segundo CSV) en sentencias SQL listas para pegar en el SQL Editor
de Supabase.

Uso:
    python3 generar_sql_import.py final.csv import.sql

Qué hace:
  - Genera un INSERT ... ON CONFLICT (email) DO UPDATE por cada fila, así
    que si el email ya existe en `members` (por ejemplo, de las fichas de
    ejemplo) se actualiza en vez de crear un duplicado.
  - Da el formato correcto a `estilos` (array) e `idiomas` (jsonb), en vez
    de dejar que un importador de CSV genérico lo adivine.
  - Ignora las columnas que no son de la tabla real (`revisar`,
    `idiomas_texto_original`, `estudios_texto_original`) — antes de cada
    INSERT deja un comentario con lo que decía `revisar` para esa fila,
    por si se te pasó revisarla.

Antes de ejecutar el SQL generado, en el SQL Editor de Supabase asegúrate
de que el email es único en la tabla (si ya lo es, este comando no hace
nada raro, solo avisa de que ya existe):

    alter table members add constraint members_email_key unique (email);
"""

import argparse
import csv


COLUMNAS_TEXTO = [
    'nombre', 'apellidos', 'email', 'telefono', 'domicilio', 'nif',
    'nacimiento', 'ciudad', 'asociacion', 'area_titulacion', 'titulacion',
    'coche', 'experiencia', 'hobbies', 'disponibilidad',
    'habilidades_humanas', 'habilidades_cristianas', 'alergias',
    'observaciones', 'foto_url',
]
COLUMNA_ARRAY = 'estilos'
COLUMNA_JSONB = 'idiomas'
TODAS_LAS_COLUMNAS = COLUMNAS_TEXTO + [COLUMNA_ARRAY, COLUMNA_JSONB]


def arreglar_mojibake(texto):
    if not texto or 'Ã' not in texto:
        return texto
    try:
        return texto.encode('latin-1').decode('utf-8')
    except (UnicodeDecodeError, UnicodeEncodeError):
        return texto


def leer_csv(ruta):
    ultimo_error = None
    contenido = None
    for encoding in ('utf-8-sig', 'cp1252', 'latin-1'):
        try:
            with open(ruta, newline='', encoding=encoding) as f:
                contenido = f.read()
            break
        except UnicodeDecodeError as e:
            ultimo_error = e
    if contenido is None:
        raise ultimo_error

    try:
        dialecto = csv.Sniffer().sniff(contenido[:4096], delimiters=',;\t')
    except csv.Error:
        dialecto = csv.excel

    lector = csv.DictReader(contenido.splitlines(), dialect=dialecto)
    return [{k: arreglar_mojibake(v) for k, v in fila.items()} for fila in lector]


def sql_texto(valor):
    if not valor:
        return 'NULL'
    return "'" + valor.replace("'", "''") + "'"


def sql_array(valor):
    if not valor:
        return 'NULL'
    return "'" + valor.replace("'", "''") + "'::text[]"


def sql_jsonb(valor):
    if not valor:
        return 'NULL'
    return "'" + valor.replace("'", "''") + "'::jsonb"


def fila_a_insert(fila):
    valores = {}
    for col in COLUMNAS_TEXTO:
        valores[col] = sql_texto(fila.get(col))
    valores[COLUMNA_ARRAY] = sql_array(fila.get(COLUMNA_ARRAY))
    valores[COLUMNA_JSONB] = sql_jsonb(fila.get(COLUMNA_JSONB))

    columnas_sql = ', '.join(TODAS_LAS_COLUMNAS)
    valores_sql = ', '.join(valores[c] for c in TODAS_LAS_COLUMNAS)
    actualizaciones = ',\n  '.join(f'{c} = EXCLUDED.{c}' for c in TODAS_LAS_COLUMNAS if c != 'email')

    revisar = (fila.get('revisar') or '').strip()
    comentario = f"-- revisar: {revisar}\n" if revisar else ''

    return (
        f"{comentario}"
        f"INSERT INTO members ({columnas_sql})\n"
        f"VALUES ({valores_sql})\n"
        f"ON CONFLICT (email) DO UPDATE SET\n"
        f"  {actualizaciones};\n"
    )


def main():
    parser = argparse.ArgumentParser(description='Genera SQL de importación a partir del CSV final.')
    parser.add_argument('entrada', help='CSV final (de fusionar_csv.py o estandarizar_csv.py)')
    parser.add_argument('salida', help='Ruta del archivo .sql a generar')
    args = parser.parse_args()

    filas = leer_csv(args.entrada)
    sin_email = [f for f in filas if not (f.get('email') or '').strip()]
    filas_validas = [f for f in filas if (f.get('email') or '').strip()]

    sentencias = [fila_a_insert(f) for f in filas_validas]

    with open(args.salida, 'w', encoding='utf-8') as f_out:
        f_out.write('-- Generado por generar_sql_import.py\n')
        f_out.write('-- Revisa antes de ejecutar: usa "Run" en el SQL Editor de Supabase.\n\n')
        f_out.write('\n'.join(sentencias))

    print(f"Listo: {len(filas_validas)} sentencias INSERT generadas en {args.salida}")
    if sin_email:
        print(f"Aviso: {len(sin_email)} fila(s) sin email se han omitido (no se puede importar sin email).")


if __name__ == '__main__':
    main()
