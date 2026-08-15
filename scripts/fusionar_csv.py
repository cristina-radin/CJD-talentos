#!/usr/bin/env python3
"""
Fusiona el CSV ya estandarizado (salida de estandarizar_csv.py) con un
segundo CSV que trae NIF, fecha de nacimiento, ciudad y alergias,
cruzando ambos por email.

Uso:
    python3 fusionar_csv.py estandarizado.csv datos.csv salida_final.csv

Columnas esperadas en el segundo CSV ("datos.csv"):
    Nombre, Apellidos, Grupo, Nacimiento, Correo electrónico, Domicilio,
    Número de teléfono, NIF, Alergias

Reglas:
  - Cruce por email (sin mayúsculas ni espacios de más).
  - "Nacimiento" se convierte de "D-M-AAAA" / "DD-MM-AAAA" a "DD/MM/AAAA".
  - "Grupo" se copia a la columna `ciudad` tal cual.
  - "NIF" y "Alergias" se copian tal cual, solo si esos campos estaban
    vacíos en el CSV estandarizado.
  - Nombre/Apellidos/Domicilio/Teléfono aparecen en los dos formularios:
    si coinciden no se toca nada; si son distintos, se deja el valor que
    ya había y se marca la fila para revisar (nunca se sobrescribe a
    ciegas cuando hay un posible conflicto).
  - Las filas de "datos.csv" cuyo email no aparece en el CSV estandarizado
    se añaden igual al final, marcadas como "solo_en_datos".
"""

import argparse
import csv
import re


CAMPOS_COMPARABLES = {
    'Nombre': 'nombre',
    'Apellidos': 'apellidos',
    'Domicilio': 'domicilio',
    'Número de teléfono': 'telefono',
}


def normalizar_comparacion(texto):
    return re.sub(r'\s+', ' ', (texto or '').strip().lower())


def normalizar_nacimiento(texto):
    texto = (texto or '').strip()
    if not texto:
        return None, False
    m = re.match(r'^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$', texto)
    if not m:
        return texto, True  # formato no reconocido: se deja tal cual y se marca
    dia, mes, anio = m.groups()
    return f"{int(dia):02d}/{int(mes):02d}/{anio}", False


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


def leer_csv(ruta):
    """Lee un CSV probando varias codificaciones (los CSV exportados desde
    Excel en Windows a veces no son UTF-8) y arregla acentos rotos si los
    hubiera."""
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


def main():
    parser = argparse.ArgumentParser(description='Fusiona el CSV estandarizado con el CSV de datos sensibles, cruzando por email.')
    parser.add_argument('estandarizado', help='CSV ya procesado por estandarizar_csv.py')
    parser.add_argument('datos', help='CSV con Nombre, Apellidos, Grupo, Nacimiento, email, Domicilio, teléfono, NIF, Alergias')
    parser.add_argument('salida', help='Ruta del CSV final')
    args = parser.parse_args()

    filas_principales = leer_csv(args.estandarizado)
    columnas = list(filas_principales[0].keys()) if filas_principales else []

    datos_por_email = {}
    for fila in leer_csv(args.datos):
        email = (fila.get('Correo electrónico') or '').strip().lower()
        if email:
            datos_por_email[email] = fila

    emails_usados = set()

    for fila in filas_principales:
        email = (fila.get('email') or '').strip().lower()
        revisar = [c for c in (fila.get('revisar') or '').split(';') if c]
        datos = datos_por_email.get(email)

        if not datos:
            fila['revisar'] = ';'.join(revisar)
            continue

        emails_usados.add(email)

        if not fila.get('nif'):
            fila['nif'] = (datos.get('NIF') or '').strip() or None
        if not fila.get('alergias'):
            fila['alergias'] = (datos.get('Alergias') or '').strip() or None
        if not fila.get('ciudad'):
            fila['ciudad'] = (datos.get('Grupo') or '').strip() or None
        if not fila.get('nacimiento'):
            nacimiento, dudoso_fecha = normalizar_nacimiento(datos.get('Nacimiento'))
            fila['nacimiento'] = nacimiento
            if dudoso_fecha:
                revisar.append('nacimiento')

        for columna_datos, columna_salida in CAMPOS_COMPARABLES.items():
            valor_datos = (datos.get(columna_datos) or '').strip()
            valor_actual = (fila.get(columna_salida) or '').strip()
            if not valor_actual:
                fila[columna_salida] = valor_datos or None
            elif valor_datos and normalizar_comparacion(valor_datos) != normalizar_comparacion(valor_actual):
                revisar.append(f'{columna_salida}_no_coincide')

        fila['revisar'] = ';'.join(dict.fromkeys(revisar))

    filas_extra = []
    for email, datos in datos_por_email.items():
        if email in emails_usados:
            continue
        nacimiento, dudoso_fecha = normalizar_nacimiento(datos.get('Nacimiento'))
        nueva = {c: None for c in columnas}
        nueva.update({
            'nombre': datos.get('Nombre'),
            'apellidos': datos.get('Apellidos'),
            'email': datos.get('Correo electrónico'),
            'telefono': datos.get('Número de teléfono'),
            'domicilio': datos.get('Domicilio'),
            'nif': datos.get('NIF'),
            'ciudad': datos.get('Grupo'),
            'alergias': datos.get('Alergias'),
            'nacimiento': nacimiento,
            'revisar': 'solo_en_datos' + (';nacimiento' if dudoso_fecha else ''),
        })
        filas_extra.append(nueva)

    todas = filas_principales + filas_extra

    # utf-8-sig añade la marca BOM: sin ella, Excel en Windows a veces abre
    # los CSV en UTF-8 como si fueran ANSI y rompe los acentos al mostrarlos.
    with open(args.salida, 'w', newline='', encoding='utf-8-sig') as f_out:
        escritor = csv.DictWriter(f_out, fieldnames=columnas)
        escritor.writeheader()
        escritor.writerows(todas)

    con_dudas = sum(1 for f in todas if f.get('revisar'))
    print(f"Listo: {len(todas)} filas en total ({len(filas_extra)} solo estaban en 'datos').")
    print(f"{con_dudas} filas con algo que revisar (columna 'revisar').")
    print(f"Guardado en: {args.salida}")


if __name__ == '__main__':
    main()
