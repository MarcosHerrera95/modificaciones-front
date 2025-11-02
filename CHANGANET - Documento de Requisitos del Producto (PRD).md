**CHANGANET**  
 **Documento de Requerimientos de Producto (PRD)**  
 **Versión 1.0**  
 **Fecha: 28/08/2025**

---

**Historial de Versiones**

| Fecha | Versión | Autor | Organización | Descripción del Cambio |
| ----- | ----- | :---- | :---- | :---- |
| 5/4/2025 | 10 | \[Nombre del Analista\] | Changánet S.A. | Versión inicial del documento PRD |

 

---

**Información del Proyecto**

| Campo | Descripción |
| :---- | :---- |
| Empresa / Organización | Changánet S.A. |
| Proyecto | Plataforma Digital de Servicios Profesionales |
| Fecha de preparación | 05/04/2025 |
| Cliente | Usuarios finales (clientes y profesionales) |
| Patrocinador principal | \[Nombre del inversionista o área interna\] |
| Gerente / Líder de Proyecto | \[Nombre del Gerente de Proyecto\] |
| Gerente / Líder de Análisis | \[Nombre del Analista de Negocio\] |

---

**Aprobaciones**

| Nombre y Apellido | Cargo | Departamento u Organización | Fecha | Firma |
| :---- | :---- | :---- | :---- | :---- |
| \[Nombre\] | Director de Producto | Changánet S.A. |  |  |
| \[Nombre\] | CTO | Changánet S.A. |  |  |
| \[Nombre\] | Gerente de Proyecto | Changánet S.A. |  |  |
| \[Nombre\] | Líder de Análisis | Changánet S.A. |  |  |

---

**1\. Propósito**

Este documento define los requerimientos funcionales, no funcionales y de diseño del producto **Changánet**, una plataforma digital que conecta a personas que requieren servicios técnicos (plomería, electricidad, albañilería, etc.) con profesionales calificados. El PRD sirve como guía para los equipos de desarrollo, diseño, calidad y negocio, asegurando una comprensión común del alcance, funcionalidades y objetivos del producto.

---

**2\. Alcance del Producto / Software**

**Objetivo General**  
 Desarrollar una plataforma digital que permita la búsqueda, contratación y gestión segura de servicios técnicos urbanos, mejorando la eficiencia, transparencia y confianza en cada interacción.

**Beneficios**

* Para **clientes**: Acceso rápido a profesionales verificados, precios transparentes y coordinación sencilla.  
* Para **profesionales**: Mayor visibilidad, formalización del trabajo, ingresos estables y herramientas digitales.  
* Para la **plataforma**: Generación de comisiones, escalamiento sostenible y posicionamiento como líder en servicios urbanos.

**Alcance Incluido**

* Registro y gestión de usuarios (clientes y profesionales).  
* Perfiles profesionales con información detallada.  
* Sistema de búsqueda y filtros avanzados.  
* Comunicación interna (chat).  
* Sistema de reseñas y valoraciones.  
* Módulo de gestión de disponibilidad y turnos.  
* Solicitudes de presupuesto.  
* Verificación de identidad.  
* Pagos integrados (futura expansión).  
* Notificaciones y alertas.  
* Diseño responsive y accesible.

**Alcance Excluido (Futuras Versiones)**

* Módulo de recursos humanos para equipos de trabajo.  
* Soporte para servicios internacionales (inicialmente enfocado en mercado local).

---

**3\. Referencias**

* Documento de visión de producto: “Changánet – Plataforma de Triple Impacto”  
* Archivo base: CHANGANET.docx  
* Plantilla PRD: PRD\_COMPLETO.docx  
* Guía de diseño UX/UI: “Principios de Interacción para Plataformas de Servicios”  
* Normativa de protección de datos: Ley Nacional de Protección de Datos Personales

---

**4\. Funcionalidades del Producto**

