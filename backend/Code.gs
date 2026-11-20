/**
 * DECISÕES DA IGREJA — backend em Google Apps Script
 * Banco de dados: a própria planilha do Google à qual este script está vinculado.
 *
 * Passos: veja o README.md. Resumo:
 *  1) Ajuste o objeto CONFIG abaixo.
 *  2) Execute a função setup() uma vez (cria abas, perguntas, unidade inicial e o administrador).
 *  3) Implantar > Nova implantação > App da Web (executar como: você; acesso: qualquer pessoa).
 */

const CONFIG = {
  ADMIN_NOME: 'Administrador',
  ADMIN_EMAIL: 'admin@suaigreja.org',
  ADMIN_SENHA_TEMPORARIA: 'Trocar@2026', // será trocada no primeiro login
  UNIDADE_INICIAL: 'Sede',
  APP_URL: '', // endereço onde o app React ficará publicado (usado no e-mail de boas-vindas)
  SESSAO_DIAS: 7,
  HASH_ITERACOES: 500,
  MAX_ARQUIVO_MB: 10,
  PASTA_PRESTACOES: 'Decisoes Igreja - Prestacoes de Contas'
};

const SHEETS = {
  Unidades: ['id', 'nome', 'emailResponsavel'],
  Usuarios: ['id', 'nome', 'email', 'senhaHash', 'salt', 'unidadeId', 'papel', 'permissoes', 'ativo', 'primeiroAcesso', 'perfil', 'config', 'criadoEm'],
  Sessoes: ['tokenHash', 'userId', 'expira'],
  Recuperacoes: ['userId', 'codigoHash', 'salt', 'expira', 'tentativas'],
  Perguntas: ['id', 'texto', 'tipo', 'opcoes', 'obrigatoria', 'ordem'],
  Pautas: ['id', 'titulo', 'descricao', 'opcoes', 'unidadeId', 'status', 'criadaPor', 'criadaEm', 'data', 'encerradaEm'],
  Votos: ['id', 'pautaId', 'userId', 'opcao', 'data'],
  Prestacoes: ['id', 'unidadeId', 'mes', 'nomeArquivo', 'arquivoId', 'mimeType', 'observacao', 'enviadoPor', 'enviadoEm'],
  Comentarios: ['id', 'prestacaoId', 'userId', 'texto', 'data']
};

const PERMS = ['votar', 'criar_pauta', 'comentar', 'enviar_prestacao', 'gerenciar_usuarios'];
// Permissões que um responsável de unidade pode conceder/retirar de membros:
const PERMS_CONCEDIVEIS = ['votar', 'criar_pauta', 'comentar', 'enviar_prestacao'];
const PAPEIS = ['admin', 'responsavel', 'membro'];
const FIRST_ACCESS = ['me', 'logout', 'unidades', 'perguntas', 'completarCadastro'];
const MIMES_OK = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg'
};

class ApiError extends Error {
  constructor(msg, codigo) {
    super(msg);
    this.name = 'ApiError';
    this.codigo = codigo || 'ERRO';
  }
}

/* ============================ ENTRADA HTTP ============================ */

