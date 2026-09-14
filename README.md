# FC AUTISM

Base jugable de fútbol 3D para navegador, construida con **Three.js 0.180** y JavaScript modular. Estadio, jugadores, texturas y efectos procedurales: no requiere Unity, Unreal, modelos descargados ni servicios de pago.

## Abrir el juego

Requisito: Node.js 22.12 o posterior. En esta carpeta:

```powershell
npm.cmd install
npm.cmd run dev
```

Abre **http://127.0.0.1:5173/** en Edge o Chrome con aceleración gráfica. El servidor solo escucha en tu equipo. Mantén la terminal abierta; para detenerlo, pulsa Ctrl+C. No abras `index.html` con doble clic: los módulos necesitan el servidor.

```powershell
npm.cmd test       # Pruebas de física e integración
npm.cmd run build # Versión compilada en dist/
npm.cmd run preview # Vista previa de la compilación en el puerto 4173
```

Las fuentes Barlow se solicitan a Google Fonts; si no hay conexión, se usan fuentes del sistema. El resto del juego funciona sin conexión después de instalar las dependencias.

## Jugar

Pulsa **Jugar partido** para un encuentro 5 contra 5 o **Campo de práctica** para entrenar con compañeros y un portero rival. Tres equipos ficticios seleccionables. Tu equipo siempre ataca hacia la derecha, también en la segunda parte.

| Control | Acción |
|---|---|
| WASD o flechas | Movimiento 360° |
| Shift | Sprint con consumo y recuperación de estamina |
| J | Pase corto hacia un compañero en la dirección elegida |
| K | Pase filtrado con anticipación |
| L | Centro elevado |
| Espacio | Tiro; apunta con tu última dirección de movimiento |
| Q / E | Curva al soltar el golpe |
| C | Cambiar al compañero de campo más cercano al balón |
| V | Entrada de pie para robar el balón |
| X | Barrida |
| R | Sombrerito: elevar el balón por encima del rival |
| F | Elástica: toque exterior y recorte interior |
| B | Alternar televisión / primera persona |
| Esc | Pausa |

Mantén J, K, L o Espacio para cargar potencia (hasta 1,2 segundos) y suelta para golpear. **Hay que acercar la bota al balón**: cargar desde lejos no produce un tiro. La animación del golpe dura 0,24 segundos. El contacto de la bota utiliza una esfera barrida entre fotogramas. Los centros y tiros permiten elevación; la potencia alta y la fatiga aumentan la dispersión.

El cronómetro escala 90 minutos a 3, 6 o 10 minutos reales. Hay descanso, marcador, final de partido, reinicio y pausa automática al cambiar de ventana. La práctica no tiene límite de tiempo.

### Estadios y cámaras (Build 02)

En **Estadios** puedes elegir Estadio del Sol o **Arena Marina**, con grandes arcos, tirantes, cubiertas en los fondos, gradas azules y pantallas propias. La selección se muestra en el menú y se guarda localmente. Ambos usan las mismas dimensiones regladas del prototipo y permiten los ajustes de clima e iluminación.

En la pantalla inicial, **Tu punto de vista** permite elegir televisión o **primera persona**. También puedes cambiar con **B** o el botón de cámara durante el partido. Primera persona sigue los ojos del jugador, oculta su cabeza y torso para evitar recortes y mantiene brazos y piernas. WASD se mueve relativo a la mirada (A/D desplazamiento lateral); haz clic en el campo para capturar el ratón y mirar. Las flechas izquierda/derecha también giran sin capturar el ratón. Esc libera el cursor y pausa. El balanceo de cabeza es leve y la vista inicial está inclinada para ver el balón.

### Comportamiento y animación

La IA decide a 5 Hz, con continuidad en el jugador que presiona, anticipación del movimiento del balón, apoyos por las bandas, cobertura de rivales y separación local. Evalúa espacio y obstáculos antes de pasar, intenta conducir fuera de la presión y tira cuando tiene una línea hacia portería. El portero anticipa la intersección de tiros con su posición. Sigue siendo IA heurística de prototipo, sin aprendizaje ni tácticas profesionales.

Las animaciones incluyen hombros, codos, muñecas y manos articuladas, balanceo opuesto a las piernas, flexión mayor al correr e inclinación al girar. Conservan la aceleración, frenado, conducción cercana y regates de la versión anterior.

### Conducción y regates

Al recoger un balón bajo y cercano, se mantiene controlado a unos 0,6–0,9 m del jugador mediante seguimiento físico amortiguado. La aceleración, el frenado y la velocidad de giro están limitados; el cuerpo se inclina al acelerar y girar. Sprint alarga el toque y facilita una entrada rival. Un tiro o pase libera la posesión; el balón sigue usando la física del mundo.

**V** intenta robar de pie y **X** realiza una barrida más larga con recuperación más lenta. Es necesario mirar hacia un balón al alcance y a baja altura. El cuerpo del poseedor protege las entradas desde detrás. Un robo impide que el jugador anterior recupere inmediatamente el balón. La IA también conduce e intenta entradas de pie.

