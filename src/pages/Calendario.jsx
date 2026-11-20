import { useMemo, useState } from 'react';
import { usePautas } from '../hooks.js';
import Estado from '../components/Estado.jsx';
import Resultado from '../components/Resultado.jsx';
import { DIAS_SEMANA, MESES, fmtData, hojeISO, textoResultado } from '../utils.js';

const iso = (a, m, d) => `${a}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export default function Calendario() {
  const { dados: pautas, erro, carregando, recarregar } = usePautas();
  const hoje = hojeISO();
  const [ano, setAno] = useState(Number(hoje.slice(0, 4)));
  const [mes, setMes] = useState(Number(hoje.slice(5, 7)) - 1);
  const [dia, setDia] = useState(hoje);

  // cada pauta aparece na data da decisão (encerradas) ou no prazo (abertas)
  const porDia = useMemo(() => {
    const m = {};
    (pautas || []).forEach((p) => {
      const d = String(p.encerrada ? p.dataDecisao : p.prazo).slice(0, 10);
      (m[d] = m[d] || []).push(p);
    });
    return m;
  }, [pautas]);

  const primeiro = new Date(ano, mes, 1).getDay();
  const total = new Date(ano, mes + 1, 0).getDate();
  const celulas = [...Array(primeiro).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];

  const navegar = (delta) => {
    const d = new Date(ano, mes + delta, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth());
  };

  const doDia = porDia[dia] || [];

  return (
    <>
      <h1>Calendário de decisões</h1>
      <Estado carregando={carregando} erro={erro} onRetry={recarregar} />

      <div className="cal-layout">
        <section className="cartao cal">
          <div className="cal-topo">
            <button className="btn btn-sutil" onClick={() => navegar(-1)} aria-label="Mês anterior">‹</button>
            <strong>{MESES[mes]} {ano}</strong>
            <button className="btn btn-sutil" onClick={() => navegar(1)} aria-label="Próximo mês">›</button>
          </div>
          <div className="cal-grade" role="grid">
            {DIAS_SEMANA.map((d) => <div key={d} className="cal-cab" role="columnheader">{d}</div>)}
            {celulas.map((d, i) => {
              if (!d) return <div key={'v' + i} />;
              const data = iso(ano, mes, d);
              const itens = porDia[data] || [];
              const abertas = itens.filter((p) => !p.encerrada).length;
              const enc = itens.length - abertas;
              return (
                <button
                  key={data}
                  className={'cal-dia' + (data === hoje ? ' hoje' : '') + (data === dia ? ' sel' : '')}
                  onClick={() => setDia(data)}
                  aria-label={`${fmtData(data)}: ${itens.length} pauta${itens.length === 1 ? '' : 's'}`}
                >
                  <span>{d}</span>
                  <span className="pontos" aria-hidden>
                    {abertas > 0 && <i className="ponto aberta" />}
                    {enc > 0 && <i className="ponto enc" />}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="legenda"><i className="ponto aberta" /> Votação aberta (prazo) &nbsp; <i className="ponto enc" /> Decisão tomada</p>
        </section>

        <section>
          <h2>{fmtData(dia)}</h2>
          {doDia.length === 0 && <p className="muted">Nenhuma pauta nesta data.</p>}
          {doDia.map((p) => (
            <article key={p.id} className="cartao">
              <div className="cartao-topo">
                <h3>{p.titulo}</h3>
                <span className={'selo ' + (p.encerrada ? 'selo-ok' : 'selo-neutro')}>{p.encerrada ? textoResultado(p) : 'Prazo de votação'}</span>
              </div>
              {p.descricao && <p>{p.descricao}</p>}
              <p className="muted pequeno">{p.unidadeNome} · {p.totalVotos} de {p.elegiveis} votaram</p>
              <Resultado pauta={p} />
            </article>
          ))}
        </section>
      </div>
    </>
  );
}
