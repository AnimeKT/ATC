// =========================================
// 1. CONFIGURACIÓN DE SUPABASE
// =========================================
const SUPABASE_URL = "https://urmnngtfoavnmvbwqepq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybW5uZ3Rmb2F2bm12YndxZXBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MTE4NzcsImV4cCI6MjA5MTI4Nzg3N30.HnfoffLftMYWt2ZEkv1YEbG0vqRPWjB5IeQunj2I5cs";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =========================================
// 2. INICIALIZAR TELEGRAM WEB APP
// =========================================
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Configurar la acción global del botón de retroceso
// =========================================
// SISTEMA DE HISTORIAL DE NAVEGACIÓN
// =========================================
let historialNavegacion = ['catalogo'];

// Configurar la acción global del botón de retroceso
tg.BackButton.onClick(() => {
    if (historialNavegacion.length > 1) {
        // 1. Sacamos la vista actual (la que estamos viendo) del historial
        historialNavegacion.pop();
        
        // 2. Obtenemos cuál era la vista anterior
        const vistaAnterior = historialNavegacion[historialNavegacion.length - 1];
        
        // 3. Renderizamos esa vista anterior sin afectar el historial
        ejecutarCambioVista(vistaAnterior);
    } else {
        // Si el historial se queda vacío por alguna razón, forzamos catálogo
        ejecutarCambioVista('catalogo');
    }
});

// 3. Función de navegación principal (Gestiona a dónde vamos)
function cambiarVista(vista) {
    // Si volvemos al catálogo directamente (ej: clic en tu logo o al publicar), limpiamos historial
    if (vista === 'catalogo') {
        historialNavegacion = ['catalogo'];
    } 
    // Si la nueva vista es diferente a la que estamos actualmente, la añadimos al historial
    else if (historialNavegacion[historialNavegacion.length - 1] !== vista) {
        historialNavegacion.push(vista);
    }
    
    // Cambiamos el DOM
    ejecutarCambioVista(vista);
}

// 3.1. Función que solo maneja el DOM (Visibilidad de HTML y Scroll)
function ejecutarCambioVista(vista) {
    const vistaCatalogo = document.getElementById('vista-catalogo');
    const vistaRegistro = document.getElementById('vista-registro');
    const vistaDetalle = document.getElementById('vista-detalle');
    const barraBusqueda = document.getElementById('barra-busqueda');

    // 1. Guardar scroll si salimos del catálogo
    if (vistaCatalogo.style.display !== 'none') {
        posicionScrollGuardada = window.scrollY;
    }

    // 2. Ocultar todas las vistas
    vistaCatalogo.style.display = 'none';
    vistaRegistro.style.display = 'none';
    vistaDetalle.style.display = 'none';
    barraBusqueda.style.display = 'none';

    // 3. Lógica de visibilidad y Botón de Telegram
    if (vista === 'catalogo') {
        vistaCatalogo.style.display = 'block';
        barraBusqueda.style.display = 'block';
        
        // OCULTAR botón nativo de retroceso en el menú principal
        tg.BackButton.hide();
        
        // Recuperar scroll
        setTimeout(() => window.scrollTo(0, posicionScrollGuardada), 10);
    } else {
        // MOSTRAR botón en cualquier otra vista (detalle o registro)
        if (vista === 'registro') vistaRegistro.style.display = 'block';
        if (vista === 'detalle') vistaDetalle.style.display = 'block';

        tg.BackButton.show();
        window.scrollTo(0, 0);
    }
}


// =========================================
// 3. ESTADO GLOBAL DE LA APP
// =========================================
let idAnimeEnEdicion = null;
let todasLasObras = []; 
let obraActual = null; 
let posicionScrollGuardada = 0;
let timeoutBusqueda = null;
let listaFavoritos = [];

let filtrosActuales = {
    texto: '',
    estado: 'Todos',
    soloFavoritos: false
};


// =========================================
// 4. INICIALIZACIÓN
// =========================================
async function inicializarApp() {
    // 1. Cargamos los favoritos del usuario en Supabase primero
    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
        await cargarFavoritosUsuario();
    }

    // 2. Cargamos las obras para pintar el catálogo y los corazones correctamente
    await cargarObras(); 

    // 3. Cargamos datos extra opcionales en segundo plano sin detener la app
    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
        tg.CloudStorage.getItem('vistos_anime', (err, value) => {
            if (!err && value) {
                try { listaFavoritos = JSON.parse(value); } 
                catch (e) { listaFavoritos = []; }
            }
        });
    }
}