**R (sombrerito)** da un impulso ascendente que supera aproximadamente dos metros: el balón queda libre y hay que seguir su caída para recuperarlo. **F (elástica)** encadena un toque exterior con un recorte interior en 0,58 segundos, conservando control cercano. Una entrada bien colocada puede interrumpir la elástica. Ambos requieren posesión, estamina y una recarga de 1,5 segundos. El panel del partido muestra posesión y disponibilidad.

## Sistemas y archivos

| Archivo | Responsabilidad |
|---|---|
| `src/main.js` | Inicialización, bucle, cámara, menús, HUD, ajustes y almacenamiento local |
| `src/ai.js` | Decisiones tácticas, apoyo, presión, selección de pase y anticipación del portero |
| `src/game-camera.js` | Primera persona, encuadre de ojos y visibilidad del jugador local |
| `src/config.js` | Dimensiones, constantes físicas y equipos |
| `src/physics.js` | Balón: gravedad, arrastre, Magnus, fricción, rebote, postes, gol y contacto de bota |
| `src/ball-control.js` | Posesión cercana, robos, protección con el cuerpo, sombrerito y elástica |
| `src/input.js` | Teclado, carga, pulsación y liberación de golpes |
| `src/player.js` | Personajes procedurales, uniforme PBR, locomoción, bota y estamina |
| `src/match.js` | IA, pases, tiros, barridas, separación corporal y reglas del partido |
| `src/stadium.js` | Campo, líneas, porterías y red, gradas instanciadas, cubiertas y reflectores |
| `src/environment.js` | Sol, cielo, ciclo, lluvia, partículas, césped mojado y sonido sintetizado |
| `src/style.css` | Menús y HUD adaptables |
| `tests/` | 27 pruebas automatizadas sin necesidad de GPU |

## Física y renderizado

Unidades en metros, segundos y kilogramos. Simulación a **120 Hz** con acumulador independiente del render. Balón de 0,43 kg y 0,22 m de radio. Arrastre: `F = -0,5 · rho · Cd · A · |v| · v`. Curva: fuerza proporcional a `omega × v`; el coeficiente está ajustado para jugabilidad, no calibrado contra mediciones de competición. El suelo húmedo reduce el rebote y la fricción. La integración es Euler semiimplícita, con barridos para postes y botas. Un gol requiere cruzar completamente la línea dentro de la portería.

Césped con textura y normales procedurales, franjas de corte y material PBR. Uniformes con normales de trama. Sol direccional, luz hemisférica, cuatro reflectores que se encienden según la elevación solar, sombras filtradas, cielo degradado y niebla. Ciclo dinámico de unos 160 segundos. Gradas y público usan `InstancedMesh`; partículas reutilizan buffers de GPU. Calidad Equilibrada activa sombras en dos reflectores, Alta en cuatro y Rendimiento desactiva sombras. El sonido de ambiente y golpes se genera con Web Audio y se activa desde Configuración.

Referencia técnica del material: [MeshStandardMaterial, documentación oficial de Three.js](https://threejs.org/docs/pages/MeshStandardMaterial.html).

## Alcance de esta base

Es un **prototipo jugable ampliable**, no un simulador comercial de fidelidad AAA. Personajes estilizados sin modelos escaneados, captura de movimiento ni IK; la bota usa un volumen aproximado, no colisión exacta de cada triángulo. El césped no tiene geometría individual por brizna. La lluvia y el humo son partículas ligeras, sin simulación volumétrica. El audio es sintetizado.

Reglas simplificadas: los saques son reposicionamientos automáticos; no hay fuera de juego, faltas, tarjetas, córners reglamentarios ni cambios de campo. IA básica de persecución, apoyo y portero; sin tácticas profesionales. No incluye multijugador, mando, controles táctiles ni equipos con licencia. La cámara de menú oscila orbitalmente alrededor de la vista del estadio para conservar la composición; la de partido sigue el balón y al jugador.

Para evolucionar: sustituir `Player` por modelos glTF con esqueleto e IK, ampliar las reglas en `Match`, calibrar los coeficientes de `BallPhysics`, añadir mando y separar simulación de cliente/servidor para red. La geometría procedural puede reemplazarse por assets sin cambiar la física ni los controles.

## Verificación realizada

Compilación de producción correcta y 27 pruebas aprobadas: física, goles, contacto de bota, pausa, descanso/final, cambio de jugador, conducción con giro y frenado, aceleración limitada, liberación al tirar, trayectoria de ambos regates, recuperación tras sombrerito, robos válidos, protección, cancelación de la elástica, brazos articulados, apoyos de IA, líneas de pase, anticipación del portero y primera persona. Selector de Arena Marina y cámara de ojos comprobados en navegador con WebGL; sin errores de ejecución durante la inspección. La fluidez depende del hardware y de la calidad elegida. Vite avisa del tamaño del bloque gráfico de Three.js (aproximadamente 507 kB sin gzip); la compilación finaliza correctamente.