function doGet() {
  return out_({ ok: true, dados: 'API Decisões da Igreja ativa.' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    const p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const a = String(p.action || '');
    let resultado;
    if (a === 'login') {
      resultado = login_(p);
    } else if (a === 'solicitarRecuperacao') {
      resultado = solicitarRecuperacao_(p);
    } else if (a === 'redefinirComCodigo') {
      resultado = redefinirComCodigo_(p);
    } else {
      const u = auth_(p.token);
      if (u.primeiroAcesso && FIRST_ACCESS.indexOf(a) < 0) {
        throw new ApiError('Conclua o primeiro acesso para continuar.', 'PRIMEIRO_ACESSO');
      }
      const fn = HANDLERS[a];
      if (!fn) throw new ApiError('Ação desconhecida.', 'ACAO');
      resultado = fn(p, u);
    }
    return out_({ ok: true, dados: resultado });
  } catch (err) {
    if (err instanceof ApiError) return out_({ ok: false, erro: err.message, codigo: err.codigo });
    console.error((err && err.stack) || err);
    return out_({ ok: false, erro: 'Erro interno. Tente novamente em instantes.', codigo: 'INTERNO' });
  } finally {
    try { lock.releaseLock(); } catch (e2) { /* ignora */ }
  }
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

const HANDLERS = {
  me: me_,
  logout: logout_,
  unidades: unidades_,
  perguntas: perguntas_,
  completarCadastro: completarCadastro_,
  atualizarPerfil: atualizarPerfil_,
  trocarSenha: trocarSenha_,
  listarPautas: listarPautas_,
  criarPauta: criarPauta_,
  votar: votar_,
  encerrarPauta: encerrarPauta_,
  removerPauta: removerPauta_,
  listarUsuarios: listarUsuarios_,
  criarUsuario: criarUsuario_,
  atualizarUsuario: atualizarUsuario_,
  removerUsuario: removerUsuario_,
  resetarSenha: resetarSenha_,
  criarUnidade: criarUnidade_,
  atualizarUnidade: atualizarUnidade_,
  removerUnidade: removerUnidade_,
  listarPrestacoes: listarPrestacoes_,
  enviarPrestacao: enviarPrestacao_,
  baixarPrestacao: baixarPrestacao_,
  comentar: comentar_,
  removerComentario: removerComentario_
};

/* ============================ INSTALAÇÃO ============================ */

function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(SHEETS).forEach(function (nome) {
    let s = ss.getSheetByName(nome);
    if (!s) s = ss.insertSheet(nome);
    const cols = SHEETS[nome];
    s.getRange(1, 1, s.getMaxRows(), cols.length).setNumberFormat('@'); // tudo como texto
    s.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#e8eef7');
    s.setFrozenRows(1);
  });
  ss.getSheets().forEach(function (s) {
    if (!SHEETS[s.getName()] && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });

  if (readAll_('Perguntas').length === 0) {
    [
      ['telefone', 'Telefone / WhatsApp', 'texto', [], true, 1],
      ['nascimento', 'Data de nascimento', 'data', [], true, 2],
      ['tempo', 'Há quanto tempo você frequenta a igreja?', 'select', ['Menos de 1 ano', '1 a 5 anos', 'Mais de 5 anos'], true, 3],
      ['ministerio', 'Participa de algum ministério ou grupo? Qual?', 'texto', [], false, 4],
      ['contato', 'Como prefere ser contatado?', 'select', ['WhatsApp', 'Ligação', 'E-mail'], true, 5]
    ].forEach(function (q) {
      appendRow_('Perguntas', { id: q[0], texto: q[1], tipo: q[2], opcoes: JSON.stringify(q[3]), obrigatoria: q[4], ordem: q[5] });
    });
  }

  let unidades = readAll_('Unidades');
  if (unidades.length === 0) {
    appendRow_('Unidades', { id: uid_(), nome: CONFIG.UNIDADE_INICIAL });
    unidades = readAll_('Unidades');
  }

  if (readAll_('Usuarios').length === 0) {
    const salt = uid_();
    appendRow_('Usuarios', {
      id: uid_(),
      nome: CONFIG.ADMIN_NOME,
      email: CONFIG.ADMIN_EMAIL.toLowerCase(),
      senhaHash: hash_(CONFIG.ADMIN_SENHA_TEMPORARIA, salt),
      salt: salt,
      unidadeId: unidades[0].id,
      papel: 'admin',
      permissoes: PERMS.join(','),
      ativo: true,
      primeiroAcesso: true,
      perfil: '{}',
      config: '{}',
      criadoEm: now_()
    });
  }
  Logger.log('Setup concluído. Login inicial: ' + CONFIG.ADMIN_EMAIL + ' / ' + CONFIG.ADMIN_SENHA_TEMPORARIA);
}

/* ============================ UTILITÁRIOS ============================ */

function tz_() { return Session.getScriptTimeZone() || 'America/Sao_Paulo'; }
function now_() { return Utilities.formatDate(new Date(), tz_(), "yyyy-MM-dd'T'HH:mm:ss"); }
function today_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'); }
function uid_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 12); }
function bool_(v) { return v === true || String(v).toLowerCase() === 'true' || String(v) === '1'; }
function jsonParse_(s, fb) { try { return s ? JSON.parse(s) : fb; } catch (e) { return fb; } }

function toHex_(bytes) {
  return bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}