function volverAlCatalogo() {
    tg.HapticFeedback.impactOccurred('light');
    cambiarVista('catalogo');
}


// =========================================
// 6. RENDERIZAR VISTA DE DETALLES
// =========================================
function abrirDetalle(tituloObra) {
    tg.HapticFeedback.impactOccurred('medium');
    obraActual = todasLasObras.find(o => o.titulo === tituloObra);
    if (!obraActual) return;

    // Poblar datos con protección por si falta algún dato en la base de datos
    document.getElementById('det-banner').src = obraActual.banner_url || obraActual.portada_url || '';
    const imgPort = document.getElementById('det-portada');
    imgPort.src = obraActual.portada_url || '';
    imgPort.style.opacity = 1;
    document.getElementById('det-titulo').textContent = obraActual.titulo || 'Sin título';
    
    // Nombres alternativos seguros
    let nombresAlt = [];
    if(obraActual.nombres_alternativos?.Japonés) nombresAlt.push(obraActual.nombres_alternativos.Japonés);
    if(obraActual.nombres_alternativos?.Ingles) nombresAlt.push(obraActual.nombres_alternativos.Ingles);
    document.getElementById('det-nombres-alt').textContent = nombresAlt.join(' • ');

    const tagsContainer = document.getElementById('det-tags');
    tagsContainer.innerHTML = '';
    if(Array.isArray(obraActual.generos)) {
        obraActual.generos.forEach(g => {
            tagsContainer.innerHTML += `<span class="tag">${g}</span>`;
        });
    }

    document.getElementById('det-estado').textContent = obraActual.estado || '--';
    document.getElementById('det-tipo').textContent = obraActual.tipo || '--';
    document.getElementById('det-estudio').textContent = obraActual.estudio || '--';
    document.getElementById('det-origen').textContent = obraActual.origen || '--';
    document.getElementById('det-dia').textContent = obraActual.dia_emision || '--';
    document.getElementById('det-estreno').textContent = obraActual.estreno || '--';
    document.getElementById('det-autor').textContent = obraActual.autor || '--';
    document.getElementById('det-sinopsis').textContent = obraActual.sinopsis || 'Sin descripción.';

    iniciarNavegacionContenido(obraActual.temporadas);
    actualizarEstadoFavoritoDetalle();
    cambiarVista('detalle');
}


// =========================================
// 7. JERARQUÍA DINÁMICA (Temporadas -> Idiomas -> Caps)
// =========================================
function iniciarNavegacionContenido(temporadasData) {
    const contenedor = document.getElementById('det-temporadas');
    contenedor.innerHTML = '';

    if (!temporadasData || !Array.isArray(temporadasData) || temporadasData.length === 0) {
        contenedor.innerHTML = '<p class="text-muted" style="color: #a1a1aa;">Aún no hay enlaces disponibles.</p>';
        return;
    }

    const seccionesObj = {};
    temporadasData.forEach((temp) => {
        const nombreSeccion = temp.seccion || "Contenido Principal";
        if (!seccionesObj[nombreSeccion]) seccionesObj[nombreSeccion] = [];
        seccionesObj[nombreSeccion].push(temp);
    });

    for (const [secName, temps] of Object.entries(seccionesObj)) {
        contenedor.innerHTML += `<h4 style="margin-top: 15px; margin-bottom: 10px; color: #3ba4fa; font-size: 14px;">${secName}</h4>`;
        
        temps.forEach((temp) => {
            const btn = document.createElement('button');
            btn.className = 'btn-dinamico';
            btn.style.cssText = "display: block; width: 100%; text-align: left; background: #18181b; border: 1px solid #27272a; padding: 12px; border-radius: 8px; color: white; margin-bottom: 8px; cursor: pointer;";
            btn.innerHTML = `<i class="fa-solid fa-folder-open" style="color: #3ba4fa; margin-right: 8px;"></i> ${temp.nombre}`;
            btn.onclick = () => mostrarIdiomas(temp);
            contenedor.appendChild(btn);
        });
    }
}

