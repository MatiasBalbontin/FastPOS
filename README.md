# FastPOS - Sistema de Punto de Venta en la Nube

FastPOS es un sistema de Punto de Venta (POS) moderno, escalable y comercializable, construido con **React + Vite + Supabase + Vercel**.

Perfectamente preparado para montarse como SaaS (Software as a Service) con autenticación segura, bases de datos multi-usuario y hosting en la nube.

## Características

✅ **Interfaz moderna**: UI responsiva construida con React y TailwindCSS  
✅ **Autenticación segura**: Supabase Auth integrado  
✅ **Base de datos relacional**: PostgreSQL en Supabase  
✅ **Multi-tenancy**: Cada usuario tiene sus propios datos aislados  
✅ **Row Level Security**: Seguridad a nivel de BD  
✅ **Deploy en Vercel**: Zero-config, CI/CD automático  
✅ **Gestión de inventario**: FIFO, stock en tiempo real  
✅ **Análisis y reportes**: Dashboards completos  
✅ **Código abierto**: GPLv3

## Stack Tecnológico

- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS
- **Backend/DB**: Supabase (PostgreSQL + Auth)
- **Hosting**: Vercel
- **Gráficos**: Recharts
- **UI Components**: Lucide Icons + Sonner (toasts)

## Configuración Rápida

### Opción 1: Desarrollo Local

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/MatiasBalbontin/FastPOS.git
   cd fastpos
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env.local
   ```
   Edita `.env.local` con tus credenciales de Supabase:
   ```
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

4. **Ejecutar en desarrollo**
   ```bash
   npm run dev
   ```
   Abre http://localhost:5173

### Opción 2: Deploy en Vercel (Recomendado para Producción)

1. **Subir a GitHub**
   ```bash
   git push origin main
   ```

2. **Conectar en Vercel**
   - Ve a [vercel.com](https://vercel.com)
   - Importa el repositorio de GitHub
   - Vercel detectará automáticamente que es Vite

3. **Configurar variables de entorno en Vercel**
   - En Project Settings → Environment Variables, agrega:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`

4. **Deploy automático**
   - Cada push a `main` desplegará automáticamente

## Configuración de Supabase

Para una configuración completa con **RLS** (Row Level Security) y **multi-tenancy**, ver [SETUP.md](SETUP.md)

**Resumen rápido:**
1. Crear proyecto en supabase.com
2. Ejecutar scripts SQL de `SETUP.md` en SQL Editor
3. Habilitar Auth (Email/Password)
4. Copiar credenciales al `.env`

## Estructura del Proyecto

```
fastpos/
├── src/
│   ├── App.tsx                 # App principal con lógica de vistas
│   ├── main.tsx               # Punto de entrada
│   ├── index.css              # Estilos globales
│   ├── components/
│   │   ├── Auth.tsx           # Componente de login/registro
│   │   ├── Landing.tsx        # Página de landing
│   ├── lib/
│   │   ├── api.ts             # Cliente API (Supabase)
│   │   ├── supabase.ts        # Inicialización de Supabase
│   │   └── utils.ts           # Utilidades
├── public/                     # Assets estáticos
├── .env.example               # Template de variables de entorno
├── vercel.json                # Config de Vercel
├── vite.config.ts             # Config de Vite
├── tsconfig.json              # Config de TypeScript
├── tailwind.config.js         # Config de TailwindCSS
└── package.json               # Dependencias
```

## Scripts Disponibles

```bash
npm run dev      # Ejecutar en modo desarrollo
npm run build    # Compilar para producción
npm run preview  # Ver build localmente
npm run lint     # Verificar tipos TypeScript
```

## Licencia

Distribuido bajo la licencia **GPLv3**. Ver [LICENSE](LICENSE) para más detalles.