function sha_(txt) {
  return toHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, txt, Utilities.Charset.UTF_8));
}
function hash_(senha, salt) {
  let h = salt + ':' + senha;
  for (let i = 0; i < CONFIG.HASH_ITERACOES; i++) h = sha_(h + ':' + salt);
  return h;
}
function senhaTemp_() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function str_(v, max, rotulo, opcional) {
  const s = String(v === undefined || v === null ? '' : v).trim();
  if (!s && !opcional) throw new ApiError(rotulo + ' é obrigatório.', 'VALIDACAO');
  if (s.length > max) throw new ApiError(rotulo + ' deve ter no máximo ' + max + ' caracteres.', 'VALIDACAO');
  return s;
}
function email_(v) {
  const s = String(v || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new ApiError('E-mail inválido.', 'VALIDACAO');
  return s;
}
function senhaForte_(s) {
  s = String(s || '');
  if (s.length < 8) throw new ApiError('A senha deve ter pelo menos 8 caracteres.', 'SENHA');
  if (!/[A-Za-z]/.test(s) || !/[0-9]/.test(s)) throw new ApiError('A senha deve conter letras e números.', 'SENHA');
}

/* ---- planilha como banco ---- */
function sh_(nome) { return SpreadsheetApp.getActive().getSheetByName(nome); }

function celula_(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function readAll_(nome) {
  const s = sh_(nome);
  if (!s) throw new ApiError('Planilha não configurada. Execute setup().', 'SETUP');
  const v = s.getDataRange().getValues();
  const h = v[0];
  const out = [];
  for (let i = 1; i < v.length; i++) {
    if (v[i].every(function (c) { return c === ''; })) continue;
    const o = { _row: i + 1 };
    for (let j = 0; j < h.length; j++) {
      let c = v[i][j];
      if (c instanceof Date) c = Utilities.formatDate(c, tz_(), "yyyy-MM-dd'T'HH:mm:ss");
      o[h[j]] = c;
    }
    out.push(o);
  }
  return out;
}
function appendRow_(nome, obj) {
  sh_(nome).appendRow(SHEETS[nome].map(function (c) { return celula_(obj[c]); }));
}
function updateRow_(nome, row, patch) {
  const cols = SHEETS[nome];
  const s = sh_(nome);
  const cur = s.getRange(row, 1, 1, cols.length).getValues()[0];
  cols.forEach(function (c, i) { if (patch[c] !== undefined) cur[i] = celula_(patch[c]); });
  s.getRange(row, 1, 1, cols.length).setValues([cur]);
}
function deleteWhere_(nome, fn) {
  readAll_(nome).filter(fn).map(function (r) { return r._row; })
    .sort(function (a, b) { return b - a; })
    .forEach(function (r) { sh_(nome).deleteRow(r); });
}
function porId_(lista) {
  const m = {};
  lista.forEach(function (x) { m[x.id] = x; });
  return m;
}

/* ---- usuários ---- */
function parseUser_(r) {
  return {
    id: r.id, nome: r.nome, email: r.email, senhaHash: r.senhaHash, salt: r.salt,
    unidadeId: r.unidadeId, papel: PAPEIS.indexOf(r.papel) >= 0 ? r.papel : 'membro',
    permissoes: String(r.permissoes || '').split(',').filter(Boolean),
    ativo: bool_(r.ativo), primeiroAcesso: bool_(r.primeiroAcesso),
    perfil: jsonParse_(r.perfil, {}), config: jsonParse_(r.config, {}),
    criadoEm: r.criadoEm, _row: r._row
  };
}
function publicUser_(u, unidades, completo) {
  const un = unidades ? unidades.filter(function (x) { return x.id === u.unidadeId; })[0] : null;
  const o = {
    id: u.id, nome: u.nome, email: u.email, unidadeId: u.unidadeId,
    unidadeNome: un ? un.nome : '', papel: u.papel,
    permissoes: u.papel === 'admin' ? PERMS.slice() : u.permissoes,
    ativo: u.ativo, primeiroAcesso: u.primeiroAcesso, criadoEm: u.criadoEm,
    telefone: (u.perfil && u.perfil.telefone) || ''
  };
  if (completo) { o.perfil = u.perfil; o.config = u.config; }
  return o;
}
function can_(u, perm) { return u.papel === 'admin' || u.permissoes.indexOf(perm) >= 0; }
function exigir_(u, perm) {
  if (!can_(u, perm)) throw new ApiError('Você não tem permissão para esta ação.', 'PERMISSAO');
}
function defaultPerms_(papel) {
  if (papel === 'membro') return ['votar', 'criar_pauta', 'comentar'];
  return PERMS.slice();
}
function permsFiltradas_(ator, lista, papel) {
  const base = Array.isArray(lista) ? lista : defaultPerms_(papel);
  const permitidas = ator.papel === 'admin' ? PERMS : PERMS_CONCEDIVEIS;
  return base.filter(function (p) { return permitidas.indexOf(p) >= 0; });
}
function achaUsuarioPorEmail_(email) {
  const r = readAll_('Usuarios').filter(function (x) { return String(x.email).toLowerCase() === email; })[0];
  return r ? parseUser_(r) : null;
}
function achaUsuario_(id) {
  const r = readAll_('Usuarios').filter(function (x) { return x.id === id; })[0];
  return r ? parseUser_(r) : null;
}
function podeGerenciar_(ator, alvo) {
  if (!can_(ator, 'gerenciar_usuarios')) return false;
  if (ator.id === alvo.id) return false;
  if (ator.papel === 'admin') return true;
  return alvo.papel === 'membro' && alvo.unidadeId === ator.unidadeId;
}

/* ============================ AUTENTICAÇÃO ============================ */

function auth_(token) {
  if (!token) throw new ApiError('Sessão expirada. Entre novamente.', 'SESSAO');
  const h = sha_(String(token));
  const agora = now_();
  const sessao = readAll_('Sessoes').filter(function (s) { return s.tokenHash === h && String(s.expira) > agora; })[0];
  if (!sessao) throw new ApiError('Sessão expirada. Entre novamente.', 'SESSAO');
  const u = achaUsuario_(sessao.userId);
  if (!u || !u.ativo) throw new ApiError('Acesso desativado.', 'SESSAO');
  u._tokenHash = h;
  return u;
}

function login_(p) {
  const email = email_(p.email);
  const cache = CacheService.getScriptCache();
  const chave = 'f_' + sha_(email).slice(0, 20);
  const falhas = Number(cache.get(chave) || 0);
  if (falhas >= 5) throw new ApiError('Muitas tentativas. Aguarde 10 minutos e tente de novo.', 'LIMITE');

  const u = achaUsuarioPorEmail_(email);
  const ok = u && u.ativo && hash_(String(p.senha || ''), u.salt) === u.senhaHash;
  if (!ok) {
    cache.put(chave, String(falhas + 1), 600);
    throw new ApiError('E-mail ou senha incorretos.', 'LOGIN');
  }
  cache.remove(chave);

  // limpa sessões expiradas e cria uma nova
  const agora = now_();
  deleteWhere_('Sessoes', function (s) { return String(s.expira) <= agora; });
  const token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  const exp = Utilities.formatDate(new Date(Date.now() + CONFIG.SESSAO_DIAS * 86400000), tz_(), "yyyy-MM-dd'T'HH:mm:ss");
  appendRow_('Sessoes', { tokenHash: sha_(token), userId: u.id, expira: exp });
  return { token: token, usuario: publicUser_(u, readAll_('Unidades'), true) };
}

function logout_(p, u) {
  deleteWhere_('Sessoes', function (s) { return s.tokenHash === u._tokenHash; });
  return true;
}

function me_(p, u) {
  return { usuario: publicUser_(u, readAll_('Unidades'), true) };
}

/* ============================ PRIMEIRO ACESSO ============================ */

function unidades_(p, u) {
  return readAll_('Unidades').map(function (x) {
    const o = { id: x.id, nome: x.nome };
    // o e-mail do responsável só é visível para quem administra a unidade
    if (u && (u.papel === 'admin' || (u.unidadeId === x.id && can_(u, 'gerenciar_usuarios')))) {
      o.emailResponsavel = x.emailResponsavel || '';
    }
    return o;
  }).sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome)); });
}

function listaPerguntas_() {
  return readAll_('Perguntas')
    .sort(function (a, b) { return Number(a.ordem) - Number(b.ordem); })
    .map(function (q) {
      return { id: q.id, texto: q.texto, tipo: q.tipo || 'texto', opcoes: jsonParse_(q.opcoes, []), obrigatoria: bool_(q.obrigatoria) };
    });
}
function perguntas_() { return listaPerguntas_(); }

