# assets/

Sube aquí el logo (el corazón partido en 4 colores con cruz y estrella) con
el nombre exacto:

```
assets/logo.png
```

Se usa en dos sitios (ya están enlazados en `index.html` y `app.html`,
no hace falta tocar código):

- Pequeño (~56px en login, ~40px en la cabecera de la app), junto al nombre.
- Grande, como marca de agua de fondo muy tenue (5% de opacidad, girado),
  fija al hacer scroll.

Si prefieres subirlo como `.svg` en vez de `.png`, dímelo y cambio la
referencia en el HTML — o directamente sube `logo.svg` y también
`logo.png` como respaldo, lo que te sea más cómodo.

Mientras no exista el archivo, los sitios donde iría el logo simplemente
se quedan vacíos (no se rompe el diseño ni aparece un icono de imagen rota).
