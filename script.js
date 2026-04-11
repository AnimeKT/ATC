// 1. Configuración de Supabase
const SUPABASE_URL = "https://urmnngtfoavnmvbwqepq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybW5uZ3Rmb2F2bm12YndxZXBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MTE4NzcsImV4cCI6MjA5MTI4Nzg3N30.HnfoffLftMYWt2ZEkv1YEbG0vqRPWjB5IeQunj2I5cs";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Inicializar Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();

// =========================================
// ESTADO GLOBAL DE LA APP
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
// INICIALIZACIÓN (A PRUEBA DE MÓVILES)
// =========================================
async function inicializarApp() {
    // 1. Cargamos las obras INMEDIATAMENTE para que el móvil no se quede en blanco
    await cargarObras(); 

    // 2. Cargamos los favoritos en segundo plano sin detener la aplicación
    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
        tg.CloudStorage.getItem('vistos_anime', (err, value) => {
            if (!err && value) {
                try { listaFavoritos = JSON.parse(value); } 
                catch (e) { listaFavoritos = []; }
            }
        });
    }
}

// =========================================
// GESTIÓN DE VISTAS (Pestañas y Scroll)
// =========================================
function cambiarVista(vista) {
    const vistaCatalogo = document.getElementById('vista-catalogo');
    const vistaRegistro = document.getElementById('vista-registro');
    const vistaDetalle = document.getElementById('vista-detalle');
    const barraBusqueda = document.getElementById('barra-busqueda');

    if (vistaCatalogo.style.display !== 'none') {
        posicionScrollGuardada = window.scrollY;
    }

    vistaCatalogo.style.display = 'none';
    vistaRegistro.style.display = 'none';
    vistaDetalle.style.display = 'none';
    barraBusqueda.style.display = 'none';

    if (vista === 'registro') {
        vistaRegistro.style.display = 'block';
        window.scrollTo(0, 0);
    } else if (vista === 'detalle') {
        vistaDetalle.style.display = 'block';
        window.scrollTo(0, 0);
    } else {
        vistaCatalogo.style.display = 'block';
        barraBusqueda.style.display = 'block';
        setTimeout(() => window.scrollTo(0, posicionScrollGuardada), 10);
    }
}

function volverAlCatalogo() {
    tg.HapticFeedback.impactOccurred('light');
    cambiarVista('catalogo');
}

// =========================================
// RENDERIZAR VISTA DE DETALLES
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
    cambiarVista('detalle');
}

// =========================================
// JERARQUÍA DINÁMICA (Temporadas -> Idiomas -> Caps)
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
// FILTROS, BUSCADOR Y RENDERIZADO CATÁLOGO
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

        return textoMatch && estadoMatch;
    });

    renderizarObras(resultado);
}

document.getElementById('buscador').addEventListener('input', (e) => {
    clearTimeout(timeoutBusqueda);
    timeoutBusqueda = setTimeout(() => {
        filtrosActuales.texto = e.target.value.toLowerCase();
        aplicarTodosLosFiltros();
    }, 300);
});

function filtrar(estado, evento) {
    tg.HapticFeedback.impactOccurred('light');
    document.querySelectorAll('.btn-filtro').forEach(btn => btn.classList.remove('active'));
    if(evento) evento.currentTarget.classList.add('active');

    filtrosActuales.estado = estado;
    aplicarTodosLosFiltros();
}