function completarCadastro_(p, u) {
  if (!u.primeiroAcesso) throw new ApiError('Cadastro já concluído.', 'JA_CONCLUIDO');
  const unidades = readAll_('Unidades');
  const nomeU = String(p.unidadeNome || '').trim().toLowerCase();
  const un = unidades.filter(function (x) { return String(x.nome).trim().toLowerCase() === nomeU; })[0];
  if (!un) throw new ApiError('Selecione uma unidade da lista.', 'UNIDADE');

  const resp = p.respostas || {};
  const perfil = {};
  listaPerguntas_().forEach(function (q) {
    const v = String(resp[q.id] === undefined || resp[q.id] === null ? '' : resp[q.id]).trim().slice(0, 200);
    if (q.obrigatoria && !v) throw new ApiError('Responda: ' + q.texto, 'FORM');
    if (q.tipo === 'select' && v && q.opcoes.indexOf(v) < 0) throw new ApiError('Resposta inválida em: ' + q.texto, 'FORM');
    perfil[q.id] = v;
  });

  senhaForte_(p.novaSenha);
  if (hash_(String(p.novaSenha), u.salt) === u.senhaHash) {
    throw new ApiError('Escolha uma senha diferente da temporária.', 'SENHA');
  }
  const salt = uid_();
  updateRow_('Usuarios', u._row, {
    unidadeId: un.id, perfil: perfil, senhaHash: hash_(String(p.novaSenha), salt), salt: salt, primeiroAcesso: false
  });
  return { usuario: publicUser_(achaUsuario_(u.id), unidades, true) };
}

/* ============================ CONFIGURAÇÕES PESSOAIS ============================ */

function atualizarPerfil_(p, u) {
  const patch = {};
  if (p.nome !== undefined) patch.nome = str_(p.nome, 80, 'Nome');
  const perfil = u.perfil;
  if (p.telefone !== undefined) perfil.telefone = str_(p.telefone, 30, 'Telefone', true);
  patch.perfil = perfil;
  const config = u.config;
  if (p.tema !== undefined) config.tema = ['auto', 'claro', 'escuro'].indexOf(p.tema) >= 0 ? p.tema : 'auto';
  if (p.fonte !== undefined) config.fonte = ['normal', 'grande'].indexOf(p.fonte) >= 0 ? p.fonte : 'normal';
  patch.config = config;
  updateRow_('Usuarios', u._row, patch);
  return { usuario: publicUser_(achaUsuario_(u.id), readAll_('Unidades'), true) };
}

function trocarSenha_(p, u) {
  if (hash_(String(p.senhaAtual || ''), u.salt) !== u.senhaHash) throw new ApiError('Senha atual incorreta.', 'SENHA');
  senhaForte_(p.novaSenha);
  const salt = uid_();
  updateRow_('Usuarios', u._row, { senhaHash: hash_(String(p.novaSenha), salt), salt: salt });
  // encerra as demais sessões
  deleteWhere_('Sessoes', function (s) { return s.userId === u.id && s.tokenHash !== u._tokenHash; });
  return true;
}

/* ============================ PAUTAS E VOTOS ============================ */

function visivel_(u, pauta) {
  return u.papel === 'admin' || pauta.unidadeId === '*' || pauta.unidadeId === u.unidadeId;
}
function pautaEncerrada_(x, hoje) {
  return x.status === 'encerrada' || (x.data && String(x.data) < hoje);
}

function montarPautas_(u) {
  const hoje = today_();
  const unidades = readAll_('Unidades');
  const mapaU = porId_(unidades);
  const usuarios = readAll_('Usuarios').map(parseUser_);
  const mapaUsr = porId_(usuarios);
  const votos = readAll_('Votos');
  const porPauta = {};
  votos.forEach(function (v) { (porPauta[v.pautaId] = porPauta[v.pautaId] || []).push(v); });

  return readAll_('Pautas').filter(function (x) { return visivel_(u, x); }).map(function (x) {
    const opcoes = jsonParse_(x.opcoes, []);
    const vs = porPauta[x.id] || [];
    const totais = {};
    opcoes.forEach(function (o) { totais[o] = 0; });
    let meuVoto = null;
    vs.forEach(function (v) {
      if (totais[v.opcao] !== undefined) totais[v.opcao]++;
      if (v.userId === u.id) meuVoto = v.opcao;
    });
    const totalVotos = opcoes.reduce(function (s, o) { return s + totais[o]; }, 0);
    const max = Math.max.apply(null, opcoes.map(function (o) { return totais[o]; }).concat([0]));
    const vencedoras = totalVotos > 0 ? opcoes.filter(function (o) { return totais[o] === max; }) : [];
    const encerrada = !!pautaEncerrada_(x, hoje);
    const elegiveis = usuarios.filter(function (m) {
      return m.ativo && !m.primeiroAcesso && can_(m, 'votar') &&
        (m.papel === 'admin' || x.unidadeId === '*' || m.unidadeId === x.unidadeId);
    }).length;
    const criador = mapaUsr[x.criadaPor];
    const manualEnc = x.status === 'encerrada' && x.encerradaEm;
    return {
      id: x.id, titulo: x.titulo, descricao: x.descricao, opcoes: opcoes,
      unidadeId: x.unidadeId,
      unidadeNome: x.unidadeId === '*' ? 'Todas as unidades' : (mapaU[x.unidadeId] ? mapaU[x.unidadeId].nome : ''),
      encerrada: encerrada, prazo: x.data,
      dataDecisao: encerrada ? (manualEnc ? String(x.encerradaEm).slice(0, 10) : x.data) : null,
      criadaEm: x.criadaEm, criadaPor: x.criadaPor, criadaPorNome: criador ? criador.nome : '—',
      totais: totais, totalVotos: totalVotos, elegiveis: elegiveis, meuVoto: meuVoto,
      vencedoras: vencedoras,
      resultado: !encerrada ? 'aberta' : (totalVotos === 0 ? 'sem_votos' : (vencedoras.length > 1 ? 'empate' : 'definida'))
    };
  }).sort(function (a, b) { return String(b.criadaEm).localeCompare(String(a.criadaEm)); });
}

