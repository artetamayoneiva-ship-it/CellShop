# Cell's Shop — PWA de inventario y ventas

Aplicación web progresiva (PWA) estática, sin backend. Está diseñada para ejecutarse en GitHub Pages y guarda la información en el `localStorage` del navegador/dispositivo.

## Estructura

```text
cells-shop-pwa/
├── index.html
├── styles.css
├── app.js
├── manifest.json
├── service-worker.js
└── assets/
    └── icon.svg
```

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub, por ejemplo `cells-shop`.
2. Descomprime este proyecto y sube **el contenido** de la carpeta a la raíz del repositorio. `index.html` debe quedar en la raíz.
3. En GitHub abre **Settings → Pages**.
4. En **Build and deployment**, selecciona **Deploy from a branch**.
5. Selecciona la rama `main` y la carpeta `/ (root)`, y pulsa **Save**.
6. Espera la publicación. GitHub mostrará una URL similar a `https://TU-USUARIO.github.io/cells-shop/`.

No cambies las rutas relativas `./` de los archivos: permiten que la app funcione tanto en un dominio raíz como en un repositorio de GitHub Pages.

## Instalar en el celular

La URL publicada debe abrirse con HTTPS.

- **Android (Chrome):** abre el enlace y usa el menú ⋮ → **Instalar aplicación** o **Agregar a pantalla principal**. Si Chrome muestra el aviso de instalación, también puedes usarlo.
- **iPhone (Safari):** abre el enlace → **Compartir** → **Agregar a pantalla de inicio** → **Agregar**.
- Dentro de la aplicación también está la opción **Instalar aplicación**, que muestra estas instrucciones. En navegadores compatibles puede aparecer el botón de instalación directa.

## Funciones incluidas

- Crear, editar y eliminar referencias; categorías, fotografía comprimida, stock mínimo y precios.
- Cálculo de utilidad unitaria y margen sobre precio de venta.
- Entradas y salidas manuales de inventario.
- Catálogo con búsqueda, filtros y estados de stock.
- Requisición de productos por reponer, con copia al portapapeles y descarga CSV.
- Registro de ventas, descuento automático de stock, costo de mercancía vendida y utilidad bruta.
- Dashboard con indicadores, ventas por últimos siete días, alertas, ranking y ventas recientes.
- Exportación e importación de respaldo JSON.
- Caché offline mediante service worker.

## Persistencia y recomendaciones importantes

- Los datos permanecen en el navegador y dispositivo donde se registran. `localStorage` **no sincroniza** automáticamente entre celulares, computadores ni navegadores.
- Exporta un respaldo JSON con frecuencia y guárdalo fuera del dispositivo. Importar un respaldo reemplaza los datos existentes.
- Las fotos se reducen antes de guardarse, pero el espacio de `localStorage` es limitado. Si manejas cientos de referencias o muchas fotos, conviene migrar a una base de datos.
- El indicador llamado **utilidad bruta** se calcula como ingresos de ventas menos costo de los productos vendidos. No descuenta gastos operativos, impuestos, comisiones ni otros egresos; por tanto, no representa utilidad neta contable.
- La salida manual registra un movimiento de inventario, pero no se considera venta ni genera ingresos.
- Esta versión no incluye usuarios, permisos, sincronización en la nube ni facturación electrónica.

## Actualizar la aplicación

Cuando publiques una nueva versión, cambia `CACHE_NAME` en `service-worker.js` (por ejemplo, `cells-shop-shell-v2`) para que los dispositivos descarguen el nuevo conjunto de archivos.