function renderizarObras(obras) {
    const grid = document.getElementById('grid-animes');
    if (!grid) return;

    if (obras.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #a1a1aa;">No se encontraron resultados</div>';
        return;
    }

    // --- ESTA ES LA CLAVE ---
    // Verificamos si el botón de admin está visible
    const esAdmin = document.getElementById('btn-admin-view').style.display !== 'none';

    grid.innerHTML = obras.map(obra => {
        const tituloSeguro = obra.titulo.replace(/'/g, "\\'");
        const estadoTexto = obra.estado || 'Desconocido';
        const claseEstado = 'estado-' + (obra.estado ? obra.estado.toLowerCase().replace(/\s+/g, '-') : 'desconocido');

        // Solo creamos el HTML del botón si esAdmin es true
        const botonEditar = esAdmin ? `
            <button onclick="event.stopPropagation(); abrirEditorParaEditar('${obra.id}')" class="btn-editar">
                <i class="fa-solid fa-pen"></i>
            </button>` : '';

        return `
            <div class="tarjeta-anime" onclick="abrirDetalle('${tituloSeguro}')">
                <div class="estado-badge ${claseEstado}">${estadoTexto}</div>
                
                ${botonEditar} <img src="${obra.portada_url}" alt="${obra.titulo}">
                <div class="info-tarjeta">
                    <div class="titulo-tarjeta">${obra.titulo}</div>
                </div>
            </div>
        `;
    }).join('');
}

// =========================================
// REGISTRO DE NUEVAS OBRAS
// =========================================

function prepararNuevoRegistro() {
    document.getElementById('btn-publicar').textContent = "Publicar en el Hub";
    
    // Limpiar todos los inputs y textareas
    document.querySelectorAll('#vista-registro input, #vista-registro select, #vista-registro textarea').forEach(i => i.value = '');
    
    // Reiniciar el constructor de temporadas
    cargarDatosTemporadas([]); 
    cambiarVista('registro');
}

async function ejecutarRegistro() {
    const btn = document.getElementById('btn-publicar');
    
    // Recolección de datos básicos
    const titulo = document.getElementById('in-titulo').value.trim();
    const portada = document.getElementById('in-portada').value.trim();

    if (!titulo || !portada) {
        tg.HapticFeedback.notificationOccurred('error');
        return alert("⚠️ Título y Portada son obligatorios.");
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Publicando...`;

    // Recolección de datos (los inputs extra que tenías originalmente o los que agregues luego)
    const sinopsisInput = document.getElementById('in-sinopsis');
    const generosInput = document.getElementById('in-generos');
    const autorInput = document.getElementById('in-autor');
    const estudioInput = document.getElementById('in-estudio');
    const origenInput = document.getElementById('in-origen');
    const estrenoInput = document.getElementById('in-estreno');
    const diaInput = document.getElementById('in-dia');
    const japonesInput = document.getElementById('in-japones');
    const inglesInput = document.getElementById('in-ingles');

    const generosRaw = generosInput ? generosInput.value : '';
    
    const datosObra = {
        titulo: titulo,
        slug: titulo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s-]/g, "").replace(/\s+/g, "-"),
        portada_url: portada,
        banner_url: document.getElementById('in-banner').value.trim(),
        sinopsis: sinopsisInput ? sinopsisInput.value.trim() : '',
        estado: document.getElementById('in-estado').value,
        tipo: document.getElementById('in-tipo').value,
        autor: autorInput ? autorInput.value.trim() : '',
        estudio: estudioInput ? estudioInput.value.trim() : '',
        origen: origenInput ? origenInput.value : '',
        estreno: estrenoInput ? estrenoInput.value.trim() : '',
        dia_emision: diaInput ? diaInput.value : '',
        generos: generosRaw ? generosRaw.split(',').map(g => g.trim()).filter(g => g !== "") : [],
        nombres_alternativos: {
            "Japonés": japonesInput ? japonesInput.value.trim() : '',
            "Ingles": inglesInput ? inglesInput.value.trim() : ''
        },
        temporadas: recolectarDatosTemporadas()
    };

    try {
        const { error } = await _supabase.from('obras').insert([datosObra]);

        if (error) throw error;

        tg.HapticFeedback.notificationOccurred('success');
        alert("✅ Publicado en el Hub");
        
        cargarObras(); // Refrescar catálogo
        cambiarVista('catalogo');
    } catch (err) {
        console.error(err);
        alert("❌ Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Publicar en el Hub";
    }
}

// =========================================
// SISTEMA DE AUTENTICACIÓN
// =========================================
const btnAdminView = document.getElementById('btn-admin-view');
const btnAuth = document.getElementById('btn-auth');
const authMensaje = document.getElementById('auth-mensaje');

_supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
        btnAdminView.style.display = 'flex';
        btnAuth.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> <span class="hide-mobile">Salir</span>';
        btnAuth.onclick = cerrarSesion;
        cerrarModalAuth();
    } else {
        btnAdminView.style.display = 'none';
        btnAuth.innerHTML = '<i class="fa-solid fa-user"></i> <span class="hide-mobile">Ingresar</span>';
        btnAuth.onclick = abrirModalAuth;
        cambiarVista('catalogo');
    }
});

_supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) btnAdminView.style.display = 'flex';
});

function abrirModalAuth() {
    document.getElementById('modal-auth').classList.add('modal-visible');
    authMensaje.textContent = '';
}

function cerrarModalAuth() {
    document.getElementById('modal-auth').classList.remove('modal-visible');
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
    authMensaje.style.color = '#ef4444';
    authMensaje.textContent = msg;
}
function mostrarMensajeAuth(msg, color) {
    authMensaje.style.color = color;
    authMensaje.textContent = msg;
}

// =========================================
// CONSTRUCTOR VISUAL DE TEMPORADAS
// =========================================

function agregarTemporadaUI(datos = null) {
    const container = document.getElementById('builder-temporadas');
    
    const bloque = document.createElement('div');
    bloque.className = 'temporada-block';
    bloque.style.border = "1px solid #27272a";
    bloque.style.padding = "15px";
    bloque.style.borderRadius = "8px";
    bloque.style.marginBottom = "15px";
    bloque.style.background = "#18181b";

    bloque.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 10px;">
            <input type="text" class="temp-nombre" placeholder="Nombre de Sección (Ej: Principal, Extras)" value="${datos ? datos.nombre || datos.seccion || '' : ''}" style="flex: 1; padding: 10px; border-radius: 6px; border: 1px solid #27272a; background: #0f0f11; color: white; outline: none;">
            <button type="button" class="btn-delete-block" onclick="this.closest('.temporada-block').remove()">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
        <input type="text" class="temp-img" placeholder="URL de Imagen para esta sección (Opcional)" value="${datos && datos.imagen ? datos.imagen : ''}" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #27272a; background: #0f0f11; color: white; outline: none; margin-bottom: 15px;">
        
        <div class="idiomas-container">
            <h4 style="color: #a1a1aa; margin-bottom: 10px; font-size: 14px;"><i class="fa-solid fa-language"></i> Idiomas Disponibles</h4>
            <div class="lista-idiomas" style="display: flex; flex-direction: column; gap: 10px;"></div>
            <button type="button" class="btn-filtro" onclick="agregarIdiomaUI(this.closest('.temporada-block').querySelector('.lista-idiomas'))" style="margin-top: 10px; padding: 8px 15px; font-size: 13px;">
                <i class="fa-solid fa-plus"></i> Añadir Idioma
            </button>
        </div>
    `;

    container.appendChild(bloque);

    const listaIdiomas = bloque.querySelector('.lista-idiomas');

    if (datos && datos.enlaces && Object.keys(datos.enlaces).length > 0) {
        Object.entries(datos.enlaces).forEach(([idioma, capitulos]) => {
            agregarIdiomaUI(listaIdiomas, idioma, capitulos);
        });
    } else {
        agregarIdiomaUI(listaIdiomas);
    }
}

function agregarIdiomaUI(containerLista, nombreIdioma = '', capitulos = null) {
    const divIdioma = document.createElement('div');
    divIdioma.className = 'idioma-bloque';
    divIdioma.style.padding = "10px";
    divIdioma.style.background = "#0c0c0f";
    divIdioma.style.border = "1px solid #27272a";
    divIdioma.style.borderRadius = "6px";

    divIdioma.innerHTML = `
        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <input type="text" class="idioma-nombre" placeholder="Ej: Sub Español, Latino, Castellano" value="${nombreIdioma}" style="flex: 1; padding: 8px; border-radius: 6px; border: 1px solid #27272a; background: #18181b; color: white; outline: none;">
            <button type="button" onclick="this.closest('.idioma-bloque').remove()" style="background: transparent; color: #ef4444; border: 1px solid #ef4444; border-radius: 6px; padding: 8px 12px; cursor: pointer;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="lista-capitulos" style="display: flex; flex-direction: column; gap: 5px; margin-left: 10px; border-left: 2px solid #27272a; padding-left: 10px;"></div>
        <button type="button" onclick="agregarCapituloUI(this.closest('.idioma-bloque').querySelector('.lista-capitulos'))" style="margin-top: 10px; margin-left: 10px; padding: 6px 12px; background: transparent; border: 1px dashed #3ba4fa; color: #3ba4fa; border-radius: 6px; cursor: pointer; font-size: 12px;">
            + Añadir Capítulo
        </button>
    `;

    containerLista.appendChild(divIdioma);
    
    const listaCaps = divIdioma.querySelector('.lista-capitulos');

    if (capitulos && Object.keys(capitulos).length > 0) {
        Object.entries(capitulos).forEach(([capNombre, capUrl]) => {
            agregarCapituloUI(listaCaps, capNombre, capUrl);
        });
    } else {
        agregarCapituloUI(listaCaps);
    }
}

function agregarCapituloUI(containerCaps, capNombre = '', capUrl = '') {
    const divCap = document.createElement('div');
    divCap.className = 'capitulo-row';
    divCap.style.display = "flex";
    divCap.style.gap = "8px";

    divCap.innerHTML = `
        <input type="text" class="cap-nombre" placeholder="N° / Nombre" value="${capNombre}" style="width: 35%; padding: 8px; border-radius: 6px; border: 1px solid #27272a; background: #18181b; color: white; font-size: 13px; outline: none;">
        <input type="text" class="cap-url" placeholder="Enlace (https://...)" value="${capUrl}" style="flex: 1; padding: 8px; border-radius: 6px; border: 1px solid #27272a; background: #18181b; color: white; font-size: 13px; outline: none;">
        <button type="button" onclick="this.closest('.capitulo-row').remove()" style="background: transparent; color: #a1a1aa; border: none; cursor: pointer; padding: 0 5px;"><i class="fa-solid fa-trash"></i></button>
    `;
    
    containerCaps.appendChild(divCap);
}

function recolectarDatosTemporadas() {
    const datos = [];
    document.querySelectorAll('.temporada-block').forEach(tempBlock => {
        const nombre = tempBlock.querySelector('.temp-nombre').value.trim();
        const imagen = tempBlock.querySelector('.temp-img').value.trim(); 

        if (!nombre) return; 

        const enlaces = {};
        tempBlock.querySelectorAll('.idioma-bloque').forEach(idiomaBlock => {
            const idiomaNombre = idiomaBlock.querySelector('.idioma-nombre').value.trim();
            if (!idiomaNombre) return;

            enlaces[idiomaNombre] = {};
            idiomaBlock.querySelectorAll('.capitulo-row').forEach(capRow => {
                const capNombre = capRow.querySelector('.cap-nombre').value.trim();
                const capUrl = capRow.querySelector('.cap-url').value.trim();
                
                if (capNombre && capUrl) {
                    enlaces[idiomaNombre][capNombre] = capUrl;
                }
            });
        });

        datos.push({ nombre, imagen, enlaces });
    });
    return datos;
}

function cargarDatosTemporadas(temporadas) {
    document.getElementById('builder-temporadas').innerHTML = ''; 
    if (!temporadas || temporadas.length === 0) {
        agregarTemporadaUI(); 
        return;
    }
    temporadas.forEach(temp => agregarTemporadaUI(temp));
}

function abrirEditorParaEditar(id) {
    // 1. Guardamos el ID para saber que estamos editando
    idAnimeEnEdicion = id;

    // 2. Buscamos los datos del anime (asumiendo que tienes un array 'listaAnimes')
    const anime = listaAnimes.find(a => a.id === id); 

    if (!anime) return;

    // 3. Llenamos los campos del formulario con los datos existentes
    // NOTA: Asegúrate de que los selectores (ej. '#titulo') coincidan con los IDs de tus inputs
    document.getElementById('titulo').value = anime.titulo;
    document.getElementById('estado').value = anime.estado;
    document.getElementById('tipo').value = anime.tipo;
    document.getElementById('url-portada').value = anime.urlPortada;
    document.getElementById('url-banner').value = anime.urlBanner;

    // (Aquí también deberías cargar las temporadas, limpiando primero el contenedor y luego usando tu función agregarTemporadaUI con los datos)

    // 4. Cambiamos el texto del botón azul para que sea intuitivo
    const btnPublicar = document.querySelector('.btn-publicar-hub'); // Cambia por tu clase/id real
    btnPublicar.innerText = "Guardar Cambios";

    // 5. Abrimos el modal/sección del editor
    abrirEditor(); // Llama a la función que ya usas para abrir esa pantalla
}

async function guardarAnime() {
    // Recolectas los datos del formulario
    const datosAnime = {
        titulo: document.getElementById('titulo').value,
        estado: document.getElementById('estado').value,
        tipo: document.getElementById('tipo').value,
        urlPortada: document.getElementById('url-portada').value,
        urlBanner: document.getElementById('url-banner').value,
        // ... recolección de temporadas ...
    };

    if (idAnimeEnEdicion) {
        // MODO EDICIÓN: Actualizamos en Supabase
        const { data, error } = await supabase
            .from('animes') // Cambia 'animes' por el nombre real de tu tabla
            .update(datosAnime)
            .eq('id', idAnimeEnEdicion);

        if (!error) {
            console.log("Anime actualizado con éxito");
        }
    } else {
        // MODO CREACIÓN: Insertamos nuevo en Supabase
        const { data, error } = await supabase
            .from('animes')
            .insert([datosAnime]);
            
        if (!error) {
            console.log("Nuevo anime publicado");
        }
    }

    // Al terminar de guardar o editar, reiniciamos todo:
    idAnimeEnEdicion = null;
    document.querySelector('.btn-publicar-hub').innerText = "Publicar en el Hub";
    // Limpiar formulario y recargar la lista de animes...
}

// Arrancar al cargar la página
document.addEventListener('DOMContentLoaded', inicializarApp);