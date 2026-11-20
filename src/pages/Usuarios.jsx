import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import Estado from '../components/Estado.jsx';
import { PAPEIS, PERMISSOES } from '../utils.js';

const CONCEDIVEIS = ['votar', 'criar_pauta', 'comentar', 'enviar_prestacao'];

function SenhaTemp({ info, onFechar }) {
  return (
    <div className="aviso aviso-ok" role="status">
      <strong>Senha temporária: </strong><code>{info.senhaTemporaria}</code>
      <p className="pequeno">
        {info.emailEnviado ? 'Também enviamos por e-mail. ' : 'Não foi possível enviar por e-mail. '}
        Repasse com segurança — ela será trocada no primeiro acesso e não aparecerá de novo.
      </p>
      <button className="link" onClick={onFechar}>Fechar</button>
    </div>
  );
}

function NovoUsuario({ unidades, onCriado }) {
  const { usuario } = useAuth();
  const ehAdmin = usuario.papel === 'admin';
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState('membro');
  const [unidadeId, setUnidadeId] = useState('');
  const [perms, setPerms] = useState(['votar', 'criar_pauta', 'comentar']);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const alternar = (p) => setPerms((a) => (a.includes(p) ? a.filter((x) => x !== p) : [...a, p]));

  const enviar = async (e) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const r = await api('criarUsuario', { nome, email, permissoes: perms, ...(ehAdmin ? { papel, unidadeId } : {}) });
      setNome(''); setEmail('');
      onCriado(r);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  };

  const listaPerms = ehAdmin ? Object.keys(PERMISSOES) : CONCEDIVEIS;

  return (
    <form className="cartao" onSubmit={enviar}>
      <h2>Adicionar usuário</h2>
      <div className="duas-col">
        <div><label htmlFor="nn">Nome</label><input id="nn" required maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div><label htmlFor="ne">E-mail</label><input id="ne" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      </div>
      {ehAdmin && (
        <div className="duas-col">
          <div>
            <label htmlFor="np">Papel</label>
            <select id="np" value={papel} onChange={(e) => setPapel(e.target.value)}>
              {Object.entries(PAPEIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="nu">Unidade (opcional)</label>
            <select id="nu" value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}>
              <option value="">A pessoa escolhe no primeiro acesso</option>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
        </div>
      )}
      <fieldset>
        <legend>Permissões</legend>
        {listaPerms.map((p) => (
          <label key={p} className="check"><input type="checkbox" checked={perms.includes(p)} onChange={() => alternar(p)} /> {PERMISSOES[p]}</label>
        ))}
      </fieldset>
      {erro && <div className="aviso aviso-erro" role="alert">{erro}</div>}
      <button className="btn btn-primario" disabled={enviando}>{enviando ? 'Criando…' : 'Criar usuário'}</button>
    </form>
  );
}

function LinhaUsuario({ u, onMudou, onSenha, euMesmo, ehAdmin }) {
  const [editando, setEditando] = useState(false);
  const [perms, setPerms] = useState(u.permissoes);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const exec = async (acao, params, confirmar) => {
    if (confirmar && !window.confirm(confirmar)) return null;
    setErro('');
    setOcupado(true);
    try {
      const r = await api(acao, { id: u.id, ...params });
      await onMudou();
      return r;
    } catch (e) {
      setErro(e.message);
      return null;
    } finally {
      setOcupado(false);
    }
  };

  const salvarPerms = async () => { if (await exec('atualizarUsuario', { permissoes: perms })) setEditando(false); };
  const alternar = (p) => setPerms((a) => (a.includes(p) ? a.filter((x) => x !== p) : [...a, p]));
  const lista = ehAdmin ? Object.keys(PERMISSOES) : CONCEDIVEIS;
  const gerenciavel = !euMesmo && (ehAdmin || u.papel === 'membro');

  return (
    <li className={'usuario' + (u.ativo ? '' : ' inativo')}>
      <div className="usuario-topo">
        <div>
          <strong>{u.nome}</strong> <span className="selo">{PAPEIS[u.papel]}</span>{!u.ativo && <span className="selo selo-neutro">Desativado</span>}{u.primeiroAcesso && <span className="selo selo-neutro">Aguardando 1º acesso</span>}
          <div className="muted pequeno">{u.email}{ehAdmin && ` · ${u.unidadeNome || 'sem unidade'}`}</div>
        </div>
        {gerenciavel && (
          <div className="linha">
            <button className="btn btn-sutil" disabled={ocupado} onClick={() => { setPerms(u.permissoes); setEditando(!editando); }}>Permissões</button>
            <button className="btn btn-sutil" disabled={ocupado} onClick={() => exec('atualizarUsuario', { ativo: !u.ativo })}>{u.ativo ? 'Desativar' : 'Reativar'}</button>
            <button className="btn btn-sutil" disabled={ocupado} onClick={async () => { const r = await exec('resetarSenha', {}, `Gerar nova senha temporária para ${u.nome}? Ela será desconectada.`); if (r) onSenha(r); }}>Redefinir senha</button>
            <button className="btn btn-perigo-sutil" disabled={ocupado} onClick={() => exec('removerUsuario', {}, `Remover ${u.nome} definitivamente?`)}>Remover</button>
          </div>
        )}
      </div>
      {editando && u.papel !== 'admin' && (
        <div className="editor-perms">
          {lista.map((p) => <label key={p} className="check"><input type="checkbox" checked={perms.includes(p)} onChange={() => alternar(p)} /> {PERMISSOES[p]}</label>)}
          <div className="linha"><button className="btn btn-primario" disabled={ocupado} onClick={salvarPerms}>Salvar</button><button className="btn btn-sutil" onClick={() => setEditando(false)}>Cancelar</button></div>
        </div>
      )}
      {editando && u.papel === 'admin' && <p className="muted pequeno">Administradores possuem todas as permissões.</p>}
      {erro && <div className="aviso aviso-erro" role="alert">{erro}</div>}
    </li>
  );
}

