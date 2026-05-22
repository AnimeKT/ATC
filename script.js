// =========================================
// 1. CONFIGURACIÓN DE SUPABASE Y CONSTANTES
// =========================================
const _supabase = supabase.createClient(ENV.SUPABASE_URL, ENV.SUPABASE_KEY);

function sanitizar(texto) {
    if (!texto) return "";
    const div = document.createElement('div');
    div.textContent = texto; 
    return div.innerHTML;
}

const userGuardado = localStorage.getItem('tg_user');
let userIdActual = userGuardado ? JSON.parse(userGuardado).id.toString() : "anonimo";
const tg = window.Telegram.WebApp;
const ADMIN_ID = "1310733615"; // Tu ID definido (Admin Súper Dueño)

// Función centralizada para el login
function loguearUsuario(user) {
    if (!user) return;
    
    userIdActual = user.id.toString();
    localStorage.setItem('tg_user', JSON.stringify(user)); 
    
    const authContainer = document.getElementById('auth-container');
    if (authContainer) {
        const fotoUrl = user.photo_url || 'https://via.placeholder.com/40';
        authContainer.innerHTML = `
            <div class="user-profile-nav">
                <img src="${fotoUrl}" alt="User" class="nav-avatar">
                <span class="user-name">${user.first_name}</span>
                <button class="btn-logout" onclick="cerrarSesion()" title="Cerrar Sesión">
                    <i class="fa-solid fa-right-from-bracket"></i>
                </button>
            </div>
        `;
    }
    verificarPermisosAdmin();
}

function verificarPermisosAdmin() {
    if (userIdActual !== "anonimo") {
        document.body.classList.add('usuario-identificado');
    } else {
        document.body.classList.remove('usuario-identificado');
    }
}

// Función para convertir "Solo Leveling!" a "solo_leveling"
function crearSlug(texto) {
    if (!texto) return "";
    
    return texto
        // 1. Normalización NFKC: Convierte fuentes raras (𝕠𝖓𝖊, 𝑜𝑛𝑒) en letras normales
        .normalize('NFKC') 
        // 2. Pasar a minúsculas
        .toLowerCase()
        // 3. Limpiar "Leetspeak" (0 -> o, 1 -> i, etc.)
        .replace(/0/g, 'o')
        .replace(/1/g, 'i')
        .replace(/3/g, 'e')
        .replace(/4/g, 'a')
        .replace(/5/g, 's')
        // 4. Quitar tildes y diacríticos (ej: oͦ -> o, é -> e)
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        // 5. Eliminar cualquier cosa que no sea letra o número (quita tachados, símbolos, etc.)
        .replace(/[^a-z0-9]+/g, '_')
        // 6. Limpiar guiones bajos sobrantes
        .replace(/^_+|_+$/g, '');
}

// 👉 PEGA ESTO AQUÍ
// 👉 REEMPLAZA LA FUNCIÓN POR ESTA VERSIÓN SEGURA
function obtenerImagenInteligente(url, { anchoMovil = 400, calidadMovil = 70 } = {}) {
    if (!url) return '';
    
    // Apagamos el proxy externo temporalmente porque choca con la seguridad de Supabase.
    // Simplemente devolvemos la URL original para que todo vuelva a funcionar.
    return url; 
}

// =========================================
// 2. INICIO DE LA APLICACIÓN
// =========================================
document.addEventListener('DOMContentLoaded', async () => {
    verificarPermisosAdmin();
    tg.ready();
    tg.expand();

    await cargarObras();
    
    let userToLog = null;
    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
        userToLog = tg.initDataUnsafe.user;
    } else {
        const saved = localStorage.getItem('tg_user');
        if (saved) userToLog = JSON.parse(saved);
    }

    if (userToLog) loguearUsuario(userToLog);

    // --- DETECTOR MULTIPLATAFORMA (Slugs / Nombres / StartApp) ---
    const urlParams = new URLSearchParams(window.location.search);
    const webId = urlParams.get('id'); 
    const webStartApp = urlParams.get('startapp'); // <--- Captura el enlace generado para Google
    const tgId = tg.initDataUnsafe?.start_param; 

    // El sistema buscará prioritariamente lo que venga de Telegram, luego la ID web y finalmente el startapp de Google
    const loQueBuscamos = tgId || webId || webStartApp;

    if (loQueBuscamos) {
        setTimeout(() => {
            // Buscamos de forma inteligente si coincide la ID o el slug limpio del título
            const obraDirecta = todasLasObras.find(o => 
                String(o.id) === String(loQueBuscamos) || 
                crearSlug(o.titulo) === String(loQueBuscamos)
            );
            
            if (obraDirecta) {
                abrirDetalle(obraDirecta.titulo);
            } else {
                mostrarCatalogo();
            }
        }, 600); 
    } else {
        mostrarCatalogo();
    }
});

// =========================================
// 3. NAVEGACIÓN Y VISTAS
// =========================================
let historialNavegacion = ['catalogo'];

tg.BackButton.onClick(() => {
    if (historialNavegacion.length > 1) {
        historialNavegacion.pop();
        const vistaAnterior = historialNavegacion[historialNavegacion.length - 1];
        ejecutarCambioVista(vistaAnterior);
    } else {
        ejecutarCambioVista('catalogo');
    }
});

function cambiarVista(vista, saveHistory = true) {
    if (saveHistory) history.pushState({ vista: vista }, "", "");

    if (vista === 'catalogo') {
        historialNavegacion = ['catalogo'];
    } else if (historialNavegacion[historialNavegacion.length - 1] !== vista) {
        historialNavegacion.push(vista);
    }
    ejecutarCambioVista(vista);
}

function ejecutarCambioVista(vista) {
    const vistas = ['vista-catalogo', 'vista-registro', 'vista-detalle', 'barra-busqueda'];
    
    if (document.getElementById('vista-catalogo') && document.getElementById('vista-catalogo').style.display !== 'none') {
        posicionScrollGuardada = window.scrollY;
    }

    vistas.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    if (vista === 'catalogo') {
        const vc = document.getElementById('vista-catalogo');
        const bb = document.getElementById('barra-busqueda');
        if(vc) vc.style.display = 'block';
        if(bb) bb.style.display = 'block';
        tg.BackButton.hide();
        setTimeout(() => window.scrollTo(0, posicionScrollGuardada), 10);
    } else {
        const vr = document.getElementById(`vista-${vista}`);
        if(vr) vr.style.display = 'block';
        tg.BackButton.show();
        window.scrollTo(0, 0);
    }
    verificarPermisosAdmin();
}

function mostrarCatalogo() { cambiarVista('catalogo', false); }
function volverAlCatalogo() {
    if(tg?.HapticFeedback?.impactOccurred) tg.HapticFeedback.impactOccurred('light');
    cambiarVista('catalogo');
}

// =========================================
// 4. ESTADO GLOBAL
// =========================================
let idAnimeEnEdicion = null;
let todasLasObras = []; 
let obraActual = null; 
let posicionScrollGuardada = 0;
let timeoutBusqueda = null;
let listaFavoritos = [];
let generoSeleccionado = null;
let animesEnEmision = [];
let bannerIndexActual = 0;
let bannerTimer = null;

let filtrosActuales = { texto: '', estado: 'Todos', soloFavoritos: false };

// =========================================
// 5. SISTEMA DE GÉNEROS DINÁMICOS
// =========================================
function togglePanelGeneros() {
    const panel = document.getElementById('panel-generos-dinamico');
    if (!panel) return;
    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        actualizarListaGeneros();
    } else {
        panel.style.display = 'none';
    }
}

function actualizarListaGeneros() {
    const container = document.getElementById('lista-generos-disponibles');
    if (!container) return;

    const generosEnUso = [...new Set(todasLasObras.flatMap(obra => obra.generos || []))].sort();

    if (generosEnUso.length === 0) {
        container.innerHTML = '<p style="font-size: 12px; color: #71717a; padding: 10px;">No hay géneros detectados.</p>';
        return;
    }

    container.innerHTML = generosEnUso.map(gen => `
        <button class="btn-filtro ${generoSeleccionado === gen ? 'active' : ''}"
                onclick="filtrarPorGenero('${gen}', event)">
            ${gen}
        </button>
    `).join('');
}

