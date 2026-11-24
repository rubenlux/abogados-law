# Seguridad de Autenticación y Sesiones

Este documento detalla el modelo de seguridad implementado para la autenticación y gestión de sesiones en la plataforma Abogado Virtual.

## 1. Modelo de Tokens (JWT)

Utilizamos un esquema de doble token para balancear seguridad y experiencia de usuario:

### Access Token
- **Vigencia**: 15 minutos.
- **Uso**: Autenticación en cada request a la API (Header `Authorization: Bearer <token>`).
- **Contenido**: `sub` (userId), `email`, `role`, `organizationId`.
- **Firma**: HMAC SHA256 con `JWT_SECRET`.

### Refresh Token
- **Vigencia**: 7 días.
- **Uso**: Obtener nuevos Access Tokens sin requerir credenciales del usuario.
- **Almacenamiento Backend**: Hash (bcrypt) almacenado en la base de datos (`User.refreshTokenHash`).
- **Almacenamiento Frontend**: `localStorage` (vía Zustand persist).
- **Rotación**: Se emite un nuevo Refresh Token cada vez que se utiliza uno, invalidando el anterior (Reuse Detection implícito por cambio de hash).

## 2. Flujos de Autenticación

### Login
1. `POST /auth/login` con email y contraseña.
2. Backend valida credenciales (bcrypt).
3. Backend genera Access Token y Refresh Token.
4. Backend guarda el hash del Refresh Token en la DB.
5. Frontend recibe y almacena ambos tokens.

### Refresh Automático (Interceptor)
1. Frontend realiza request y recibe `401 Unauthorized`.
2. Interceptor captura el error.
3. Invoca `POST /auth/refresh` con el Refresh Token actual.
4. Backend valida firma y compara con el hash en DB.
5. Si es válido:
   - Recibe nuevos tokens (Access + Refresh).
   - Reintenta la request original con el nuevo Access Token.
6. Si es inválido (expirado, revocado, reutilizado):
   - Frontend fuerza Logout y redirige a `/login`.

### Logout
1. `POST /auth/logout` (requiere Access Token válido).
2. Backend elimina el `refreshTokenHash` de la DB (lo setea a null).
3. Frontend limpia el estado local y redirige a login.

## 3. Seguridad Adicional

- **Hashing de Contraseñas**: Bcrypt para contraseñas de usuario.
- **Hashing de Tokens**: Los Refresh Tokens no se guardan en texto plano en la DB, previniendo fugas en caso de compromiso de la base de datos.
- **Revocación**: Al hacer logout, el token de refresco queda inutilizable inmediatamente.
