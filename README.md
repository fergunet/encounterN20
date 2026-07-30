# Nivel20 - Ayudante de Encuentros (D&D 5e 2014)

Userscript de Tampermonkey que añade información útil al modal **"Encuentro"** de [Nivel20](https://nivel20.com) (la web de fichas y seguimiento de partidas de D&D 5e): dificultad del combate, experiencia total/por jugador y una estimación de turnos necesarios para derrotar a los monstruos (TTK).

Funciona en páginas del tipo:

```
https://nivel20.com/games/dnd-5/campaigns/NOMBRECAMPANIA/tracking_log
```

## Qué muestra

Al abrir el modal "Encuentro" y añadir criaturas, aparece un panel con:

- **Dificultad (reglas 2014)**: Trivial / Fácil / Medio / Difícil / Mortal, calculada según el número y nivel de los personajes de la campaña.
- **XP total** y **XP por jugador**: la experiencia real que se repartiría al derrotar a las criaturas.
- **XP ajustada a repartir** y **XP ajustada por jugador**: la XP con el multiplicador de dificultad aplicado (según el número de monstruos y el tamaño del grupo).
- **TTK estimado**: turnos que tardaría el grupo en derrotar a las criaturas, estimado solo a partir del nivel de cada personaje (tabla oficial de Daño/Asalto por Valor de Desafío del DMG 2014, pág. 274).

El panel se recalcula automáticamente cada vez que añades, quitas o cambias la cantidad de un monstruo.

## Requisitos

- Navegador **Firefox** (también funciona en Chrome/Edge, el script no usa nada específico de Firefox).
- Extensión **[Tampermonkey](https://www.tampermonkey.net/)** instalada.
- Estar logueado en Nivel20 y tener acceso a la campaña.

## Instalación

1. **Instala Tampermonkey** en tu navegador si aún no lo tienes:
   - Firefox: [Tampermonkey para Firefox](https://addons.mozilla.org/firefox/addon/tampermonkey/)
   - Chrome: [Tampermonkey para Chrome](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)

2. **Abre el fichero del script**: [`nivel20-encounter-helper.user.js`](./nivel20-encounter-helper.user.js) de este repositorio.

3. **Instálalo en Tampermonkey**, con cualquiera de estas dos opciones:

   - **Opción A (recomendada):** haz clic en el icono de Tampermonkey en la barra del navegador → **"Crear un nuevo script..."** (o "Dashboard" → pestaña "+"). Borra el contenido de ejemplo, pega el contenido completo de `nivel20-encounter-helper.user.js` y guarda con `Ctrl+S` (o el icono de guardar).

   - **Opción B:** si abres el archivo `.user.js` directamente en el navegador (por ejemplo arrastrándolo a una pestaña, o con "Archivo > Abrir archivo"), Tampermonkey debería detectarlo automáticamente y ofrecerte un botón **"Instalar"**.

4. Comprueba que el script aparece **activado** (habilitado) en el Dashboard de Tampermonkey, en la lista de scripts.

## Uso

1. Entra en la página de seguimiento de tu campaña:
   `https://nivel20.com/games/dnd-5/campaigns/TU-CAMPANIA/tracking_log`
2. Haz clic en el botón **"Encuentro"**.
3. Añade una o varias criaturas y ajusta las cantidades: el panel de arriba del modal se actualizará solo.

## Actualizar el script

Si cambias `nivel20-encounter-helper.user.js` (o descargas una versión nueva), abre el Dashboard de Tampermonkey, entra en el script instalado, sustituye el contenido por el nuevo y guarda. Tampermonkey también soporta configurar una URL de actualización automática (`@updateURL`/`@downloadURL`) si el script se aloja en algún sitio accesible, pero por defecto hay que actualizarlo a mano copiando el fichero.

## Limitaciones conocidas

- El **TTK** es una estimación basada únicamente en el **nivel** de cada personaje (no en sus armas, hechizos o clase), usando la tabla de Daño/Asalto por Valor de Desafío del DMG 2014. Es orientativo, no un cálculo exacto de combate.
- Las criaturas añadidas al equipo **"Personajes"** (aliados/compañeros) no cuentan como amenaza en los cálculos de dificultad, XP ni TTK.
- Los datos de cada monstruo (puntos de golpe y XP) se obtienen en tiempo real de su ficha en Nivel20, así que necesitas conexión y que la ficha exista en el sitio.
- El script depende de la estructura HTML actual de Nivel20; si la web cambia su maquetación, puede dejar de funcionar y necesitar actualización.