function filtrarPorGenero(genero, event) {
    document.querySelectorAll('#lista-generos-disponibles .btn-filtro').forEach(b => b.classList.remove('active'));
    
    if (generoSeleccionado === genero) {
        generoSeleccionado = null;
        renderizarObras(todasLasObras);
    } else {
        generoSeleccionado = genero;
        if (event && event.currentTarget) event.currentTarget.classList.add('active');
        const filtradas = todasLasObras.filter(o => o.generos && o.generos.includes(genero));
        renderizarObras(filtradas);
    }
}

// =========================================
// 6. CATÁLOGO Y FILTROS
// =========================================
async function cargarObras() {
    const { data: obras, error } = await _supabase
        .from('obras')
        .select('*')
        .order('fecha_creacion', { ascending: false });

    if (error) return console.error("Error cargando obras:", error);

    todasLasObras = obras || []; 
    aplicarTodosLosFiltros();

    cargarBanner();
}

function aplicarTodosLosFiltros() {
    const resultado = todasLasObras.filter(obra => {
        const tituloMatch = obra.titulo.toLowerCase().includes(filtrosActuales.texto);
        const altJap = obra.nombres_alternativos?.Japonés?.toLowerCase() || '';
        const altIng = obra.nombres_alternativos?.Ingles?.toLowerCase() || '';
        const textoMatch = tituloMatch || altJap.includes(filtrosActuales.texto) || altIng.includes(filtrosActuales.texto);
        
        const estadoMatch = filtrosActuales.estado === 'Todos' || filtrosActuales.estado === 'Favoritos' || obra.estado === filtrosActuales.estado;
        const favoritoMatch = !filtrosActuales.soloFavoritos || esFavorito(String(obra.id));

        return textoMatch && estadoMatch && favoritoMatch;
    });

    renderizarObras(resultado);
}

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