function mostrarIdiomas(temporadaObj) {
    tg.HapticFeedback.impactOccurred('light');
    const contenedor = document.getElementById('det-temporadas');
    
    contenedor.innerHTML = `<button onclick="iniciarNavegacionContenido(obraActual.temporadas)" style="background: transparent; border: none; color: #a1a1aa; padding-bottom: 15px; cursor: pointer; display: flex; align-items: center; gap: 5px;"><i class="fa-solid fa-chevron-left"></i> Volver a Temporadas</button>`;

    if(temporadaObj.imagen && temporadaObj.imagen !== "") {
        const imgPortada = document.getElementById('det-portada');
        imgPortada.style.opacity = 0.3;
        setTimeout(() => {
            imgPortada.src = temporadaObj.imagen;
            imgPortada.style.opacity = 1;
        }, 150);
    }

    if (temporadaObj.enlaces) {
        for (const [idioma, capitulos] of Object.entries(temporadaObj.enlaces)) {
            const btn = document.createElement('button');
            btn.style.cssText = "display: block; width: 100%; text-align: left; background: #18181b; border: 1px solid #27272a; padding: 12px; border-radius: 8px; color: white; margin-bottom: 8px; cursor: pointer;";
            btn.innerHTML = `<i class="fa-solid fa-language" style="color: #10b981; margin-right: 8px;"></i> Audio: ${idioma}`;
            btn.onclick = () => mostrarCapitulos(capitulos, temporadaObj);
            contenedor.appendChild(btn);
        }
    }
}

function mostrarCapitulos(capitulosObj, temporadaPadre) {
    tg.HapticFeedback.impactOccurred('light');
    const contenedor = document.getElementById('det-temporadas');
    
    contenedor.innerHTML = `<button onclick="mostrarIdiomas(obraActual.temporadas.find(t => t.nombre === '${temporadaPadre.nombre}'))" style="background: transparent; border: none; color: #a1a1aa; padding-bottom: 15px; cursor: pointer; display: flex; align-items: center; gap: 5px;"><i class="fa-solid fa-chevron-left"></i> Volver a Idiomas</button>`;

    for (const [capitulo, url] of Object.entries(capitulosObj)) {
        const btn = document.createElement('button');
        btn.style.cssText = "display: block; width: 100%; text-align: left; background: #18181b; border: 1px solid #3ba4fa; padding: 12px; border-radius: 8px; color: white; margin-bottom: 8px; cursor: pointer;";
        btn.innerHTML = `<i class="fa-solid fa-play" style="color: #3ba4fa; margin-right: 8px;"></i> ${capitulo}`;
        btn.onclick = () => abrirEnlaceTelegram(url);
        contenedor.appendChild(btn);
    }
}

function abrirEnlaceTelegram(url) {
    tg.HapticFeedback.impactOccurred('heavy');
    if (url.includes('t.me')) {
        tg.openTelegramLink(url);
    } else {
        tg.openLink(url);
    }
}


// =========================================
// 8. FILTROS, BUSCADOR Y RENDERIZADO CATÁLOGO
// =========================================
async function cargarObras() {
    const { data: obras, error } = await _supabase
        .from('obras')
        .select('*')
        .order('fecha_creacion', { ascending: false });

    if (error) return console.error("Error cargando obras:", error);

    todasLasObras = obras || []; 
    aplicarTodosLosFiltros();
}

function aplicarTodosLosFiltros() {
    const resultado = todasLasObras.filter(obra => {
        const tituloMatch = obra.titulo.toLowerCase().includes(filtrosActuales.texto);
        const altJap = obra.nombres_alternativos?.Japonés?.toLowerCase() || '';
        const altIng = obra.nombres_alternativos?.Ingles?.toLowerCase() || '';
        const textoMatch = tituloMatch || altJap.includes(filtrosActuales.texto) || altIng.includes(filtrosActuales.texto);
        const estadoMatch = filtrosActuales.estado === 'Todos' || obra.estado === filtrosActuales.estado;
        const favoritoMatch = !filtrosActuales.soloFavoritos || esFavorito(String(obra.id));

        return textoMatch && estadoMatch && favoritoMatch;
    });

    renderizarObras(resultado);
}