1. Registro y Autenticación de Usuarios  
2. Gestión de Perfiles Profesionales  
3. Sistema de Búsqueda y Filtros  
4. Mensajería Interna  
5. Sistema de Reseñas y Valoraciones  
6. Gestión de Disponibilidad y Agenda  
7. Solicitud de Presupuestos  
8. Verificación de Identidad y Reputación  
9. Pagos Integrados y Comisiones  
10. Sección de Servicios Urgentes  
11. Notificaciones y Alertas  
12. Blog y Contenido Educativo  
13. Programa de Fidelización  
14. Geolocalización y Mapa Interactivo  
15. Panel de Administración

 

---

**5\. Clases y Características de Usuarios**

| Tipo de Usuario | Características | Funcionalidades Relevantes |
| :---- | :---- | :---- |
| Cliente | Busca servicios ocasionales. Bajo nivel técnico. Usa móvil principalmente. | Búsqueda, contacto, chat, reseñas, solicitud de presupuesto, pagos. |
| Profesional | Ofrece servicios regularmente. Nivel técnico básico. Necesita visibilidad. | Perfil, agenda, chat, reseñas, verificación, pagos, notificaciones. |
| Administrador | Gestiona la plataforma. Alto nivel técnico y de permisos. | Gestión de usuarios, verificación, disputas, estadísticas, contenido, notificaciones. |
| Usuario Ocacional | Usa la plataforma una vez. Necesita simplicidad. | Búsqueda rápida, contacto directo, información clara. |

 

---

**6\. Entorno Operativo**

* **Plataforma Web**:  
  * Navegadores soportados: Chrome, Firefox, Safari, Edge (últimas 2 versiones).  
  * Sistema operativo: Windows, macOS, Linux.  
* **Aplicación Móvil (Fase 4\)**:  
  * iOS 14+ (iPhone)  
  * Android 10+  
* **Infraestructura Técnica**:  
  * Backend: Node.js / Python (Django)  
  * Base de datos: PostgreSQL / MongoDB  
  * Hosting: Cloud (AWS o Google Cloud)  
  * Almacenamiento de archivos: Amazon S3 o Google Cloud Storage  
* **Seguridad**:  
  * HTTPS con TLS 1.3  
  * Encriptación de datos sensibles  
  * Cumplimiento con normativas de privacidad

---

**7\. Requerimientos Funcionales**

**7.1. Registro y Autenticación de Usuarios**

**Descripción**: Permitir a los usuarios crear una cuenta y acceder al sistema de forma segura.  
 **Prioridad**: Alta

**Acciones iniciadoras y comportamiento esperado**:

1. El usuario accede a la página de inicio.  
2. Hace clic en “Registrarse”.  
3. Selecciona tipo de cuenta (Cliente o Profesional).  
4. Ingresa datos básicos (nombre, email, contraseña).  
5. Opcional: Registro con Google o Facebook.  
6. Confirma correo electrónico.  
7. Accede al dashboard inicial.

**Requerimientos funcionales**:

* REQ-01: El sistema debe permitir el registro con correo y contraseña.  
* REQ-02: El sistema debe permitir el registro social (Google, Facebook).  
* REQ-03: El sistema debe enviar un correo de verificación al registrarse.  
* REQ-04: El sistema debe validar que el correo no esté previamente registrado.  
* REQ-05: El sistema debe permitir recuperar la contraseña mediante correo.

---

**7.2. Gestión de Perfiles Profesionales**

**Descripción**: Permitir a los profesionales crear y gestionar un perfil detallado.  
 **Prioridad**: Alta

**Acciones iniciadoras y comportamiento esperado**:

1. El profesional inicia sesión.  
2. Accede a “Mi Perfil”.  
3. Completa información: foto, especialidad, experiencia, zona, tarifas, disponibilidad.  
4. Guarda los cambios.  
5. El perfil es visible en búsquedas.

**Requerimientos funcionales**:

* REQ-06: El sistema debe permitir subir foto de perfil y portada.  
* REQ-07: El sistema debe permitir seleccionar una o más especialidades.  
* REQ-08: El sistema debe permitir ingresar años de experiencia.  
* REQ-09: El sistema debe permitir definir una zona de cobertura geográfica.  
* REQ-10: El sistema debe permitir indicar tarifas (por hora, por servicio o “a convenir”).