function renderizarObras(obras) {
    const grid = document.getElementById('grid-obras');
    if(!grid) return;
    
    if (obras.length === 0) {
        grid.innerHTML = "<p style='color: #a1a1aa; grid-column: 1 / -1; text-align: center; padding: 40px;'>No se encontraron obras...</p>";
        return;
    }

    grid.innerHTML = obras.map(obra => {
        const tituloSeguro = String(obra.titulo || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const imgUrl = obtenerImagenInteligente(obra.portada_url);
        
        // Usamos tu función crearSlug para que el enlace coincida con el formato del bot
        const animeParametro = crearSlug(obra.titulo);

        return `
        <div class="tarjeta-anime" onclick="abrirDetalle('${tituloSeguro}')">
            <div class="tipo-tag">${obra.tipo || 'Anime'}</div>
            
            <a href="?startapp=${animeParametro}" style="display: block; text-decoration: none; color: inherit;" onclick="event.preventDefault();">
                <img src="${imgUrl}" alt="${tituloSeguro}" loading="lazy" class="img-catalogo">
            </a>
            
            <div class="info-tarjeta">
                <div class="titulo-tarjeta">${obra.titulo}</div>
            </div>
        </div>
        `;
    }).join('');
}

// =========================================
// 7. FAVORITOS
// =========================================
function esFavorito(animeId) {
    if (!animeId) return false;
    return listaFavoritos.map(String).includes(String(animeId));
}

async function cargarFavoritosUsuario() {
    if (!userIdActual || userIdActual === "anonimo") return;

    const { data, error } = await _supabase
        .from('favoritos')
        .select('nombre_item')
        .eq('user_id_telegram', userIdActual);

    if (!error) listaFavoritos = Array.isArray(data) ? data.map(i => String(i.nombre_item)) : [];
}

async function toggleFavorito(event, animeId) {
    if (event) event.stopPropagation(); 
    if (!userIdActual || userIdActual === "anonimo") {
        alert('Inicia sesión con Telegram para guardar tus favoritos.');
        abrirModalAuth();
        return;
    }
    if (!animeId) return;

    const userIdStr = String(userIdActual);
    const nombreItem = String(animeId);
    const yaEsFavorito = esFavorito(nombreItem);

    try {
        let resultado;
        if (yaEsFavorito) {
            resultado = await _supabase.from('favoritos').delete().eq('user_id_telegram', userIdStr).eq('nombre_item', nombreItem);
        } else {
            resultado = await _supabase.from('favoritos').insert([{ user_id_telegram: userIdStr, nombre_item: nombreItem }]);
        }
        if (resultado.error) throw resultado.error;

        await cargarFavoritosUsuario();
        aplicarTodosLosFiltros(); 
        actualizarEstadoFavoritoDetalle(); 
    } catch (error) {
        console.error('Error favoritos:', error);
    }
}

function toggleFavoritoDetalle(event) {
    if (event) event.stopPropagation();
    if (obraActual) toggleFavorito(event, obraActual.id);
}

function actualizarEstadoFavoritoDetalle() {
    const btn = document.getElementById('det-favorito-btn');
    if (!btn || !obraActual) return;

    if (esFavorito(String(obraActual.id))) {
        btn.classList.add('favorito-activo');
        btn.innerHTML = '<i class="fa-solid fa-heart" style="color:#ff4757;"></i>';
    } else {
        btn.classList.remove('favorito-activo');
        btn.innerHTML = '<i class="fa-regular fa-heart"></i>';
    }
}

// =========================================
// 8. VISTA DETALLE
// =========================================
function abrirDetalle(tituloObra) {
    if(tg?.HapticFeedback?.impactOccurred) tg.HapticFeedback.impactOccurred('medium');
    
    obraActual = todasLasObras.find(o => o.titulo === tituloObra);
    if (!obraActual) return;

    const setContent = (id, value) => { if(document.getElementById(id)) document.getElementById(id).textContent = value; };
    
    // 👉 REEMPLAZA DESDE AQUÍ
    const imgBanner = document.getElementById('det-banner');
    if(imgBanner) imgBanner.src = obtenerImagenInteligente(obraActual.banner_url || obraActual.portada_url, { anchoMovil: 600 });
    
    const imgPort = document.getElementById('det-portada');
    if(imgPort) {
        imgPort.src = obtenerImagenInteligente(obraActual.portada_url, { anchoMovil: 300 });
        imgPort.style.opacity = 1;
        // El visor grande siempre usa la original en alta calidad
        imgPort.onclick = (e) => { e.preventDefault(); e.stopPropagation(); verImagenGrande(obraActual.portada_url); };
    }
    
    setContent('det-titulo', obraActual.titulo || 'Sin título');
    
    let nombresAlt = [];
    if(obraActual.nombres_alternativos?.Japonés) nombresAlt.push(obraActual.nombres_alternativos.Japonés);
    if(obraActual.nombres_alternativos?.Ingles) nombresAlt.push(obraActual.nombres_alternativos.Ingles);
    setContent('det-nombres-alt', nombresAlt.join(' • '));

    const badge = document.getElementById('det-creador-badge');
    const txtCreador = document.getElementById('txt-creador');

    if (obraActual.creador_nombre) {
        badge.style.display = 'inline-flex';
        txtCreador.textContent = obraActual.creador_nombre;

        txtCreador.style.fontWeight = "normal";
        // Guardamos los datos en el elemento para que la función toggle pueda leerlos
        badge.dataset.nombre = obraActual.creador_nombre;
        badge.dataset.username = obraActual.creador_username || "Sin @usuario";
        badge.dataset.id = obraActual.creador_id || "Sin ID";
        badge.dataset.link = obraActual.creador_link || "";
        badge.dataset.estado = "nombre";

        // 👉 AQUÍ ESTÁ LA MAGIA: Forzamos el click igual que en las temporadas
        badge.onclick = (e) => { 
            e.stopPropagation(); 
            toggleNombreCreador(badge); 
        };

        if (obraActual.creador_id === ADMIN_ID || obraActual.creador_nombre === "Admin") {
            badge.classList.add('admin');
        } else {
            badge.classList.remove('admin');
        }
    } else {
        badge.style.display = 'none';
    }

    const tagsContainer = document.getElementById('det-tags');
    if(tagsContainer) {
        tagsContainer.innerHTML = '';
        (obraActual.generos || []).forEach(g => tagsContainer.innerHTML += `<span class="tag">${g}</span>`);
    }

    setContent('det-estado', obraActual.estado || '--');
    setContent('det-tipo', obraActual.tipo || '--');
    setContent('det-estudio', obraActual.estudio || '--');
    setContent('det-origen', obraActual.origen || '--');
    setContent('det-dia', obraActual.dia_emision || '--');
    setContent('det-estreno', obraActual.estreno || '--');
    setContent('det-autor', obraActual.autor || '--');
    setContent('det-sinopsis', obraActual.sinopsis || 'Sin descripción.');

    const infoSidebar = document.querySelector('.detalle-sidebar');
    if (infoSidebar) {
        infoSidebar.querySelectorAll('.info-item[data-din="extra"]').forEach(n => n.remove());
        if (obraActual.propiedades_extra && typeof obraActual.propiedades_extra === 'object') {
            Object.entries(obraActual.propiedades_extra).forEach(([clave, valor]) => {
                const divExtra = document.createElement('div');
                divExtra.className = 'info-item';
                divExtra.dataset.din = 'extra'; 
                divExtra.innerHTML = `<span>${clave}:</span> <strong>${valor}</strong>`;
                infoSidebar.appendChild(divExtra);
            });
        }
    }

    const btnEditar = document.getElementById('btn-edit-serie');
    if (btnEditar) {
        // CUALQUIER USUARIO LOGUEADO PUEDE EDITAR (Para ser colaborador)
        if (userIdActual !== "anonimo") {
            btnEditar.style.setProperty('display', 'block', 'important');
        } else {
            btnEditar.style.setProperty('display', 'none', 'important');
        }
    }
    const btnEliminar = document.getElementById('btn-eliminar-serie');
    if (btnEliminar) {
        // ¿Es el creador original o es el Admin principal?
        const esPropietarioOAdmin = (String(obraActual.creador_id) === String(userIdActual)) || (String(userIdActual) === ADMIN_ID);
        
        if (esPropietarioOAdmin) {
            btnEliminar.style.setProperty('display', 'flex', 'important');
        } else {
            btnEliminar.style.setProperty('display', 'none', 'important');
        }
    }

    iniciarNavegacionContenido(obraActual.temporadas);
    actualizarEstadoFavoritoDetalle();

    const btnShare = document.getElementById('det-share-btn');
    if (btnShare) {
        btnShare.onclick = () => copiarEnlaceAnime(obraActual.titulo);
    }

    cambiarVista('detalle');
}

// =========================================
// 9. NAVEGACIÓN DE CAPÍTULOS
// =========================================
function iniciarNavegacionContenido(temporadasData) {
    const contenedor = document.getElementById('det-temporadas');
    if(!contenedor) return;
    
    contenedor.innerHTML = '';
    const imgPortada = document.getElementById('det-portada');
    if (imgPortada && obraActual) {
        imgPortada.src = obraActual.portada_url || ''; 
        imgPortada.style.opacity = 1;
    }

    if (!temporadasData || !Array.isArray(temporadasData) || temporadasData.length === 0) {
        contenedor.innerHTML = '<p class="text-muted" style="color: #a1a1aa;">Aún no hay enlaces disponibles.</p>';
        return;
    }

    const seccionesObj = {};
    temporadasData.forEach(temp => {
        const nombreSeccion = temp.seccion || "Contenido Principal";
        if (!seccionesObj[nombreSeccion]) seccionesObj[nombreSeccion] = [];
        seccionesObj[nombreSeccion].push(temp);
    });

    for (const [secName, temps] of Object.entries(seccionesObj)) {
        // Creamos un contenedor para el título y el badge
        const header = document.createElement('div');
        header.className = 'temporada-header'; // Asegúrate de tener este estilo en CSS
        
        const titulo = document.createElement('h4');
        titulo.style.cssText = "margin: 0; color: #3ba4fa; font-size: 14px;";
        titulo.textContent = secName;
        header.appendChild(titulo);

        // Verificamos si esta sección fue creada por alguien diferente al dueño del anime
        const primerItem = temps[0];
        if (primerItem.creador_nombre && primerItem.creador_nombre !== obraActual.creador_nombre) {
            const badge = document.createElement('div');
            badge.className = `creador-badge ${primerItem.creador_nombre === 'Admin' ? 'admin' : ''}`;
            badge.onclick = (e) => { e.stopPropagation(); toggleNombreCreador(badge); };
            badge.dataset.nombre = primerItem.creador_nombre;
            badge.dataset.username = primerItem.creador_username || "Sin @usuario";
            badge.dataset.id = primerItem.creador_id || "Sin ID"; // <-- Línea nueva
            badge.dataset.estado = "nombre";
            badge.innerHTML = `<i class="fa-solid fa-user-pen"></i> <span>${primerItem.creador_nombre}</span>`;
            header.appendChild(badge);
        }

        contenedor.appendChild(header);
        
        temps.forEach(temp => {
            const btn = document.createElement('button');
            btn.className = 'btn-dinamico';
            btn.innerHTML = `<i class="fa-solid fa-folder-open" style="color: #3ba4fa; margin-right: 8px;"></i> ${temp.nombre}`;
            btn.onclick = () => mostrarIdiomas(temp);
            contenedor.appendChild(btn);
        });
    }
}

function mostrarIdiomas(temporadaObj) {
    if(tg?.HapticFeedback?.impactOccurred) tg.HapticFeedback.impactOccurred('light');
    const contenedor = document.getElementById('det-temporadas');
    
    contenedor.innerHTML = `<button onclick="iniciarNavegacionContenido(obraActual.temporadas)" style="background: transparent; border: none; color: #a1a1aa; padding-bottom: 15px; cursor: pointer; display: flex; align-items: center; gap: 5px;"><i class="fa-solid fa-chevron-left"></i> Volver a Temporadas</button>`;

    if(temporadaObj.imagen && temporadaObj.imagen !== "") {
        const imgPortada = document.getElementById('det-portada');
        if(imgPortada) {
            imgPortada.style.opacity = 0.3;
            setTimeout(() => { 
                imgPortada.src = temporadaObj.imagen; 
                imgPortada.style.opacity = 1; 
                // 👉 LÍNEA NUEVA: Actualizamos el visor para que muestre la imagen de la temporada
                imgPortada.onclick = (e) => { e.preventDefault(); e.stopPropagation(); verImagenGrande(temporadaObj.imagen); };
            }, 150);
        }
    }

    if (temporadaObj.enlaces) {
        for (const [idioma, capitulos] of Object.entries(temporadaObj.enlaces)) {
            const btn = document.createElement('button');
            btn.className = 'btn-dinamico';
            btn.innerHTML = `<i class="fa-solid fa-language" style="color: #10b981; margin-right: 8px;"></i> Audio: ${idioma}`;
            btn.onclick = () => mostrarCapitulos(capitulos, temporadaObj);
            contenedor.appendChild(btn);
        }
    }
}

function mostrarCapitulos(capitulosObj, temporadaPadre) {
    if(tg?.HapticFeedback?.impactOccurred) tg.HapticFeedback.impactOccurred('light');
    const contenedor = document.getElementById('det-temporadas');
    
    contenedor.innerHTML = `<button onclick="mostrarIdiomas(obraActual.temporadas.find(t => t.nombre === '${temporadaPadre.nombre}'))" style="background: transparent; border: none; color: #a1a1aa; padding-bottom: 15px; cursor: pointer; display: flex; align-items: center; gap: 5px;"><i class="fa-solid fa-chevron-left"></i> Volver a Idiomas</button>`;

    for (const [capitulo, url] of Object.entries(capitulosObj)) {
        const btn = document.createElement('button');
        btn.className = 'btn-dinamico';
        btn.style.borderColor = '#3ba4fa';
        btn.innerHTML = `<i class="fa-solid fa-play" style="color: #3ba4fa; margin-right: 8px;"></i> ${capitulo}`;
        btn.onclick = () => abrirEnlaceTelegram(url);
        contenedor.appendChild(btn);
    }
}

function abrirEnlaceTelegram(url) {
    if(tg?.HapticFeedback?.impactOccurred) tg.HapticFeedback.impactOccurred('heavy');
    url.includes('t.me') ? tg.openTelegramLink(url) : tg.openLink(url);
}

// =========================================
// 10. LÓGICA DE ROLES Y REGISTRO (CORREGIDO)
// =========================================

// Para CREAR un nuevo anime (Eres dueño automáticamente)
function prepararNuevoRegistro() {
    idAnimeEnEdicion = null;
    obraActual = null;

    document.getElementById('btn-publicar').textContent = "Publicar Obra";
    
    // Limpiar campos
    const inputsId = ['in-titulo', 'in-portada', 'in-banner', 'in-estado', 'in-tipo', 'in-sinopsis', 'in-autor', 'in-estudio', 'in-origen', 'in-estreno', 'in-dia', 'in-japones', 'in-ingles', 'edit-telegram-creador']; // <-- AGREGA edit-telegram-creador AL ARRAY
    inputsId.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.value = "";
            input.disabled = false;
            input.classList.remove('campo-bloqueado');
        }
    });

    document.querySelectorAll('#generos-container input').forEach(cb => { cb.checked = false; cb.disabled = false; cb.parentElement.classList.remove('campo-bloqueado'); });
    document.getElementById('builder-temporadas').innerHTML = '';
    
    const containerExtra = document.getElementById('extra-props-container');
    if(containerExtra) { containerExtra.innerHTML = ''; containerExtra.classList.remove('campo-bloqueado'); }
    
    const btnAddProp = document.getElementById('btn-add-prop');
    if (btnAddProp) { btnAddProp.disabled = false; btnAddProp.style.display = 'block'; }

    const seccionesFormulario = document.querySelectorAll('#vista-registro .form-seccion');
    if (seccionesFormulario[0]) seccionesFormulario[0].style.display = 'block';
    if (seccionesFormulario[1]) seccionesFormulario[1].style.display = 'block';

    agregarPropiedadUI();

    const herramientas = document.querySelector('.import-export-tools');
    if (herramientas) herramientas.style.display = 'flex';

    cambiarVista('registro');
}

