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
    return texto.toLowerCase()
        .replace(/[^a-z0-9]+/g, '_') // Cambia todo lo que no sea letra o número por _
        .replace(/^_+|_+$/g, '');    // Quita guiones bajos del inicio o final
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

    // --- DETECTOR MULTIPLATAFORMA (Slugs / Nombres) ---
    const urlParams = new URLSearchParams(window.location.search);
    const webId = urlParams.get('id'); 
    const tgId = tg.initDataUnsafe?.start_param; 

    const loQueBuscamos = tgId || webId;

    if (loQueBuscamos) {
        setTimeout(() => {
            // Buscamos en la lista si coincide el ID o el nombre limpio (slug)
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
        return `
        <div class="tarjeta-anime" onclick="abrirDetalle('${tituloSeguro}')">
            <div class="tipo-tag">${obra.tipo || 'Anime'}</div>
            <img src="${obra.portada_url}" alt="${tituloSeguro}">
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
        btn.innerHTML = '<i class="fa-solid fa-heart" style="color:#ff4757;"></i> Quitar de favoritos';
    } else {
        btn.classList.remove('favorito-activo');
        btn.innerHTML = '<i class="fa-regular fa-heart"></i> Agregar a favoritos';
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
    const imgBanner = document.getElementById('det-banner');
    if(imgBanner) imgBanner.src = obraActual.banner_url || obraActual.portada_url || '';
    
    const imgPort = document.getElementById('det-portada');
    if(imgPort) {
        imgPort.src = obraActual.portada_url || '';
        imgPort.style.opacity = 1;
        imgPort.onclick = (e) => { e.preventDefault(); e.stopPropagation(); verImagenGrande(imgPort.src); };
    }
    
    setContent('det-titulo', obraActual.titulo || 'Sin título');
    
    let nombresAlt = [];
    if(obraActual.nombres_alternativos?.Japonés) nombresAlt.push(obraActual.nombres_alternativos.Japonés);
    if(obraActual.nombres_alternativos?.Ingles) nombresAlt.push(obraActual.nombres_alternativos.Ingles);
    setContent('det-nombres-alt', nombresAlt.join(' • '));

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
        const titulo = document.createElement('h4');
        titulo.style.cssText = "margin-top: 15px; margin-bottom: 10px; color: #3ba4fa; font-size: 14px;";
        titulo.textContent = secName;
        contenedor.appendChild(titulo);
        
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
            setTimeout(() => { imgPortada.src = temporadaObj.imagen; imgPortada.style.opacity = 1; }, 150);
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
    const inputsId = ['in-titulo', 'in-portada', 'in-banner', 'in-estado', 'in-tipo', 'in-sinopsis', 'in-autor', 'in-estudio', 'in-origen', 'in-estreno', 'in-dia', 'in-japones', 'in-ingles'];
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

    agregarPropiedadUI();
    cambiarVista('registro');
}

// Para EDITAR un anime existente (Valida si eres Dueño o Colaborador)
function prepararEdicionDesdeDetalle() {
    if (!obraActual) return;
    idAnimeEnEdicion = obraActual.id; 
    document.getElementById('btn-publicar').textContent = "Guardar Cambios";

    // 1. Validar Permisos
    const esPropietario = (String(obraActual.creador_id) === String(userIdActual)) || (String(userIdActual) === ADMIN_ID);

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

    // 3. Aplicar Bloqueos si es Colaborador
    const camposPrivados = ['in-titulo', 'in-portada', 'in-banner', 'in-estado', 'in-tipo', 'in-sinopsis', 'in-autor', 'in-estudio', 'in-origen', 'in-estreno', 'in-dia', 'in-japones', 'in-ingles'];
    
    camposPrivados.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.disabled = !esPropietario;
            if(!esPropietario) input.classList.add('campo-bloqueado'); else input.classList.remove('campo-bloqueado');
        }
    });

    document.querySelectorAll('#generos-container input').forEach(cb => {
        cb.disabled = !esPropietario;
        if(!esPropietario && cb.parentElement) cb.parentElement.classList.add('campo-bloqueado');
        else if (cb.parentElement) cb.parentElement.classList.remove('campo-bloqueado');
    });

    const btnAddProp = document.getElementById('btn-add-prop');
    const extraPropsContainer = document.getElementById('extra-props-container');
    if (!esPropietario) {
        if (btnAddProp) btnAddProp.style.display = 'none';
        if (extraPropsContainer) extraPropsContainer.classList.add('campo-bloqueado');
    } else {
        if (btnAddProp) btnAddProp.style.display = 'block';
        if (extraPropsContainer) extraPropsContainer.classList.remove('campo-bloqueado');
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

    // Lógica de validación
    const esPropietario = idAnimeEnEdicion ? ((String(obraActual.creador_id) === String(userIdActual)) || (String(userIdActual) === ADMIN_ID)) : true;

    if (esPropietario && (!inTitulo.value.trim() || !inPortada.value.trim())) {
        if(tg?.HapticFeedback?.notificationOccurred) tg.HapticFeedback.notificationOccurred('error');
        return alert("⚠️ Título y Portada son obligatorios.");
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Procesando...`;

    try {
        let datosObra = {};
        
        // Si eres el dueño (o estás creando algo nuevo), actualizas todo.
        if (esPropietario) {
            const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value.trim() : '';
            datosObra = {
                titulo: sanitizar(getVal('in-titulo')),
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
                temporadas: recolectarDatosTemporadas(), // Recoge todo
                propiedades_extra: recolectarCamposExtras()
            };

            if (!idAnimeEnEdicion) {
                datosObra.creador_id = userIdActual; // Al crear, se registra como dueño
            }
        } else {
            // SI ERES COLABORADOR: SOLO se actualiza el array de temporadas.
            // recolectarDatosTemporadas() recogerá también los inputs bloqueados (los del dueño) y los tuyos nuevos.
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
function agregarSeccionUI(nombreSeccion = '', temporadasArray = null, creadorId = null) {
    const container = document.getElementById('builder-temporadas');
    if(!container) return;
    
    const secBlock = document.createElement('div');
    secBlock.className = 'seccion-block';
    secBlock.style.cssText = "border: 1px solid #3ba4fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; background: #0f0f11;";

    // Definir quién es el creador de esta sección para el bloqueo
    const resolvedCreador = (creadorId !== null && creadorId !== undefined && creadorId !== '') 
        ? String(creadorId) 
        : String(userIdActual); // Si es nueva, el creador es el que la está agregando ahora mismo.
        
    secBlock.dataset.creador = resolvedCreador;

    // Verificamos si el usuario actual tiene permiso de editar ESTA sección específica
    const puedeEditarEstaSeccion = (resolvedCreador === String(userIdActual)) || (String(userIdActual) === ADMIN_ID);

    secBlock.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; gap: 10px; border-bottom: 1px solid #27272a; padding-bottom: 10px;">
            <input type="text" class="sec-nombre" placeholder="Nombre de tu Página o Grupo" value="${nombreSeccion}" style="flex: 1; padding: 10px; border-radius: 6px; border: 1px solid #3ba4fa; background: #18181b; color: white; outline: none; font-weight: bold;">
            <button type="button" class="btn-delete-sec" onclick="this.closest('.seccion-block').remove()" style="background:#ef4444; color:white; border:none; padding: 10px; border-radius: 6px; cursor:pointer;">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
        <div class="lista-temporadas"></div>
        <button type="button" class="btn-add-sub" onclick="agregarSubTemporadaUI(this.previousElementSibling)" style="width: 100%; padding: 10px; background: #18181b; color: #3ba4fa; border: 1px dashed #3ba4fa; border-radius: 6px; cursor: pointer; margin-top: 10px;">
            <i class="fa-solid fa-plus"></i> Añadir Nueva Temporada
        </button>
    `;

    container.appendChild(secBlock);

    // Aplicar bloqueo visual si no puede editarla
    if (!puedeEditarEstaSeccion) {
        secBlock.classList.add('campo-bloqueado');
        secBlock.querySelectorAll('input').forEach(inp => inp.disabled = true);
        secBlock.querySelectorAll('button').forEach(btn => btn.style.display = 'none');
    }

    const listaTemps = secBlock.querySelector('.lista-temporadas');

    if (temporadasArray && Array.isArray(temporadasArray)) {
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
        const creadorId = secBlock.dataset.creador || ''; // Toma el creador guardado en el DOM

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
                datos.push({ seccion: nombreSeccion, nombre, imagen, enlaces, creador_id: creadorId });
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
        // Tomamos el creador del primer elemento de esa sección
        const sectionCreator = (tempsArray && tempsArray.length > 0 && tempsArray[0].creador_id) ? tempsArray[0].creador_id : (obraActual.creador_id || '');
        agregarSeccionUI(nombreSec, tempsArray, sectionCreator);
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
    const appNickname = "ahub"; // <--- ACTUALIZADO CON TU LINK REAL
    
    // Creamos el nombre limpio para el link (ej: mashle_magic_and_muscles)
    const slug = crearSlug(tituloAnime); 

    // Este es el link que Telegram sí reconoce
    const linkDirecto = `https://t.me/${botUsername}/${appNickname}?startapp=${slug}`;
    const textoMensaje = `¡Mira este anime en AnimeHub! 🍿`;

    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        tg.HapticFeedback.impactOccurred('medium');
        // Abre el menú de compartir de Telegram
        const urlCompartir = `https://t.me/share/url?url=${encodeURIComponent(linkDirecto)}&text=${encodeURIComponent(textoMensaje)}`;
        tg.openTelegramLink(urlCompartir);
    } else {
        // Para PC/Navegador normal
        navigator.clipboard.writeText(linkDirecto).then(() => {
            alert("Enlace copiado: " + linkDirecto);
        });
    }
}

window.addEventListener('popstate', (event) => {
    if (event.state && event.state.vista) cambiarVista(event.state.vista, false);
    else cambiarVista('catalogo', false);
});