---

**7.3. Sistema de Búsqueda y Filtros**

**Descripción**: Permitir a los clientes encontrar profesionales según criterios específicos.  
 **Prioridad**: Alta

**Acciones iniciadoras y comportamiento esperado**:

1. El cliente ingresa al buscador.  
2. Escribe una especialidad (ej: “plomero”).  
3. Aplica filtros (ubicación, precio, disponibilidad).  
4. Visualiza resultados ordenados por relevancia.  
5. Hace clic en un perfil para ver detalles.

**Requerimientos funcionales**:

* REQ-11: El sistema debe permitir búsqueda por palabra clave.  
* REQ-12: El sistema debe filtrar por especialidad, ciudad, barrio y radio.  
* REQ-13: El sistema debe filtrar por rango de precio.  
* REQ-14: El sistema debe ordenar resultados por calificación, cercanía y disponibilidad.  
* REQ-15: El sistema debe mostrar una tarjeta resumen por profesional (foto, nombre, calificación, distancia).

---

**7.4. Mensajería Interna**

**Descripción**: Permitir comunicación segura entre cliente y profesional sin compartir datos personales.  
 **Prioridad**: Alta

**Requerimientos funcionales**:

* REQ-16: El sistema debe incluir un chat interno en la página del perfil.  
* REQ-17: El sistema debe permitir enviar mensajes de texto.  
* REQ-18: El sistema debe permitir enviar imágenes.  
* REQ-19: El sistema debe notificar nuevos mensajes (push y email).  
* REQ-20: El sistema debe mantener el historial de conversaciones.

---

**7.5. Sistema de Reseñas y Valoraciones**

**Descripción**: Permitir a los clientes calificar y comentar servicios realizados.  
 **Prioridad**: Alta

**Requerimientos funcionales**:

* REQ-21: El sistema debe permitir calificar con estrellas (1 a 5).  
* REQ-22: El sistema debe permitir dejar un comentario escrito.  
* REQ-23: El sistema debe permitir adjuntar una foto del servicio finalizado.  
* REQ-24: El sistema debe calcular y mostrar la calificación promedio.  
* REQ-25: Solo los usuarios que completaron un servicio pueden dejar reseña.

---

**7.6. Gestión de Disponibilidad y Agenda**

**Descripción**: Permitir a los profesionales gestionar su disponibilidad y recibir solicitudes de turno.  
 **Prioridad**: Media

**Requerimientos funcionales**:

* REQ-26: El sistema debe incluir un calendario editable.  
* REQ-27: El profesional debe poder marcar horarios disponibles y no disponibles.  
* REQ-28: El cliente debe poder ver la disponibilidad en tiempo real.  
* REQ-29: El sistema debe permitir agendar un servicio directamente.  
* REQ-30: El sistema debe enviar confirmación automática al agendar.

---

**7.7. Solicitud de Presupuestos**

**Descripción**: Permitir a los clientes solicitar ofertas a múltiples profesionales.  
 **Prioridad**: Media

**Requerimientos funcionales**:

* REQ-31: El cliente debe poder crear una solicitud con descripción y fotos.  
* REQ-32: El sistema debe enviar la solicitud a varios profesionales preseleccionados.  
* REQ-33: Los profesionales deben poder responder con precio y comentarios.  
* REQ-34: El cliente debe poder comparar ofertas en una vista única.  
* REQ-35: El sistema debe notificar al cliente cuando reciba una oferta.

---

**7.8. Verificación de Identidad y Reputación**

**Descripción**: Aumentar la confianza mediante verificación de datos y sistema de reputación.  
 **Prioridad**: Media

**Requerimientos funcionales**:

* REQ-36: El sistema debe permitir subir documento de identidad.  
* REQ-37: El sistema debe mostrar una insignia “Verificado” al validar datos.  
* REQ-38: El sistema debe asignar medallas por logros (puntualidad, buenas reseñas).  
* REQ-39: El sistema debe mostrar un ranking basado en reputación.  
* REQ-40: El administrador debe poder aprobar/rechazar solicitudes de verificación.

---

**7.9. Pagos Integrados y Comisiones**

**Descripción**: Facilitar transacciones seguras y monetizar la plataforma.  
 **Prioridad**: Alta (Fase 3\)

**Requerimientos funcionales**:

* REQ-41: El sistema debe integrar pasarelas de pago (tarjeta, transferencia).  
* REQ-42: El dinero debe quedar en custodia hasta la aprobación del servicio.  
* REQ-43: El sistema debe cobrar una comisión configurable (5-10%).  
* REQ-44: El profesional debe poder retirar fondos a su cuenta bancaria.  
* REQ-45: El sistema debe generar comprobantes de pago.

---

*(Continúa con funcionalidades de urgencias, notificaciones, blog, geolocalización, etc., siguiendo el mismo formato.)*

---

**8\. Reglas de Negocio**

* RB-01: Un profesional solo puede tener un perfil activo.  
* RB-02: Las reseñas solo se pueden dejar tras la finalización del servicio.  
* RB-03: La comisión se cobra solo si el servicio se completa.  
* RB-04: Los pagos en custodia se liberan tras 24h de inactividad o confirmación manual.  
* RB-05: Los usuarios bloqueados por mal comportamiento no pueden acceder al sistema.

---

**9\. Requerimientos de Interfaces Externas**

**9.1. Interfaces de Usuario**

* Diseño responsive (móvil, tablet, desktop).  
* Estándares de accesibilidad (WCAG 2.1).  
* Guía de estilos: colores, tipografía, iconografía.  
* Pantallas prototipadas (adjuntas en documento anexo).

**9.2. Interfaces de Hardware**

* Compatible con smartphones, tablets y computadoras.  
* Soporte para cámaras (subida de fotos).  
* GPS para geolocalización (móvil).

**9.3. Interfaces de Software**

* Integración con pasarelas de pago (Mercado Pago, PayPal).  
* Conexión con servicios de correo (SendGrid, Mailchimp).  
* API de mapas (Google Maps o OpenStreetMap).

**9.4. Interfaces de Comunicación**

* Protocolos: HTTPS, WebSockets (chat en tiempo real).  
* Formatos: JSON para APIs.  
* Encriptación: TLS 1.3 para todas las comunicaciones.

---

**10\. Requerimientos No Funcionales**

* **Rendimiento**: Tiempo de carga \< 2 segundos en condiciones normales.  
* **Disponibilidad**: 99.5% de uptime anual.  
* **Seguridad**: Autenticación de dos factores (opcional), auditoría de accesos.  
* **Escalabilidad**: Soportar hasta 100.000 usuarios activos.  
* **Usabilidad**: Tasa de conversión de registro \> 60%.  
* **Mantenibilidad**: Código modular, documentado y testeado.

---

**11\. Otros Requerimientos**

* **Internacionalización**: Soporte para español (versión inicial).  
* **Legales**: Aviso de privacidad, términos y condiciones, cumplimiento con protección de datos.  
* **Reutilización**: Componentes modulares (chat, perfil, buscador) para futuros productos.  
* **Monitoreo**: Herramientas de análisis (Google Analytics, Sentry).

 

---

**12\. Glosario**

| Término | Definición |
| :---- | :---- |
| MVP | Producto Mínimo Viable: versión inicial con funcionalidades esenciales. |
| Custodia de fondos | El dinero se retiene en la plataforma hasta la confirmación del servicio. |
| Geolocalización | Determinación de la ubicación geográfica de un dispositivo. |
| Verificación | Proceso de validación de identidad o credenciales de un usuario. |
| Turno | Servicio agendado en una fecha y hora específica. |

 

**© Changánet S.A. – 2025**  
 *Documento confidencial. Todos los derechos reservados.*

 