// Para EDITAR un anime existente (Valida si eres Dueño o Colaborador)
function prepararEdicionDesdeDetalle() {
    if (!obraActual) return;
    idAnimeEnEdicion = obraActual.id; 
    document.getElementById('btn-publicar').textContent = "Guardar Cambios";

    // 1. Validar Permisos (ESTO DEBE IR PRIMERO)
    const esPropietario = (String(obraActual.creador_id) === String(userIdActual)) || (String(userIdActual) === ADMIN_ID);

    // ============================================================
    // CONTROL DE VISIBILIDAD DE HERRAMIENTAS XML (Copiar, Pegar, etc.)
    // ============================================================
    const herramientas = document.querySelector('.import-export-tools');
    if (herramientas) {
        // Solo el dueño o el admin ven estas opciones
        herramientas.style.display = esPropietario ? 'flex' : 'none';
    }
    // ============================================================

    const inputPagina = document.getElementById('edit-telegram-creador');
    if (inputPagina) {
        if (esPropietario) {
            inputPagina.value = obraActual.creador_link || '';
        } else {
            const miSeccion = obraActual.temporadas?.find(t => String(t.creador_id) === String(userIdActual));
            inputPagina.value = miSeccion?.creador_link || '';
        }
    }

    // 2. Llenar datos base
    const mapVal = (id, val) => { if(document.getElementById(id)) document.getElementById(id).value = val || ''; };
    mapVal('in-titulo', obraActual.titulo);
    mapVal('in-portada', obraActual.portada_url);
    mapVal('in-banner', obraActual.banner_url);
    mapVal('in-estado', obraActual.estado || 'En emisión');
    mapVal('in-tipo', obraActual.tipo || 'TV');
    mapVal('in-sinopsis', obraActual.sinopsis);
    mapVal('in-autor', obraActual.autor);
    mapVal('in-estudio', obraActual.estudio);
    mapVal('in-origen', obraActual.origen);
    mapVal('in-estreno', obraActual.estreno);
    mapVal('in-dia', obraActual.dia_emision);
    mapVal('in-japones', obraActual.nombres_alternativos?.Japonés);
    mapVal('in-ingles', obraActual.nombres_alternativos?.Ingles);

    const generosAnime = obraActual.generos || [];
    document.querySelectorAll('#generos-container input').forEach(cb => cb.checked = generosAnime.includes(cb.value));

    // 3. Ocultar o mostrar secciones completas
    const seccionesFormulario = document.querySelectorAll('#vista-registro .form-seccion');

    if (!esPropietario) {
        // Si es colaborador: ocultar "Información General" y "Multimedia"
        if (seccionesFormulario[0]) seccionesFormulario[0].style.display = 'none';
        if (seccionesFormulario[1]) seccionesFormulario[1].style.display = 'none';
    } else {
        // Si es el dueño o admin: mostrar todo normalmente
        if (seccionesFormulario[0]) seccionesFormulario[0].style.display = 'block';
        if (seccionesFormulario[1]) seccionesFormulario[1].style.display = 'block';
    }

    // 4. Cargar Temporadas y Extras
    cargarInfoAdicional(obraActual.propiedades_extra || {});
    cargarDatosTemporadas(obraActual.temporadas || []);

    cambiarVista('registro');
}
// Al presionar Guardar/Publicar
async function ejecutarRegistro() {
    const btn = document.getElementById('btn-publicar');
    const inTitulo = document.getElementById('in-titulo');
    const inPortada = document.getElementById('in-portada');
    
    if(!inTitulo || !inPortada) return;

    // Lógica de validación de permisos
    const esPropietario = idAnimeEnEdicion ? ((String(obraActual.creador_id) === String(userIdActual)) || (String(userIdActual) === ADMIN_ID)) : true;
    const esAdmin = (String(userIdActual) === ADMIN_ID); // <--- IDENTIFICAR ADMIN

    if (esPropietario && (!inTitulo.value.trim() || !inPortada.value.trim())) {
        if(tg?.HapticFeedback?.notificationOccurred) tg.HapticFeedback.notificationOccurred('error');
        return alert("⚠️ Título y Portada son obligatorios.");
    }

    // --- VALIDACIÓN DE DUPLICADOS CON BYPASS PARA ADMIN ---
    const tituloSanitizado = sanitizar(inTitulo.value.trim());
    let slugGenerado = crearSlug(tituloSanitizado);

    // Verificamos si realmente cambiaste el título (si estás editando)
    const tituloCambio = idAnimeEnEdicion ? (obraActual.titulo !== tituloSanitizado) : true;

    if (idAnimeEnEdicion && !tituloCambio) {
        // Si NO cambiaste el título, simplemente mantenemos tu slug original intacto
        slugGenerado = obraActual.slug; 
    } else {
        // Solo buscamos duplicados si es un anime nuevo o si de verdad le cambiaste el nombre
        const animeDuplicado = todasLasObras.find(obra => crearSlug(obra.titulo) === slugGenerado);

        if (esPropietario && animeDuplicado) {
            // CASO 1: CREANDO NUEVO
            if (!idAnimeEnEdicion) {
                if (esAdmin) {
                    slugGenerado = slugGenerado + "_" + Date.now();
                } else {
                    if(tg?.HapticFeedback?.notificationOccurred) tg.HapticFeedback.notificationOccurred('error');
                    return alert(`⚠️ ¡Este anime ya existe!\nEstá registrado como: "${animeDuplicado.titulo}"`);
                }
            } 
            // CASO 2: EDITANDO (y sí cambiaste el título a uno que ya existe)
            else {
                if (esAdmin) {
                    slugGenerado = slugGenerado + "_ed" + Date.now();
                } else {
                    if(tg?.HapticFeedback?.notificationOccurred) tg.HapticFeedback.notificationOccurred('error');
                    return alert("⚠️ No puedes usar ese nombre porque ya pertenece a otro anime.");
                }
            }
        }
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Procesando...`;

    try {
        let datosObra = {};
        
        if (esPropietario) {
            const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value.trim() : '';
            
            datosObra = {
                titulo: tituloSanitizado,
                slug: slugGenerado, // <--- MUY IMPORTANTE: Guardar el slug en la base de datos
                portada_url: getVal('in-portada'),
                banner_url: getVal('in-banner'),
                sinopsis: sanitizar(getVal('in-sinopsis')),
                estado: sanitizar(getVal('in-estado') || 'En emisión'),
                tipo: sanitizar(getVal('in-tipo') || 'TV'),
                estudio: sanitizar(getVal('in-estudio')),
                autor: sanitizar(getVal('in-autor')),
                origen: sanitizar(getVal('in-origen')),
                estreno: sanitizar(getVal('in-estreno')),
                dia_emision: sanitizar(getVal('in-dia')),
                nombres_alternativos: {
                    Japonés: sanitizar(getVal('in-japones')),
                    Ingles: sanitizar(getVal('in-ingles'))
                },
                generos: Array.from(document.querySelectorAll('#generos-container input:checked')).map(cb => cb.value),
                temporadas: recolectarDatosTemporadas(),
                propiedades_extra: recolectarCamposExtras(),
                creador_link: sanitizar(getVal('edit-telegram-creador'))
            };

            if (!idAnimeEnEdicion) {
                datosObra.creador_id = userIdActual;
                if (esAdmin) {
                    datosObra.creador_nombre = "Admin";
                    datosObra.creador_username = "@Admin";
                } else {
                    const tgUser = JSON.parse(localStorage.getItem('tg_user'));
                    datosObra.creador_nombre = tgUser ? tgUser.first_name : "Usuario";
                    datosObra.creador_username = (tgUser && tgUser.username) ? `@${tgUser.username}` : "Sin @usuario";
                }
            }
        } else {
            // SI ERES COLABORADOR: Solo actualizamos temporadas
            datosObra = {
                temporadas: recolectarDatosTemporadas()
            };
        }

        let resultado;
        if (idAnimeEnEdicion) {
            resultado = await _supabase.from('obras').update(datosObra).eq('id', idAnimeEnEdicion);
        } else {
            resultado = await _supabase.from('obras').insert([datosObra]);
        }

        if (resultado.error) throw resultado.error;

        if(tg?.HapticFeedback?.notificationOccurred) tg.HapticFeedback.notificationOccurred('success');
        alert(idAnimeEnEdicion ? "✅ Cambios guardados" : "✅ Publicado con éxito");

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
// 11. CONSTRUCTOR VISUAL DE TEMPORADAS (CORREGIDO PARA ROLES)
// =========================================
// Agregamos creadorNombre y creadorUsername como parámetros
// 👉 Se añadió el 6to parámetro: creadorLink
function agregarSeccionUI(nombreSeccion = '', temporadasArray = null, creadorId = null, creadorNombre = null, creadorUsername = null, creadorLink = null) {
    const container = document.getElementById('builder-temporadas');
    if (!container) return;
    
    const secBlock = document.createElement('div');
    secBlock.className = 'seccion-block';
    
    // 1. Determinar si es una sección nueva o existente
    const esNuevaSeccion = (temporadasArray === null);
    
    // 2. Asignación de identidad y Link de Telegram
    if (esNuevaSeccion) {
        // CASO NUEVO: Usuario actual es el autor
        const tgUser = JSON.parse(localStorage.getItem('tg_user'));
        
        secBlock.dataset.creador = String(userIdActual);
        secBlock.dataset.creadorNombre = userIdActual === ADMIN_ID ? "Admin" : (tgUser?.first_name || "Colaborador");
        secBlock.dataset.creadorUsername = userIdActual === ADMIN_ID ? "@Admin" : (tgUser?.username ? `@${tgUser.username}` : "Sin @usuario");
        
        // 👉 IMPORTANTE: Captura el link actual del input global al crear la sección
        const currentInput = document.getElementById('edit-telegram-creador');
        secBlock.dataset.creadorLink = currentInput ? currentInput.value.trim() : "";
    } else {
        // CASO EXISTENTE: Mantenemos lo que viene de la BD
        secBlock.dataset.creador = creadorId ? String(creadorId) : (obraActual?.creador_id ? String(obraActual.creador_id) : '');
        secBlock.dataset.creadorNombre = creadorNombre || (obraActual?.creador_nombre || "Autor");
        secBlock.dataset.creadorUsername = creadorUsername || (obraActual?.creador_username || "Sin @usuario");
        
        // 👉 IMPORTANTE: Guardamos el link que viene de la base de datos
        secBlock.dataset.creadorLink = creadorLink || (obraActual?.creador_link || "");
    }

    // 3. Lógica de Permisos
    const esDueñoDeLaObra = (obraActual && String(obraActual.creador_id) === String(userIdActual));
    const esAutorDeLaSeccion = (String(secBlock.dataset.creador) === String(userIdActual));
    const esAdmin = (String(userIdActual) === ADMIN_ID);

    const puedeEditarEstaSeccion = esAutorDeLaSeccion || esAdmin || esDueñoDeLaObra;

    // 4. Renderizado del HTML
    secBlock.innerHTML = `
        <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; gap: 10px; border-bottom: 1px solid #27272a; padding-bottom: 10px;">
            <input type="text" class="sec-nombre" placeholder="Nombre de tu Página o Grupo" value="${nombreSeccion}" style="flex: 1; padding: 10px; border-radius: 6px; border: 1px solid #3ba4fa; background: #18181b; color: white; outline: none; font-weight: bold;">
            <button type="button" class="btn-delete-sec" onclick="this.closest('.seccion-block').remove()" style="background:#ef4444; color:white; border:none; padding: 10px; border-radius: 6px; cursor:pointer;">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
        <div class="lista-temporadas"></div>
        <button type="button" class="btn-add-sub" onclick="agregarSubTemporadaUI(this.previousElementSibling)" 
        style="width: 100%; padding: 10px; background: #18181b; color: #3ba4fa; border: 1px dashed #3ba4fa; border-radius: 6px; cursor: pointer; margin-top: 10px; margin-bottom: 20px;">
            <i class="fa-solid fa-plus"></i> Añadir Nueva Temporada
        </button>
    `;

    container.appendChild(secBlock);

    // 5. Aplicar bloqueos de seguridad
    if (!puedeEditarEstaSeccion) {
        secBlock.style.display = 'none'; // Desaparece visualmente
    } else {
        secBlock.style.display = 'block'; // Aseguramos que se vea
    }

    // 6. Cargar sub-temporadas
    const listaTemps = secBlock.querySelector('.lista-temporadas');
    if (!esNuevaSeccion && Array.isArray(temporadasArray)) {
        temporadasArray.forEach(tempDatos => agregarSubTemporadaUI(listaTemps, tempDatos, puedeEditarEstaSeccion));
    } else {
        agregarSubTemporadaUI(listaTemps, null, puedeEditarEstaSeccion);
    }
}

function agregarSubTemporadaUI(containerLista, datos = null, puedeEditar = true) {
    if (!containerLista) return;
    const bloque = document.createElement('div');
    bloque.className = 'temporada-block';
    bloque.style.cssText = "border: 1px solid #27272a; padding: 15px; border-radius: 8px; margin-bottom: 15px; background: #18181b;";

    bloque.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 10px;">
            <input type="text" class="temp-nombre" placeholder="Nombre (Ej: Temporada 1)" value="${datos?.nombre || ''}" style="flex: 1; padding: 10px; border-radius: 6px; border: 1px solid #27272a; background: #0f0f11; color: white; outline: none;">
            <button type="button" class="btn-del-sub" onclick="this.closest('.temporada-block').remove()" style="background:transparent; color:#ef4444; border:none; cursor:pointer;">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
        <input type="text" class="temp-img" placeholder="URL Imagen Portada (Opcional)" value="${datos?.imagen || ''}" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #27272a; background: #0f0f11; color: white; outline: none; margin-bottom: 15px; box-sizing: border-box;">
        
        <div class="idiomas-container">
            <div class="lista-idiomas" style="display: flex; flex-direction: column; gap: 10px;"></div>
            <button type="button" class="btn-add-idioma" onclick="agregarIdiomaUI(this.previousElementSibling)" style="margin-top: 10px; padding: 8px 15px; background:#27272a; color:white; border:none; border-radius:6px; cursor:pointer; font-size:13px;">
                <i class="fa-solid fa-plus"></i> Añadir Idioma
            </button>
        </div>
    `;

    containerLista.appendChild(bloque);

    if (!puedeEditar) {
        bloque.querySelectorAll('input').forEach(inp => inp.disabled = true);
        bloque.querySelectorAll('button').forEach(btn => btn.style.display = 'none');
    }

    const listaIdiomas = bloque.querySelector('.lista-idiomas');
    if (datos?.enlaces) {
        Object.entries(datos.enlaces).forEach(([idioma, caps]) => agregarIdiomaUI(listaIdiomas, idioma, caps, puedeEditar));
    } else {
        agregarIdiomaUI(listaIdiomas, '', null, puedeEditar);
    }
}

function agregarIdiomaUI(containerLista, nombreIdioma = '', capitulos = null, puedeEditar = true) {
    if (!containerLista) return;
    const divIdioma = document.createElement('div');
    divIdioma.className = 'idioma-bloque';
    divIdioma.style.cssText = "padding: 10px; background: #0c0c0f; border: 1px solid #27272a; border-radius: 6px;";

    divIdioma.innerHTML = `
        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <input type="text" class="idioma-nombre" placeholder="Idioma" value="${nombreIdioma}" style="flex: 1; padding: 8px; border-radius: 6px; border: 1px solid #27272a; background: #18181b; color: white; outline: none;">
            <button type="button" class="btn-del-id" onclick="this.closest('.idioma-bloque').remove()" style="background: transparent; color: #ef4444; border: 1px solid #ef4444; border-radius: 6px; padding: 8px 12px; cursor: pointer;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="lista-capitulos" style="display: flex; flex-direction: column; gap: 5px; margin-left: 10px; border-left: 2px solid #27272a; padding-left: 10px;"></div>
        <button type="button" class="btn-add-cap" onclick="agregarCapituloUI(this.previousElementSibling)" style="margin-top: 10px; margin-left: 10px; padding: 6px 12px; background: transparent; border: 1px dashed #3ba4fa; color: #3ba4fa; border-radius: 6px; cursor: pointer; font-size: 12px;">
            + Añadir Capítulo
        </button>
    `;

    containerLista.appendChild(divIdioma);
    
    if (!puedeEditar) {
        divIdioma.querySelectorAll('input').forEach(inp => inp.disabled = true);
        divIdioma.querySelectorAll('button').forEach(btn => btn.style.display = 'none');
    }

    const listaCaps = divIdioma.querySelector('.lista-capitulos');
    if (capitulos) {
        Object.entries(capitulos).forEach(([n, u]) => agregarCapituloUI(listaCaps, n, u, puedeEditar));
    } else {
        agregarCapituloUI(listaCaps, '', '', puedeEditar);
    }
}

function agregarCapituloUI(containerCaps, capNombre = '', capUrl = '', puedeEditar = true) {
    if (!containerCaps) return;
    const divCap = document.createElement('div');
    divCap.className = 'capitulo-row';
    divCap.style.cssText = "display: flex; gap: 8px;";

    divCap.innerHTML = `
        <input type="text" class="cap-nombre" placeholder="N°" value="${capNombre}" style="width: 35%; padding: 8px; border-radius: 6px; border: 1px solid #27272a; background: #18181b; color: white; font-size: 13px;">
        <input type="text" class="cap-url" placeholder="URL" value="${capUrl}" style="flex: 1; padding: 8px; border-radius: 6px; border: 1px solid #27272a; background: #18181b; color: white; font-size: 13px;">
        <button type="button" class="btn-del-cap" onclick="this.closest('.capitulo-row').remove()" style="background: transparent; color: #a1a1aa; border: none; cursor: pointer;"><i class="fa-solid fa-trash"></i></button>
    `;
    containerCaps.appendChild(divCap);
    
    if (!puedeEditar) {
        divCap.querySelectorAll('input').forEach(inp => inp.disabled = true);
        divCap.querySelector('button').style.display = 'none';
    }
}

function recolectarDatosTemporadas() {
    const datos = [];
    
    document.querySelectorAll('.seccion-block').forEach(secBlock => {
        const inputSec = secBlock.querySelector('.sec-nombre');
        const nombreSeccion = inputSec ? inputSec.value.trim() : 'Principal';
        
        // --- NUEVO: Leer la identidad directamente del HTML ---
        const creadorId = secBlock.dataset.creador || ''; 
        const creadorNombre = secBlock.dataset.creadorNombre || '';
        const creadorUsername = secBlock.dataset.creadorUsername || '';

        let linkGuardar = secBlock.dataset.creadorLink || '';

        if (String(creadorId) === String(userIdActual)) {
            const inputLink = document.getElementById('edit-telegram-creador');
            if (inputLink) {
                linkGuardar = inputLink.value.trim();
            }
        }

        secBlock.querySelectorAll('.temporada-block').forEach(tempBlock => {
            const nombre = tempBlock.querySelector('.temp-nombre')?.value.trim() || '';
            const imagen = tempBlock.querySelector('.temp-img')?.value.trim() || '';
            const enlaces = {};

            tempBlock.querySelectorAll('.idioma-bloque').forEach(idBlock => {
                const idiomaNombre = idBlock.querySelector('.idioma-nombre')?.value.trim() || '';
                if (idiomaNombre) {
                    enlaces[idiomaNombre] = {};
                    idBlock.querySelectorAll('.capitulo-row').forEach(capRow => {
                        const cNombre = capRow.querySelector('.cap-nombre')?.value.trim() || '';
                        const cUrl = capRow.querySelector('.cap-url')?.value.trim() || '';
                        if (cNombre && cUrl) enlaces[idiomaNombre][cNombre] = cUrl;
                    });
                }
            });

            if(nombre) {
                datos.push({ 
                    seccion: nombreSeccion, 
                    nombre, 
                    imagen, 
                    enlaces, 
                    creador_id: creadorId,
                    creador_nombre: creadorNombre,
                    creador_username: creadorUsername,
                    creador_link: linkGuardar 
                });
            }
        });
    });
    return datos;
}

function cargarDatosTemporadas(temporadasFlat) {
    const container = document.getElementById('builder-temporadas');
    if(!container) return;
    container.innerHTML = ''; 

    if (!Array.isArray(temporadasFlat) || temporadasFlat.length === 0) {
        return; 
    }

    const agrupado = {};
    temporadasFlat.forEach(temp => {
        const sec = temp.seccion || 'Principal';
        if (!agrupado[sec]) agrupado[sec] = [];
        agrupado[sec].push(temp);
    });

    for (const [nombreSec, tempsArray] of Object.entries(agrupado)) {
        // Tomamos todos los datos de creador del primer elemento de esa sección
        const primerItem = tempsArray[0] || {};
        const sectionCreator = primerItem.creador_id || (obraActual.creador_id || '');
        
        // --- NUEVO: Extraer nombres originales ---
        const sectionNombre = primerItem.creador_nombre || '';
        const sectionUsername = primerItem.creador_username || '';
        const sectionLink = primerItem.creador_link || '';

        // Se los pasamos a la UI
        agregarSeccionUI(nombreSec, tempsArray, sectionCreator, sectionNombre, sectionUsername);
    }
}

// =========================================
// 12. PROPIEDADES DINÁMICAS (EXTRAS)
// =========================================
function agregarPropiedadUI(key = '', value = '') {
    const container = document.getElementById('extra-props-container');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'prop-row';
    row.style.cssText = 'display:flex; gap:8px; margin-bottom:8px; align-items:center;';

    row.innerHTML = `
        <input type="text" class="prop-key" placeholder="Ej: Editor" value="${key}" style="flex: 0 0 40%; padding:8px; border-radius:6px; border:1px solid #27272a; background:#0f0f11; color:white;">
        <input type="text" class="prop-value" placeholder="Ej: MAPPA" value="${value}" style="flex:1; padding:8px; border-radius:6px; border:1px solid #27272a; background:#0f0f11; color:white;">
        <button type="button" title="Eliminar" style="background:transparent; color:#ef4444; border:none; cursor:pointer; font-size:18px;" onclick="this.closest('.prop-row').remove()"><i class="fa-solid fa-trash"></i></button>
    `;

    container.appendChild(row);
}

function recolectarCamposExtras() {
    const container = document.getElementById('extra-props-container');
    if (!container) return {};

    const datos = {};
    container.querySelectorAll('.prop-row').forEach(r => {
        const k = (r.querySelector('.prop-key')?.value || '').trim();
        const v = (r.querySelector('.prop-value')?.value || '').trim();
        if (k) datos[k] = v;
    });
    return Object.keys(datos).length ? datos : {};
}

function cargarInfoAdicional(obj) {
    const container = document.getElementById('extra-props-container');
    if (!container) return;
    container.innerHTML = '';

    if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) {
        agregarPropiedadUI(); 
        return;
    }
    Object.entries(obj).forEach(([k, v]) => agregarPropiedadUI(k, v));
}