function listarPautas_(p, u) { return montarPautas_(u); }

function criarPauta_(p, u) {
  exigir_(u, 'criar_pauta');
  const titulo = str_(p.titulo, 120, 'Título');
  const descricao = str_(p.descricao, 1000, 'Descrição', true);
  let opcoes = Array.isArray(p.opcoes) ? p.opcoes.map(function (o) { return String(o).trim(); }).filter(Boolean) : [];
  if (opcoes.length === 0) opcoes = ['Sim', 'Não', 'Abstenção'];
  opcoes = opcoes.filter(function (o, i) { return opcoes.indexOf(o) === i; });
  if (opcoes.length < 2 || opcoes.length > 8) throw new ApiError('Informe de 2 a 8 opções diferentes.', 'VALIDACAO');
  opcoes.forEach(function (o) { if (o.length > 60) throw new ApiError('Cada opção deve ter até 60 caracteres.', 'VALIDACAO'); });
  const data = String(p.data || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new ApiError('Informe a data limite da votação.', 'VALIDACAO');
  if (data < today_()) throw new ApiError('A data limite não pode estar no passado.', 'VALIDACAO');

  let unidadeId = u.unidadeId;
  if (u.papel === 'admin' && p.unidadeId) {
    if (p.unidadeId !== '*' && !readAll_('Unidades').some(function (x) { return x.id === p.unidadeId; })) {
      throw new ApiError('Unidade inválida.', 'VALIDACAO');
    }
    unidadeId = p.unidadeId;
  }
  const id = uid_();
  appendRow_('Pautas', {
    id: id, titulo: titulo, descricao: descricao, opcoes: opcoes, unidadeId: unidadeId,
    status: 'aberta', criadaPor: u.id, criadaEm: now_(), data: data, encerradaEm: ''
  });
  return { id: id };
}

function achaPauta_(id, u) {
  const x = readAll_('Pautas').filter(function (r) { return r.id === id; })[0];
  if (!x || !visivel_(u, x)) throw new ApiError('Pauta não encontrada.', 'NAO_ENCONTRADO');
  return x;
}
function podeAdministrarPauta_(u, x) {
  return u.papel === 'admin' || x.criadaPor === u.id ||
    (u.papel === 'responsavel' && x.unidadeId === u.unidadeId);
}

function votar_(p, u) {
  exigir_(u, 'votar');
  const x = achaPauta_(p.pautaId, u);
  if (pautaEncerrada_(x, today_())) throw new ApiError('Esta votação já foi encerrada.', 'ENCERRADA');
  const opcoes = jsonParse_(x.opcoes, []);
  if (opcoes.indexOf(p.opcao) < 0) throw new ApiError('Opção inválida.', 'VALIDACAO');
  const existente = readAll_('Votos').filter(function (v) { return v.pautaId === x.id && v.userId === u.id; })[0];
  if (existente) updateRow_('Votos', existente._row, { opcao: p.opcao, data: now_() });
  else appendRow_('Votos', { id: uid_(), pautaId: x.id, userId: u.id, opcao: p.opcao, data: now_() });
  return true;
}

function encerrarPauta_(p, u) {
  const x = achaPauta_(p.pautaId, u);
  if (!podeAdministrarPauta_(u, x)) throw new ApiError('Você não pode encerrar esta pauta.', 'PERMISSAO');
  updateRow_('Pautas', x._row, { status: 'encerrada', encerradaEm: now_() });
  return true;
}

function removerPauta_(p, u) {
  const x = achaPauta_(p.pautaId, u);
  if (!podeAdministrarPauta_(u, x)) throw new ApiError('Você não pode remover esta pauta.', 'PERMISSAO');
  deleteWhere_('Votos', function (v) { return v.pautaId === x.id; });
  sh_('Pautas').deleteRow(x._row);
  return true;
}

/* ============================ USUÁRIOS E UNIDADES ============================ */

function listarUsuarios_(p, u) {
  exigir_(u, 'gerenciar_usuarios');
  const unidades = readAll_('Unidades');
  return readAll_('Usuarios').map(parseUser_).filter(function (m) {
    return u.papel === 'admin' || m.unidadeId === u.unidadeId;
  }).map(function (m) { return publicUser_(m, unidades, false); })
    .sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome)); });
}

function criarUsuario_(p, u) {
  exigir_(u, 'gerenciar_usuarios');
  const nome = str_(p.nome, 80, 'Nome');
  const email = email_(p.email);
  if (achaUsuarioPorEmail_(email)) throw new ApiError('Já existe um usuário com este e-mail.', 'DUPLICADO');

  let papel = 'membro';
  let unidadeId = u.unidadeId;
  if (u.papel === 'admin') {
    papel = PAPEIS.indexOf(p.papel) >= 0 ? p.papel : 'membro';
    unidadeId = p.unidadeId || '';
    if (unidadeId && !readAll_('Unidades').some(function (x) { return x.id === unidadeId; })) {
      throw new ApiError('Unidade inválida.', 'VALIDACAO');
    }
  }
  const perms = papel === 'admin' ? PERMS.slice() : permsFiltradas_(u, p.permissoes, papel);
  const temp = senhaTemp_();
  const salt = uid_();
  const id = uid_();
  appendRow_('Usuarios', {
    id: id, nome: nome, email: email, senhaHash: hash_(temp, salt), salt: salt, unidadeId: unidadeId,
    papel: papel, permissoes: perms.join(','), ativo: true, primeiroAcesso: true,
    perfil: '{}', config: '{}', criadoEm: now_()
  });
  const emailEnviado = enviarEmailAcesso_(email, nome, temp);
  return { usuario: publicUser_(achaUsuario_(id), readAll_('Unidades'), false), senhaTemporaria: temp, emailEnviado: emailEnviado };
}

