# SalvadoreX POS - Sistema Unificado

Sistema de Punto de Venta con **UI 100% idéntica** en Web, Windows y Android.

## Características Principales

### UI Unificada
- **Un solo diseño web** reutilizado en todas las plataformas
- Windows usa WebView2 para mostrar la misma interfaz web
- Android usa WebView para la misma experiencia visual
- Cambios en la UI web se reflejan en todas las plataformas

### Offline-First
- **100% funcional sin internet**
- Base de datos SQLite local en cada plataforma
- Todas las operaciones del POS funcionan offline
- Datos seguros almacenados localmente

### Sincronización Automática
- Detecta automáticamente cuando hay conexión
- Sincroniza cambios pendientes con Supabase
- Resolución de conflictos inteligente
- Indicador visual de estado de conexión

### Seguridad y Licenciamiento
- **Anclado a hardware**: Fingerprint único por dispositivo
- No funciona si se copia a otra PC/dispositivo
- Licencia por equipo
- Sin modo portable

## Estructura del Proyecto

```
SalvadoreXUnified/
├── Windows/              # Aplicación Windows (.exe)
│   ├── WebApp/           # UI Web embebida
│   ├── Services/         # Servicios nativos (DB, Sync, License)
│   ├── MainForm.cs       # Formulario principal con WebView2
│   └── Installer/        # Script Inno Setup
│
├── Android/              # Aplicación Android (.apk)
│   ├── Assets/webapp/    # UI Web embebida
│   ├── Services/         # Servicios nativos
│   └── MainActivity.cs   # Actividad con WebView
│
└── Web/                  # UI Web original (opcional)
```

## Compilación

### Windows (.exe)

```bash
cd SalvadoreXUnified/Windows
dotnet build -c Release
```

El ejecutable estará en: `bin/Release/net8.0-windows/SalvadoreXPOS.exe`

### Generar Instalador Windows

1. Instalar [Inno Setup](https://jrsoftware.org/isinfo.php)
2. Abrir `Installer/setup.iss`
3. Compilar (Ctrl+F9)
4. El instalador estará en `Output/SalvadoreXPOS_Setup.exe`

### Android (.apk)

```bash
cd SalvadoreXUnified/Android
dotnet publish -f net8.0-android -c Release
```

El APK estará en: `bin/Release/net8.0-android/publish/com.salvadorex.pos-Signed.apk`

## Requisitos

### Windows
- Windows 10/11
- .NET 8.0 Runtime
- Microsoft Edge WebView2 Runtime (incluido en Windows 11)

### Android
- Android 7.0 (API 24) o superior
- 50 MB de espacio libre

## Módulos Incluidos

1. **Punto de Venta (POS)**
   - Grid de productos con búsqueda
   - Carrito con cantidades editables
   - Múltiples métodos de pago
   - Recibos automáticos

2. **Inventario**
   - CRUD de productos
   - Gestión de stock
   - Alertas de bajo inventario

3. **Clientes**
   - Base de datos de clientes
   - Historial de compras
   - Datos de contacto

4. **Ventas**
   - Historial completo
   - Reportes diarios
   - Detalles por transacción

5. **Configuración**
   - Datos del negocio
   - Tasa de IVA
   - Estado de sincronización
   - ID de Hardware

## Licenciamiento

El sistema genera un ID de Hardware único basado en:
- **Windows**: CPU ID, Serial de motherboard, BIOS, Disco
- **Android**: Android ID, Modelo, Fabricante, Serial

Para activar:
1. Obtener el ID de Hardware desde Configuración
2. Solicitar licencia al proveedor
3. Ingresar clave de licencia

## Sincronización con Supabase

Configurar en la aplicación:
1. Ir a Configuración
2. Agregar URL de Supabase
3. Agregar API Key de Supabase
4. La sincronización iniciará automáticamente

## Tecnologías

- **Windows**: C# .NET 8.0, WebView2, SQLite
- **Android**: C# .NET 8.0 Android, WebView, SQLite
- **UI**: HTML5, Tailwind CSS, JavaScript

## Soporte

Copyright © 2025 SalvadoreX. Todos los derechos reservados.
