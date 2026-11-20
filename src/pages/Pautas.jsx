import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useApi, usePautas } from '../hooks.js';
import Estado from '../components/Estado.jsx';
import { fmtData, hojeISO } from '../utils.js';

function NovaPauta({ onCriada, onCancelar }) {
  const { usuario } = useAuth();
  const ehAdmin = usuario.papel === 'admin';
  const { dados: unidades } = useApi('unidades');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState('');
  const [opcoesTxt, setOpcoesTxt] = useState('');
  const [unidadeId, setUnidadeId] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const opcoes = opcoesTxt.split('\n').map((s) => s.trim()).filter(Boolean);
      await api('criarPauta', { titulo, descricao, data, opcoes, unidadeId: ehAdmin ? unidadeId : undefined });
      onCriada();
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="cartao" onSubmit={enviar}>
      <h2>Nova sugestão de pauta</h2>
      <label htmlFor="t">Título *</label>
      <input id="t" maxLength={120} required value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Reforma do telhado do salão" />
      <label htmlFor="d">Descrição</label>
      <textarea id="d" rows={3} maxLength={1000} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Explique a proposta para ajudar na decisão" />
      <label htmlFor="o">Opções de voto (uma por linha)</label>
      <textarea id="o" rows={3} value={opcoesTxt} onChange={(e) => setOpcoesTxt(e.target.value)} placeholder={'Deixe em branco para usar:\nSim\nNão\nAbstenção'} />
      <label htmlFor="dt">Votação aberta até *</label>
      <input id="dt" type="date" min={hojeISO()} required value={data} onChange={(e) => setData(e.target.value)} />
      {ehAdmin && (
        <>
          <label htmlFor="un">Unidade</label>
          <select id="un" value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}>
            <option value="">Minha unidade</option>
            <option value="*">Todas as unidades</option>
            {(unidades || []).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </>
      )}
      {erro && <div className="aviso aviso-erro" role="alert">{erro}</div>}
      <div className="linha">
        <button className="btn btn-primario" disabled={enviando}>{enviando ? 'Criando…' : 'Criar pauta'}</button>
        <button type="button" className="btn btn-sutil" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}

function CartaoPauta({ p, onMudou }) {
  const { usuario, can } = useAuth();
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const podeAdm = usuario.papel === 'admin' || p.criadaPor === usuario.id ||
    (usuario.papel === 'responsavel' && p.unidadeId === usuario.unidadeId);

  const executar = async (acao, params, confirmar) => {
    if (confirmar && !window.confirm(confirmar)) return;
    setErro('');
    setOcupado(true);
    try {
      await api(acao, params);
      await onMudou();
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <article className="cartao">
      <div className="cartao-topo">
        <h3>{p.titulo}</h3>
        <span className={'selo ' + (p.encerrada ? 'selo-neutro' : 'selo-ok')}>{p.encerrada ? 'Encerrada' : 'Aberta'}</span>
      </div>
      {p.descricao && <p>{p.descricao}</p>}
      <p className="muted pequeno">
        Por {p.criadaPorNome} · {p.unidadeNome} · {p.encerrada ? `decidida em ${fmtData(p.dataDecisao)}` : `votação até ${fmtData(p.prazo)}`} · {p.totalVotos} de {p.elegiveis} votaram
      </p>

      {!p.encerrada && can('votar') && (
        <div className="opcoes" role="radiogroup" aria-label={'Voto em ' + p.titulo}>
          {p.opcoes.map((o) => (
            <button
              key={o}
              role="radio"
              aria-checked={p.meuVoto === o}
              className={'opcao' + (p.meuVoto === o ? ' marcada' : '')}
              disabled={ocupado}
              onClick={() => executar('votar', { pautaId: p.id, opcao: o })}
            >
              {p.meuVoto === o ? '✓ ' : ''}{o}
            </button>
          ))}
        </div>
      )}
      {!p.encerrada && p.meuVoto && <p className="muted pequeno">Seu voto: <strong>{p.meuVoto}</strong>. Você pode mudar até o fim da votação.</p>}
      {!p.encerrada && !can('votar') && <p className="muted pequeno">Você não tem permissão para votar.</p>}
      {p.encerrada && p.meuVoto && <p className="muted pequeno">Seu voto: {p.meuVoto}</p>}

      {erro && <div className="aviso aviso-erro" role="alert">{erro}</div>}
      {podeAdm && (
        <div className="linha">
          {!p.encerrada && <button className="btn btn-sutil" disabled={ocupado} onClick={() => executar('encerrarPauta', { pautaId: p.id }, 'Encerrar a votação agora? O resultado atual será a decisão.')}>Encerrar votação</button>}
          <button className="btn btn-perigo-sutil" disabled={ocupado} onClick={() => executar('removerPauta', { pautaId: p.id }, 'Remover esta pauta e todos os votos?')}>Remover</button>
        </div>
      )}
    </article>
  );
}

export default function Pautas() {
  const { can } = useAuth();
  const { dados: pautas, erro, carregando, recarregar } = usePautas();
  const [aba, setAba] = useState('abertas');
  const [criando, setCriando] = useState(false);

  const lista = (pautas || []).filter((p) => (aba === 'abertas' ? !p.encerrada : p.encerrada));

  return (
    <>
      <div className="cabecalho">
        <h1>Pautas</h1>
        {can('criar_pauta') && !criando && <button className="btn btn-primario" onClick={() => setCriando(true)}>+ Nova sugestão</button>}
      </div>

      {criando && <NovaPauta onCancelar={() => setCriando(false)} onCriada={() => { setCriando(false); setAba('abertas'); recarregar(); }} />}

      <div className="seg" role="tablist">
        <button role="tab" aria-selected={aba === 'abertas'} className={aba === 'abertas' ? 'ativa' : ''} onClick={() => setAba('abertas')}>Abertas</button>
        <button role="tab" aria-selected={aba === 'encerradas'} className={aba === 'encerradas' ? 'ativa' : ''} onClick={() => setAba('encerradas')}>Encerradas</button>
      </div>

      <Estado carregando={carregando} erro={erro} onRetry={recarregar} vazio={pautas && lista.length === 0 ? 'Nenhuma pauta por aqui.' : ''} />
      <div className="grade">
        {lista.map((p) => <CartaoPauta key={p.id} p={p} onMudou={recarregar} />)}
      </div>
    </>
  );
}