// =========================================
// 13. WIDGET TELEGRAM & MODAL
// =========================================
function abrirModalAuth() {
    const modal = document.getElementById('modal-auth');
    if (modal) modal.classList.remove('modal-oculto');
}

function cerrarModalAuth() {
    const modal = document.getElementById('modal-auth');
    if (modal) modal.classList.add('modal-oculto');
}

window.onTelegramAuth = function(user) {
    loguearUsuario(user);
    const mensaje = document.getElementById('auth-mensaje');
    if (mensaje) {
        mensaje.style.color = "#4ade80";
        mensaje.innerText = `¡Bienvenido, ${user.first_name}!`;
    }
    setTimeout(() => { cerrarModalAuth(); }, 1500);
};

function cerrarSesion() {
    userIdActual = "anonimo";
    localStorage.removeItem('tg_user');
    listaFavoritos = [];
    document.body.classList.remove('usuario-identificado');

    const authContainer = document.getElementById('auth-container');
    if (authContainer) {
        authContainer.innerHTML = `
            <button class="btn-login" onclick="abrirModalAuth()">
                <i class="fa-solid fa-user"></i> <span>Login</span>
            </button>
        `;
    }
    aplicarTodosLosFiltros();
    alert("Has cerrado sesión correctamente.");
}

// =========================================
// 14. UTILIDADES (Visor de imagen)
// =========================================
function verImagenGrande(url) {
    if (!url || url === "") return;
    let overlay = document.getElementById('viewer-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'viewer-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.9); display: none; justify-content: center; align-items: center;
            z-index: 999999; cursor: pointer; backdrop-filter: blur(5px); touch-action: none;
        `;
        const img = document.createElement('img');
        img.id = 'viewer-img';
        img.style.cssText = `max-width: 95vw; max-height: 85vh; border-radius: 12px; box-shadow: 0 0 30px rgba(0,0,0,0.5); object-fit: contain; pointer-events: none;`;
        const btnCerrar = document.createElement('div');
        btnCerrar.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        btnCerrar.style.cssText = `position: absolute; top: 20px; right: 20px; color: white; font-size: 28px; padding: 10px;`;
        
        overlay.appendChild(img); overlay.appendChild(btnCerrar); document.body.appendChild(overlay);
        overlay.onclick = (e) => { e.preventDefault(); overlay.style.display = 'none'; };
    }
    document.getElementById('viewer-img').src = url;
    overlay.style.display = 'flex';
}

function copiarEnlaceAnime(tituloAnime) {
    const botUsername = "AnimeKaergstyBot"; 
    const appNickname = "ahub"; 
    
    // Generamos el slug (nombre_limpio)
    const slug = crearSlug(tituloAnime); 
    const linkDirecto = `https://t.me/${botUsername}/${appNickname}?startapp=${slug}`;

    // Copiar directamente al portapapeles sin avisos
    navigator.clipboard.writeText(linkDirecto).then(() => {
        // Solo una vibración sutil para confirmar que se hizo clic
        if (tg && tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('light');
        }
    }).catch(err => {
        console.error('Error al copiar:', err);
    });
}