// Comprueba que tengas un input con el ID 'buscador' en tu HTML
const inputBuscador = document.getElementById('buscador');
if(inputBuscador) {
    inputBuscador.addEventListener('input', (e) => {
        clearTimeout(timeoutBusqueda);
        timeoutBusqueda = setTimeout(() => {
            filtrosActuales.texto = e.target.value.toLowerCase();
            aplicarTodosLosFiltros();
        }, 300);
    });
}

function filtrar(estado, evento) {
    if (tg?.HapticFeedback?.impactOccurred) tg.HapticFeedback.impactOccurred('light');
    document.querySelectorAll('.btn-filtro').forEach(btn => btn.classList.remove('active'));
    if(evento) evento.currentTarget.classList.add('active');

    filtrosActuales.estado = estado;
    filtrosActuales.soloFavoritos = estado === 'Favoritos';
    aplicarTodosLosFiltros();
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function renderizarObras(obras) {
    const grid = document.getElementById('grid-obras');
    if(!grid) return;
    
    if (obras.length === 0) {
        grid.innerHTML = "<p style='color: #a1a1aa; grid-column: 1 / -1; text-align: center; padding: 40px;'>No se encontraron obras...</p>";
        return;
    }

    grid.innerHTML = obras.map(obra => {
        const tituloSeguro = String(obra.titulo || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const esFav = esFavorito(String(obra.id));
        const corazonClass = esFav ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
        const favoritoActivo = esFav ? 'favorito-activo' : '';

        return `
        <div class="tarjeta-anime" onclick="abrirDetalle('${tituloSeguro}')">
            <button type="button" class="btn-fav-card ${favoritoActivo}" onclick="toggleFavorito(event, '${obra.id}')">
                <i class="${corazonClass}"></i>
            </button>
            <div class="tipo-tag">${obra.tipo || 'Anime'}</div>
            <img src="${obra.portada_url}" alt="${tituloSeguro}">
            <div class="info-tarjeta">
                <div class="titulo-tarjeta">${obra.titulo}</div>
            </div>
        </div>
        `;
    }).join('');
}

function esFavorito(animeId) {
    if (!animeId) return false;
    return listaFavoritos.map(String).includes(String(animeId));
}

async function cargarFavoritosUsuario() {
    const userId = tg.initDataUnsafe?.user?.id;
    if (!userId) return;

    const { data, error } = await _supabase
        .from('favoritos')
        .select('anime_id')
        .eq('user_id', String(userId));

    if (error) {
        console.error('Error cargando favoritos:', error);
        return;
    }

    listaFavoritos = Array.isArray(data) ? data.map(item => String(item.anime_id)) : [];
}

async function toggleFavorito(event, animeId) {
    if (event) event.stopPropagation();
    const userId = tg.initDataUnsafe?.user?.id;
    if (!userId) return alert('Favoritos solo están disponibles cuando abres la miniapp desde Telegram con tu usuario.');
    if (!animeId) return;

    const animeIdStr = String(animeId);
    const yaEsFavorito = esFavorito(animeIdStr);

    try {
        if (yaEsFavorito) {
            await _supabase
                .from('favoritos')
                .delete()
                .eq('user_id', String(userId))
                .eq('anime_id', animeIdStr);
        } else {
            await _supabase
                .from('favoritos')
                .insert([{ user_id: String(userId), anime_id: animeIdStr }]);
        }

        await cargarFavoritosUsuario();
        aplicarTodosLosFiltros();
        actualizarEstadoFavoritoDetalle();
    } catch (error) {
        console.error('Error toggling favorito:', error);
        alert('No se pudo actualizar el favorito. Revisa la consola.');
    }
}

function toggleFavoritoDetalle(event) {
    if (event) event.stopPropagation();
    if (!obraActual) return;
    toggleFavorito(event, obraActual.id);
}

function actualizarEstadoFavoritoDetalle() {
    const btn = document.getElementById('det-favorito-btn');
    if (!btn) return;

    const esFav = obraActual && esFavorito(String(obraActual.id));
    if (esFav) {
        btn.classList.add('favorito-activo');
        btn.innerHTML = '<i class="fa-solid fa-heart"></i> Quitar de favoritos';
    } else {
        btn.classList.remove('favorito-activo');
        btn.innerHTML = '<i class="fa-regular fa-heart"></i> Agregar a favoritos';
    }
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// =========================================
// 9. REGISTRO Y EDICIÓN DE OBRAS
// =========================================
function prepararNuevoRegistro() {
    idAnimeEnEdicion = null; // Resetear ID de edición
    const btn = document.getElementById('btn-publicar');
    if(btn) btn.textContent = "Publicar";
    
    // Limpiar inputs
    document.querySelectorAll('#vista-registro input, #vista-registro select, #vista-registro textarea').forEach(i => i.value = '');
    
    cargarDatosTemporadas([]); 
    cambiarVista('registro');
}

function prepararEdicionDesdeDetalle() {
    if (!obraActual) return;

    idAnimeEnEdicion = obraActual.id; // Activamos el MODO EDICIÓN
    
    const btnPublicar = document.getElementById('btn-publicar');
    if(btnPublicar) btnPublicar.textContent = "Guardar Cambios";

    // Llenamos los campos con los datos de la obra seleccionada
    document.getElementById('in-titulo').value = obraActual.titulo || '';
    document.getElementById('in-portada').value = obraActual.portada_url || '';
    document.getElementById('in-banner').value = obraActual.banner_url || '';
    document.getElementById('in-estado').value = obraActual.estado || 'En emisión';
    document.getElementById('in-tipo').value = obraActual.tipo || 'TV';

    if(document.getElementById('in-sinopsis')) document.getElementById('in-sinopsis').value = obraActual.sinopsis || '';
    if(document.getElementById('in-autor')) document.getElementById('in-autor').value = obraActual.autor || '';
    
    if(document.getElementById('in-japones')) document.getElementById('in-japones').value = obraActual.nombres_alternativos?.Japonés || '';
    if(document.getElementById('in-ingles')) document.getElementById('in-ingles').value = obraActual.nombres_alternativos?.Ingles || '';

    // Cargamos las temporadas en el constructor visual
    cargarDatosTemporadas(obraActual.temporadas || []);

    // Cambiamos a la vista de edición/registro
    cambiarVista('registro');
}

async function ejecutarRegistro() {
    const btn = document.getElementById('btn-publicar');
    const titulo = document.getElementById('in-titulo').value.trim();
    const portada = document.getElementById('in-portada').value.trim();

    if (!titulo || !portada) {
        tg.HapticFeedback.notificationOccurred('error');
        return alert("⚠️ Título y Portada son obligatorios.");
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Procesando...`;

    // Recolectar datos del formulario
    const datosObra = {
        titulo: titulo,
        portada_url: portada,
        banner_url: document.getElementById('in-banner').value.trim(),
        sinopsis: document.getElementById('in-sinopsis') ? document.getElementById('in-sinopsis').value.trim() : null,
        estado: document.getElementById('in-estado').value,
        tipo: document.getElementById('in-tipo').value,
        temporadas: recolectarDatosTemporadas()
    };

    try {
        let resultado;
        
        if (idAnimeEnEdicion) {
            // MODO EDICIÓN: Actualizar registro existente
            resultado = await _supabase
                .from('obras')
                .update(datosObra)
                .eq('id', idAnimeEnEdicion);
        } else {
            // MODO CREACIÓN: Insertar nuevo
            resultado = await _supabase
                .from('obras')
                .insert([datosObra]);
        }

        if (resultado.error) throw resultado.error;

        tg.HapticFeedback.notificationOccurred('success');
        alert(idAnimeEnEdicion ? "✅ Cambios guardados" : "✅ Publicado con éxito");
        
        // Limpiar estado y volver al catálogo
        idAnimeEnEdicion = null;
        await cargarObras(); 
        cambiarVista('catalogo');
    } catch (err) {
        console.error(err);
        alert("❌ Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = idAnimeEnEdicion ? "Guardar Cambios" : "Publicar";
    }
}


// =========================================
// 10. SISTEMA DE AUTENTICACIÓN
// =========================================
const btnAdminView = document.getElementById('btn-admin-view');
const btnAuth = document.getElementById('btn-auth');
const authMensaje = document.getElementById('auth-mensaje');

_supabase.auth.onAuthStateChange((event, session) => {
    const isAdmin = !!session; // Truco: si hay sesión es true, si no false
    const btnAdminView = document.getElementById('btn-admin-view');
    const btnEdit = document.getElementById('btn-edit-serie'); // El botón del lápiz
    const btnAuth = document.getElementById('btn-auth');

    // Controlamos el botón "Añadir"
    if(btnAdminView) btnAdminView.style.display = isAdmin ? 'flex' : 'none';
    
    // Controlamos el botón "Editar" (Lápiz)
    if(btnEdit) btnEdit.style.display = isAdmin ? 'flex' : 'none';

    if (session) {
        if(btnAuth) {
            btnAuth.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> <span class="hide-mobile">Salir</span>';
            btnAuth.onclick = cerrarSesion;
        }
        cerrarModalAuth();
    } else {
        if(btnAuth) {
            btnAuth.innerHTML = '<i class="fa-solid fa-user"></i> <span class="hide-mobile">Ingresar</span>';
            btnAuth.onclick = abrirModalAuth;
        }
        if(todasLasObras.length > 0) cambiarVista('catalogo');
    }
});

_supabase.auth.getSession().then(({ data: { session } }) => {
    if (session && btnAdminView) btnAdminView.style.display = 'flex';
});

function abrirModalAuth() {
    const modal = document.getElementById('modal-auth');
    if (modal) {
        modal.classList.remove('modal-oculto');
        // Esto limpia el input por si acaso
        document.getElementById('auth-password').value = "";
        document.getElementById('auth-mensaje').innerText = "";
    }
}

function cerrarModalAuth() {
    const modal = document.getElementById('modal-auth');
    if (modal) {
        modal.classList.add('modal-oculto');
        // Opcional: limpiar la clave al cerrar
        document.getElementById('auth-password').value = "";
    }
}

function obtenerEmailVirtual() {
    const user = tg.initDataUnsafe?.user;
    if (!user || !user.id) return "admin_pc@kaergsty.hub"; 
    return `${user.id}@kaergsty.hub`;
}

async function registrarUsuario() {
    const virtualEmail = obtenerEmailVirtual();
    const password = document.getElementById('auth-password').value;

    if (password.length < 6) return mostrarErrorAuth('La clave debe tener al menos 6 caracteres.');

    mostrarMensajeAuth('Procesando...', '#e0e0e0');
    const { error } = await _supabase.auth.signUp({ email: virtualEmail, password: password });
    
    if (error) mostrarErrorAuth(error.message);
    else mostrarMensajeAuth('¡Clave vinculada exitosamente!', '#10b981');
}

async function iniciarSesion() {
    const virtualEmail = obtenerEmailVirtual();
    const password = document.getElementById('auth-password').value;

    mostrarMensajeAuth('Iniciando...', '#e0e0e0');
    const { error } = await _supabase.auth.signInWithPassword({ email: virtualEmail, password: password });

    if (error) mostrarErrorAuth('Error: Contraseña incorrecta.');
}

async function cerrarSesion() {
    await _supabase.auth.signOut();
}

function mostrarErrorAuth(msg) {
    if(authMensaje) {
        authMensaje.style.color = '#ef4444';
        authMensaje.textContent = msg;
    }
}
function mostrarMensajeAuth(msg, color) {
    if(authMensaje) {
        authMensaje.style.color = color;
        authMensaje.textContent = msg;
    }
}


// =========================================
// 11. CONSTRUCTOR VISUAL DE TEMPORADAS
// =========================================

// Crea el bloque contenedor principal (La Carpeta)
// =========================================
// 11. CONSTRUCTOR VISUAL DE TEMPORADAS Y SECCIONES (VERSION BLINDADA)
// =========================================

function agregarSeccionUI(nombreSeccion = '', temporadasArray = null) {
    const container = document.getElementById('builder-temporadas');
    if(!container) return;
    
    const secBlock = document.createElement('div');
    secBlock.className = 'seccion-block';
    secBlock.style.cssText = "border: 1px solid #3ba4fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; background: #0f0f11;";

    secBlock.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; gap: 10px; border-bottom: 1px solid #27272a; padding-bottom: 10px;">
            <input type="text" class="sec-nombre" placeholder="Nombre de Sección (Ej: Películas / Ovas)" value="${nombreSeccion}" style="flex: 1; padding: 10px; border-radius: 6px; border: 1px solid #3ba4fa; background: #18181b; color: white; outline: none; font-weight: bold;">
            <button type="button" onclick="this.closest('.seccion-block').remove()" style="background:#ef4444; color:white; border:none; padding: 10px; border-radius: 6px; cursor:pointer;">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
        <div class="lista-temporadas"></div>
        <button type="button" onclick="agregarSubTemporadaUI(this.previousElementSibling)" style="width: 100%; padding: 10px; background: #18181b; color: #3ba4fa; border: 1px dashed #3ba4fa; border-radius: 6px; cursor: pointer; margin-top: 10px;">
            <i class="fa-solid fa-plus"></i> Añadir Bloque a esta Sección
        </button>
    `;

    container.appendChild(secBlock);
    const listaTemps = secBlock.querySelector('.lista-temporadas');

    if (temporadasArray && Array.isArray(temporadasArray)) {
        temporadasArray.forEach(tempDatos => agregarSubTemporadaUI(listaTemps, tempDatos));
    } else {
        agregarSubTemporadaUI(listaTemps);
    }
}

function agregarSubTemporadaUI(containerLista, datos = null) {
    if (!containerLista) return;
    const bloque = document.createElement('div');
    bloque.className = 'temporada-block';
    bloque.style.cssText = "border: 1px solid #27272a; padding: 15px; border-radius: 8px; margin-bottom: 15px; background: #18181b;";

    bloque.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 10px;">
            <input type="text" class="temp-nombre" placeholder="Nombre (Ej: Temporada 1)" value="${datos?.nombre || ''}" style="flex: 1; padding: 10px; border-radius: 6px; border: 1px solid #27272a; background: #0f0f11; color: white; outline: none;">
            <button type="button" onclick="this.closest('.temporada-block').remove()" style="background:transparent; color:#ef4444; border:none; cursor:pointer;">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
        <input type="text" class="temp-img" placeholder="URL Imagen Portada (Opcional)" value="${datos?.imagen || ''}" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #27272a; background: #0f0f11; color: white; outline: none; margin-bottom: 15px; box-sizing: border-box;">
        
        <div class="idiomas-container">
            <div class="lista-idiomas" style="display: flex; flex-direction: column; gap: 10px;"></div>
            <button type="button" onclick="agregarIdiomaUI(this.previousElementSibling)" style="margin-top: 10px; padding: 8px 15px; background:#27272a; color:white; border:none; border-radius:6px; cursor:pointer; font-size:13px;">
                <i class="fa-solid fa-plus"></i> Añadir Idioma
            </button>
        </div>
    `;

    containerLista.appendChild(bloque);
    const listaIdiomas = bloque.querySelector('.lista-idiomas');

    if (datos?.enlaces) {
        Object.entries(datos.enlaces).forEach(([idioma, caps]) => agregarIdiomaUI(listaIdiomas, idioma, caps));
    } else {
        agregarIdiomaUI(listaIdiomas);
    }
}

function agregarIdiomaUI(containerLista, nombreIdioma = '', capitulos = null) {
    if (!containerLista) return;
    const divIdioma = document.createElement('div');
    divIdioma.className = 'idioma-bloque';
    divIdioma.style.cssText = "padding: 10px; background: #0c0c0f; border: 1px solid #27272a; border-radius: 6px;";

    divIdioma.innerHTML = `
        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <input type="text" class="idioma-nombre" placeholder="Idioma" value="${nombreIdioma}" style="flex: 1; padding: 8px; border-radius: 6px; border: 1px solid #27272a; background: #18181b; color: white; outline: none;">
            <button type="button" onclick="this.closest('.idioma-bloque').remove()" style="background: transparent; color: #ef4444; border: 1px solid #ef4444; border-radius: 6px; padding: 8px 12px; cursor: pointer;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="lista-capitulos" style="display: flex; flex-direction: column; gap: 5px; margin-left: 10px; border-left: 2px solid #27272a; padding-left: 10px;"></div>
        <button type="button" onclick="agregarCapituloUI(this.previousElementSibling)" style="margin-top: 10px; margin-left: 10px; padding: 6px 12px; background: transparent; border: 1px dashed #3ba4fa; color: #3ba4fa; border-radius: 6px; cursor: pointer; font-size: 12px;">
            + Añadir Capítulo
        </button>
    `;

    containerLista.appendChild(divIdioma);
    const listaCaps = divIdioma.querySelector('.lista-capitulos');

    if (capitulos) {
        Object.entries(capitulos).forEach(([n, u]) => agregarCapituloUI(listaCaps, n, u));
    } else {
        agregarCapituloUI(listaCaps);
    }
}

function agregarCapituloUI(containerCaps, capNombre = '', capUrl = '') {
    if (!containerCaps) return;
    const divCap = document.createElement('div');
    divCap.className = 'capitulo-row';
    divCap.style.display = "flex";
    divCap.style.gap = "8px";

    divCap.innerHTML = `
        <input type="text" class="cap-nombre" placeholder="N°" value="${capNombre}" style="width: 35%; padding: 8px; border-radius: 6px; border: 1px solid #27272a; background: #18181b; color: white; font-size: 13px;">
        <input type="text" class="cap-url" placeholder="URL" value="${capUrl}" style="flex: 1; padding: 8px; border-radius: 6px; border: 1px solid #27272a; background: #18181b; color: white; font-size: 13px;">
        <button type="button" onclick="this.closest('.capitulo-row').remove()" style="background: transparent; color: #a1a1aa; border: none; cursor: pointer;"><i class="fa-solid fa-trash"></i></button>
    `;
    containerCaps.appendChild(divCap);
}

// ESTA FUNCIÓN ES LA QUE EVITA QUE EL SISTEMA "DEJE DE RESPONDER"
function recolectarDatosTemporadas() {
    const datos = [];
    document.querySelectorAll('.seccion-block').forEach(secBlock => {
        const inputSec = secBlock.querySelector('.sec-nombre');
        const nombreSeccion = inputSec ? inputSec.value.trim() : 'Principal';

        secBlock.querySelectorAll('.temporada-block').forEach(tempBlock => {
            const inputTemp = tempBlock.querySelector('.temp-nombre');
            const inputImg = tempBlock.querySelector('.temp-img');
            
            const nombre = inputTemp ? inputTemp.value.trim() : 'Temporada';
            const imagen = inputImg ? inputImg.value.trim() : '';

            const enlaces = {};
            tempBlock.querySelectorAll('.idioma-bloque').forEach(idiomaBlock => {
                const inputIdio = idiomaBlock.querySelector('.idioma-nombre');
                const idiomaNombre = inputIdio ? inputIdio.value.trim() : '';
                
                if (!idiomaNombre) return;

                enlaces[idiomaNombre] = {};
                idiomaBlock.querySelectorAll('.capitulo-row').forEach(capRow => {
                    const inputCapN = capRow.querySelector('.cap-nombre');
                    const inputCapU = capRow.querySelector('.cap-url');
                    const cNombre = inputCapN ? inputCapN.value.trim() : '';
                    const cUrl = inputCapU ? inputCapU.value.trim() : '';
                    
                    if (cNombre && cUrl) {
                        enlaces[idiomaNombre][cNombre] = cUrl;
                    }
                });
            });

            datos.push({ seccion: nombreSeccion, nombre, imagen, enlaces });
        });
    });
    return datos;
}

function cargarDatosTemporadas(temporadasFlat) {
    const container = document.getElementById('builder-temporadas');
    if(!container) return;
    container.innerHTML = ''; 

    if (!Array.isArray(temporadasFlat) || temporadasFlat.length === 0) {
        agregarSeccionUI();
        return;
    }

    const agrupado = {};
    temporadasFlat.forEach(temp => {
        const sec = temp.seccion || 'Principal';
        if (!agrupado[sec]) agrupado[sec] = [];
        agrupado[sec].push(temp);
    });

    for (const [nombreSec, tempsArray] of Object.entries(agrupado)) {
        agregarSeccionUI(nombreSec, tempsArray);
    }
}


// =========================================
// 12. ARRANQUE DEL SISTEMA
// =========================================
document.addEventListener('DOMContentLoaded', inicializarApp);