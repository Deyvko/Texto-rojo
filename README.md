class CoordinateManager {
constructor(config = {}) {
// Configuración por defecto
this.config = {
baseCoordinates: config.baseCoordinates || { x: 500, y: 500 },
maxRadius: config.maxRadius || 50,
cooldownMs: config.cooldownMs || 3000,
enableLogging: config.enableLogging || false,
…config
};

```
    // Estado interno
    this.currentBackupCoord = null;
    this.lastBackupGeneration = 0;
    this.realCoordinate = null;
    this.isActive = false;
}

/**
 * Genera una coordenada falsa aleatoria cerca de la base
 */
generateBackupCoordinate() {
    const { baseCoordinates, maxRadius } = this.config;
    
    // Generar un ángulo aleatorio
    const angle = Math.random() * 2 * Math.PI;
    
    // Generar una distancia aleatoria dentro del radio
    const distance = Math.random() * maxRadius;
    
    // Calcular las coordenadas
    const x = Math.round(baseCoordinates.x + distance * Math.cos(angle));
    const y = Math.round(baseCoordinates.y + distance * Math.sin(angle));
    
    return { x, y };
}

/**
 * Verifica si necesita generar una nueva coordenada de respaldo
 */
shouldGenerateNewBackup() {
    const now = Date.now();
    return (now - this.lastBackupGeneration) >= this.config.cooldownMs;
}

/**
 * Actualiza la coordenada de respaldo si es necesario
 */
updateBackupCoordinate() {
    if (this.shouldGenerateNewBackup()) {
        this.currentBackupCoord = this.generateBackupCoordinate();
        this.lastBackupGeneration = Date.now();
        
        if (this.config.enableLogging) {
            console.log(`Nueva coordenada de respaldo generada: (${this.currentBackupCoord.x}, ${this.currentBackupCoord.y})`);
        }
    }
}

/**
 * Establece una coordenada real (tiene prioridad sobre las de respaldo)
 */
setRealCoordinate(coord) {
    this.realCoordinate = coord;
    
    if (this.config.enableLogging && coord) {
        console.log(`Coordenada real establecida: (${coord.x}, ${coord.y})`);
    }
}

/**
 * Limpia la coordenada real
 */
clearRealCoordinate() {
    this.realCoordinate = null;
    
    if (this.config.enableLogging) {
        console.log('Coordenada real limpiada');
    }
}

/**
 * Obtiene la coordenada activa (real si está disponible, respaldo en caso contrario)
 */
getActiveCoordinate() {
    // Priorizar coordenada real si está disponible
    if (this.realCoordinate) {
        return {
            coordinate: this.realCoordinate,
            type: 'real'
        };
    }
    
    // Actualizar coordenada de respaldo si es necesario
    this.updateBackupCoordinate();
    
    // Retornar coordenada de respaldo
    return {
        coordinate: this.currentBackupCoord,
        type: 'backup'
    };
}

/**
 * Inicia el sistema automático
 */
start() {
    if (this.isActive) return;
    
    this.isActive = true;
    
    // Generar primera coordenada de respaldo
    this.currentBackupCoord = this.generateBackupCoordinate();
    this.lastBackupGeneration = Date.now();
    
    if (this.config.enableLogging) {
        console.log('Sistema de coordenadas iniciado');
        console.log(`Base: (${this.config.baseCoordinates.x}, ${this.config.baseCoordinates.y})`);
        console.log(`Radio máximo: ${this.config.maxRadius}`);
        console.log(`Cooldown: ${this.config.cooldownMs}ms`);
    }
}

/**
 * Detiene el sistema
 */
stop() {
    this.isActive = false;
    this.currentBackupCoord = null;
    this.realCoordinate = null;
    
    if (this.config.enableLogging) {
        console.log('Sistema de coordenadas detenido');
    }
}

/**
 * Obtiene el estado actual del sistema
 */
getStatus() {
    return {
        isActive: this.isActive,
        hasRealCoordinate: !!this.realCoordinate,
        currentBackupCoord: this.currentBackupCoord,
        timeSinceLastBackup: Date.now() - this.lastBackupGeneration,
        cooldownRemaining: Math.max(0, this.config.cooldownMs - (Date.now() - this.lastBackupGeneration))
    };
}

/**
 * Actualiza la configuración en tiempo real
 */
updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    if (this.config.enableLogging) {
        console.log('Configuración actualizada:', newConfig);
    }
}
```

}

// Ejemplo de uso
const coordinateManager = new CoordinateManager({
baseCoordinates: { x: 500, y: 500 }, // Coordenada base
maxRadius: 30,                        // Radio máximo para coordenadas falsas
cooldownMs: 3000,                     // 3 segundos entre actualizaciones
enableLogging: true                   // Habilitar logs para debugging
});

// Función principal del bot
function botMainLoop() {
// Obtener la coordenada activa
const { coordinate, type } = coordinateManager.getActiveCoordinate();

```
if (coordinate) {
    console.log(`Usando coordenada ${type}: (${coordinate.x}, ${coordinate.y})`);
    
    // Aquí iría la lógica de tu bot para usar la coordenada
    // Por ejemplo: placePixel(coordinate.x, coordinate.y, color);
    
    // Si usaste una coordenada real, la puedes limpiar después de usarla
    if (type === 'real') {
        coordinateManager.clearRealCoordinate();
    }
}
```

}

// Función para establecer coordenadas reales cuando estén disponibles
function onRealCoordinateAvailable(x, y) {
coordinateManager.setRealCoordinate({ x, y });
}

// Iniciar el sistema
coordinateManager.start();

// Ejemplo de integración con el loop principal del bot
// setInterval(botMainLoop, 1000); // Ejecutar cada segundo

// Exportar para uso en otros módulos
if (typeof module !== ‘undefined’ && module.exports) {
module.exports = CoordinateManager;
}

// Para navegadores
if (typeof window !== ‘undefined’) {
window.CoordinateManager = CoordinateManager;
}

/*
EJEMPLO DE INTEGRACIÓN:

// 1. Inicializar el sistema
const coordManager = new CoordinateManager({
baseCoordinates: { x: 500, y: 500 },
maxRadius: 25,
cooldownMs: 4000,
enableLogging: true
});

coordManager.start();

// 2. En tu loop principal del bot
function yourBotLoop() {
const { coordinate, type } = coordManager.getActiveCoordinate();

```
if (coordinate) {
    // Usar la coordenada (real o de respaldo)
    performBotAction(coordinate.x, coordinate.y);
    
    // Si era una coordenada real, limpiarla después de usar
    if (type === 'real') {
        coordManager.clearRealCoordinate();
    }
}
```

}

// 3. Cuando detectes una coordenada real
function onTargetFound(targetX, targetY) {
coordManager.setRealCoordinate({ x: targetX, y: targetY });
}

// 4. Ejecutar el bot cada X tiempo
setInterval(yourBotLoop, 2000);
*/