function toggleNombreCreador(elemento) {
    const txt = elemento.querySelector('span');
    const estadoActual = elemento.dataset.estado;
    const link = elemento.dataset.link;
    
    // Detectamos si es el badge principal del detalle (el de arriba)
    const esBadgePrincipal = (elemento.id === 'det-creador-badge');

    // --- ESTADO FINAL: ABRIR LINK Y RESETEAR (Solo si es el principal) ---
    if (estadoActual === "link") {
        if (link && link !== "null" && link !== "") {
            // Verificamos si estamos dentro de Telegram Web App
            if (window.Telegram?.WebApp) {
                // Si el link es de Telegram (t.me), usamos openTelegramLink nativo
                if (link.includes('t.me')) {
                    window.Telegram.WebApp.openTelegramLink(link);
                } else {
                    window.Telegram.WebApp.openLink(link);
                }
            } else {
                window.open(link, '_blank');
            }
        }

        // Reset inmediato al nombre
        txt.textContent = elemento.dataset.nombre;
        elemento.dataset.estado = "nombre";
        txt.style.fontWeight = "normal";
        
        if (tg?.HapticFeedback?.impactOccurred) tg.HapticFeedback.impactOccurred('medium');
        return; 
    }

    // --- CICLO DE INFORMACIÓN ---
    if (estadoActual === "nombre") {
        txt.textContent = elemento.dataset.username;
        elemento.dataset.estado = "username";
    } 
    else if (estadoActual === "username") {
        txt.textContent = `ID: ${elemento.dataset.id}`;
        elemento.dataset.estado = "id";
    } 
    else if (estadoActual === "id") {
        // 👉 AQUÍ ESTÁ EL FILTRO:
        // Solo pasamos a "Ver Página" si es el badge principal Y tiene un link válido
        if (esBadgePrincipal && link && link !== "null" && link !== "") {
            txt.textContent = "🌐 Ver Página";
            elemento.dataset.estado = "link";
            txt.style.fontWeight = "bold";
        } else {
            // En las temporadas (o si no hay link), vuelve al nombre directamente
            txt.textContent = elemento.dataset.nombre;
            elemento.dataset.estado = "nombre";
            txt.style.fontWeight = "normal";
        }
    }
    
    if (tg?.HapticFeedback?.impactOccurred) tg.HapticFeedback.impactOccurred('light');
}
// =========================================
// 15. ELIMINAR OBRA (SOLO DUEÑO Y ADMIN)
// =========================================
async function eliminarObraActual(event) {
    if (event) event.stopPropagation();
    
    if (!obraActual) return;

    // Validación de seguridad (por si alguien modifica el HTML)
    const esPropietarioOAdmin = (String(obraActual.creador_id) === String(userIdActual)) || (String(userIdActual) === ADMIN_ID);
    if (!esPropietarioOAdmin) {
        alert("⚠️ No tienes permisos para eliminar este anime.");
        return;
    }

    // 1. Mensaje de confirmación nativo
    const confirmacion = confirm(`¿Estás seguro que quieres eliminar "${obraActual.titulo}" de forma permanente?\n\nEsta acción no se puede deshacer.`);
    
    if (!confirmacion) return; // Si dice cancelar, no hacemos nada

    try {
        // Pequeña vibración en Telegram si es posible
        if (tg?.HapticFeedback?.notificationOccurred) tg.HapticFeedback.notificationOccurred('warning');

        // 2. Borrar de Supabase
        const { error } = await _supabase
            .from('obras')
            .delete()
            .eq('id', obraActual.id);

        if (error) throw error;

        // 3. Quitar de la lista local (para no recargar toda la base de datos de nuevo)
        todasLasObras = todasLasObras.filter(o => o.id !== obraActual.id);

        if (tg?.HapticFeedback?.notificationOccurred) tg.HapticFeedback.notificationOccurred('success');
        alert("🗑️ Anime eliminado correctamente.");

        // 4. Devolver al usuario al catálogo y actualizar visualmente
        volverAlCatalogo();
        aplicarTodosLosFiltros();

    } catch (err) {
        console.error("Error al eliminar la obra:", err);
        alert("❌ Hubo un error al intentar eliminar. Revisa la consola.");
    }
}

