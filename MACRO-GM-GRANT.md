# Macro: Otorgar Items (GM)

Esta macro permite al GM otorgar items, materiales, diagramas, fórmulas, maniobras y más a los jugadores de forma organizada.

## Cómo crear la macro:

1. Ve a la barra de macros en Foundry VTT
2. Haz clic derecho en un espacio vacío y selecciona "Create Macro"
3. Configura la macro:
   - **Name**: `Otorgar Items`
   - **Type**: `Script`
   - **Command**: Copia y pega el siguiente código:

```javascript
game.tsdc.openGrantDialog();
```

4. Guarda la macro
5. Arrastra la macro a la barra de acceso rápido

## Uso:

1. Haz clic en la macro
2. Se abrirá un diálogo con las siguientes opciones:

### Categorías disponibles:
- **Armas**: Espadas, arcos, hachas, etc.
- **Armaduras**: Armaduras ligeras, medias, pesadas, escudos
- **Materiales**: Pieles, huesos, minerales, madera
- **Diagramas**: Planos para herrería, sastrería, trampas
- **Fórmulas**: Recetas de alquimia
- **Consumibles**: Pociones, comida, antorchas
- **Reliquias**: Items mágicos especiales
- **Tauma**: Cristales y gemas taumáticas
- **Contenedores**: Frascos de conservación, cajas
- **Maniobras**: Técnicas de combate

### Pasos para otorgar:

1. **Selecciona los jugadores** en la lista de la izquierda (puedes seleccionar varios)
2. **Selecciona una categoría** en las pestañas superiores
3. **Ajusta la cantidad** del item que quieres dar
4. **Haz clic en "Otorgar"** en el item deseado

### Crear items personalizados:

1. Haz clic en el botón **"Crear Custom"**
2. Rellena el formulario:
   - Nombre del item
   - Tipo
   - Descripción
   - Cantidad
3. Los jugadores seleccionados recibirán el item

## Notas:

- Solo el GM puede usar esta herramienta
- Los jugadores recibirán una notificación cuando reciban items
- Se crea un mensaje de chat visible solo para el GM y el jugador receptor
- Los items se añaden automáticamente al inventario del personaje

## Ejemplo de uso:

```
1. Abrir macro "Otorgar Items"
2. Seleccionar jugadores: [✓] Juan (Arthas), [✓] María (Sylvanas)
3. Ir a categoría "Materiales"
4. Seleccionar "Piel de Lobo" con cantidad 3
5. Clic en "Otorgar"
6. → Arthas y Sylvanas reciben 3x Piel de Lobo cada uno
```

## API avanzada:

También puedes usar la función directamente desde la consola:

```javascript
// Abrir el diálogo
game.tsdc.openGrantDialog();

// Acceder a la clase
const dialog = new game.tsdc.GMGrantDialog();
dialog.render(true);
```
