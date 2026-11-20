import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import Estado from '../components/Estado.jsx';
import { baixarBase64, fileToBase64, fmtDataHora, fmtMes, hojeISO } from '../utils.js';

const MAX_MB = 10;

function Envio({ unidades, onEnviado }) {
  const { usuario } = useAuth();
  const ehAdmin = usuario.papel === 'admin';
  const [mes, setMes] = useState(hojeISO().slice(0, 7));
  const [arquivo, setArquivo] = useState(null);
  const [obs, setObs] = useState('');
  const [unidadeId, setUnidadeId] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setErro('');
    setOk('');
    if (!arquivo) return setErro('Selecione um arquivo.');
    if (arquivo.size > MAX_MB * 1024 * 1024) return setErro(`O arquivo excede ${MAX_MB} MB.`);
    setEnviando(true);
    try {
      const base64 = await fileToBase64(arquivo);
      const r = await api('enviarPrestacao', { mes, nomeArquivo: arquivo.name, base64, observacao: obs, unidadeId: ehAdmin ? unidadeId || undefined : undefined });
      setOk(r.substituiu ? 'Arquivo do mês substituído com sucesso.' : 'Prestação de contas enviada!');
      setArquivo(null);
      setObs('');
      e.target.reset();
      onEnviado();
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="cartao" onSubmit={enviar}>
      <h2>Enviar prestação de contas</h2>
      <div className="duas-col">
        <div>
          <label htmlFor="mes">Mês de referência</label>
          <input id="mes" type="month" required value={mes} onChange={(e) => setMes(e.target.value)} />
        </div>
        {ehAdmin && (
          <div>
            <label htmlFor="un">Unidade</label>
            <select id="un" value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}>
              <option value="">Minha unidade</option>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
        )}
      </div>
      <label htmlFor="arq">Arquivo (PDF, Excel, Word, CSV ou imagem — até {MAX_MB} MB)</label>
      <input id="arq" type="file" required accept=".pdf,.xlsx,.xls,.csv,.docx,.png,.jpg,.jpeg" onChange={(e) => setArquivo(e.target.files[0] || null)} />
      <label htmlFor="obs">Observação (opcional)</label>
      <input id="obs" maxLength={500} value={obs} onChange={(e) => setObs(e.target.value)} />
      <small className="muted">Se já existir um arquivo para o mesmo mês, ele será substituído e os comentários serão mantidos.</small>
      {erro && <div className="aviso aviso-erro" role="alert">{erro}</div>}
      {ok && <div className="aviso aviso-ok" role="status">{ok}</div>}
      <button className="btn btn-primario" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar'}</button>
    </form>
  );
}

function CartaoPrestacao({ p, onMudou }) {
  const { usuario, can } = useAuth();
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const moderador = usuario.papel === 'admin' || (usuario.papel === 'responsavel' && p.unidadeId === usuario.unidadeId);

  const baixar = async () => {
    setErro('');
    setOcupado(true);
    try {
      baixarBase64(await api('baixarPrestacao', { id: p.id }));
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  };

  const comentar = async (e) => {
    e.preventDefault();
    setErro('');
    setOcupado(true);
    try {
      await api('comentar', { prestacaoId: p.id, texto });
      setTexto('');
      await onMudou();
    } catch (err) {
      setErro(err.message);
    } finally {
      setOcupado(false);
    }
  };

  const remover = async (id) => {
    if (!window.confirm('Remover este comentário?')) return;
    try {
      await api('removerComentario', { id });
      await onMudou();
    } catch (err) {
      setErro(err.message);
    }
  };

  return (
    <article className="cartao">
      <div className="cartao-topo">
        <h3>{fmtMes(p.mes)}</h3>
        <span className="selo selo-neutro">{p.unidadeNome}</span>
      </div>
      <p className="arquivo">📄 {p.nomeArquivo}</p>
      {p.observacao && <p>{p.observacao}</p>}
      <p className="muted pequeno">Enviado por {p.enviadoPorNome} em {fmtDataHora(p.enviadoEm)}</p>
      <button className="btn btn-sutil" onClick={baixar} disabled={ocupado}>⬇ Baixar arquivo</button>

      <h4>Comentários ({p.comentarios.length})</h4>
      {p.comentarios.length === 0 && <p className="muted pequeno">Nenhum comentário ainda.</p>}
      <ul className="comentarios">
        {p.comentarios.map((c) => (
          <li key={c.id}>
            <div><strong>{c.autor}</strong> <span className="muted pequeno">{fmtDataHora(c.data)}</span></div>
            <p>{c.texto}</p>
            {(c.userId === usuario.id || moderador) && <button className="link" onClick={() => remover(c.id)}>remover</button>}
          </li>
        ))}
      </ul>
      {can('comentar') && (
        <form className="linha" onSubmit={comentar}>
          <input aria-label="Novo comentário" placeholder="Escreva um comentário…" maxLength={500} required value={texto} onChange={(e) => setTexto(e.target.value)} />
          <button className="btn btn-primario" disabled={ocupado}>Enviar</button>
        </form>
      )}
      {erro && <div className="aviso aviso-erro" role="alert">{erro}</div>}
    </article>
  );
}

export default function Prestacoes() {
  const { usuario, can } = useAuth();
  const ehAdmin = usuario.papel === 'admin';
  const [filtro, setFiltro] = useState('');
  const { dados: unidades } = useApi('unidades');
  const { dados: lista, erro, carregando, recarregar } = useApi('listarPrestacoes', { unidadeId: filtro || undefined }, [filtro]);

  return (
    <>
      <h1>Prestação de contas</h1>
      {can('enviar_prestacao') && <Envio unidades={unidades || []} onEnviado={recarregar} />}

      <div className="cabecalho">
        <h2>Histórico</h2>
        {ehAdmin && (
          <select aria-label="Filtrar por unidade" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todas as unidades</option>
            {(unidades || []).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        )}
      </div>
      <Estado carregando={carregando} erro={erro} onRetry={recarregar} vazio={lista && lista.length === 0 ? 'Nenhuma prestação de contas enviada ainda.' : ''} />
      <div className="grade">{(lista || []).map((p) => <CartaoPrestacao key={p.id} p={p} onMudou={recarregar} />)}</div>
    </>
  );
}