// =========================================
// =========================================
// HERRAMIENTAS DE IMPORTACIÓN / EXPORTACIÓN
// =========================================

const getVal = (id) => { 
    const el = document.getElementById(id); 
    return el ? el.value.trim() : ''; 
};

// 1. RECOLECTAR DATOS
function recolectarDatosCompletos() {
    return {
        titulo: getVal('in-titulo') || 'Sin_Titulo',
        japones: getVal('in-japones'),
        ingles: getVal('in-ingles'),
        sinopsis: getVal('in-sinopsis'),
        creador_link: getVal('edit-telegram-creador'),
        estado: getVal('in-estado') || 'En emisión',
        tipo: getVal('in-tipo') || 'TV',
        estudio: getVal('in-estudio'),
        autor: getVal('in-autor'),
        origen: getVal('in-origen'),
        estreno: getVal('in-estreno'),
        dia_emision: getVal('in-dia'),
        portada: getVal('in-portada'),
        banner: getVal('in-banner'),
        generos: Array.from(document.querySelectorAll('#generos-container input:checked')).map(cb => cb.value),
        propiedades_extra: typeof recolectarCamposExtras === 'function' ? recolectarCamposExtras() : {},
        temporadas: typeof recolectarDatosTemporadas === 'function' ? recolectarDatosTemporadas() : []
    };
}

