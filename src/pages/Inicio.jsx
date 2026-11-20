import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { usePautas } from '../hooks.js';
import Estado from '../components/Estado.jsx';
import Resultado from '../components/Resultado.jsx';
import { fmtData, textoResultado } from '../utils.js';

export default function Inicio() {
  const { usuario, can } = useAuth();
  const { dados: pautas, erro, carregando, recarregar } = usePautas();

  const abertas = (pautas || []).filter((p) => !p.encerrada);
  const encerradas = (pautas || []).filter((p) => p.encerrada)
    .sort((a, b) => String(b.dataDecisao).localeCompare(String(a.dataDecisao)));
  const pendentes = abertas.filter((p) => !p.meuVoto);

  return (
    <>
      <h1>Olá, {usuario.nome.split(' ')[0]} 👋</h1>

      <Estado carregando={carregando} erro={erro} onRetry={recarregar} />

      {pautas && (
        <>
          <section className="resumo">
            <div className="stat"><strong>{abertas.length}</strong><span>pautas abertas</span></div>
            <div className="stat destaque"><strong>{can('votar') ? pendentes.length : 0}</strong><span>aguardando seu voto</span></div>
            <div className="stat"><strong>{encerradas.length}</strong><span>decisões tomadas</span></div>
          </section>

          {can('votar') && pendentes.length > 0 && (
            <div className="aviso aviso-info">
              Você tem {pendentes.length} pauta{pendentes.length > 1 ? 's' : ''} para votar. <Link to="/pautas">Ir votar →</Link>
            </div>
          )}

          <h2>Resultados das decisões</h2>
          <Estado vazio={encerradas.length === 0 ? 'Ainda não há decisões encerradas.' : ''} />
          <div className="grade">
            {encerradas.map((p) => (
              <article key={p.id} className="cartao">
                <div className="cartao-topo">
                  <h3>{p.titulo}</h3>
                  <span className={'selo ' + (p.resultado === 'definida' ? 'selo-ok' : 'selo-neutro')}>{textoResultado(p)}</span>
                </div>
                <p className="muted pequeno">Decidida em {fmtData(p.dataDecisao)} · {p.unidadeNome} · {p.totalVotos} de {p.elegiveis} votaram</p>
                <Resultado pauta={p} />
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}