function enviarEmail_(para, assunto, corpo) {
  try {
    MailApp.sendEmail(para, assunto, corpo);
    return true;
  } catch (e) {
    console.error('Falha ao enviar e-mail: ' + e);
    return false;
  }
}

function enviarEmailAcesso_(email, nome, temp) {
  return enviarEmail_(email, 'Seu acesso ao app de decisões da igreja',
    'Olá, ' + nome + '!\n\nSeu acesso foi criado.\n' +
    (CONFIG.APP_URL ? 'Endereço: ' + CONFIG.APP_URL + '\n' : '') +
    'E-mail: ' + email + '\nSenha temporária: ' + temp +
    '\n\nNo primeiro acesso você escolherá sua unidade, responderá algumas perguntas e criará uma nova senha.');
}

/* ============================ RECUPERAÇÃO DE SENHA ============================ */

/** E-mail(s) do responsável: o cadastrado na unidade; se não houver, os usuários "responsável" ativos dela. */
function emailsResponsaveis_(unidadeId) {
  const un = readAll_('Unidades').filter(function (x) { return x.id === unidadeId; })[0];
  if (un && un.emailResponsavel) return [String(un.emailResponsavel).toLowerCase()];
  return readAll_('Usuarios').map(parseUser_).filter(function (m) {
    return m.ativo && m.papel === 'responsavel' && m.unidadeId === unidadeId;
  }).map(function (m) { return m.email; });
}

function solicitarRecuperacao_(p) {
  const email = email_(p.email);
  const cache = CacheService.getScriptCache();
  const chave = 'r_' + sha_(email).slice(0, 20);
  const n = Number(cache.get(chave) || 0);
  if (n >= 3) throw new ApiError('Muitas solicitações. Aguarde 1 hora ou peça ao responsável da sua unidade para redefinir sua senha.', 'LIMITE');
  cache.put(chave, String(n + 1), 3600);

  const u = achaUsuarioPorEmail_(email);
  if (u && u.ativo) {
    const codigo = String(100000 + (parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 8), 16) % 900000));
    const salt = uid_();
    const expira = Utilities.formatDate(new Date(Date.now() + 30 * 60000), tz_(), "yyyy-MM-dd'T'HH:mm:ss");
    deleteWhere_('Recuperacoes', function (r) { return r.userId === u.id; });
    appendRow_('Recuperacoes', { userId: u.id, codigoHash: hash_(codigo, salt), salt: salt, expira: expira, tentativas: 0 });

    enviarEmail_(u.email, 'Recuperação de senha — app de decisões da igreja',
      'Olá, ' + u.nome + '!\n\nSeu código para criar uma nova senha é: ' + codigo +
      '\nEle vale por 30 minutos.\n' + (CONFIG.APP_URL ? 'Endereço: ' + CONFIG.APP_URL + '\n' : '') +
      '\nSe você não pediu isso, ignore esta mensagem.');

    // avisa o responsável da unidade (sem o código)
    emailsResponsaveis_(u.unidadeId).filter(function (e) { return e !== u.email; }).forEach(function (e) {
      enviarEmail_(e, 'Pedido de recuperação de senha — ' + u.nome,
        u.nome + ' (' + u.email + ') solicitou a recuperação de senha no app de decisões.\n' +
        'Um código foi enviado ao e-mail dele(a). Se a pessoa não receber, use "Redefinir senha" na aba Usuários.\n' +
        'Se você não reconhece este pedido, avise o administrador.');
    });
  }
  // mesma resposta exista ou não o e-mail (não revela quem é cadastrado)
  return { mensagem: 'Se o e-mail estiver cadastrado, enviamos um código válido por 30 minutos. Se não chegar, peça ao responsável da sua unidade para redefinir sua senha.' };
}

function redefinirComCodigo_(p) {
  const invalido = new ApiError('Código inválido ou expirado.', 'CODIGO');
  const email = email_(p.email);
  senhaForte_(p.novaSenha);
  const u = achaUsuarioPorEmail_(email);
  if (!u || !u.ativo) throw invalido;
  const rec = readAll_('Recuperacoes').filter(function (r) { return r.userId === u.id; })[0];
  if (!rec || String(rec.expira) <= now_() || Number(rec.tentativas) >= 5) throw invalido;
  if (hash_(String(p.codigo || '').trim(), rec.salt) !== rec.codigoHash) {
    updateRow_('Recuperacoes', rec._row, { tentativas: Number(rec.tentativas) + 1 });
    throw invalido;
  }
  const salt = uid_();
  updateRow_('Usuarios', u._row, { senhaHash: hash_(String(p.novaSenha), salt), salt: salt });
  deleteWhere_('Recuperacoes', function (r) { return r.userId === u.id; });
  deleteWhere_('Sessoes', function (s) { return s.userId === u.id; });
  return true;
}