function LinhaUnidade({ u, ehAdmin, onMudou }) {
  const [email, setEmail] = useState(u.emailResponsavel || '');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);

  const salvar = async (e) => {
    e.preventDefault();
    setErro(''); setOk(false);
    try { await api('atualizarUnidade', { id: u.id, emailResponsavel: email.trim() }); setOk(true); await onMudou(); } catch (err) { setErro(err.message); }
  };
  const remover = async () => {
    if (!window.confirm(`Remover a unidade ${u.nome}?`)) return;
    setErro('');
    try { await api('removerUnidade', { id: u.id }); await onMudou(); } catch (err) { setErro(err.message); }
  };

  return (
    <li className="unidade">
      <div className="usuario-topo"><strong>{u.nome}</strong>{ehAdmin && <button className="link" onClick={remover}>remover</button>}</div>
      <form className="linha" onSubmit={salvar}>
        <input type="email" aria-label={`E-mail do responsável — ${u.nome}`} placeholder="E-mail do responsável (recebe avisos de recuperação de senha)" value={email} onChange={(e) => { setEmail(e.target.value); setOk(false); }} />
        <button className="btn btn-sutil">Salvar</button>
      </form>
      {ok && <div className="aviso aviso-ok" role="status">E-mail salvo.</div>}
      {erro && <div className="aviso aviso-erro" role="alert">{erro}</div>}
    </li>
  );
}

function Unidades({ unidades, ehAdmin, onMudou }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState('');

  const criar = async (e) => {
    e.preventDefault();
    setErro('');
    try { await api('criarUnidade', { nome, emailResponsavel: email.trim() || undefined }); setNome(''); setEmail(''); await onMudou(); } catch (err) { setErro(err.message); }
  };

  // só aparecem as unidades que o usuário pode administrar (a API envia o e-mail apenas para elas)
  const minhas = unidades.filter((u) => u.emailResponsavel !== undefined);

  return (
    <section className="cartao">
      <h2>{ehAdmin ? 'Unidades' : 'E-mail do responsável da unidade'}</h2>
      <p className="muted pequeno">Quando alguém pede para recuperar a senha, este e-mail recebe um aviso (sem o código). Se ficar em branco, o aviso vai para os usuários com papel Responsável da unidade.</p>
      <ul className="lista-unidades">
        {minhas.map((u) => <LinhaUnidade key={u.id} u={u} ehAdmin={ehAdmin} onMudou={onMudou} />)}
      </ul>
      {ehAdmin && (
        <form className="linha" onSubmit={criar}>
          <input aria-label="Nome da nova unidade" placeholder="Nome da nova unidade" required maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} />
          <input type="email" aria-label="E-mail do responsável da nova unidade" placeholder="E-mail do responsável (opcional)" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn btn-primario">Adicionar unidade</button>
        </form>
      )}
      {erro && <div className="aviso aviso-erro" role="alert">{erro}</div>}
    </section>
  );
}

export default function Usuarios() {
  const { usuario } = useAuth();
  const ehAdmin = usuario.papel === 'admin';
  const { dados: lista, erro, carregando, recarregar } = useApi('listarUsuarios');
  const { dados: unidades, recarregar: recarregarUnidades } = useApi('unidades');
  const [senha, setSenha] = useState(null);

  return (
    <>
      <h1>Usuários{!ehAdmin && ` da unidade ${usuario.unidadeNome}`}</h1>
      {senha && <SenhaTemp info={senha} onFechar={() => setSenha(null)} />}

      <NovoUsuario unidades={unidades || []} onCriado={(r) => { setSenha(r); recarregar(); }} />

      <h2>Membros</h2>
      <Estado carregando={carregando} erro={erro} onRetry={recarregar} vazio={lista && lista.length === 0 ? 'Nenhum usuário.' : ''} />
      <ul className="lista-usuarios">
        {(lista || []).map((u) => (
          <LinhaUsuario key={u.id} u={u} euMesmo={u.id === usuario.id} ehAdmin={ehAdmin} onMudou={recarregar} onSenha={setSenha} />
        ))}
      </ul>

      <Unidades unidades={unidades || []} ehAdmin={ehAdmin} onMudou={recarregarUnidades} />
    </>
  );
}