// 2. GENERAR XML
function generarXML(datos) {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<serie>\n`;
    for (const key in datos) {
        let valor = (typeof datos[key] === 'object') ? JSON.stringify(datos[key]) : datos[key];
        xml += `  <${key}><![CDATA[${valor}]]></${key}>\n`;
    }
    xml += `</serie>`;
    return xml;
}

// 3. EXPORTAR (A veces falla en Telegram)
function exportarSerieXML() {
    try {
        const datos = recolectarDatosCompletos();
        const blob = new Blob([generarXML(datos)], { type: 'application/xml' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${datos.titulo.replace(/\s+/g, '_').toLowerCase()}.xml`;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => { document.body.removeChild(link); window.URL.revokeObjectURL(url); }, 100);
    } catch (e) { alert("Error al exportar."); }
}

// 4. COPIAR
async function copiarXMLAlPortapapeles() {
    try {
        const xml = generarXML(recolectarDatosCompletos());
        await navigator.clipboard.writeText(xml);
        alert("✅ Copiado al portapapeles.");
        if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    } catch (e) { alert("Error al copiar."); }
}

// 5. NUEVA FUNCIÓN: PEGAR DESDE PORTAPAPELES
async function pegarXMLDesdePortapapeles() {
    try {
        const texto = await navigator.clipboard.readText();
        if (!texto.includes('<serie>')) throw new Error();
        procesarXML(texto);
        if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
    } catch (e) {
        alert("❌ El portapapeles no contiene un XML válido.");
    }
}

// 6. IMPORTAR DESDE ARCHIVO
function importarSerieXML(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        procesarXML(e.target.result);
        event.target.value = ''; 
    };
    reader.readAsText(file);
}

// 7. MOTOR DE PROCESAMIENTO (El cerebro que llena los campos)
function procesarXML(xmlTexto) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlTexto, "text/xml");
        const getXml = (tag) => xmlDoc.getElementsByTagName(tag)[0]?.textContent || "";
        const setVal = (id, val) => { if(document.getElementById(id)) document.getElementById(id).value = val; };

        // Llenar campos simples
        setVal('in-titulo', getXml("titulo"));
        setVal('in-japones', getXml("japones"));
        setVal('in-ingles', getXml("ingles"));
        setVal('in-sinopsis', getXml("sinopsis"));
        setVal('edit-telegram-creador', getXml("creador_link"));
        setVal('in-estado', getXml("estado"));
        setVal('in-tipo', getXml("tipo"));
        setVal('in-estudio', getXml("estudio"));
        setVal('in-autor', getXml("autor"));
        setVal('in-origen', getXml("origen"));
        setVal('in-estreno', getXml("estreno"));
        setVal('in-dia', getXml("dia_emision"));
        setVal('in-portada', getXml("portada"));
        setVal('in-banner', getXml("banner"));

        // Géneros
        const genArr = getXml("generos").split(',');
        document.querySelectorAll('#generos-container input').forEach(cb => cb.checked = genArr.includes(cb.value));

        // Props Extra y Temporadas (JSON)
        try {
            const props = JSON.parse(getXml("propiedades_extra"));
            if (window.cargarInfoAdicional) cargarInfoAdicional(props);
            
            const temps = JSON.parse(getXml("temporadas"));
            if (window.cargarDatosTemporadas) cargarDatosTemporadas(temps);
        } catch(e) { console.warn("Campos JSON vacíos"); }

        alert("✅ Datos cargados correctamente.");
    } catch (error) {
        alert("❌ Error al procesar el código XML.");
    }
}

// === FUNCIONES DEL BANNER ===
function cargarBanner() {
    function esDiaDeEmision(diaEmisionDB) {
        if (!diaEmisionDB) return false;
        
        const diaActualJS = new Date().getDay();
        const diaDB = diaEmisionDB.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        switch(diaActualJS) {
            case 0: return diaDB.includes("domingo");
            case 1: return diaDB.includes("lunes");
            case 2: return diaDB.includes("martes");
            case 3: return diaDB.includes("miercoles");
            case 4: return diaDB.includes("jueves");
            case 5: return diaDB.includes("viernes");
            case 6: return diaDB.includes("sabado");
            default: return false;
        }
    }

    // AHORA USAMOS: todasLasObras
    animesEnEmision = todasLasObras.filter(obra => {
        return obra.estado === "En emisión" && esDiaDeEmision(obra.dia_emision);
    });
    
    const contenedor = document.getElementById('contenedor-banner');
    const slidesContainer = document.getElementById('slides-banner');
    
    // Prevención de errores si no existe el contenedor
    if (!contenedor || !slidesContainer) return; 
    
    slidesContainer.innerHTML = ''; 

    if (animesEnEmision.length === 0) {
        contenedor.style.display = 'none';
        return;
    }

    contenedor.style.display = 'block';

    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const diaActualTexto = diasSemana[new Date().getDay()];
    
    const svgCalendario = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px; vertical-align: middle; position: relative; top: -1px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><circle cx="8" cy="12" r="1.5" fill="currentColor" stroke="none"></circle><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"></circle><circle cx="16" cy="12" r="1.5" fill="currentColor" stroke="none"></circle><circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none"></circle><circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none"></circle></svg>`;

    animesEnEmision.forEach((obra, index) => {
        
        // 👉 REEMPLAZA EL let imgUrl ORIGINAL POR ESTO:
        let imgBase = obra.banner_url ? obra.banner_url : (obra.portada_url ? obra.portada_url : '');
        let imgUrl = obtenerImagenInteligente(imgBase, { anchoMovil: 600 });
        
        const tituloSeguro = String(obra.titulo || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        
        // Creamos un identificador limpio para usar en la URL (reemplaza espacios por guiones bajos y pasa a minúsculas)
        const animeParametro = crearSlug(obra.titulo);

        const div = document.createElement('div');
        div.className = `slide ${index === 0 ? 'activo' : ''}`;
        
        // El onclick intercepta el clic para que la app SPA reaccione de inmediato sin recargar toda la página
        div.onclick = (e) => {
            e.preventDefault(); // Evita que el navegador intente seguir el enlace de forma tradicional
            abrirDetalle(tituloSeguro); 
        };
        
        // Envolvemos la imagen en un tag <a> apuntando al parámetro para que Google lo indexe individualmente
        div.innerHTML = `
            <a href="?startapp=${animeParametro}" style="display: block; width: 100%; height: 100%; text-decoration: none; color: inherit;">
                <img src="${imgUrl}" alt="${tituloSeguro}" loading="lazy">
                <div class="slide-info">
                    <div class="slide-dia-emision">
                        ${svgCalendario}Hoy: ${diaActualTexto}
                    </div>
                    <h3 class="slide-titulo">${obra.titulo}</h3>
                </div>
            </a>
        `;
        slidesContainer.appendChild(div);
    });

    bannerIndexActual = 0;
    iniciarAutoBanner();
}

function cambiarBanner(direccion) {
    if (animesEnEmision.length <= 1) return;
    
    const slides = document.querySelectorAll('.slide');
    if(slides.length === 0) return;

    slides[bannerIndexActual].classList.remove('activo');
    bannerIndexActual = (bannerIndexActual + direccion + slides.length) % slides.length;
    slides[bannerIndexActual].classList.add('activo');
    
    reiniciarAutoBanner();
}

function iniciarAutoBanner() {
    if (animesEnEmision.length > 1) {
        bannerTimer = setInterval(() => cambiarBanner(1), 8000); 
    }
}

function reiniciarAutoBanner() {
    clearInterval(bannerTimer);
    iniciarAutoBanner();
}
// === FIN FUNCIONES DEL BANNER ===

window.addEventListener('popstate', (event) => {
    if (event.state && event.state.vista) cambiarVista(event.state.vista, false);
    else cambiarVista('catalogo', false);
});