function atualizarUsuario_(p, u) {
  const alvo = achaUsuario_(p.id);
  if (!alvo || !podeGerenciar_(u, alvo)) throw new ApiError('Você não pode editar este usuário.', 'PERMISSAO');
  const patch = {};
  if (p.nome !== undefined) patch.nome = str_(p.nome, 80, 'Nome');
  if (p.ativo !== undefined) patch.ativo = !!p.ativo;
  if (Array.isArray(p.permissoes) && alvo.papel !== 'admin') {
    patch.permissoes = permsFiltradas_(u, p.permissoes, alvo.papel).join(',');
  }
  if (u.papel === 'admin') {
    if (p.papel !== undefined && PAPEIS.indexOf(p.papel) >= 0) patch.papel = p.papel;
    if (p.unidadeId !== undefined) {
      if (p.unidadeId && !readAll_('Unidades').some(function (x) { return x.id === p.unidadeId; })) {
        throw new ApiError('Unidade inválida.', 'VALIDACAO');
      }
      patch.unidadeId = p.unidadeId;
    }
  }
  updateRow_('Usuarios', alvo._row, patch);
  if (patch.ativo === false) deleteWhere_('Sessoes', function (s) { return s.userId === alvo.id; });
  return { usuario: publicUser_(achaUsuario_(alvo.id), readAll_('Unidades'), false) };
}

function removerUsuario_(p, u) {
  const alvo = achaUsuario_(p.id);
  if (!alvo || !podeGerenciar_(u, alvo)) throw new ApiError('Você não pode remover este usuário.', 'PERMISSAO');
  deleteWhere_('Sessoes', function (s) { return s.userId === alvo.id; });
  sh_('Usuarios').deleteRow(alvo._row);
  return true;
}

function resetarSenha_(p, u) {
  const alvo = achaUsuario_(p.id);
  if (!alvo || !podeGerenciar_(u, alvo)) throw new ApiError('Você não pode redefinir a senha deste usuário.', 'PERMISSAO');
  const temp = senhaTemp_();
  const salt = uid_();
  updateRow_('Usuarios', alvo._row, { senhaHash: hash_(temp, salt), salt: salt, primeiroAcesso: true });
  deleteWhere_('Sessoes', function (s) { return s.userId === alvo.id; });
  return { senhaTemporaria: temp, emailEnviado: enviarEmailAcesso_(alvo.email, alvo.nome, temp) };
}

function criarUnidade_(p, u) {
  if (u.papel !== 'admin') throw new ApiError('Apenas o administrador pode criar unidades.', 'PERMISSAO');
  const nome = str_(p.nome, 80, 'Nome da unidade');
  if (readAll_('Unidades').some(function (x) { return String(x.nome).toLowerCase() === nome.toLowerCase(); })) {
    throw new ApiError('Já existe uma unidade com esse nome.', 'DUPLICADO');
  }
  const emailResp = p.emailResponsavel ? email_(p.emailResponsavel) : '';
  const id = uid_();
  appendRow_('Unidades', { id: id, nome: nome, emailResponsavel: emailResp });
  return { id: id, nome: nome, emailResponsavel: emailResp };
}

function atualizarUnidade_(p, u) {
  const un = readAll_('Unidades').filter(function (x) { return x.id === p.id; })[0];
  if (!un) throw new ApiError('Unidade não encontrada.', 'NAO_ENCONTRADO');
  const ehAdmin = u.papel === 'admin';
  if (!ehAdmin && !(u.unidadeId === un.id && can_(u, 'gerenciar_usuarios'))) {
    throw new ApiError('Você não pode editar esta unidade.', 'PERMISSAO');
  }
  const patch = {};
  if (p.emailResponsavel !== undefined) patch.emailResponsavel = p.emailResponsavel ? email_(p.emailResponsavel) : '';
  if (p.nome !== undefined && ehAdmin) {
    const nome = str_(p.nome, 80, 'Nome da unidade');
    if (readAll_('Unidades').some(function (x) { return x.id !== un.id && String(x.nome).toLowerCase() === nome.toLowerCase(); })) {
      throw new ApiError('Já existe uma unidade com esse nome.', 'DUPLICADO');
    }
    patch.nome = nome;
  }
  updateRow_('Unidades', un._row, patch);
  return true;
}

function removerUnidade_(p, u) {
  if (u.papel !== 'admin') throw new ApiError('Apenas o administrador pode remover unidades.', 'PERMISSAO');
  if (readAll_('Usuarios').some(function (m) { return m.unidadeId === p.id; })) {
    throw new ApiError('Há usuários nesta unidade. Mova-os antes de remover.', 'EM_USO');
  }
  if (readAll_('Pautas').some(function (x) { return x.unidadeId === p.id; }) ||
      readAll_('Prestacoes').some(function (x) { return x.unidadeId === p.id; })) {
    throw new ApiError('Esta unidade possui pautas ou prestações de contas e não pode ser removida.', 'EM_USO');
  }
  deleteWhere_('Unidades', function (x) { return x.id === p.id; });
  return true;
}

/* ============================ PRESTAÇÃO DE CONTAS ============================ */

function pastaUnidade_(unidade) {
  const props = PropertiesService.getScriptProperties();
  let raiz = null;
  const idRaiz = props.getProperty('PASTA_ID');
  if (idRaiz) { try { raiz = DriveApp.getFolderById(idRaiz); } catch (e) { raiz = null; } }
  if (!raiz) {
    raiz = DriveApp.createFolder(CONFIG.PASTA_PRESTACOES);
    props.setProperty('PASTA_ID', raiz.getId());
  }
  const it = raiz.getFoldersByName(unidade.nome);
  return it.hasNext() ? it.next() : raiz.createFolder(unidade.nome);
}

function unidadeAlvoPrestacao_(p, u) {
  const id = u.papel === 'admin' && p.unidadeId ? p.unidadeId : u.unidadeId;
  return id;
}

function listarPrestacoes_(p, u) {
  const unidades = readAll_('Unidades');
  const mapaU = porId_(unidades);
  const mapaUsr = porId_(readAll_('Usuarios'));
  const comentarios = readAll_('Comentarios');
  return readAll_('Prestacoes').filter(function (x) {
    if (u.papel === 'admin') return !p.unidadeId || x.unidadeId === p.unidadeId;
    return x.unidadeId === u.unidadeId;
  }).map(function (x) {
    return {
      id: x.id, unidadeId: x.unidadeId, unidadeNome: mapaU[x.unidadeId] ? mapaU[x.unidadeId].nome : '',
      mes: x.mes, nomeArquivo: x.nomeArquivo, observacao: x.observacao,
      enviadoPorNome: mapaUsr[x.enviadoPor] ? mapaUsr[x.enviadoPor].nome : '—', enviadoEm: x.enviadoEm,
      comentarios: comentarios.filter(function (c) { return c.prestacaoId === x.id; })
        .sort(function (a, b) { return String(a.data).localeCompare(String(b.data)); })
        .map(function (c) {
          return { id: c.id, texto: c.texto, data: c.data, userId: c.userId,
            autor: mapaUsr[c.userId] ? mapaUsr[c.userId].nome : 'Ex-membro' };
        })
    };
  }).sort(function (a, b) { return String(b.mes).localeCompare(String(a.mes)) || String(b.enviadoEm).localeCompare(String(a.enviadoEm)); });
}

function enviarPrestacao_(p, u) {
  exigir_(u, 'enviar_prestacao');
  const unidadeId = unidadeAlvoPrestacao_(p, u);
  const un = readAll_('Unidades').filter(function (x) { return x.id === unidadeId; })[0];
  if (!un) throw new ApiError('Unidade inválida.', 'VALIDACAO');
  const mes = String(p.mes || '');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw new ApiError('Informe o mês de referência.', 'VALIDACAO');
  const nome = str_(p.nomeArquivo, 120, 'Nome do arquivo').replace(/[\\/:*?"<>|]/g, '_');
  const ext = (nome.split('.').pop() || '').toLowerCase();
  if (!MIMES_OK[ext]) throw new ApiError('Tipo de arquivo não permitido. Use PDF, Excel, Word, CSV ou imagem.', 'ARQUIVO');
  const b64 = String(p.base64 || '');
  if (!b64) throw new ApiError('Selecione um arquivo.', 'ARQUIVO');
  const bytes = Utilities.base64Decode(b64);
  if (bytes.length > CONFIG.MAX_ARQUIVO_MB * 1024 * 1024) {
    throw new ApiError('O arquivo excede ' + CONFIG.MAX_ARQUIVO_MB + ' MB.', 'ARQUIVO');
  }
  const mime = MIMES_OK[ext];
  const nomeFinal = mes + ' - ' + nome;
  const arquivo = pastaUnidade_(un).createFile(Utilities.newBlob(bytes, mime, nomeFinal));
  const observacao = str_(p.observacao, 500, 'Observação', true);

  const existente = readAll_('Prestacoes').filter(function (x) { return x.unidadeId === unidadeId && x.mes === mes; })[0];
  if (existente) {
    try { DriveApp.getFileById(existente.arquivoId).setTrashed(true); } catch (e) { /* já removido */ }
    updateRow_('Prestacoes', existente._row, {
      nomeArquivo: nome, arquivoId: arquivo.getId(), mimeType: mime, observacao: observacao,
      enviadoPor: u.id, enviadoEm: now_()
    });
    return { id: existente.id, substituiu: true };
  }
  const id = uid_();
  appendRow_('Prestacoes', {
    id: id, unidadeId: unidadeId, mes: mes, nomeArquivo: nome, arquivoId: arquivo.getId(), mimeType: mime,
    observacao: observacao, enviadoPor: u.id, enviadoEm: now_()
  });
  return { id: id, substituiu: false };
}

function achaPrestacao_(id, u) {
  const x = readAll_('Prestacoes').filter(function (r) { return r.id === id; })[0];
  if (!x || (u.papel !== 'admin' && x.unidadeId !== u.unidadeId)) throw new ApiError('Prestação não encontrada.', 'NAO_ENCONTRADO');
  return x;
}

function baixarPrestacao_(p, u) {
  const x = achaPrestacao_(p.id, u);
  const blob = DriveApp.getFileById(x.arquivoId).getBlob();
  return { nomeArquivo: x.nomeArquivo, mimeType: x.mimeType, base64: Utilities.base64Encode(blob.getBytes()) };
}

function comentar_(p, u) {
  exigir_(u, 'comentar');
  const x = achaPrestacao_(p.prestacaoId, u);
  const texto = str_(p.texto, 500, 'Comentário');
  appendRow_('Comentarios', { id: uid_(), prestacaoId: x.id, userId: u.id, texto: texto, data: now_() });
  return true;
}

function removerComentario_(p, u) {
  const c = readAll_('Comentarios').filter(function (r) { return r.id === p.id; })[0];
  if (!c) throw new ApiError('Comentário não encontrado.', 'NAO_ENCONTRADO');
  const prest = achaPrestacao_(c.prestacaoId, u);
  const podeModerar = u.papel === 'admin' || (u.papel === 'responsavel' && prest.unidadeId === u.unidadeId);
  if (c.userId !== u.id && !podeModerar) throw new ApiError('Você não pode remover este comentário.', 'PERMISSAO');
  sh_('Comentarios').deleteRow(c._row);
  return true;
}
